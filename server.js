require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { animasu } = require('yaoi');
const axios = require('axios');
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

axios.defaults.timeout = 30000;
    
// ============================================================
// AUTO-DETECT PUBLIC DIRECTORY
// ============================================================
function findPublicDir() {
    // Kemungkinan lokasi index.html
    const candidates = [
        path.join(__dirname, ".."),          // satu level di atas backend (root proyek)
        __dirname,                           // di dalam folder backend
    ];

    for (const dir of candidates) {
        const indexPath = path.join(dir, "index.html");
        if (fs.existsSync(indexPath)) {
            console.log(`[Server] Found index.html in: ${dir}`);
            return dir;
        }
    }

    // Jika tidak ditemukan, fallback ke __dirname (folder backend)
    console.warn("[Server] index.html not found, using __dirname as fallback");
    return __dirname;
}

const publicDir = findPublicDir();
console.log(`[Server] Public directory: ${publicDir}`);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// ============================================================
// FUNGSI PENCARIAN CERDAS
// ============================================================
const STOPWORDS = new Set([
    'of', 'the', 'and', 'a', 'an', 'for', 'on', 'at', 'to', 'in',
    'with', 'without', 'but', 'or', 'yet', 'so', 'as', 'up', 'down',
    'by', 'from', 'into', 'through', 'during', 'including', 'season',
    'part', 'movie', 'special', 'ova', 'ona'
]);

async function findAnimeByTitle(title) {
    console.log(`[Search] Mencoba: "${title}"`);
    let result = await animasu.getAnimes({ search: title, page: 1 });
    if (result.data && result.data.length > 0) {
        console.log(`[Search] Ditemukan: ${result.data[0].title}`);
        return result.data[0];
    }

    const words = title.split(/\s+/);
    const filtered = words.filter(w => w.length > 1 && !STOPWORDS.has(w.toLowerCase()));
    if (filtered.length > 0) {
        const cleaned = filtered.join(' ');
        if (cleaned !== title) {
            console.log(`[Search] Mencoba (tanpa stopwords): "${cleaned}"`);
            result = await animasu.getAnimes({ search: cleaned, page: 1 });
            if (result.data && result.data.length > 0) {
                console.log(`[Search] Ditemukan: ${result.data[0].title}`);
                return result.data[0];
            }
        }
    }

    const sorted = filtered.sort((a, b) => b.length - a.length);
    for (const word of sorted) {
        if (word.length < 3) continue;
        console.log(`[Search] Mencoba kata: "${word}"`);
        result = await animasu.getAnimes({ search: word, page: 1 });
        if (result.data && result.data.length > 0) {
            console.log(`[Search] Ditemukan: ${result.data[0].title}`);
            return result.data[0];
        }
    }
    return null;
}

// ============================================================
// ENDPOINT: PENCARIAN ANIME (SEMUA HALAMAN)
// ============================================================
app.get('/api/animes', async (req, res) => {
    const { search, page, sort } = req.query;
    console.log(`[API] /api/animes search="${search}" page=${page || 1}`);

    try {
        let allData = [];
        let currentPage = parseInt(page) || 1;
        let hasNext = true;
        const maxPages = 10;

        while (hasNext && currentPage - parseInt(page || 1) < maxPages) {
            const result = await animasu.getAnimes({
                search: search || '',
                page: currentPage,
                sort: sort || 'update',
            });
            if (result.data && result.data.length > 0) {
                allData = allData.concat(result.data);
            }
            hasNext = result.hasNext;
            currentPage++;
        }

        const unique = [];
        const seen = new Set();
        allData.forEach(item => {
            if (!seen.has(item.slug)) {
                seen.add(item.slug);
                unique.push(item);
            }
        });

        console.log(`[API] /api/animes mengembalikan ${unique.length} hasil`);
        res.json({ data: unique, hasNext: false, error: null });
    } catch (err) {
        console.error('[API] /api/animes error:', err);
        res.status(500).json({ data: [], error: err.message });
    }
});

