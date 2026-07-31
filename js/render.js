// ===========================================================
// RENDER — semua fungsi yang nyentuh DOM
// ===========================================================

const Render = {
    scheduleList: document.getElementById("scheduleList"),
    dayBadge: document.getElementById("dayBadge"),
    animeGrid: document.getElementById("animeGrid"),
    countBadge: document.getElementById("countBadge"),
    mainListTitle: document.getElementById("mainListTitle"),
    searchResults: document.querySelector(".search-results"),

    // ---------- SEARCH DROPDOWN (opsional, kita matikan) ----------
    closeSearchResults() {
        this.searchResults.classList.remove("active");
        this.searchResults.innerHTML = "";
    },

    // ---------- SCHEDULE ----------
    schedule(list, error) {
        const DAY_LABEL_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        this.dayBadge.textContent = DAY_LABEL_ID[new Date().getDay()];

        if (error) {
            this.scheduleList.innerHTML = `<p class="empty">${error}</p>`;
            return;
        }
        if (!list.length) {
            this.scheduleList.innerHTML = `<p class="empty">Tidak ada jadwal hari ini.</p>`;
            return;
        }

        this.scheduleList.innerHTML = list
            .map(
                (a) => `
            <div class="schedule-item" data-slug="${a.slug}" title="Klik buat tambah ke Plan to Watch">
                <img src="${a.image}" alt="${a.title}" loading="lazy">
                <div class="schedule-info">
                    <p class="schedule-title">${a.title}</p>
                    <p class="schedule-time">${a.broadcastTime}</p>
                </div>
            </div>`
            )
            .join("");
    },

    bindScheduleClicks(list, onAdd) {
        this.scheduleList.querySelectorAll(".schedule-item").forEach((el) => {
            el.addEventListener("click", () => {
                const anime = list.find((a) => a.slug === el.dataset.slug);
                if (anime) onAdd(anime);
            });
        });
    },

    // ---------- MAIN LIST ----------
    mainList(filtered, { onStatusChange, onRemove }) {
        this.countBadge.textContent = filtered.length;

        if (!filtered.length) {
            this.animeGrid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <p class="empty-title">Belum ada anime di sini</p>
                    <p class="empty-sub">Ketik judul di kolom pencarian atas buat mulai nambahin anime ke list kamu.</p>
                </div>`;
            return;
        }

        this.animeGrid.innerHTML = filtered
            .map(
                (a) => `
            <div class="anime-card" data-slug="${a.slug}">
                <img src="${a.image}" alt="${a.title}" loading="lazy">
                <div class="anime-card-body">
                    <p class="anime-title">${a.title}</p>
                    <p class="anime-meta">Ep ${a.episodes} · ${a.score}</p>
                    <select class="status-select" data-slug="${a.slug}">
                        <option value="plan_to_watch" ${a.status === "plan_to_watch" ? "selected" : ""}>Plan to Watch</option>
                        <option value="watching" ${a.status === "watching" ? "selected" : ""}>Watching</option>
                        <option value="completed" ${a.status === "completed" ? "selected" : ""}>Completed</option>
                    </select>
                    <button class="remove-btn" data-slug="${a.slug}">Hapus</button>
                </div>
            </div>`
            )
            .join("");

        this.animeGrid.querySelectorAll(".anime-card").forEach((card) => {
            card.addEventListener("click", () => {
                window.location.href = `anime.html?slug=${card.dataset.slug}`;
            });
        });
        this.animeGrid.querySelectorAll(".status-select").forEach((sel) => {
            sel.addEventListener("click", (e) => e.stopPropagation());
            sel.addEventListener("change", (e) => onStatusChange(e.target.dataset.slug, e.target.value));
        });
        this.animeGrid.querySelectorAll(".remove-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                onRemove(e.target.dataset.slug);
            });
        });
    },

    // ---------- HASIL PENCARIAN (GRID) ----------
    renderSearchResults(results, onAdd, onBack) {
        this.mainListTitle.textContent = "Hasil Pencarian";
        this.countBadge.textContent = results.length;

        if (!results.length) {
            this.animeGrid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <p class="empty-title">Tidak ada hasil</p>
                    <p class="empty-sub">Coba dengan kata kunci lain.</p>
                    <button class="back-btn" id="searchBackBtn" style="background:var(--coral); color:#1a0a0d; border:none; padding:10px 24px; border-radius:8px; font-weight:600; cursor:pointer; margin-top:16px;">← Kembali ke Daftar Saya</button>
                </div>`;
            document.getElementById("searchBackBtn")?.addEventListener("click", onBack);
            return;
        }

        // Hapus duplikat (jika ada)
        const unique = [];
        const seen = new Set();
        results.forEach(a => {
            if (!seen.has(a.slug)) {
                seen.add(a.slug);
                unique.push(a);
            }
        });

        this.animeGrid.innerHTML = unique
            .map(
                (a) => `
            <div class="anime-card" data-slug="${a.slug}">
                <img src="${a.image}" alt="${a.title}" loading="lazy">
                <div class="anime-card-body">
                    <p class="anime-title">${a.title}</p>
                    <p class="anime-meta">${a.type || 'TV'} · ${a.episode || '?'} eps</p>
                    <button class="search-add-btn" data-slug="${a.slug}">+ Tambah ke List</button>
                </div>
            </div>`
            )
            .join("");

        // Event klik kartu
        this.animeGrid.querySelectorAll(".anime-card").forEach((card) => {
            card.addEventListener("click", (e) => {
                if (e.target.classList.contains("search-add-btn")) return;
                window.location.href = `anime.html?slug=${card.dataset.slug}`;
            });
        });

        // Event tombol tambah dengan animasi
        this.animeGrid.querySelectorAll(".search-add-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const slug = btn.dataset.slug;
                const anime = unique.find(a => a.slug === slug);
                if (anime) {
                    // Cek apakah sudah ada di list
                    const list = Storage.loadList();
                    const exists = list.some(a => a.slug === slug);
                    if (exists) {
                        btn.textContent = "Sudah di List";
                        btn.disabled = true;
                        return;
                    }
                    onAdd(anime);
                    // Animasi slide kiri (inSine)
                    btn.style.transition = "transform 0.3s cubic-bezier(0.42, 0, 0.58, 1), opacity 0.3s";
                    btn.style.transform = "translateX(-100%)";
                    btn.style.opacity = "0";
                    setTimeout(() => {
                        btn.textContent = "Sudah di List";
                        btn.style.transform = "translateX(0)";
                        btn.style.opacity = "1";
                        btn.disabled = true;
                        btn.style.background = "var(--panel-border)";
                        btn.style.color = "var(--text-faint)";
                    }, 300);
                }
            });
        });

        // Tombol kembali
        const backBtnHtml = `<div style="grid-column:1/-1; text-align:center; margin-top:12px;">
            <button class="back-btn" id="searchBackBtn" style="background:var(--coral); color:#1a0a0d; border:none; padding:10px 24px; border-radius:8px; font-weight:600; cursor:pointer;">← Kembali ke Daftar Saya</button>
        </div>`;
        this.animeGrid.insertAdjacentHTML("beforeend", backBtnHtml);
        document.getElementById("searchBackBtn")?.addEventListener("click", onBack);
    },

    showErrorInGrid(message) {
        this.mainListTitle.textContent = "Error";
        this.countBadge.textContent = "0";
        this.animeGrid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <p class="empty-title">${message}</p>
                <p class="empty-sub">Coba lagi nanti atau periksa koneksi.</p>
            </div>`;
    },

    // ---------- TODAY ----------
    todayInMainList(list, savedSlugs, onAdd) {
        this.mainListTitle.textContent = "Tayang Hari Ini";
        this.countBadge.textContent = list.length;

        if (!list.length) {
            this.animeGrid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <p class="empty-title">Nggak ada anime yang tayang hari ini</p>
                    <p class="empty-sub">Coba cek lagi besok, atau cari manual lewat kolom pencarian.</p>
                </div>`;
            return;
        }

        this.animeGrid.innerHTML = list
            .map((a) => {
                const already = savedSlugs.has(a.slug);
                return `
            <div class="anime-card today-card" data-slug="${a.slug}">
                <img src="${a.image}" alt="${a.title}" loading="lazy">
                <div class="anime-card-body">
                    <p class="anime-title">${a.title}</p>
                    <p class="anime-meta">${a.broadcastTime}</p>
                    <button class="add-btn" data-slug="${a.slug}" ${already ? "disabled" : ""}>
                        ${already ? "Sudah di list" : "+ Tambah ke List"}
                    </button>
                </div>
            </div>`;
            })
            .join("");

        this.animeGrid.querySelectorAll(".today-card").forEach((card) => {
            card.addEventListener("click", () => {
                window.location.href = `anime.html?slug=${card.dataset.slug}`;
            });
        });
        this.animeGrid.querySelectorAll(".add-btn:not([disabled])").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const anime = list.find((a) => a.slug === btn.dataset.slug);
                if (anime) onAdd(anime);
            });
        });
    },

    resetMainListTitle() {
        this.mainListTitle.textContent = "Anime Saya";
    },
};