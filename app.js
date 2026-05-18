import { 
    auth, db, 
    signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, logoutUser,
    getCurrentUserData, getMovieById, getMovies, searchMovies,
    addToFavorites, removeFromFavorites, addToWatchHistory, updateContinueWatching,
    getAppSettings, getAllCategories, showToast,
    onAuthStateChanged, updateDoc, doc, getDoc, collection,
    query, where, getDocs, increment, serverTimestamp, arrayUnion, arrayRemove
} from './firebase.js';

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let currentMovie = null;
let currentVideoElement = null;
let watchProgressInterval = null;
let currentAdTimeout = null;
let liveCounterInterval = null;
let moviesWatchedCount = 0;
let deferredPrompt = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 800);
        }, 2500);
    }

    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userData = await getCurrentUserData();
            if (userData) {
                updateUserInterface(userData);
                // Check daily streak
                await updateDailyStreak(userData);
                // Get movies watched count
                moviesWatchedCount = userData.watchHistory?.length || 0;
                // Check if should show rate popup
                if (moviesWatchedCount >= 5 && !localStorage.getItem('mp_rated')) {
                    setTimeout(() => showRateModal(), 3000);
                }
            }
        } else {
            currentUser = null;
            // Check if on protected page
            const protectedPages = ['account.html', 'downloads.html'];
            if (protectedPages.some(page => window.location.pathname.includes(page))) {
                window.location.href = 'login.html';
            }
        }
    });

    // Load settings and apply theme
    await loadAndApplySettings();
    
    // Initialize PWA install banner
    initPWAInstall();
    
    // Initialize welcome popup
    showWelcomePopup();
    
    // Initialize push notification prompt
    initNotificationPrompt();
    
    // Initialize live counters on movie cards
    startLiveCounters();
    
    // Setup event listeners for current page
    setupPageSpecificListeners();
});

// ==================== THEME MANAGEMENT ====================
async function loadAndApplySettings() {
    const settings = await getAppSettings();
    const savedTheme = localStorage.getItem('mp_theme') || 'dark';
    applyTheme(savedTheme);
    
    // Setup theme toggle buttons
    const themeToggles = document.querySelectorAll('input[name="theme"]');
    themeToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                applyTheme(e.target.value);
                localStorage.setItem('mp_theme', e.target.value);
            }
        });
        
        if (toggle.value === savedTheme) {
            toggle.checked = true;
        }
    });
}

function applyTheme(theme) {
    const body = document.body;
    if (theme === 'dark') {
        body.classList.remove('light');
        body.classList.add('dark');
    } else if (theme === 'light') {
        body.classList.remove('dark');
        body.classList.add('light');
    }
}

// ==================== USER INTERFACE ====================
function updateUserInterface(userData) {
    // Update avatar letters
    const avatarLetters = document.querySelectorAll('#avatarLetter, #largeAvatarLetter');
    const firstName = userData.fullName?.charAt(0)?.toUpperCase() || 'U';
    avatarLetters.forEach(el => {
        if (el) el.textContent = firstName;
    });
    
    // Update profile info
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = userData.fullName || 'User';
    
    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = currentUser?.email || '';
    
    const joinDateEl = document.getElementById('joinDate');
    if (joinDateEl && userData.createdAt) {
        const date = userData.createdAt.toDate?.() || new Date();
        joinDateEl.textContent = `Joined: ${date.toLocaleDateString()}`;
    }
    
    // Update subscription status
    const subBadge = document.getElementById('subStatusBadge');
    if (subBadge) {
        const isActive = userData.subscriptionStatus === 'active';
        subBadge.textContent = isActive ? 'ACTIVE' : 'INACTIVE';
        subBadge.className = `status-badge ${isActive ? 'active' : 'inactive'}`;
    }
    
    const planTypeEl = document.getElementById('planType');
    if (planTypeEl && userData.planType) {
        planTypeEl.textContent = userData.planType.toUpperCase();
    }
    
    // Update premium badges
    if (userData.subscriptionStatus === 'active') {
        document.getElementById('premiumMemberBadge')?.classList.remove('hidden');
        if (userData.planType === 'lifetime') {
            document.getElementById('lifetimeBadge')?.classList.remove('hidden');
        }
    }
    
    // Load favorites grid
    loadFavoritesGrid(userData.favorites || []);
    
    // Load watch history
    loadWatchHistory(userData.watchHistory || []);
    
    // Load continue watching
    loadContinueWatching(userData.continueWatching || []);
    
    // Update daily limit display
    updateDailyLimitDisplay(userData);
    
    // Show admin section if isAdmin
    if (userData.isAdmin) {
        const adminSection = document.getElementById('adminSection');
        if (adminSection) adminSection.style.display = 'block';
    }
}

