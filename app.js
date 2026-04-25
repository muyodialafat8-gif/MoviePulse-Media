// ============================================================
// MoviePulse — Main application script
// Boots whichever page is loaded, wires Firebase, navigation,
// modals, player, ratings, downloads, share, etc.
// ============================================================

// Wait for Firebase to be initialized by firebase.js
function waitForFirebase() {
  return new Promise((resolve) => {
    if (window.MP_FIREBASE) return resolve(window.MP_FIREBASE);
    window.addEventListener("mp:firebase-ready", () => resolve(window.MP_FIREBASE), { once: true });
  });
}

// ----------- helpers ------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const params = new URLSearchParams(window.location.search);
const PAGE = (() => {
  const path = window.location.pathname.split("/").pop() || "index.html";
  return path.replace(".html", "") || "index";
})();

const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb73dtF5kg76mEEo1L3a";

function toast(msg, ms = 2400) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

function debounce(fn, ms = 300) {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return "—"; }
}

function fmtTime(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function escapeHTML(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function lazyImg(src, alt = "") {
  return `<img loading="lazy" decoding="async" src="${escapeHTML(src) || "./assets/logo.png"}" alt="${escapeHTML(alt)}" onerror="this.src='./assets/logo.png'" />`;
}

function cardHTML(item, kind = "movie") {
  const url = `${kind}.html?id=${encodeURIComponent(item.id)}`;
  const badges = [];
  if (item.isPremium) badges.push(`<span class="badge gold"><i class="fa-solid fa-crown"></i> Premium</span>`);
  else if (item.isNew) badges.push(`<span class="badge new">NEW</span>`);
  return `
    <a class="card" href="${url}">
      <div class="card-img">
        ${badges.join("")}
        ${lazyImg(item.poster || item.thumbnail, item.title)}
        ${item._progress ? `<div class="progress-overlay"><span style="width:${Math.min(100, item._progress * 100)}%"></span></div>` : ""}
      </div>
      <div class="card-meta">
        <div class="card-title">${escapeHTML(item.title || "Untitled")}</div>
        <div class="card-sub">${item.vjName ? `<span><i class="fa-solid fa-microphone-lines"></i> ${escapeHTML(item.vjName)}</span>` : ""}</div>
      </div>
    </a>
  `;
}

// ============================================================
// Splash screen — homepage only
// ============================================================
function runSplash() {
  const el = $("#splash");
  if (!el) return;
  const title = $("#splashTitle");
  const text = "MoviePulse";
  if (title) {
    title.innerHTML = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.textContent = ch === " " ? "\u00a0" : ch;
      span.style.opacity = "0";
      span.style.display = "inline-block";
      span.style.transition = `opacity .3s ${i * 0.08}s, transform .4s ${i * 0.08}s`;
      span.style.transform = "translateY(8px)";
      title.appendChild(span);
      requestAnimationFrame(() => {
        span.style.opacity = "1";
        span.style.transform = "translateY(0)";
      });
    });
  }
  setTimeout(() => {
    el.classList.add("hide");
    setTimeout(() => (el.style.display = "none"), 800);
  }, 2500);
}

// ============================================================
// Theme handling
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("mp_theme", theme);
}
applyTheme(localStorage.getItem("mp_theme") || "dark");

// ============================================================
// Bottom nav active state
// ============================================================
(function setActiveNav() {
  const nav = $(".bottomnav");
  if (!nav) return;
  const map = { index: 0, search: 1, series: 2, downloads: 3, account: 4, movie: 0, subscription: 4 };
  const i = map[PAGE];
  if (i != null) {
    const links = $$("a", nav);
    if (links[i]) links[i].classList.add("active");
  }
})();

// ============================================================
// Profile dropdown
// ============================================================
(function profileDropdown() {
  const btn = $("#profileBtn");
  const menu = $("#profileMenu");
  if (!btn || !menu) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) menu.classList.remove("open");
  });
  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const fb = await waitForFirebase();
        await fb.signOut(fb.auth);
        toast("Signed out");
        setTimeout(() => (window.location.href = "./login.html"), 600);
      } catch (e) { toast(e.message || "Logout failed"); }
    });
  }
})();

// ============================================================
// Service worker registration (PWA)
// ============================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = new URL("./sw.js", document.baseURI).toString();
    navigator.serviceWorker.register(swUrl, { scope: "./" }).catch(() => {});
  });
}

// ============================================================
// Install banner (beforeinstallprompt)
// ============================================================
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  const banner = $("#installBanner");
  if (!banner) return;
  if (localStorage.getItem("mp_installed") === "true") return;
  const dismissedAt = parseInt(localStorage.getItem("mp_install_dismissed") || "0", 10);
  if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
  banner.hidden = false;
});
window.addEventListener("appinstalled", () => {
  localStorage.setItem("mp_installed", "true");
  const banner = $("#installBanner");
  if (banner) banner.hidden = true;
});
(function initInstallBanner() {
  const banner = $("#installBanner");
  if (!banner) return;
  $("#installBtn")?.addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === "accepted") localStorage.setItem("mp_installed", "true");
    banner.hidden = true;
    deferredInstall = null;
  });
  $("#installDismiss")?.addEventListener("click", () => {
    localStorage.setItem("mp_install_dismissed", Date.now().toString());
    banner.hidden = true;
  });
})();

// ============================================================
// Welcome + Notification popups (homepage)
// ============================================================
function showWelcomeModal() {
  const m = $("#welcomeModal");
  if (!m) return;
  $("#welcomeWa").href = WHATSAPP_CHANNEL;
  m.hidden = false;
  m.querySelector("[data-close-welcome]").addEventListener("click", () => {
    localStorage.setItem("mp_welcomed", "true");
    m.hidden = true;
    setTimeout(showNotifModal, 500);
  });
}
function showNotifModal() {
  const m = $("#notifModal");
  if (!m) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  if (localStorage.getItem("mp_notif")) return;
  m.hidden = false;
  $("#enableNotifBtn").addEventListener("click", async () => {
    try {
      const r = await Notification.requestPermission();
      if (r === "granted") {
        localStorage.setItem("mp_notif", "granted");
        toast("Notifications enabled!");
      } else {
        localStorage.setItem("mp_notif", "denied");
      }
    } catch {}
    m.hidden = true;
  });
  m.querySelector("[data-close-notif]").addEventListener("click", () => {
    localStorage.setItem("mp_notif", "later");
    m.hidden = true;
  });
}