// ============================================================
// ENDPOINT: DETAIL ANIME
// ============================================================
app.get('/api/anime/:slug', async (req, res) => {
    const { slug } = req.params;
    console.log(`[API] /api/anime/${slug}`);
    try {
        const detail = await animasu.getAnime(slug);
        if (!detail) {
            return res.status(404).json({ error: 'Anime tidak ditemukan' });
        }
        detail.slug = slug;
        res.json({ data: detail, error: null });
    } catch (err) {
        console.error(`[API] /api/anime/${slug} error:`, err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// ENDPOINT: STREAMING BULK (dengan slug opsional) - OPTIMASI PARALEL
// ============================================================
app.post('/api/streams/bulk', async (req, res) => {
    const { title, totalEpisodes, slug } = req.body;
    console.log(`[Bulk] Request: title="${title}", totalEpisodes=${totalEpisodes}, slug="${slug}"`);

    if (!title || !totalEpisodes) {
        return res.status(400).json({ error: 'Parameter title dan totalEpisodes diperlukan' });
    }

    try {
        let animeSlug = slug;
        let animeTitle = title;

        if (!animeSlug) {
            const anime = await findAnimeByTitle(title);
            if (!anime) {
                console.log(`[Bulk] Anime tidak ditemukan untuk judul: "${title}"`);
                return res.json({ data: [], error: 'Anime tidak ditemukan di YaoiAPI' });
            }
            animeSlug = anime.slug;
            animeTitle = anime.title;
        }

        console.log(`[Bulk] Menggunakan slug: ${animeSlug}`);
        const detail = await animasu.getAnime(animeSlug, { noCache: false });

        if (!detail || !detail.episodes || detail.episodes.length === 0) {
            console.log(`[Bulk] Tidak ada episode untuk anime: ${animeTitle}`);
            return res.json({ data: [], error: 'Tidak ada episode ditemukan' });
        }

        const episodes = detail.episodes.slice().reverse();
        const maxEp = Math.min(totalEpisodes, episodes.length);

        const episodeData = [];
        const batchSize = 5;

        for (let i = 0; i < maxEp; i += batchSize) {
            const batch = episodes.slice(i, i + batchSize);
            const promises = batch.map(async (ep, idx) => {
                const epNum = i + idx + 1;
                try {
                    const streams = await animasu.getStreams(ep.slug);
                    const streamUrl = streams.length > 0 ? streams[0].url : null;
                    return {
                        episode: epNum,
                        title: ep.episode || `Episode ${epNum}`,
                        slug: ep.slug,
                        url: streamUrl,
                        thumbnail: null,
                    };
                } catch (err) {
                    return {
                        episode: epNum,
                        title: ep.episode || `Episode ${epNum}`,
                        slug: ep.slug,
                        url: null,
                        thumbnail: null,
                    };
                }
            });
            const results = await Promise.all(promises);
            episodeData.push(...results);
        }

        console.log(`[Bulk] Selesai, ${episodeData.filter(e => e.url).length} episode memiliki link.`);
        res.json({ data: episodeData, error: null });
    } catch (err) {
        console.error('[Bulk] Error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// ============================================================
// ENDPOINT: JADWAL TAYANG HARI INI
// ============================================================
app.get('/api/schedule', async (req, res) => {
    console.log('[API] /api/schedule');
    try {
        const dayMap = { 0: 'minggu', 1: 'senin', 2: 'selasa', 3: 'rabu', 4: 'kamis', 5: 'jumat', 6: 'sabtu' };
        const now = new Date();
        const day = dayMap[now.getDay()];
        console.log(`[API] Hari ini: ${day}`);

        const animes = await animasu.getAnimesByDay(day);
        console.log(`[API] /api/schedule mengembalikan ${animes.length} anime`);
        res.json({ data: animes, error: null });
    } catch (err) {
        console.error('[API] /api/schedule error:', err);
        res.status(500).json({ data: [], error: err.message });
    }
});

// ============================================================
// ENDPOINT: STREAMING PER EPISODE
// ============================================================
app.get('/api/streams/:episodeSlug', async (req, res) => {
    const { episodeSlug } = req.params;
    console.log(`[API] /api/streams/${episodeSlug}`);
    try {
        const streams = await animasu.getStreams(episodeSlug);
        res.json({ data: streams, error: null });
    } catch (err) {
        console.error(`[API] /api/streams/${episodeSlug} error:`, err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// ============================================================
// FALLBACK: Semua request non-API -> index.html
// ============================================================
app.get("*", (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint tidak ditemukan' });
    }

    const indexPath = path.join(publicDir, "index.html");
    console.log(`[Fallback] Mencoba mengirim: ${indexPath}`);

    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("index.html tidak ditemukan");
    }
});

// ============================================================
// JALANKAN SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`Backend YaoiAPI running on http://localhost:${PORT}`);
    console.log(`Root URL: http://localhost:${PORT}/`);
});