// ==================== FAVORITES ====================
async function loadFavoritesGrid(favoriteIds) {
    const container = document.getElementById('favoritesGrid');
    if (!container) return;
    
    if (!favoriteIds || favoriteIds.length === 0) {
        container.innerHTML = '<p class="empty-message">No favorites yet. Add some movies!</p>';
        return;
    }
    
    container.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
    
    const movies = [];
    for (const id of favoriteIds.slice(0, 10)) {
        const movie = await getMovieById(id);
        if (movie) movies.push(movie);
    }
    
    container.innerHTML = movies.map(movie => `
        <div class="movie-card" onclick="location.href='movie.html?id=${movie.id}'">
            <img src="${movie.poster}" alt="${movie.title}" loading="lazy">
            <div class="live-counter" data-movie-id="${movie.id}">👁️ ${Math.floor(Math.random() * 500) + 50} watching</div>
            <h4>${movie.title}</h4>
        </div>
    `).join('');
}

// ==================== WATCH HISTORY ====================
function loadWatchHistory(history) {
    const container = document.getElementById('historyList');
    if (!container) return;
    
    if (!history || history.length === 0) {
        container.innerHTML = '<p class="empty-message">No watch history yet.</p>';
        return;
    }
    
    const recentHistory = history.slice(-10).reverse();
    container.innerHTML = recentHistory.map(item => `
        <div class="history-item" onclick="location.href='movie.html?id=${item.movieId}'">
            <span>🎬 ${item.movieId}</span>
            <span class="history-date">${new Date(item.timestamp).toLocaleDateString()}</span>
        </div>
    `).join('');
    
    // Update statistics
    updateWatchStatistics(history);
}

async function updateWatchStatistics(history) {
    const totalMovies = history.length;
    const totalHours = Math.floor(history.reduce((sum, item) => sum + (item.watchedSeconds || 0), 0) / 3600);
    
    const totalEl = document.getElementById('totalMoviesWatched');
    if (totalEl) totalEl.textContent = totalMovies;
    
    const hoursEl = document.getElementById('totalHoursWatched');
    if (hoursEl) hoursEl.textContent = totalHours;
    
    // Get favorite category
    if (totalMovies > 0) {
        const categories = {};
        for (const item of history) {
            const movie = await getMovieById(item.movieId);
            if (movie && movie.category) {
                categories[movie.category] = (categories[movie.category] || 0) + 1;
            }
        }
        const favCategory = Object.entries(categories).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';
        const favEl = document.getElementById('favoriteCategory');
        if (favEl) favEl.textContent = favCategory;
    }
}

// ==================== CONTINUE WATCHING ====================
function loadContinueWatching(continueWatching) {
    const container = document.getElementById('continueWatchingGrid');
    if (!container) return;
    
    if (!continueWatching || continueWatching.length === 0) {
        container.innerHTML = '<p class="empty-message">No movies in progress.</p>';
        return;
    }
    
    container.innerHTML = continueWatching.slice(0, 6).map(item => `
        <div class="continue-card" onclick="location.href='movie.html?id=${item.movieId}'">
            <img src="${item.poster}" alt="${item.title}">
            <div class="progress-bar"><div class="progress-fill" style="width:${item.progress}%"></div></div>
            <span>${item.title}</span>
        </div>
    `).join('');
}

