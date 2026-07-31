// ===========================================================
// STORAGE — localStorage untuk to-do list user + cache hasil API
// (gambar TIDAK pernah disimpan lokal, cuma URL-nya yang di-cache)
// ===========================================================

const Storage = {
    loadList() {
        try {
            return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    },

    saveList(list) {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(list));
    },

    getCache(key) {
        try {
            const raw = localStorage.getItem(CONFIG.CACHE_PREFIX + key);
            if (!raw) return null;
            const { data, timestamp } = JSON.parse(raw);
            if (Date.now() - timestamp > CONFIG.CACHE_TTL) {
                localStorage.removeItem(CONFIG.CACHE_PREFIX + key);
                return null;
            }
            return data;
        } catch {
            return null;
        }
    },

    setCache(key, data) {
        try {
            localStorage.setItem(
                CONFIG.CACHE_PREFIX + key,
                JSON.stringify({ data, timestamp: Date.now() })
            );
        } catch {
            // localStorage penuh / private mode — abaikan, bukan fatal
        }
    },

    // ---------- PROGRESS EPISODE (per anime, disimpen terpisah dari to-do list) ----------
    PROGRESS_KEY: "animeProgress",

    getProgress(animeId) {
        try {
            const all = JSON.parse(localStorage.getItem(this.PROGRESS_KEY)) || {};
            return all[animeId] || { watched: [] };
        } catch {
            return { watched: [] };
        }
    },

    toggleEpisodeWatched(animeId, episodeNumber) {
        try {
            const all = JSON.parse(localStorage.getItem(this.PROGRESS_KEY)) || {};
            const current = all[animeId] || { watched: [] };
            const idx = current.watched.indexOf(episodeNumber);
            if (idx === -1) current.watched.push(episodeNumber);
            else current.watched.splice(idx, 1);
            all[animeId] = current;
            localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(all));
            return current;
        } catch {
            return { watched: [] };
        }
    },
};
