import { auth, db, onAuthStateChanged, doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp } from './firebase.js';

// Global variables
let currentUser = null;
let settingsCache = null;
let activeUnsubscribes = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await showLoadingScreen();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            await loadSettings();
            await loadHomepage();
            setupEventListeners();
            checkFirstVisit();
            checkNotificationPrompt();
            hideLoadingScreen();
        } else if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
            window.location.href = 'login.html';
        }
    });
});

// Loading screen
async function showLoadingScreen() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                setTimeout(() => {
                    document.getElementById('main-content').style.display = 'block';
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                        resolve();
                    }, 800);
                }, 2500);
            } else {
                resolve();
            }
        }, 100);
    });
}

function hideLoadingScreen() {
    const loading = document.getElementById('loading-screen');
    if (loading && loading.style.display !== 'none') {
        loading.style.opacity = '0';
        setTimeout(() => {
            loading.style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        }, 800);
    } else if (document.getElementById('main-content')) {
        document.getElementById('main-content').style.display = 'block';
    }
}

// Load user data from Firestore
async function loadUserData() {
    if (!currentUser) return;
    
    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
        // Create user document
        await setDoc(userRef, {
            email: currentUser.email,
            fullName: currentUser.displayName || currentUser.email.split('@')[0],
            createdAt: serverTimestamp(),
            role: 'user',
            isAdmin: false,
            subscriptionStatus: 'inactive',
            planType: null,
            expiryDate: null,
            dailyWatchCount: 0,
            lastWatchDate: null,
            favorites: [],
            watchHistory: [],
            downloads: [],
            continueWatching: [],
            referralCode: generateReferralCode(),
            referralCount: 0
        });
    }
    
    window.userData = (await getDoc(userRef)).data();
}

function generateReferralCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Load settings from Firestore
async function loadSettings() {
    const settingsRef = doc(db, 'settings', 'appSettings');
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
        settingsCache = settingsDoc.data();
    } else {
        // Default settings
        settingsCache = {
            ads_enabled: false,
            ad_video_url: "",
            ad_skip_time: 5,
            price_daily: 1600,
            price_weekly: 6000,
            price_monthly: 25000,
            price_lifetime: 55000,
            footerText: "© 2026 MoviePulse. All rights reserved.",
            whatsapp_channel_url: "https://whatsapp.com/channel/0029Vb73dtF5kg76mEEo1L3a",
            free_user_daily_limit: 3,
            trust_badges: [
                { icon: "🔒", text: "No auto-renewal" },
                { icon: "✅", text: "Manual activation by admin" },
                { icon: "📱", text: "WhatsApp support" }
            ],
            testimonials: [
                { name: "John", location: "Kampala", text: "Best streaming in Uganda!" }
            ],
            homepage_sections_order: ["trending", "featured", "newReleases", "continueWatching"]
        };
    }
    
    window.appSettings = settingsCache;
}

// Load homepage with dynamic sections
async function loadHomepage() {
    const sectionsContainer = document.getElementById('sections-container');
    if (!sectionsContainer) return;
    
    sectionsContainer.innerHTML = '';
    
    // Load hero slider
    await loadHeroSlider();
    
    // Load each section based on order
    for (const sectionName of settingsCache.homepage_sections_order) {
        await loadSection(sectionName);
    }
}