// ==================== DAILY STREAK ====================
async function updateDailyStreak(userData) {
    const today = new Date().toDateString();
    const lastWatch = userData.lastWatchStreak ? new Date(userData.lastWatchStreak).toDateString() : null;
    let streak = userData.streakCount || 0;
    
    if (lastWatch === today) {
        // Already updated today
    } else if (lastWatch && new Date(lastWatch) >= new Date(Date.now() - 86400000)) {
        // Watched yesterday, increment streak
        streak++;
        await updateDoc(doc(db, "users", currentUser.uid), {
            streakCount: streak,
            lastWatchStreak: new Date().toISOString()
        });
    } else if (lastWatch !== today) {
        // Streak broken or first watch
        streak = 1;
        await updateDoc(doc(db, "users", currentUser.uid), {
            streakCount: streak,
            lastWatchStreak: new Date().toISOString()
        });
    }
    
    const streakEl = document.getElementById('streakCount');
    if (streakEl) streakEl.textContent = streak;
    
    const streakMsgEl = document.getElementById('streakMessage');
    if (streakMsgEl && streak > 0) {
        streakMsgEl.textContent = `Watch tomorrow to reach ${streak + 1} day streak! 🔥`;
    }
}

// ==================== DAILY LIMIT ====================
function updateDailyLimitDisplay(userData) {
    const container = document.getElementById('dailyLimitSection');
    if (!container) return;
    
    const today = new Date().toDateString();
    const lastWatchDate = userData.lastWatchDate?.toDate?.()?.toDateString();
    const dailyCount = lastWatchDate === today ? (userData.dailyWatchCount || 0) : 0;
    const limit = 3; // From settings
    
    const progressEl = document.getElementById('dailyProgress');
    if (progressEl) progressEl.textContent = `${dailyCount}/${limit} movies watched today`;
    
    const fillEl = document.getElementById('dailyLimitFill');
    if (fillEl) fillEl.style.width = `${(dailyCount / limit) * 100}%`;
}

