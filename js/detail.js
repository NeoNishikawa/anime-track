// ============================================================
// DETAIL — menggunakan YaoiAPI (Animasu)
// ============================================================

function getSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderError(message) {
    const loading = document.getElementById('detailLoading');
    if (loading) loading.remove();

    const wrap = document.getElementById('detailWrap');
    if (!wrap) {
        // Jika wrap tidak ada, buat elemen baru
        document.body.innerHTML = `<div class="detail-wrap"><p class="detail-error">${escapeHtml(message)}</p></div>`;
        return;
    }
    wrap.insertAdjacentHTML('beforeend', `<p class="detail-error">${escapeHtml(message)}</p>`);
}

async function init() {
    const slug = getSlugFromUrl();
    if (!slug) {
        renderError('Slug anime tidak ditemukan di URL.');
        return;
    }

    // Pastikan elemen detailWrap ada
    const wrap = document.getElementById('detailWrap');
    if (!wrap) {
        document.body.innerHTML = `<div class="detail-wrap"><p class="detail-error">Error: Halaman tidak lengkap.</p></div>`;
        return;
    }

    const { data: anime, error } = await YaoiAPI.fetchAnimeDetail(slug);
    const loading = document.getElementById('detailLoading');
    if (loading) loading.remove();

    if (error || !anime) {
        renderError(error || 'Anime tidak ditemukan.');
        return;
    }

    // Ambil link streaming
    let yaoiEpisodes = null;
    const totalEp = parseInt(anime.episode) || 0;
    if (totalEp > 0) {
        const { data, error: streamErr } = await YaoiAPI.fetchAllStreams(
            anime.title,
            totalEp,
            slug  // kirim slug agar backend tidak perlu cari ulang
        );
        if (!streamErr && data) {
            yaoiEpisodes = data;
        } else {
            console.warn('Stream error:', streamErr);
        }
    }

    const progress = Storage.getProgress(slug);
    const animeList = Storage.loadList();
    const savedItem = animeList.find(a => a.slug === slug);

    const genres = anime.genres?.map(g => g.name).join(', ') || '-';
    const seasonLabel = `${anime.season || ''} ${anime.aired || ''}`.trim() || '-';

    // Hapus loading
    const existingError = wrap.querySelector('.detail-error');
    if (existingError) existingError.remove();

    wrap.insertAdjacentHTML('beforeend', `
        <div class="detail-hero">
            <img class="detail-banner" src="${escapeHtml(anime.image)}" alt="">
            <div class="detail-hero-content">
                <img class="detail-cover" src="${escapeHtml(anime.image)}" alt="${escapeHtml(anime.title)}">
                <div class="detail-info">
                    <h1 class="detail-title">${escapeHtml(anime.title)}</h1>
                    <div class="detail-tags">
                        ${anime.genres?.map(g => `<span class="detail-tag">${escapeHtml(g.name)}</span>`).join('') || ''}
                    </div>
                    <p class="detail-meta-line">Rating ${anime.rating || '?'} · ${anime.episode || '?'} episode · ${seasonLabel} · Studio ${escapeHtml(anime.studio || '-')}</p>

                    <div class="detail-actions">
                        <select class="detail-status-select" id="statusSelect">
                            <option value="">${savedItem ? 'Pilih status' : '+ Tambah ke List'}</option>
                            <option value="plan_to_watch" ${savedItem?.status === 'plan_to_watch' ? 'selected' : ''}>Plan to Watch</option>
                            <option value="watching" ${savedItem?.status === 'watching' ? 'selected' : ''}>Watching</option>
                            <option value="completed" ${savedItem?.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                        ${savedItem ? `<button class="detail-remove-btn" id="removeBtn">Hapus dari List</button>` : ''}
                    </div>
                </div>
            </div>
        </div>

        ${anime.trailer ? `
        <div class="detail-section">
            <h3>Trailer</h3>
            <div class="trailer-frame-wrap">
                <iframe src="${escapeHtml(anime.trailer)}" title="Trailer" allowfullscreen loading="lazy"></iframe>
            </div>
        </div>` : ''}

        <div class="detail-section">
            <h3>Sinopsis</h3>
            <p class="detail-desc">${escapeHtml(anime.synopsis || 'Belum ada sinopsis.')}</p>
        </div>

        <div class="detail-section">
            <div class="progress-head">
                <h3>Episode</h3>
                <span class="progress-count" id="progressCount">${progress.watched.length} / ${totalEp || '?'} ditonton</span>
            </div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" id="progressBarFill" style="width: ${totalEp ? (progress.watched.length / totalEp) * 100 : 0}%"></div>
            </div>
            <div class="episode-list" id="episodeList"></div>
        </div>
    `);

    // Render episode
    renderEpisodeList(anime, progress, yaoiEpisodes);
    setupStatusControl(anime);
}

function renderEpisodeList(anime, progress, yaoiEpisodes) {
    const container = document.getElementById('episodeList');
    if (!container) return;

    if (!yaoiEpisodes || yaoiEpisodes.length === 0) {
        container.innerHTML = `<p class="empty">Tidak ada link streaming dari Animasu untuk anime ini.</p>`;
        return;
    }

    container.innerHTML = yaoiEpisodes
        .map(ep => {
            const isWatched = progress.watched.includes(ep.episode);
            const linkHtml = ep.url
                ? `<a class="episode-watch-link" href="watch.html?slug=${anime.slug}&ep=${ep.episode}" target="_self">Tonton →</a>`
                : `<span class="episode-watch-link disabled">Belum ada link</span>`;
            return `
            <div class="episode-row ${isWatched ? 'watched' : ''}" data-ep="${ep.episode}">
                <input type="checkbox" class="episode-watched-toggle" data-ep="${ep.episode}" ${isWatched ? 'checked' : ''}>
                <span class="episode-num">Ep ${ep.episode}</span>
                <span class="episode-title">${escapeHtml(ep.title)}</span>
                ${linkHtml}
            </div>`;
        })
        .join('');

    container.querySelectorAll('.episode-watched-toggle').forEach((cb) => {
        cb.addEventListener('change', () => {
            const ep = Number(cb.dataset.ep);
            const updated = Storage.toggleEpisodeWatched(anime.slug, ep);
            cb.closest('.episode-row').classList.toggle('watched', updated.watched.includes(ep));
            const countEl = document.getElementById('progressCount');
            if (countEl) {
                const total = parseInt(anime.episode) || 0;
                countEl.textContent = `${updated.watched.length} / ${total || '?'} ditonton`;
            }
            const fillEl = document.getElementById('progressBarFill');
            if (fillEl) {
                const total = parseInt(anime.episode) || 0;
                const pct = total ? (updated.watched.length / total) * 100 : 0;
                fillEl.style.width = `${pct}%`;
            }
        });
    });
}

function setupStatusControl(anime) {
    const select = document.getElementById('statusSelect');
    const removeBtn = document.getElementById('removeBtn');

    if (select) {
        select.addEventListener('change', () => {
            const status = select.value;
            if (!status) return;
            let list = Storage.loadList();
            const exists = list.find(a => a.slug === anime.slug);
            if (exists) {
                exists.status = status;
            } else {
                list.push({
                    slug: anime.slug,
                    title: anime.title,
                    image: anime.image,
                    episodes: anime.episode || '?',
                    score: anime.rating || '-',
                    status,
                });
            }
            Storage.saveList(list);
            location.reload();
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            let list = Storage.loadList();
            list = list.filter(a => a.slug !== anime.slug);
            Storage.saveList(list);
            location.reload();
        });
    }
}

document.addEventListener('DOMContentLoaded', init);