async function loadHeroSlider() {
    const moviesRef = collection(db, 'movies');
    const q = query(moviesRef, where('featured', '==', true));
    const snapshot = await getDocs(q);
    const featuredMovies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const heroTrack = document.getElementById('hero-track');
    const heroDots = document.getElementById('hero-dots');
    
    if (!heroTrack || featuredMovies.length === 0) return;
    
    heroTrack.innerHTML = '';
    heroDots.innerHTML = '';
    
    featuredMovies.forEach((movie, index) => {
        const slide = document.createElement('div');
        slide.className = 'hero-slide';
        slide.onclick = () => window.location.href = `movie.html?id=${movie.id}`;
        slide.innerHTML = `
            <img src="${movie.poster}" alt="${movie.title}">
            <div class="hero-overlay">
                <div class="hero-title">${movie.title}</div>
                <button class="hero-btn" onclick="event.stopPropagation(); window.location.href='subscription.html'">Subscribe Now</button>
            </div>
        `;
        heroTrack.appendChild(slide);
        
        const dot = document.createElement('div');
        dot.className = `hero-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(index);
        heroDots.appendChild(dot);
    });
    
    let currentSlide = 0;
    window.goToSlide = (index) => {
        currentSlide = index;
        heroTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
        document.querySelectorAll('.hero-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    };
    
    setInterval(() => {
        currentSlide = (currentSlide + 1) % featuredMovies.length;
        window.goToSlide(currentSlide);
    }, 5000);
}

async function loadSection(sectionName) {
    const sectionsContainer = document.getElementById('sections-container');
    let movies = [];
    let sectionTitle = '';
    
    switch(sectionName) {
        case 'trending':
            const trendingQuery = query(collection(db, 'movies'), where('trending', '==', true));
            const trendingSnap = await getDocs(trendingQuery);
            movies = trendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sectionTitle = '🔥 Trending Now';
            break;
            
        case 'featured':
            const featuredQuery = query(collection(db, 'movies'), where('featured', '==', true));
            const featuredSnap = await getDocs(featuredQuery);
            movies = featuredSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sectionTitle = '⭐ Featured Movies';
            break;
            
        case 'newReleases':
            const newQuery = query(collection(db, 'movies'), where('isNew', '==', true));
            const newSnap = await getDocs(newQuery);
            movies = newSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sectionTitle = '🆕 New Releases';
            break;
            
        case 'continueWatching':
            if (window.userData?.continueWatching?.length > 0) {
                movies = window.userData.continueWatching;
                sectionTitle = '⏯️ Continue Watching';
            }
            break;
    }
    
    if (movies.length === 0) return;
    
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `
        <div class="section-header">
            <h2 class="section-title">${sectionTitle}</h2>
        </div>
        <div class="carousel" id="carousel-${sectionName}">
            ${movies.map(movie => renderMovieCard(movie)).join('')}
        </div>
    `;
    
    sectionsContainer.appendChild(section);
}

function renderMovieCard(movie) {
    const isPremium = movie.isPremium || false;
    const hasTrailer = movie.trailerUrl && movie.trailerUrl !== '';
    
    return `
        <div class="movie-card ${isPremium ? 'premium' : ''}" onclick="window.location.href='movie.html?id=${movie.id}'">
            <img class="movie-poster" src="${movie.poster}" alt="${movie.title}" loading="lazy">
            ${isPremium ? '<div class="premium-badge">PREMIUM</div>' : ''}
            ${hasTrailer ? '<div class="trailer-badge">🎬 Trailer</div>' : ''}
            <div class="movie-title">${movie.title}</div>
        </div>
    `;
}

// Check first visit for welcome popup
function checkFirstVisit() {
    const hasWelcomed = localStorage.getItem('mp_welcomed');
    if (!hasWelcomed) {
        showWelcomePopup();
    }
}

function showWelcomePopup() {
    const popup = document.createElement('div');
    popup.className = 'welcome-popup';
    popup.innerHTML = `
        <div class="welcome-content">
            <div style="font-size: 48px; animation: pulse 1s infinite;">🎬</div>
            <h2 style="color: #e50914; margin: 15px 0;">Welcome to MoviePulse</h2>
            <p>Your ultimate destination for movies and series. Join our community for updates and new content!</p>
            <button id="join-whatsapp-btn" style="background: #25D366; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin-top: 20px; cursor: pointer;">
                📱 Join our WhatsApp Channel
            </button>
            <p id="maybe-later" style="margin-top: 15px; text-decoration: underline; cursor: pointer;">Maybe Later</p>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    document.getElementById('join-whatsapp-btn').onclick = () => {
        window.open(settingsCache.whatsapp_channel_url, '_blank');
        localStorage.setItem('mp_welcomed', 'true');
        popup.remove();
    };
    
    document.getElementById('maybe-later').onclick = () => {
        localStorage.setItem('mp_welcomed', 'true');
        popup.remove();
    };
}

// Notification prompt
function checkNotificationPrompt() {
    const notifStatus = localStorage.getItem('mp_notif');
    if (notifStatus === 'granted' || notifStatus === 'declined') return;
    
    setTimeout(() => {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'welcome-popup';
        promptDiv.innerHTML = `
            <div class="welcome-content">
                <div style="font-size: 48px;">🔔</div>
                <h3>Stay Updated!</h3>
                <p>Enable push notifications to get instant alerts when new movies and series are added.</p>
                <button id="enable-notif-btn" style="background: #e50914; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin-top: 20px; cursor: pointer;">
                    Enable Notifications
                </button>
                <p id="notif-later" style="margin-top: 15px; text-decoration: underline; cursor: pointer;">Maybe Later</p>
            </div>
        `;
        
        document.body.appendChild(promptDiv);
        
        document.getElementById('enable-notif-btn').onclick = async () => {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    localStorage.setItem('mp_notif', 'granted');
                    showToast('Notifications enabled!', 'success');
                } else {
                    localStorage.setItem('mp_notif', 'declined');
                }
            }
            promptDiv.remove();
        };
        
        document.getElementById('notif-later').onclick = () => {
            localStorage.setItem('mp_notif', 'later');
            promptDiv.remove();
        };
    }, 1000);
}

// Settings modal
function setupEventListeners() {
    const settingsBtn = document.getElementById('settings-gear');
    const settingsModal = document.getElementById('settings-modal');
    const closeModal = document.querySelector('.close-modal');
    
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            loadSettingsIntoModal();
            settingsModal.classList.add('active');
        };
    }
    
    if (closeModal) {
        closeModal.onclick = () => settingsModal.classList.remove('active');
    }
    
    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.onchange = (e) => {
            const theme = e.target.value;
            if (theme === 'dark') {
                document.body.classList.remove('light');
                document.body.classList.add('dark');
            } else if (theme === 'light') {
                document.body.classList.remove('dark');
                document.body.classList.add('light');
            } else {
                // Auto - follow system
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.body.classList.toggle('light', !prefersDark);
                document.body.classList.toggle('dark', prefersDark);
            }
            localStorage.setItem('mp_theme', theme);
        };
        
        const savedTheme = localStorage.getItem('mp_theme') || 'dark';
        themeSelect.value = savedTheme;
        if (savedTheme === 'dark') {
            document.body.classList.remove('light');
            document.body.classList.add('dark');
        } else if (savedTheme === 'light') {
            document.body.classList.remove('dark');
            document.body.classList.add('light');
        }
    }
    
    // Clear history button
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn && currentUser) {
        clearHistoryBtn.onclick = async () => {
            if (confirm('Clear all watch history?')) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    watchHistory: []
                });
                showToast('History cleared', 'success');
            }
        };
    }
}

function loadSettingsIntoModal() {
    const qualitySelect = document.getElementById('video-quality');
    const savedQuality = localStorage.getItem('mp_quality') || 'auto';
    if (qualitySelect) qualitySelect.value = savedQuality;
    
    const skipSelect = document.getElementById('skip-seconds');
    const savedSkip = localStorage.getItem('mp_skip_seconds') || '10';
    if (skipSelect) skipSelect.value = savedSkip;
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.showToast = showToast;
window.renderMovieCard = renderMovieCard;