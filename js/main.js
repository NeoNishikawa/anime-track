// ===========================================================
// MAIN — state aplikasi + event listeners + init
// ===========================================================

const App = {
    animeList: Storage.loadList(),
    currentFilter: "all",
    todaySchedule: [],
    searchMode: false,
    searchResults: [],

    // ---------------- CRUD ----------------
    addToList(anime, status = "plan_to_watch") {
        const exists = this.animeList.some((a) => a.slug === anime.slug);
        if (exists) return;

        this.animeList.push({
            slug: anime.slug,
            title: anime.title,
            image: anime.image,
            episodes: anime.episode || "?",
            score: anime.rating || "-",
            status,
        });
        Storage.saveList(this.animeList);
        if (!this.searchMode) this.refreshMainList();
    },

    updateStatus(slug, status) {
        const anime = this.animeList.find((a) => a.slug === slug);
        if (anime) {
            anime.status = status;
            Storage.saveList(this.animeList);
            if (!this.searchMode) this.refreshMainList();
        }
    },

    removeFromList(slug) {
        this.animeList = this.animeList.filter((a) => a.slug !== slug);
        Storage.saveList(this.animeList);
        if (!this.searchMode) this.refreshMainList();
    },

    // ---------------- MAIN LIST REFRESH ----------------
    refreshMainList() {
        if (this.searchMode) {
            Render.renderSearchResults(this.searchResults, (anime) => {
                this.addToList(anime, "plan_to_watch");
            }, () => {
                this.searchMode = false;
                this.refreshMainList();
            });
            return;
        }

        if (this.currentFilter === "today") {
            const savedSlugs = new Set(this.animeList.map((a) => a.slug));
            Render.todayInMainList(this.todaySchedule, savedSlugs, (anime) => {
                this.addToList(anime, "plan_to_watch");
            });
            return;
        }

        Render.resetMainListTitle();
        const filtered =
            this.currentFilter === "all"
                ? this.animeList
                : this.animeList.filter((a) => a.status === this.currentFilter);

        Render.mainList(filtered, {
            onStatusChange: (slug, status) => this.updateStatus(slug, status),
            onRemove: (slug) => this.removeFromList(slug),
        });
    },

    // ---------------- SEARCH ----------------
    async performSearch(query) {
        if (!query.trim()) {
            this.searchMode = false;
            this.refreshMainList();
            return;
        }

        const { data, error } = await YaoiAPI.searchAnime(query);
        if (error) {
            Render.showErrorInGrid(error);
            return;
        }

        this.searchMode = true;
        this.searchResults = data;
        this.refreshMainList(); // akan memanggil renderSearchResults
    },

    setupSearch() {
        const input = document.querySelector(".search-input");

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const query = e.target.value;
                this.performSearch(query);
                Render.closeSearchResults();
            }
        });

        // Jika user klik filter tab, keluar dari mode pencarian
        document.querySelectorAll(".filter-tab").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (this.searchMode) {
                    this.searchMode = false;
                    document.querySelector(".search-input").value = "";
                    this.refreshMainList();
                }
            });
        });
    },

    // ---------------- FILTER TABS ----------------
    setupFilterTabs() {
        // sudah dihandle di setupSearch
    },

    // ---------------- SCHEDULE ----------------
    async loadSchedule() {
        const { data, error } = await YaoiAPI.fetchTodaySchedule();
        this.todaySchedule = data;
        Render.schedule(data, error);
        Render.bindScheduleClicks(data, (anime) => this.addToList(anime, "plan_to_watch"));

        if (this.currentFilter === "today") this.refreshMainList();
    },

    // ---------------- INIT ----------------
    async init() {
        this.setupSearch();
        this.refreshMainList();
        await this.loadSchedule();
    },
};

document.addEventListener("DOMContentLoaded", () => App.init());