// ============================================================
// PAGE: HOME (index.html)
// ============================================================
async function bootHome() {
  runSplash();
  const fb = await waitForFirebase();
  const { db, collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, getDocs, onAuthStateChanged, auth } = fb;

  // Settings (banner ad, popup ad, footer)
  loadSettings(fb);

  // Welcome popup on first visit
  if (!localStorage.getItem("mp_welcomed")) {
    setTimeout(showWelcomeModal, 2800);
  } else {
    onAuthStateChanged(auth, (user) => { if (user) setTimeout(showNotifModal, 1500); });
  }

  // Hero — featured movies
  loadHero(fb);

  // Trending / Featured / New / VJs
  subscribeRow(fb, "movies", "trendingRow", { field: "trending", value: true });
  subscribeRow(fb, "movies", "featuredRow", { field: "featured", value: true });
  subscribeRow(fb, "movies", "newRow", { field: "isNew", value: true });
  subscribeRow(fb, "vjs", "vjsRow", { field: "isBest", value: true, kind: "vj" });

  // Continue Watching (per-user)
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const uref = doc(db, "users", user.uid);
      const snap = await getDoc(uref);
      const data = snap.exists() ? snap.data() : {};
      const list = (data.continueWatching || []).slice(-12).reverse();
      if (!list.length) return;
      $("#continueSection").hidden = false;
      const row = $("#continueRow");
      const ids = list.map((x) => x.movieId);
      const movies = await Promise.all(ids.map((id) => getDoc(doc(db, "movies", id))));
      row.innerHTML = movies
        .map((m, i) => (m.exists() ? cardHTML({ id: m.id, ...m.data(), _progress: list[i].progress || 0 }, "movie") : ""))
        .join("") || "";
    } catch (e) { /* silent */ }
  });

  // Recently Viewed (localStorage)
  try {
    const recent = JSON.parse(localStorage.getItem("mp_recent") || "[]");
    if (recent.length) {
      $("#recentSection").hidden = false;
      const ids = recent.slice(0, 12);
      const docs = await Promise.all(ids.map((id) => getDoc(doc(db, "movies", id))));
      $("#recentRow").innerHTML = docs.filter((d) => d.exists()).map((d) => cardHTML({ id: d.id, ...d.data() }, "movie")).join("");
    }
  } catch {}
}

function subscribeRow(fb, col, rowId, opts) {
  const { db, collection, query, where, onSnapshot } = fb;
  const row = $("#" + rowId);
  if (!row) return;
  let q;
  try {
    q = query(collection(db, col), where(opts.field, "==", opts.value));
  } catch {
    q = collection(db, col);
  }
  onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (!items.length) {
      row.innerHTML = `<div class="muted" style="padding:18px">No items yet.</div>`;
      return;
    }
    row.innerHTML = items.map((it) => (opts.kind === "vj" ? vjCardHTML(it) : cardHTML(it, "movie"))).join("");
  }, (err) => {
    row.innerHTML = `<div class="muted" style="padding:18px">${escapeHTML(err.message)}</div>`;
  });
}

function vjCardHTML(v) {
  return `
    <a class="card" href="./search.html?vj=${encodeURIComponent(v.name || "")}">
      <div class="card-img" style="aspect-ratio:1/1;border-radius:50%;margin:10px;width:120px;height:120px;align-self:center">
        ${lazyImg(v.profile_image, v.name)}
      </div>
      <div class="card-meta center">
        <div class="card-title">${escapeHTML(v.name || "VJ")}</div>
        <div class="card-sub">${(v.fans || 0).toLocaleString()} fans · ${v.totalMovies || 0} movies</div>
      </div>
    </a>
  `;
}

async function loadHero(fb) {
  const { db, collection, query, where, getDocs, limit } = fb;
  const slidesEl = $("#heroSlides");
  const dotsEl = $("#heroDots");
  if (!slidesEl) return;
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, "movies"), where("featured", "==", true), limit(6)));
    } catch {
      snap = await getDocs(query(collection(db, "movies"), limit(6)));
    }
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (!items.length) {
      slidesEl.innerHTML = `<div class="hero-slide" style="background:linear-gradient(135deg,#1a1a1a,#3a0d0f);"><div class="hero-content"><h1>Welcome to MoviePulse</h1><p>Add movies in Firebase to see them here.</p></div></div>`;
      return;
    }
    slidesEl.innerHTML = items.map((m) => `
      <div class="hero-slide" style="background-image:url('${escapeHTML(m.thumbnail || m.poster || "")}')">
        <div class="hero-content">
          <h1>${escapeHTML(m.title || "Untitled")}</h1>
          <p>${escapeHTML(m.description || "")}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="./movie.html?id=${encodeURIComponent(m.id)}"><i class="fa-solid fa-play"></i> Watch Now</a>
            <a class="btn btn-ghost" href="./subscription.html"><i class="fa-solid fa-crown"></i> Subscribe</a>
          </div>
        </div>
      </div>
    `).join("");
    dotsEl.innerHTML = items.map((_, i) => `<span class="${i === 0 ? "active" : ""}" data-i="${i}"></span>`).join("");

    let idx = 0;
    const total = items.length;
    const goto = (i) => {
      idx = (i + total) % total;
      slidesEl.style.transform = `translateX(-${idx * 100}%)`;
      $$(".hero-dots span").forEach((d, j) => d.classList.toggle("active", j === idx));
    };
    dotsEl.addEventListener("click", (e) => {
      const t = e.target.closest("span[data-i]");
      if (t) goto(parseInt(t.dataset.i, 10));
    });
    setInterval(() => goto(idx + 1), 5000);

    // swipe
    let startX = 0;
    slidesEl.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX));
    slidesEl.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goto(idx + (dx < 0 ? 1 : -1));
    });
  } catch (e) {
    slidesEl.innerHTML = `<div class="hero-slide" style="background:#1a1a1a;"><div class="hero-content"><h1>MoviePulse</h1><p>${escapeHTML(e.message)}</p></div></div>`;
  }
}