// ==================== VIDEO PLAYER ====================
function setupVideoPlayer(movieId, isSeries = false) {
    const overlay = document.getElementById('videoPlayerOverlay');
    const mainVideo = document.getElementById('mainVideo');
    const adVideo = document.getElementById('adVideo');
    const adContainer = document.getElementById('adContainer');
    const mainContainer = document.getElementById('mainVideoContainer');
    const premiumLock = document.getElementById('premiumLockOverlay');
    const closeBtn = document.getElementById('closeVideoBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBar = document.getElementById('progressBar');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const currentTimeSpan = document.getElementById('currentTime');
    const durationSpan = document.getElementById('duration');
    
    if (!overlay) return;
    
    overlay.classList.remove('hidden');
    currentVideoElement = mainVideo;
    
    // Load movie data
    getMovieById(movieId).then(async (movie) => {
        currentMovie = movie;
        const userData = await getCurrentUserData();
        const isPremium = movie.isPremium === true;
        const hasSubscription = userData?.subscriptionStatus === 'active';
        
        // Check if should show premium lock
        if (isPremium && !hasSubscription) {
            mainContainer.classList.add('hidden');
            premiumLock.classList.remove('hidden');
            return;
        }
        
        // Check daily limit for free users
        if (!hasSubscription && !isPremium) {
            const today = new Date().toDateString();
            const lastWatchDate = userData?.lastWatchDate?.toDate?.()?.toDateString();
            const dailyCount = lastWatchDate === today ? (userData?.dailyWatchCount || 0) : 0;
            const settings = await getAppSettings();
            const limit = settings.free_user_daily_limit || 3;
            
            if (dailyCount >= limit) {
                showToast(`Daily limit reached! Upgrade to premium for unlimited movies.`, "warning");
                overlay.classList.add('hidden');
                return;
            }
            
            // Increment daily count
            await updateDoc(doc(db, "users", currentUser.uid), {
                dailyWatchCount: dailyCount + 1,
                lastWatchDate: serverTimestamp()
            });
        }
        
        // Check for ads
        const settings = await getAppSettings();
        if (settings.ads_enabled && !isPremium && !hasSubscription) {
            playAd(settings, movie);
        } else {
            playVideo(movie.videoUrl);
        }
        
        // Add to watch history
        await addToWatchHistory(movieId, 0);
    });
    
    // Setup close button
    closeBtn.onclick = () => {
        overlay.classList.add('hidden');
        if (watchProgressInterval) clearInterval(watchProgressInterval);
        if (currentAdTimeout) clearTimeout(currentAdTimeout);
        if (mainVideo) mainVideo.pause();
        if (adVideo) adVideo.pause();
    };
    
    // Setup video controls
    playPauseBtn.onclick = () => {
        if (mainVideo.paused) mainVideo.play();
        else mainVideo.pause();
    };
    
    mainVideo.onplay = () => playPauseBtn.textContent = '⏸';
    mainVideo.onpause = () => playPauseBtn.textContent = '▶';
    
    mainVideo.ontimeupdate = () => {
        if (mainVideo.duration) {
            const progress = (mainVideo.currentTime / mainVideo.duration) * 100;
            progressBar.value = progress;
            currentTimeSpan.textContent = formatTime(mainVideo.currentTime);
        }
    };
    
    mainVideo.onloadedmetadata = () => {
        durationSpan.textContent = formatTime(mainVideo.duration);
    };
    
    progressBar.oninput = (e) => {
        const time = (e.target.value / 100) * mainVideo.duration;
        mainVideo.currentTime = time;
    };
    
    volumeSlider.oninput = (e) => {
        mainVideo.volume = e.target.value;
        volumeBtn.textContent = mainVideo.volume === 0 ? '🔇' : '🔊';
    };
    
    fullscreenBtn.onclick = () => {
        if (mainVideo.requestFullscreen) mainVideo.requestFullscreen();
    };
    
    // Track watch progress every 10 seconds
    watchProgressInterval = setInterval(async () => {
        if (mainVideo && mainVideo.duration && currentUser) {
            const progress = (mainVideo.currentTime / mainVideo.duration) * 100;
            await updateContinueWatching(movieId, progress, currentMovie?.title, currentMovie?.poster);
        }
    }, 10000);
}

function playAd(settings, movie) {
    const adContainer = document.getElementById('adContainer');
    const mainContainer = document.getElementById('mainVideoContainer');
    const adVideo = document.getElementById('adVideo');
    const skipBtn = document.getElementById('skipAdBtn');
    const skipTimer = document.getElementById('skipTimer');
    
    adContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
    
    if (settings.ad_video_url) {
        adVideo.src = settings.ad_video_url;
        adVideo.play();
        
        let secondsLeft = settings.ad_skip_time || 5;
        skipBtn.classList.add('hidden');
        
        const timerInterval = setInterval(() => {
            secondsLeft--;
            if (skipTimer) skipTimer.textContent = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                skipBtn.classList.remove('hidden');
            }
        }, 1000);
        
        skipBtn.onclick = () => {
            clearInterval(timerInterval);
            adVideo.pause();
            adContainer.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            playVideo(movie.videoUrl);
        };
        
        adVideo.onended = () => {
            clearInterval(timerInterval);
            adContainer.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            playVideo(movie.videoUrl);
        };
    } else {
        adContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        playVideo(movie.videoUrl);
    }
}

function playVideo(videoUrl) {
    const mainVideo = document.getElementById('mainVideo');
    if (mainVideo && videoUrl) {
        mainVideo.src = videoUrl;
        mainVideo.play();
    }
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    return `${mins}:${secs.toString().padStart(2,'0')}`;
}

