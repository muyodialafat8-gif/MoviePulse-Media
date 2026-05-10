import { auth, db, onAuthStateChanged, doc, getDoc, updateDoc, serverTimestamp, setDoc } from './firebase.js';

// Global
let currentUser = null;
let settingsCache = {};

// Wait for DOM and Firebase
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    
    // Listen to auth state
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
        currentUser = user;
        
        if (user) {
            await loadOrCreateUser(user);
            await loadSettings();
        }
        
        // Hide loading screen after everything
        setTimeout(() => {
            hideLoadingScreen();
        }, 500);
    });
});

// Load or create user document
async function loadOrCreateUser(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            // Create new user document
            await setDoc(userRef, {
                email: user.email,
                fullName: user.displayName || user.email.split('@')[0],
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
            console.log('New user document created');
        }
        
        window.userData = (await getDoc(userRef)).data();
        console.log('User data loaded:', window.userData);
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

// Load settings
async function loadSettings() {
    try {
        const settingsRef = doc(db, 'settings', 'appSettings');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
            settingsCache = settingsDoc.data();
        } else {
            settingsCache = {
                whatsapp_channel_url: "https://whatsapp.com/channel/0029Vb73dtF5kg76mEEo1L3a",
                free_user_daily_limit: 3,
                price_daily: 1600,
                price_weekly: 6000,
                price_monthly: 25000,
                price_lifetime: 55000
            };
        }
        
        window.appSettings = settingsCache;
        console.log('Settings loaded');
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Generate referral code
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Hide loading screen with animation
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('main-content');
    
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            if (mainContent) {
                mainContent.style.display = 'block';
                // Animate main content entrance
                mainContent.style.animation = 'fadeInUp 0.5s ease-out';
            }
        }, 800);
    } else if (mainContent) {
        mainContent.style.display = 'block';
    }
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Setup settings modal
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settings-gear');
    const settingsModal = document.getElementById('settings-modal');
    const closeModal = document.querySelector('.close-modal');
    
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            if (settingsModal) settingsModal.classList.add('active');
        };
    }
    
    if (closeModal) {
        closeModal.onclick = () => {
            if (settingsModal) settingsModal.classList.remove('active');
        };
    }
    
    // Close modal on outside click
    if (settingsModal) {
        settingsModal.onclick = (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
        };
    }
    
    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        const savedTheme = localStorage.getItem('mp_theme') || 'dark';
        themeSelect.value = savedTheme;
        applyTheme(savedTheme);
        
        themeSelect.onchange = (e) => {
            const theme = e.target.value;
            applyTheme(theme);
            localStorage.setItem('mp_theme', theme);
            showToast(`Theme changed to ${theme}`, 'success');
        };
    }
    
    // Clear history
    const clearBtn = document.getElementById('clear-history-btn');
    if (clearBtn && currentUser) {
        clearBtn.onclick = async () => {
            if (confirm('Are you sure you want to clear all watch history?')) {
                try {
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        watchHistory: []
                    });
                    showToast('Watch history cleared!', 'success');
                } catch (error) {
                    showToast('Error clearing history', 'error');
                }
            }
        };
    }
});

// Apply theme
function applyTheme(theme) {
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
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make functions global
window.showToast = showToast;
window.applyTheme = applyTheme;

console.log('✅ App.js loaded successfully');