async function loadSettings(fb) {
  const { db, doc, getDoc, onSnapshot } = fb;
  try {
    onSnapshot(doc(db, "settings", "global"), (snap) => {
      window.MP_SETTINGS = snap.exists() ? snap.data() : {};
      // banner
      const b = $("#bannerAd"), bi = $("#bannerAdImg");
      if (b && window.MP_SETTINGS.ad_image) {
        bi.src = window.MP_SETTINGS.ad_image;
        b.href = window.MP_SETTINGS.ad_link || "#";
        b.hidden = false;
      }
      const m = $("#midAd"), mi = $("#midAdImg");
      if (m && window.MP_SETTINGS.ad_image) {
        mi.src = window.MP_SETTINGS.ad_image;
        m.href = window.MP_SETTINGS.ad_link || "#";
        m.hidden = false;
      }
      const ft = $("#pageFooter");
      if (ft && window.MP_SETTINGS.footerText) ft.textContent = window.MP_SETTINGS.footerText;
      // popup ad after 30s
      if (window.MP_SETTINGS.popup_enabled && !sessionStorage.getItem("mp_popup_shown")) {
        setTimeout(() => {
          const p = $("#popupAd");
          if (p && window.MP_SETTINGS.ad_image) {
            $("#popupAdImg").src = window.MP_SETTINGS.ad_image;
            $("#popupAdLink").href = window.MP_SETTINGS.ad_link || "#";
            p.hidden = false;
            sessionStorage.setItem("mp_popup_shown", "1");
            p.querySelector("[data-close-popup]")?.addEventListener("click", () => (p.hidden = true));
          }
        }, 30000);
      }
    }, () => {});
  } catch {}
}