// ==================== LIVE COUNTERS ====================
function startLiveCounters() {
    if (liveCounterInterval) clearInterval(liveCounterInterval);
    
    liveCounterInterval = setInterval(() => {
        document.querySelectorAll('.live-counter').forEach(counter => {
            const newCount = Math.floor(Math.random() * 500) + 50;
            counter.textContent = `👁️ ${newCount} watching`;
        });
    }, 30000);
}

// ==================== RATE MODAL ====================
function showRateModal() {
    const modal = document.getElementById('rateModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    const stars = modal.querySelectorAll('.star-rating span');
    let selectedRating = 0;
    
    stars.forEach((star, index) => {
        star.onclick = () => {
            selectedRating = index + 1;
            stars.forEach((s, i) => {
                s.textContent = i < selectedRating ? '★' : '☆';
            });
        };
    });
    
    const submitBtn = document.getElementById('submitRatingBtn');
    if (submitBtn) {
        submitBtn.onclick = () => {
            localStorage.setItem('mp_rated', 'true');
            showToast('Thank you for rating! ⭐', 'success');
            modal.classList.add('hidden');
        };
    }
}

// ==================== WELCOME POPUP ====================
function showWelcomePopup() {
    const hasSeen = localStorage.getItem('mp_welcomed');
    if (hasSeen) return;
    
    setTimeout(async () => {
        const settings = await getAppSettings();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content glass" style="text-align:center">
                <div class="welcome-icon">🎬</div>
                <h2>Welcome to MoviePulse!</h2>
                <p>Your ultimate destination for movies and series.</p>
                <button id="joinWhatsAppBtn" class="whatsapp-btn" style="margin:15px 0">💬 Join our WhatsApp Channel</button>
                <button id="maybeLaterBtn" class="btn-secondary">Maybe Later</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('joinWhatsAppBtn')?.addEventListener('click', () => {
            window.open(settings.whatsapp_channel_url, '_blank');
            localStorage.setItem('mp_welcomed', 'true');
            modal.remove();
        });
        
        document.getElementById('maybeLaterBtn')?.addEventListener('click', () => {
            localStorage.setItem('mp_welcomed', 'true');
            modal.remove();
        });
    }, 3000);
}

// ==================== NOTIFICATION PROMPT ====================
function initNotificationPrompt() {
    const hasSeen = localStorage.getItem('mp_notif');
    if (hasSeen === 'granted' || hasSeen === 'declined') return;
    
    setTimeout(() => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content glass" style="text-align:center">
                <div class="bell-icon">🔔</div>
                <h3>Stay Updated!</h3>
                <p>Get instant alerts when new movies are added.</p>
                <button id="enableNotifBtn" class="btn-primary" style="margin:15px 0">Enable Notifications</button>
                <button id="notifLaterBtn" class="btn-secondary">Maybe Later</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('enableNotifBtn')?.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                localStorage.setItem('mp_notif', 'granted');
                showToast('Notifications enabled! 🔔', 'success');
            } else {
                localStorage.setItem('mp_notif', 'declined');
            }
            modal.remove();
        });
        
        document.getElementById('notifLaterBtn')?.addEventListener('click', () => {
            localStorage.setItem('mp_notif', 'later');
            modal.remove();
        });
    }, 5000);
}

// ==================== PWA INSTALL ====================
function initPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const dismissed = localStorage.getItem('mp_install_dismissed');
        const dismissedDate = localStorage.getItem('mp_install_dismissed_date');
        
        if (!dismissed || (dismissedDate && Date.now() - parseInt(dismissedDate) > 7 * 86400000)) {
            showInstallBanner();
        }
    });
}

