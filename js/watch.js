// watch.js (versi fix)
const WatchApp = {
    slug: null,
    anime: null,
    episodes: [],
    progress: { watched: [] },
    currentEpisode: 1,
    totalEpisodes: 0,

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.slug = params.get('slug');
        const ep = params.get('ep');
        if (ep) this.currentEpisode = parseInt(ep) || 1;

        if (!this.slug) {
            document.getElementById('episodeList').innerHTML = '<p class="empty">Slug anime tidak ditemukan.</p>';
            return;
        }

        const { data: anime, error } = await YaoiAPI.fetchAnimeDetail(this.slug);
        if (error || !anime) {
            document.getElementById('episodeList').innerHTML = `<p class="empty">${error || 'Gagal memuat anime.'}</p>`;
            return;
        }

        this.anime = anime;
        document.getElementById('watchAnimeTitle').textContent = anime.title;

        const totalEp = parseInt(anime.episode) || 0;
        if (totalEp === 0) {
            document.getElementById('episodeList').innerHTML = '<p class="empty">Tidak ada episode untuk anime ini.</p>';
            return;
        }

        const { data: yaoiEpisodes, error: yaoiError } = await YaoiAPI.fetchAllStreams(
            anime.title,
            totalEp,
            this.slug
        );

        if (yaoiError || !yaoiEpisodes || yaoiEpisodes.length === 0) {
            document.getElementById('episodeList').innerHTML = `<p class="empty">${yaoiError || 'Tidak ada link streaming.'}</p>`;
            return;
        }

        this.episodes = yaoiEpisodes;
        this.totalEpisodes = this.episodes.length;
        this.progress = Storage.getProgress(this.slug);

        this.renderEpisodeList();
        this.loadEpisode(this.currentEpisode);
        document.getElementById('backToDetail').href = `anime.html?slug=${this.slug}`;
        this.updateProgressCount();
    },

    renderEpisodeList() {
        const container = document.getElementById('episodeList');
        const watchedSet = new Set(this.progress.watched);

        container.innerHTML = this.episodes
            .map((ep, index) => {
                const epNum = index + 1;
                const isWatched = watchedSet.has(epNum);
                const isActive = epNum === this.currentEpisode;
                const hasUrl = ep.url !== null;

                return `
                <div class="episode-row ${isWatched ? 'watched' : ''} ${isActive ? 'active' : ''}" data-ep="${epNum}">
                    <span class="episode-num">Ep ${epNum}</span>
                    <span class="episode-title">${ep.title || `Episode ${epNum}`}</span>
                    <span class="episode-status">${hasUrl ? 'Tersedia' : 'Tidak ada'}</span>
                    <input type="checkbox" class="episode-watched-toggle" data-ep="${epNum}" ${isWatched ? 'checked' : ''}>
                </div>`;
            })
            .join('');

        container.querySelectorAll('.episode-row').forEach(row => {
            row.addEventListener('click', e => {
                if (e.target.classList.contains('episode-watched-toggle')) return;
                const ep = parseInt(row.dataset.ep);
                this.loadEpisode(ep);
            });
        });

        container.querySelectorAll('.episode-watched-toggle').forEach(cb => {
            cb.addEventListener('change', e => {
                e.stopPropagation();
                const ep = parseInt(e.target.dataset.ep);
                this.toggleWatched(ep);
            });
        });
    },

    loadEpisode(epNum) {
        const episode = this.episodes[epNum - 1];
        if (!episode) {
            document.getElementById('videoPlayer').src = '';
            document.getElementById('currentEpisodeLabel').textContent = 'Episode tidak ditemukan';
            return;
        }

        this.currentEpisode = epNum;
        const iframe = document.getElementById('videoPlayer');
        iframe.src = episode.url || '';
        document.getElementById('currentEpisodeLabel').textContent =
            `${this.anime.title} - Episode ${epNum}`;

        document.querySelectorAll('.episode-row').forEach(row => {
            row.classList.toggle('active', parseInt(row.dataset.ep) === epNum);
        });

        const url = new URL(window.location);
        url.searchParams.set('ep', epNum);
        window.history.pushState({}, '', url);
    },

    toggleWatched(epNum) {
        const updated = Storage.toggleEpisodeWatched(this.slug, epNum);
        this.progress = updated;

        const row = document.querySelector(`.episode-row[data-ep="${epNum}"]`);
        if (row) row.classList.toggle('watched', updated.watched.includes(epNum));

        this.updateProgressCount();
    },

    updateProgressCount() {
        const watched = this.progress.watched.length;
        const total = this.totalEpisodes || this.anime?.episode || '?';
        document.getElementById('epsCount').textContent = `${watched} / ${total}`;
    }
};

document.addEventListener('DOMContentLoaded', () => WatchApp.init());