// ============================================================
// API — SEMUA DATA DARI YAOIAPI (via backend)
// ============================================================

// Tentukan base URL: jika BACKEND_URL kosong, pakai origin dari browser
const baseUrl = CONFIG.BACKEND_URL || window.location.origin;

const YaoiAPI = {
    // ---------- PENCARIAN ----------
    async searchAnime(query) {
        const q = query.trim();
        if (!q) return { data: [], error: null };

        const cacheKey = `search_${q.toLowerCase()}`;
        const cached = Storage.getCache(cacheKey);
        if (cached) return { data: cached, error: null };

        try {
            // Gunakan string concatenation biasa, bukan new URL()
            const url = `${baseUrl}/api/animes?search=${encodeURIComponent(q)}&page=1`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            Storage.setCache(cacheKey, json.data);
            return { data: json.data, error: null };
        } catch (err) {
            console.error('Search error:', err);
            return { data: [], error: err.message };
        }
    },

    // ---------- DETAIL ANIME ----------
    async fetchAnimeDetail(slug) {
        const cacheKey = `detail_${slug}`;
        const cached = Storage.getCache(cacheKey);
        if (cached) return { data: cached, error: null };

        try {
            const url = `${baseUrl}/api/anime/${slug}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            Storage.setCache(cacheKey, json.data);
            return { data: json.data, error: null };
        } catch (err) {
            console.error('Detail error:', err);
            return { data: null, error: err.message };
        }
    },

    // ---------- STREAMING BULK ----------
    async fetchAllStreams(title, totalEpisodes, slug = null) {
        if (!title || !totalEpisodes) return { data: null, error: 'Parameter tidak lengkap' };

        const cacheKey = `streams_${(slug || title).toLowerCase().replace(/\s/g, '_')}`;
        const cached = Storage.getCache(cacheKey);
        if (cached) return { data: cached, error: null };

        try {
            const url = `${baseUrl}/api/streams/bulk`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, totalEpisodes, slug }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            Storage.setCache(cacheKey, json.data);
            return { data: json.data, error: null };
        } catch (err) {
            console.error('Stream error:', err);
            return { data: null, error: err.message };
        }
    },

    // ---------- JADWAL TAYANG HARI INI ----------
    async fetchTodaySchedule() {
        const cacheKey = `schedule_${new Date().toDateString()}`;
        const cached = Storage.getCache(cacheKey);
        if (cached) return { data: cached, error: null };

        try {
            const url = `${baseUrl}/api/schedule`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            const data = json.data.map(a => ({
                slug: a.slug,
                title: a.title,
                image: a.image,
                type: a.type,
                episode: a.episode,
                status: a.status,
                broadcastTime: `Hari ini · ${a.type || 'TV'}`,
            }));
            Storage.setCache(cacheKey, data);
            return { data, error: null };
        } catch (err) {
            console.error('Schedule error:', err);
            return { data: [], error: err.message };
        }
    },
};

// Untuk kompatibilitas
const AniListAPI = YaoiAPI;