function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (!banner) return;
    
    banner.classList.remove('hidden');
    
    document.getElementById('installBtn')?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                localStorage.setItem('mp_installed', 'true');
            }
            deferredPrompt = null;
            banner.classList.add('hidden');
        }
    });
    
    document.getElementById('dismissInstallBtn')?.addEventListener('click', () => {
        banner.classList.add('hidden');
        localStorage.setItem('mp_install_dismissed', 'true');
        localStorage.setItem('mp_install_dismissed_date', Date.now().toString());
    });
}

// ==================== PAGE SPECIFIC ====================
function setupPageSpecificListeners() {
    // Login page
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            if (email && password) {
                const result = await signInWithEmail(email, password);
                if (result.success) window.location.href = 'index.html';
            }
        });
        
        const googleBtn = document.getElementById('googleLoginBtn');
        if (googleBtn) {
            googleBtn.onclick = async () => {
                const result = await signInWithGoogle();
                if (result.success) window.location.href = 'index.html';
            };
        }
        
        const forgotLink = document.getElementById('forgotPasswordLink');
        if (forgotLink) {
            forgotLink.onclick = () => {
                const email = prompt('Enter your email address:');
                if (email) resetPassword(email);
            };
        }
    }
    
    // Register page
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const passwordInput = document.getElementById('registerPassword');
        if (passwordInput) {
            passwordInput.addEventListener('input', updatePasswordStrength);
        }
        
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName')?.value;
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirm = document.getElementById('confirmPassword')?.value;
            
            if (password !== confirm) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            if (fullName && email && password) {
                const result = await signUpWithEmail(email, password, fullName);
                if (result.success) window.location.href = 'login.html';
            }
        });
        
        const googleBtn = document.getElementById('googleRegisterBtn');
        if (googleBtn) {
            googleBtn.onclick = async () => {
                const result = await signInWithGoogle();
                if (result.success) window.location.href = 'index.html';
            };
        }
    }
    
    // Movie page
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    if (movieId && document.getElementById('movieContent')) {
        loadMoviePage(movieId);
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            const modal = document.getElementById('settingsModal');
            if (modal) modal.classList.remove('hidden');
        };
    }
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            btn.closest('.modal')?.classList.add('hidden');
        };
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            await logoutUser();
        };
    }
    
    // WhatsApp community button
    const whatsappBtns = document.querySelectorAll('.whatsapp-btn');
    whatsappBtns.forEach(btn => {
        btn.onclick = async () => {
            const settings = await getAppSettings();
            window.open(settings.whatsapp_channel_url, '_blank');
        };
    });
}

async function loadMoviePage(movieId) {
    const movie = await getMovieById(movieId);
    if (!movie) return;
    
    // Set hero background
    const heroBackdrop = document.getElementById('heroBackdrop');
    if (heroBackdrop) heroBackdrop.style.backgroundImage = `url(${movie.poster})`;
    
    document.getElementById('movieTitle').textContent = movie.title;
    document.getElementById('movieDescription').textContent = movie.description || 'No description available';
    document.getElementById('movieCategory').textContent = movie.category || 'Movie';
    document.getElementById('vjName').textContent = movie.vjName ? `VJ: ${movie.vjName}` : '';
    document.getElementById('viewsCount').textContent = `${movie.views || 0} views`;
    
    if (movie.isPremium) {
        document.getElementById('premiumBadge')?.classList.remove('hidden');
    }
    
    if (movie.trailerUrl) {
        const trailerBtn = document.getElementById('trailerBtn');
        if (trailerBtn) {
            trailerBtn.classList.remove('hidden');
            trailerBtn.onclick = () => showTrailer(movie.trailerUrl);
        }
    }
    
    // Setup buttons
    document.getElementById('watchNowBtn').onclick = () => setupVideoPlayer(movieId);
    
    const favBtn = document.getElementById('favoriteBtn');
    if (favBtn) {
        const userData = await getCurrentUserData();
        const isFav = userData?.favorites?.includes(movieId);
        favBtn.innerHTML = isFav ? '❤️ Remove' : '❤️ Favorite';
        favBtn.onclick = async () => {
            if (isFav) await removeFromFavorites(movieId);
            else await addToFavorites(movieId);
            location.reload();
        };
    }
    
    document.getElementById('shareBtn').onclick = () => showShareSheet(movie);
    document.getElementById('reportBtn').onclick = () => showReportModal(movieId);
    
    // Load ratings
    await loadRatings(movieId);
}

