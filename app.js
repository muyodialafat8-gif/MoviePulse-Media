import { auth, db, signInWithGoogle, signUpWithEmail, signInWithEmail, logoutUser, getCurrentUserData, getMovies, showToast, onAuthStateChanged } from './firebase.js';

let currentUser = null;

// ===== LOADING SCREEN =====
document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.style.display = 'none', 800);
        }, 2500);
    }
    
    loadSavedTheme();
    setupEventListeners();
    
    // Check auth
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userData = await getCurrentUserData();
            updateUserUI(userData);
        }
        loadHomepageContent();
    });
});

// ===== THEME =====
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('mp_theme') || 'dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const body = document.body;
    body.classList.remove('dark', 'light');
    if (theme === 'dark') body.classList.add('dark');
    else if (theme === 'light') body.classList.add('light');
    localStorage.setItem('mp_theme', theme);
}

function setupThemeToggles() {
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) applyTheme(e.target.value);
        });
        if (radio.value === localStorage.getItem('mp_theme')) radio.checked = true;
    });
}

// ===== HOMEPAGE =====
async function loadHomepageContent() {
    const sectionsContainer = document.getElementById('sectionsContainer');
    if (!sectionsContainer) return;
    
    sectionsContainer.innerHTML = '<div class="carousel-section"><h3 class="carousel-title">Trending</h3><div class="carousel-track"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div></div>';
    
    const trending = await getMovies('trending', 10);
    const featured = await getMovies('featured', 10);
    const newReleases = await getMovies('newReleases', 10);
    
    sectionsContainer.innerHTML = `
        ${trending.length ? `<div class="carousel-section"><h3 class="carousel-title">🔥 Trending Now</h3><div class="carousel-track">${renderMovieCards(trending)}</div></div>` : ''}
        ${featured.length ? `<div class="carousel-section"><h3 class="carousel-title">⭐ Featured</h3><div class="carousel-track">${renderMovieCards(featured)}</div></div>` : ''}
        ${newReleases.length ? `<div class="carousel-section"><h3 class="carousel-title">🆕 New Releases</h3><div class="carousel-track">${renderMovieCards(newReleases)}</div></div>` : ''}
    `;
    
    if (!trending.length && !featured.length && !newReleases.length) {
        sectionsContainer.innerHTML = '<div style="text-align:center; padding:50px"><h3>No movies yet</h3><p>Add movies to Firestore "movies" collection</p></div>';
    }
}

function renderMovieCards(movies) {
    return movies.map(movie => `
        <div class="movie-card" onclick="location.href='movie.html?id=${movie.id}'">
            <img src="${movie.poster || 'https://via.placeholder.com/300x450'}" alt="${movie.title}" loading="lazy">
            <h4>${movie.title}</h4>
            <div class="live-counter">👁️ ${Math.floor(Math.random() * 500) + 50} watching</div>
        </div>
    `).join('');
}

// ===== USER UI =====
function updateUserUI(userData) {
    const avatarLetter = document.getElementById('avatarLetter');
    if (avatarLetter && userData?.fullName) {
        avatarLetter.textContent = userData.fullName.charAt(0).toUpperCase();
    }
    
    const profileName = document.getElementById('profileName');
    if (profileName && userData?.fullName) profileName.textContent = userData.fullName;
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail && currentUser?.email) profileEmail.textContent = currentUser.email;
    
    const subBadge = document.getElementById('subStatusBadge');
    if (subBadge) {
        const isActive = userData?.subscriptionStatus === 'active';
        subBadge.textContent = isActive ? 'ACTIVE' : 'INACTIVE';
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            const modal = document.getElementById('settingsModal');
            if (modal) modal.classList.remove('hidden');
            setupThemeToggles();
        };
    }
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => btn.closest('.modal')?.classList.add('hidden');
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async (e) => { e.preventDefault(); await logoutUser(); };
    
    // Profile dropdown
    const profileAvatar = document.getElementById('profileAvatar');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileAvatar && profileDropdown) {
        profileAvatar.onclick = () => profileDropdown.classList.toggle('hidden');
    }
    
    // Login/Register forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            if (email && password) {
                const result = await signInWithEmail(email, password);
                if (result.success) window.location.href = 'index.html';
            }
        };
    }
    
    const googleBtn = document.getElementById('googleLoginBtn');
    if (googleBtn) {
        googleBtn.onclick = async () => {
            const result = await signInWithGoogle();
            if (result.success) window.location.href = 'index.html';
        };
    }
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('fullName')?.value;
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirm = document.getElementById('confirmPassword')?.value;
            if (password !== confirm) { showToast('Passwords do not match', 'error'); return; }
            if (name && email && password) {
                const result = await signUpWithEmail(email, password, name);
                if (result.success) window.location.href = 'login.html';
            }
        };
    }
}

// Make functions global for HTML onclick
window.location = window.location;