// ============================================================
// PAGE: SERIES (series.html)
// ============================================================
async function bootSeries() {
  const fb = await waitForFirebase();
  const { db, collection, getDocs, query, where, doc, getDoc, orderBy } = fb;
  const id = params.get("id");
  if (id) {
    $("#seriesGridSection").hidden = true;
    const detail = $("#seriesDetail");
    detail.hidden = false;
    detail.innerHTML = `<div class="loader-center"><div class="spinner"></div></div>`;
    try {
      const sref = doc(db, "series", id);
      const snap = await getDoc(sref);
      if (!snap.exists()) {
        detail.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h3>Series not found</h3></div>`;
        return;
      }
      const s = { id: snap.id, ...snap.data() };
      // episodes
      let episodes = [];
      try {
        const epQ = query(collection(db, "episodes"), where("seriesId", "==", s.id));
        const epSnap = await getDocs(epQ);
        epSnap.forEach((d) => episodes.push({ id: d.id, ...d.data() }));
        episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
      } catch {}
      detail.innerHTML = `
        <div class="movie-poster" style="background-image:url('${escapeHTML(s.poster || "")}')"></div>
        <div class="movie-info">
          <h1>${escapeHTML(s.title || "Untitled")}</h1>
          <div class="movie-meta">
            ${episodes.length ? `<span class="chip">${episodes.length} episodes</span>` : ""}
          </div>
          <p class="movie-description">${escapeHTML(s.description || "")}</p>
          <h2 style="margin-top:18px">Episodes</h2>
          <div class="history-list" style="margin-top:10px">
            ${episodes.map((ep) => `
              <button class="history-item" data-video="${escapeHTML(ep.videoUrl || "")}">
                ${lazyImg(s.poster, "")}
                <div class="meta">
                  <h4>Episode ${escapeHTML(String(ep.episodeNumber || "?"))}</h4>
                  <small>${escapeHTML(ep.title || "")}</small>
                </div>
                <i class="fa-solid fa-circle-play accent"></i>
              </button>
            `).join("") || `<div class="muted">No episodes yet.</div>`}
          </div>
        </div>
      `;
      detail.addEventListener("click", (e) => {
        const b = e.target.closest("[data-video]");
        if (!b) return;
        const url = b.getAttribute("data-video");
        if (!url) return toast("No video URL");
        playSimpleVideo(url);
      });
    } catch (e) {
      detail.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h3>Error</h3><p>${escapeHTML(e.message)}</p></div>`;
    }
    return;
  }
  // Grid view
  const grid = $("#seriesGrid");
  try {
    const snap = await getDocs(collection(db, "series"));
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    if (!items.length) {
      grid.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:30px">No series yet. Add some in Firebase.</div>`;
      return;
    }
    grid.innerHTML = items.map((s) => cardHTML(s, "series")).join("");
  } catch (e) {
    grid.innerHTML = `<div class="muted">${escapeHTML(e.message)}</div>`;
  }
}

function playSimpleVideo(url) {
  // Use a minimal overlay to play episode/local video
  let overlay = $("#playerOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "playerOverlay";
    overlay.className = "player-overlay";
    overlay.innerHTML = `<button class="player-close" id="playerClose"><i class="fa-solid fa-xmark"></i></button><video id="videoEl" controls playsinline></video>`;
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  const v = $("#videoEl");
  v.src = url;
  v.play().catch(() => {});
  $("#playerClose").onclick = () => { v.pause(); v.removeAttribute("src"); overlay.hidden = true; };
}

// ============================================================
// PAGE: SEARCH (search.html)
// ============================================================
async function bootSearch() {
  const fb = await waitForFirebase();
  const { db, collection, getDocs } = fb;

  // Fetch all movies once
  let movies = [];
  let categories = new Set();
  try {
    const snap = await getDocs(collection(db, "movies"));
    snap.forEach((d) => {
      const m = { id: d.id, ...d.data() };
      movies.push(m);
      if (m.category) categories.add(m.category);
    });
  } catch (e) { toast(e.message); }

  // Categories chips
  const chipsEl = $("#categoryChips");
  let activeCat = params.get("category") || "";
  function renderChips() {
    chipsEl.innerHTML =
      `<button class="chip-btn ${!activeCat ? "active" : ""}" data-cat="">All</button>` +
      Array.from(categories).map((c) => `<button class="chip-btn ${activeCat === c ? "active" : ""}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("");
  }
  renderChips();
  chipsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    activeCat = b.dataset.cat;
    renderChips();
    runSearch();
  });

  // Recent searches
  const recents = JSON.parse(localStorage.getItem("mp_searches") || "[]");
  const recentEl = $("#recentSearches");
  const recentList = $("#recentList");
  function renderRecents() {
    if (!recents.length) { recentEl.hidden = true; return; }
    recentEl.hidden = false;
    recentList.innerHTML = recents.map((q) => `<button class="chip-btn" data-q="${escapeHTML(q)}">${escapeHTML(q)}</button>`).join("");
  }
  renderRecents();
  recentList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (!b) return;
    $("#searchInput").value = b.dataset.q;
    runSearch();
  });
  $("#clearRecent").addEventListener("click", () => {
    localStorage.removeItem("mp_searches");
    recents.length = 0;
    renderRecents();
  });

  // Search input
  const input = $("#searchInput");
  const initial = params.get("q") || params.get("vj") || "";
  if (initial) input.value = initial;

  const runSearch = () => {
    const q = (input.value || "").trim().toLowerCase();
    let results = movies;
    if (activeCat) results = results.filter((m) => (m.category || "") === activeCat);
    if (q) results = results.filter((m) =>
      (m.title || "").toLowerCase().includes(q) ||
      (m.vjName || "").toLowerCase().includes(q) ||
      (m.description || "").toLowerCase().includes(q));
    renderResults(results);
  };
  const renderResults = (list) => {
    const grid = $("#searchResults");
    const empty = $("#emptyState");
    if (!list.length) { grid.innerHTML = ""; empty.hidden = false; return; }
    empty.hidden = true;
    grid.innerHTML = list.map((m) => cardHTML(m, "movie")).join("");
  };
  input.addEventListener("input", debounce(() => {
    const q = input.value.trim();
    if (q && !recents.includes(q)) {
      recents.unshift(q);
      while (recents.length > 8) recents.pop();
      localStorage.setItem("mp_searches", JSON.stringify(recents));
      renderRecents();
    }
    runSearch();
  }, 300));

  runSearch();
}

// ============================================================
// PAGE: SUBSCRIPTION (subscription.html)
// ============================================================
async function bootSubscription() {
  const fb = await waitForFirebase();
  const { db, doc, getDoc } = fb;
  const wrap = $("#plansSection");
  let s = {};
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) s = snap.data();
  } catch {}
  const plans = [
    { key: "Daily", price: s.price_daily || "5,000 UGX", features: ["24-hour access", "Ad-free streaming", "All movies & series"] },
    { key: "Weekly", price: s.price_weekly || "15,000 UGX", features: ["7-day access", "Ad-free streaming", "Download for offline"] },
    { key: "Monthly", price: s.price_monthly || "40,000 UGX", popular: true, features: ["30-day access", "Ad-free streaming", "Unlimited downloads", "Early access"] },
    { key: "Lifetime", price: s.price_lifetime || "300,000 UGX", features: ["Lifetime access", "Ad-free streaming", "Unlimited downloads", "VIP support"] },
  ];
  wrap.innerHTML = plans.map((p) => `
    <div class="plan-card ${p.popular ? "popular" : ""}">
      ${p.popular ? `<span class="plan-tag">Most Popular</span>` : ""}
      <h3>${p.key} Plan</h3>
      <div class="plan-price">${escapeHTML(p.price)}</div>
      <ul class="plan-features">
        ${p.features.map((f) => `<li>${escapeHTML(f)}</li>`).join("")}
      </ul>
      <a href="https://wa.me/256766051929?text=${encodeURIComponent("Hi, I want to activate the " + p.key + " plan on MoviePulse.")}" target="_blank" rel="noopener" class="btn btn-primary btn-block">
        <i class="fa-brands fa-whatsapp"></i> Activate via WhatsApp
      </a>
    </div>
  `).join("");
}

// ============================================================
// PAGE: ACCOUNT (account.html)
// ============================================================
async function bootAccount() {
  const fb = await waitForFirebase();
  const { auth, db, doc, getDoc, collection, getDocs, onAuthStateChanged } = fb;
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "./login.html"; return; }
    const uref = doc(db, "users", user.uid);
    const snap = await getDoc(uref);
    const data = snap.exists() ? snap.data() : {};
    const initials = (user.displayName || user.email || "M").trim().charAt(0).toUpperCase();
    $("#avatarCircle").textContent = initials;
    $("#profileEmail").textContent = user.email || user.displayName || "";
    $("#profileJoined").textContent = `Member since ${formatDate(data.createdAt)}`;
    const isActive = data.subscriptionStatus && String(data.subscriptionStatus).toLowerCase() === "active";
    const badge = $("#subBadge");
    badge.textContent = isActive ? "Active subscription" : "Inactive";
    badge.classList.toggle("active", isActive);

    // Favorites
    const favIds = data.favorites || [];
    const favGrid = $("#favoritesGrid");
    if (!favIds.length) {
      favGrid.innerHTML = `<div class="muted" style="grid-column:1/-1;padding:18px;text-align:center">No favorites yet.</div>`;
    } else {
      const docs = await Promise.all(favIds.map((id) => getDoc(doc(db, "movies", id))));
      favGrid.innerHTML = docs.filter((d) => d.exists()).map((d) => cardHTML({ id: d.id, ...d.data() }, "movie")).join("");
    }
    // History
    const hist = data.watchHistory || [];
    const histEl = $("#historyList");
    if (!hist.length) {
      histEl.innerHTML = `<div class="muted" style="padding:18px;text-align:center">No watch history yet.</div>`;
    } else {
      const ids = hist.slice(-10).reverse().map((x) => x.movieId || x);
      const docs = await Promise.all(ids.map((id) => getDoc(doc(db, "movies", id))));
      histEl.innerHTML = docs.filter((d) => d.exists()).map((d) => {
        const m = { id: d.id, ...d.data() };
        return `<a class="history-item" href="./movie.html?id=${encodeURIComponent(m.id)}">${lazyImg(m.poster)}<div class="meta"><h4>${escapeHTML(m.title)}</h4><small>${escapeHTML(m.category || "")}</small></div><i class="fa-solid fa-chevron-right muted"></i></a>`;
      }).join("");
    }
    // Downloads count
    const dls = await idbList();
    $("#dlCount").textContent = dls.length;
  });

  // Theme toggle
  const dark = $("#darkToggle");
  if (dark) {
    dark.checked = (localStorage.getItem("mp_theme") || "dark") === "dark";
    dark.addEventListener("change", () => applyTheme(dark.checked ? "dark" : "light"));
  }
  const notif = $("#notifToggle");
  if (notif) {
    notif.checked = localStorage.getItem("mp_notif") === "granted";
    notif.addEventListener("change", async () => {
      if (notif.checked && "Notification" in window) {
        const r = await Notification.requestPermission();
        if (r === "granted") { localStorage.setItem("mp_notif", "granted"); toast("Notifications enabled!"); }
        else { notif.checked = false; localStorage.setItem("mp_notif", "denied"); }
      } else {
        localStorage.setItem("mp_notif", "off");
      }
    });
  }
}

// ============================================================
// PAGE: LOGIN (login.html)
// ============================================================
async function bootLogin() {
  const fb = await waitForFirebase();
  const { auth, db, doc, setDoc, signInWithEmailAndPassword, signInWithPopup, googleProvider, sendPasswordResetEmail, sendEmailVerification, serverTimestamp } = fb;

  $("#loginEye").addEventListener("click", () => {
    const i = $("#loginPassword");
    i.type = i.type === "password" ? "text" : "password";
  });

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        toast("Please verify your email first");
        try { await sendEmailVerification(cred.user); toast("Verification email re-sent"); } catch {}
        return;
      }
      toast("Welcome back!");
      setTimeout(() => (window.location.href = "./index.html"), 600);
    } catch (err) { toast(err.message || "Sign-in failed"); }
  });

  $("#googleBtn").addEventListener("click", async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      // Create user doc if missing
      const uref = doc(db, "users", cred.user.uid);
      await setDoc(uref, {
        email: cred.user.email,
        displayName: cred.user.displayName || "",
        photoURL: cred.user.photoURL || "",
        createdAt: serverTimestamp(),
        role: "user",
        isAdmin: false,
      }, { merge: true });
      toast("Signed in with Google");
      setTimeout(() => (window.location.href = "./index.html"), 600);
    } catch (err) { toast(err.message || "Google sign-in failed"); }
  });

  $("#forgotBtn").addEventListener("click", async () => {
    const email = $("#loginEmail").value.trim();
    if (!email) return toast("Enter your email first");
    try { await sendPasswordResetEmail(auth, email); toast("Reset email sent! Check your inbox"); }
    catch (err) { toast(err.message); }
  });
}

// ============================================================
// PAGE: REGISTER (register.html)
// ============================================================
async function bootRegister() {
  const fb = await waitForFirebase();
  const { auth, db, doc, setDoc, createUserWithEmailAndPassword, signInWithPopup, googleProvider, sendEmailVerification, updateProfile, serverTimestamp } = fb;

  const pw = $("#regPassword");
  const bar = $("#strengthBar");
  const lbl = $("#strengthLabel");
  pw.addEventListener("input", () => {
    const v = pw.value;
    let score = 0;
    if (v.length >= 6) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    bar.className = "strength-bar";
    if (score <= 1) { bar.classList.add("weak"); lbl.textContent = "Weak"; }
    else if (score <= 3) { bar.classList.add("medium"); lbl.textContent = "Medium"; }
    else { bar.classList.add("strong"); lbl.textContent = "Strong"; }
  });

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#regName").value.trim();
    const email = $("#regEmail").value.trim();
    const password = pw.value;
    const confirm = $("#regConfirm").value;
    if (password !== confirm) return toast("Passwords don't match");
    if (password.length < 6) return toast("Password must be at least 6 characters");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try { await updateProfile(cred.user, { displayName: name }); } catch {}
      try { await sendEmailVerification(cred.user); } catch {}
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        displayName: name,
        createdAt: serverTimestamp(),
        role: "user",
        isAdmin: false,
        favorites: [],
        watchHistory: [],
        downloads: [],
        continueWatching: [],
        subscriptionStatus: "inactive",
      });
      toast("Account created! Please verify your email");
      setTimeout(() => (window.location.href = "./login.html"), 1200);
    } catch (err) { toast(err.message || "Sign-up failed"); }
  });

  $("#googleBtn").addEventListener("click", async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        displayName: cred.user.displayName || "",
        createdAt: serverTimestamp(),
        role: "user", isAdmin: false,
      }, { merge: true });
      toast("Welcome to MoviePulse!");
      setTimeout(() => (window.location.href = "./index.html"), 600);
    } catch (err) { toast(err.message); }
  });
}

// ============================================================
// PAGE: MOVIE (movie.html?id=...)
// ============================================================
async function bootMovie() {
  const fb = await waitForFirebase();
  const { db, doc, getDoc, updateDoc, setDoc, increment, arrayUnion, arrayRemove,
    collection, addDoc, getDocs, query, where, onSnapshot, serverTimestamp, auth, onAuthStateChanged } = fb;
  const id = params.get("id");
  const wrap = $("#movieDetail");
  if (!id) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h3>No movie selected</h3><a class="btn btn-primary" href="./index.html">Go Home</a></div>`;
    return;
  }
  // Settings (for ads/subscriber gate)
  loadSettings(fb);

  let movie = null;
  let user = null;
  let userData = {};

  try {
    const ref = doc(db, "movies", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h3>Movie not found</h3><a class="btn btn-primary" href="./index.html">Go Home</a></div>`;
      return;
    }
    movie = { id: snap.id, ...snap.data() };

    // Increment views
    try { await updateDoc(ref, { views: increment(1) }); } catch {}

    // Push to recently viewed
    try {
      const recent = JSON.parse(localStorage.getItem("mp_recent") || "[]");
      const filtered = recent.filter((x) => x !== id);
      filtered.unshift(id);
      localStorage.setItem("mp_recent", JSON.stringify(filtered.slice(0, 20)));
    } catch {}

    renderMovie(movie);
    setupActions(movie);
    setupRatings(movie);
  } catch (e) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><h3>Error</h3><p>${escapeHTML(e.message)}</p></div>`;
  }

  onAuthStateChanged(auth, async (u) => {
    user = u;
    if (u) {
      const us = await getDoc(doc(db, "users", u.uid));
      userData = us.exists() ? us.data() : {};
      // Reflect favorite state
      const favBtn = $("#favBtn");
      if (favBtn && (userData.favorites || []).includes(id)) {
        favBtn.classList.add("active");
        favBtn.querySelector("i").className = "fa-solid fa-heart";
      }
    }
  });

  function renderMovie(m) {
    const premium = m.isPremium ? `<span class="chip gold"><i class="fa-solid fa-crown"></i> Premium</span>` : "";
    wrap.innerHTML = `
      <div class="movie-poster" style="background-image:url('${escapeHTML(m.thumbnail || m.poster || "")}')"></div>
      <div class="movie-info">
        <h1>${escapeHTML(m.title || "Untitled")}</h1>
        <div class="movie-meta">
          ${m.category ? `<span class="chip red">${escapeHTML(m.category)}</span>` : ""}
          ${m.vjName ? `<span class="chip"><i class="fa-solid fa-microphone-lines"></i> ${escapeHTML(m.vjName)}</span>` : ""}
          ${premium}
          <span class="chip"><i class="fa-solid fa-eye"></i> <span id="viewCount">${(m.views || 0).toLocaleString()}</span></span>
        </div>
        <p class="movie-description">${escapeHTML(m.description || "")}</p>
        <div class="action-row">
          <button class="btn btn-primary" id="watchBtn"><i class="fa-solid fa-play"></i> Watch Now</button>
          ${m.trailerUrl ? `<button class="btn btn-ghost" id="trailerBtn"><i class="fa-solid fa-film"></i> Watch Trailer</button>` : ""}
          <button class="icon-pill" id="favBtn" title="Favorite"><i class="fa-regular fa-heart"></i></button>
          <button class="icon-pill" id="downloadBtn" title="Download"><i class="fa-solid fa-download"></i></button>
          <button class="icon-pill" id="shareBtn" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
          <button class="icon-pill" id="reportBtn" title="Report"><i class="fa-solid fa-flag"></i></button>
        </div>
        <div class="rating-block">
          <div class="rating-summary">
            <div class="rating-score" id="avgScore">0.0</div>
            <div>
              <div class="rating-stars" id="avgStars">${[1,2,3,4,5].map(()=>`<i class="fa-solid fa-star"></i>`).join("")}</div>
              <div class="rating-total" id="ratingTotal">0 ratings</div>
            </div>
          </div>
          <div class="rating-bars" id="ratingBars"></div>
          <div class="user-rate">
            <p class="muted">Tap a star to rate this movie</p>
            <div class="user-rate-stars" id="userStars">${[1,2,3,4,5].map(n=>`<i class="fa-regular fa-star" data-n="${n}"></i>`).join("")}</div>
            <button class="btn btn-primary" id="submitRating" disabled>Submit Rating</button>
          </div>
        </div>
      </div>
    `;
  }

  function setupActions(m) {
    const watchBtn = $("#watchBtn");
    watchBtn.addEventListener("click", () => openPlayer(m));

    const trailer = $("#trailerBtn");
    if (trailer) trailer.addEventListener("click", () => openTrailer(m));

    $("#favBtn").addEventListener("click", async () => {
      if (!user) { toast("Sign in to save favorites"); return setTimeout(() => location.href = "./login.html", 800); }
      const ref = doc(db, "users", user.uid);
      const isFav = (userData.favorites || []).includes(m.id);
      try {
        await updateDoc(ref, { favorites: isFav ? arrayRemove(m.id) : arrayUnion(m.id) }).catch(async () => {
          await setDoc(ref, { favorites: isFav ? [] : [m.id] }, { merge: true });
        });
        userData.favorites = isFav ? (userData.favorites || []).filter((x) => x !== m.id) : [...(userData.favorites || []), m.id];
        const btn = $("#favBtn");
        btn.classList.toggle("active", !isFav);
        btn.classList.add("fav-pop");
        setTimeout(() => btn.classList.remove("fav-pop"), 500);
        btn.querySelector("i").className = !isFav ? "fa-solid fa-heart" : "fa-regular fa-heart";
        toast(isFav ? "Removed from favorites" : "Added to favorites");
      } catch (e) { toast(e.message); }
    });

    $("#downloadBtn").addEventListener("click", () => downloadMovie(m));
    $("#shareBtn").addEventListener("click", () => openShareSheet(m));
    $("#reportBtn").addEventListener("click", () => openReport(m));
  }

  // ----- PLAYER -----
  function openPlayer(m) {
    const overlay = $("#playerOverlay");
    overlay.hidden = false;
    const v = $("#videoEl");
    const adOverlay = $("#adOverlay");
    const skipBtn = $("#skipAdBtn");
    const gate = $("#subscribeGate");
    gate.hidden = true; adOverlay.hidden = true;

    const settings = window.MP_SETTINGS || {};
    const isSubscribed = userData.subscriptionStatus && String(userData.subscriptionStatus).toLowerCase() === "active";

    if (m.isPremium && !isSubscribed) {
      gate.hidden = false;
      v.removeAttribute("src");
      return;
    }

    const playMain = () => {
      adOverlay.hidden = true;
      v.src = m.videoUrl || "";
      v.play().catch(() => {});
    };

    if (settings.ads_enabled && !m.isPremium && settings.ad_video_url) {
      adOverlay.hidden = false;
      v.src = settings.ad_video_url;
      v.play().catch(() => {});
      const skipAt = Number(settings.ad_skip_time || 5);
      let t = skipAt;
      skipBtn.hidden = false;
      skipBtn.disabled = true;
      skipBtn.textContent = `Skip in ${t}s`;
      const tick = setInterval(() => {
        t--;
        if (t <= 0) {
          clearInterval(tick);
          skipBtn.disabled = false;
          skipBtn.textContent = "Skip Ad ▶";
          skipBtn.onclick = () => { v.onended = null; playMain(); };
        } else skipBtn.textContent = `Skip in ${t}s`;
      }, 1000);
      v.onended = playMain;
    } else {
      playMain();
    }

    // progress save every 10s
    let lastSave = 0;
    v.ontimeupdate = () => {
      const cur = v.currentTime;
      const dur = v.duration || 0;
      $("#timeDisplay").textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
      $("#seekBar").value = dur ? (cur / dur) * 100 : 0;
      if (user && cur - lastSave >= 10) {
        lastSave = cur;
        const ref = doc(db, "users", user.uid);
        const entry = { movieId: m.id, progress: dur ? cur / dur : 0, timestamp: Date.now() };
        updateDoc(ref, { continueWatching: arrayUnion(entry), watchHistory: arrayUnion({ movieId: m.id, ts: Date.now() }) }).catch(async () => {
          await setDoc(ref, { continueWatching: [entry] }, { merge: true });
        });
      }
    };

    $("#playerClose").onclick = () => { v.pause(); v.removeAttribute("src"); overlay.hidden = true; };
    $("#playPauseBtn").onclick = () => { v.paused ? v.play() : v.pause(); $("#playPauseBtn").innerHTML = v.paused ? `<i class="fa-solid fa-play"></i>` : `<i class="fa-solid fa-pause"></i>`; };
    $("#fullscreenBtn").onclick = () => { (overlay.requestFullscreen || overlay.webkitRequestFullscreen)?.call(overlay); };
    $("#seekBar").oninput = (e) => { if (v.duration) v.currentTime = (e.target.value / 100) * v.duration; };
    // double-tap skip
    let lastTap = 0;
    v.addEventListener("click", (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        const rect = v.getBoundingClientRect();
        const right = e.clientX - rect.left > rect.width / 2;
        v.currentTime += right ? 10 : -10;
      }
      lastTap = now;
    });
  }

  function openTrailer(m) {
    if (!m.trailerUrl) return;
    const overlay = $("#trailerOverlay");
    overlay.hidden = false;
    const v = $("#trailerVideo");
    v.src = m.trailerUrl;
    v.play().catch(() => {});
    $("#trailerClose").onclick = () => { v.pause(); v.removeAttribute("src"); overlay.hidden = true; };
  }

  // ----- DOWNLOAD -----
  async function downloadMovie(m) {
    if (!m.videoUrl) return toast("No video URL");
    toast("Starting download...");
    try {
      const res = await fetch(m.videoUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      await idbAdd({
        id: m.id, title: m.title, poster: m.poster, blob, size: blob.size, downloadedAt: Date.now(),
      });
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { downloads: arrayUnion(m.id) }).catch(async () => {
          await setDoc(doc(db, "users", user.uid), { downloads: [m.id] }, { merge: true });
        });
      }
      toast("Saved for offline viewing");
    } catch (e) {
      toast("Couldn't download (" + e.message + ")");
    }
  }

  // ----- SHARE -----
  function openShareSheet(m) {
    const sheet = $("#shareSheet");
    $("#shareThumb").src = m.poster || "./assets/logo.png";
    $("#shareTitle").textContent = m.title || "Share this movie";
    const link = `https://moviepulse-256.web.app/movie.html?id=${encodeURIComponent(m.id)}`;
    sheet.hidden = false;
    $("#shareClose").onclick = () => (sheet.hidden = true);
    sheet.querySelectorAll("[data-share]").forEach((b) => {
      b.onclick = async () => {
        const k = b.dataset.share;
        const text = `${m.title} on MoviePulse`;
        const enc = encodeURIComponent(`${text} — ${link}`);
        if (k === "whatsapp") window.open(`https://wa.me/?text=${enc}`, "_blank");
        else if (k === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, "_blank");
        else if (k === "twitter") window.open(`https://twitter.com/intent/tweet?text=${enc}`, "_blank");
        else if (k === "telegram") window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, "_blank");
        else if (k === "copy") {
          try { await navigator.clipboard.writeText(link); b.querySelector("i").className = "fa-solid fa-check"; toast("Link copied!"); setTimeout(() => (b.querySelector("i").className = "fa-solid fa-link"), 1400); }
          catch { toast("Copy failed"); }
        }
        else if (k === "more") {
          if (navigator.share) { try { await navigator.share({ title: text, url: link }); } catch {} }
          else toast("Sharing not supported");
        }
      };
    });
  }

  // ----- REPORT -----
  function openReport(m) {
    const md = $("#reportModal");
    md.hidden = false;
    $("#reportClose").onclick = () => (md.hidden = true);
    $("#reportSubmit").onclick = async () => {
      try {
        await addDoc(collection(db, "reports"), {
          movieId: m.id,
          userId: user?.uid || null,
          reason: $("#reportReason").value,
          message: $("#reportMessage").value,
          status: "pending",
          createdAt: serverTimestamp(),
        });
        toast("Report sent. Thank you!");
        md.hidden = true;
      } catch (e) { toast(e.message); }
    };
  }

  // ----- RATINGS -----
  function setupRatings(m) {
    const stars = $("#userStars");
    const submit = $("#submitRating");
    let chosen = 0;

    const userQ = query(collection(db, "ratings"), where("movieId", "==", m.id));
    onSnapshot(userQ, (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      const total = list.length;
      const sum = list.reduce((a, b) => a + (Number(b.stars) || 0), 0);
      const avg = total ? sum / total : 0;
      $("#avgScore").textContent = avg.toFixed(1);
      const filled = Math.round(avg);
      $$("#avgStars i").forEach((el, i) => el.classList.toggle("filled", i < filled));
      $("#ratingTotal").textContent = `${total} ${total === 1 ? "rating" : "ratings"}`;
      // distribution
      const dist = [5,4,3,2,1].map((n) => ({
        n,
        pct: total ? (list.filter((x) => Number(x.stars) === n).length / total) * 100 : 0,
      }));
      $("#ratingBars").innerHTML = dist.map((d) => `<div class="rating-bar-row">${d.n}<i class="fa-solid fa-star" style="color:#ffc83d"></i><div class="bar"><span style="width:${d.pct}%"></span></div></div>`).join("");
      // Pre-select user's rating if any
      if (user) {
        const mine = list.find((r) => r.userId === user.uid);
        if (mine && !chosen) selectStars(mine.stars);
      }
    });

    function selectStars(n) {
      chosen = n;
      $$("#userStars i").forEach((el, i) => {
        el.classList.toggle("selected", i < n);
        el.className = (i < n ? "fa-solid" : "fa-regular") + " fa-star" + (i < n ? " selected" : "");
        el.dataset.n = i + 1;
      });
      submit.disabled = false;
    }
    stars.addEventListener("mouseover", (e) => {
      const t = e.target.closest("[data-n]"); if (!t) return;
      const n = parseInt(t.dataset.n, 10);
      $$("#userStars i").forEach((el, i) => el.classList.toggle("hover", i < n));
    });
    stars.addEventListener("mouseout", () => $$("#userStars i").forEach((el) => el.classList.remove("hover")));
    stars.addEventListener("click", (e) => {
      const t = e.target.closest("[data-n]"); if (!t) return;
      selectStars(parseInt(t.dataset.n, 10));
    });
    submit.addEventListener("click", async () => {
      if (!user) { toast("Sign in to rate"); return setTimeout(() => location.href = "./login.html", 800); }
      if (!chosen) return;
      try {
        // upsert: overwrite if user already rated
        const qExisting = query(collection(db, "ratings"), where("movieId", "==", m.id), where("userId", "==", user.uid));
        const ex = await getDocs(qExisting);
        if (!ex.empty) {
          await updateDoc(doc(db, "ratings", ex.docs[0].id), { stars: chosen, updatedAt: serverTimestamp() });
        } else {
          await addDoc(collection(db, "ratings"), {
            movieId: m.id, userId: user.uid, stars: chosen, createdAt: serverTimestamp(),
          });
        }
        toast("Thanks for rating!");
      } catch (e) { toast(e.message); }
    });
  }
}

// ============================================================
// PAGE: DOWNLOADS (downloads.html)
// ============================================================
async function bootDownloads() {
  const grid = $("#downloadsGrid");
  const empty = $("#downloadsEmpty");
  const items = await idbList();
  if (!items.length) { empty.hidden = false; return; }
  grid.innerHTML = items.map((d) => `
    <div class="card">
      <div class="card-img">${lazyImg(d.poster, d.title)}</div>
      <div class="card-meta">
        <div class="card-title">${escapeHTML(d.title || "Untitled")}</div>
        <div class="card-sub">${(d.size / (1024*1024)).toFixed(1)} MB · ${formatDate(d.downloadedAt)}</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-primary btn-sm" data-play="${escapeHTML(d.id)}" style="flex:1"><i class="fa-solid fa-play"></i> Play</button>
          <button class="btn btn-ghost btn-sm" data-del="${escapeHTML(d.id)}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join("");
  grid.addEventListener("click", async (e) => {
    const p = e.target.closest("[data-play]");
    const d = e.target.closest("[data-del]");
    if (p) {
      const it = await idbGet(p.dataset.play);
      if (!it) return;
      const url = URL.createObjectURL(it.blob);
      playSimpleVideo(url);
    }
    if (d) {
      await idbDelete(d.dataset.del);
      toast("Removed from downloads");
      bootDownloads();
    }
  });
}

// ============================================================
// IndexedDB — offline downloads
// ============================================================
const DB_NAME = "moviepulse-db";
const DB_STORE = "downloads";
function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbAdd(item) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(item);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbList() {
  try {
    const db = await idbOpen();
    return await new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const r = tx.objectStore(DB_STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  } catch { return []; }
}
async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const r = tx.objectStore(DB_STORE).get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ============================================================
// BOOT — pick the right page handler
// ============================================================
const BOOTS = {
  index: bootHome,
  movie: bootMovie,
  series: bootSeries,
  search: bootSearch,
  subscription: bootSubscription,
  account: bootAccount,
  downloads: bootDownloads,
  login: bootLogin,
  register: bootRegister,
};
const handler = BOOTS[PAGE];
if (handler) handler().catch((e) => { console.error(e); toast(e.message || "Error loading page"); });