async function loadRatings(movieId) {
    const ratingsQuery = query(collection(db, "ratings"), where("movieId", "==", movieId));
    const snapshot = await getDocs(ratingsQuery);
    const ratings = snapshot.docs.map(doc => doc.data());
    
    const avg = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length : 0;
    document.getElementById('avgScore').textContent = avg.toFixed(1);
    document.getElementById('totalRatings').textContent = `(${ratings.length} ratings)`;
    
    // Show stars
    const starsDisplay = document.getElementById('starsDisplay');
    if (starsDisplay) {
        starsDisplay.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            starsDisplay.innerHTML += `<span class="${i <= Math.round(avg) ? 'star-filled' : ''}">★</span>`;
        }
    }
}

function showShareSheet(movie) {
    const sheet = document.getElementById('shareBottomSheet');
    if (!sheet) return;
    
    document.getElementById('sharePoster').src = movie.poster;
    document.getElementById('shareTitle').textContent = movie.title;
    sheet.classList.remove('hidden');
    
    const shareUrl = `${window.location.origin}/movie.html?id=${movie.id}`;
    const shareText = `Watch ${movie.title} on MoviePulse - uses less data!`;
    
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.onclick = () => {
            const platform = btn.dataset.platform;
            let url = '';
            if (platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            else if (platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            else if (platform === 'twitter') url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            else if (platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
            else if (platform === 'copy') {
                navigator.clipboard.writeText(shareUrl);
                showToast('Link copied!', 'success');
                sheet.classList.add('hidden');
                return;
            } else if (platform === 'more') {
                if (navigator.share) navigator.share({ title: movie.title, text: shareText, url: shareUrl });
                else showToast('Share not supported', 'error');
                sheet.classList.add('hidden');
                return;
            }
            if (url) window.open(url, '_blank');
            sheet.classList.add('hidden');
        };
    });
    
    document.querySelector('.close-sheet')?.addEventListener('click', () => {
        sheet.classList.add('hidden');
    });
}

function showReportModal(movieId) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.getElementById('submitReportBtn').onclick = async () => {
        const reason = document.querySelector('input[name="reason"]:checked')?.value;
        const message = document.getElementById('reportMessage')?.value;
        
        if (reason) {
            await addDoc(collection(db, "reports"), {
                movieId: movieId,
                userId: currentUser?.uid,
                reason: reason,
                message: message,
                createdAt: serverTimestamp(),
                status: "pending"
            });
            showToast('Report submitted! We will fix it ASAP', 'success');
            modal.classList.add('hidden');
        }
    };
}

function showTrailer(trailerUrl) {
    const modal = document.getElementById('trailerModal');
    const video = document.getElementById('trailerVideo');
    if (modal && video && trailerUrl) {
        video.src = trailerUrl;
        modal.classList.remove('hidden');
        video.play();
        
        document.querySelector('#trailerModal .close-modal').onclick = () => {
            video.pause();
            video.src = '';
            modal.classList.add('hidden');
        };
    }
}

function updatePasswordStrength() {
    const password = document.getElementById('registerPassword')?.value || '';
    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthText = document.getElementById('strengthText');
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    strengthBars.forEach((bar, i) => {
        bar.style.background = i < strength ? '#e50914' : '#333';
    });
    
    if (strengthText) {
        if (strength <= 1) strengthText.textContent = 'Weak';
        else if (strength <= 2) strengthText.textContent = 'Medium';
        else strengthText.textContent = 'Strong';
    }
}

// Make functions global for HTML onclick
window.location = window.location;
window.setupVideoPlayer = setupVideoPlayer;