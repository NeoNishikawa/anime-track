// config.js
const CONFIG = {
    // Kosongkan agar menggunakan domain yang sama dengan frontend
    BACKEND_URL: "",
    STORAGE_KEY: "animeTodoList",
    CACHE_PREFIX: "animeCache_",
    CACHE_TTL: 1000 * 60 * 60,
    SEARCH_DEBOUNCE_MS: 500,
};

const STATUS_LABEL = {
    plan_to_watch: "Plan to Watch",
    watching: "Watching",
    completed: "Completed",
};
