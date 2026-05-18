// Settings management for MoviePulse
import { getCurrentUserData, updateDoc, doc, db, showToast } from './firebase.js';

// Settings state
let currentSettings = {
    theme: 'dark',
    autoplayNext: true,
    videoQuality: 'auto',
    skipIntro: 'after10s',
    doubleTapSkip: 10,
    pushNotifications: true,
    newMovieAlerts: true,
    newEpisodeAlerts: true,
    subscriptionReminder: true,
    wifiOnlyDownload: true,
    maxStorage: 2,
    autoDeleteWatched: true,
    compactCards: false
};

// Initialize settings
export async function initSettings() {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('mp_settings');
    if (savedSettings) {
        try {
            currentSettings = { ...currentSettings, ...JSON.parse(savedSettings) };
            applySettings();
        } catch(e) {}
    }
    
    // Setup settings UI if on settings modal
    setupSettingsUI();
    
    return currentSettings;
}

// Apply all settings to the app
function applySettings() {
    // Apply theme
    const body = document.body;
    if (currentSettings.theme === 'dark') {
        body.classList.remove('light');
        body.classList.add('dark');
    } else if (currentSettings.theme === 'light') {
        body.classList.remove('dark');
        body.classList.add('light');
    }
    
    // Apply compact cards
    if (currentSettings.compactCards) {
        document.body.classList.add('compact-cards');
    } else {
        document.body.classList.remove('compact-cards');
    }
    
    // Save to localStorage
    localStorage.setItem('mp_settings', JSON.stringify(currentSettings));
}

// Setup settings modal UI
function setupSettingsUI() {
    const settingsModal = document.getElementById('settingsModal');
    if (!settingsModal) return;
    
    // Populate settings form
    const modalBody = settingsModal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="settings-section">
                <h3>Appearance</h3>
                <div class="setting-option">
                    <label>Theme</label>
                    <div class="theme-buttons">
                        <button class="theme-btn ${currentSettings.theme === 'dark' ? 'active' : ''}" data-theme="dark">🌙 Dark</button>
                        <button class="theme-btn ${currentSettings.theme === 'light' ? 'active' : ''}" data-theme="light">☀️ Light</button>
                        <button class="theme-btn ${currentSettings.theme === 'auto' ? 'active' : ''}" data-theme="auto">🔄 Auto</button>
                    </div>
                </div>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="compactCards" ${currentSettings.compactCards ? 'checked' : ''}>
                        Compact Cards (smaller posters)
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Playback</h3>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="autoplayNext" ${currentSettings.autoplayNext ? 'checked' : ''}>
                        Autoplay next episode
                    </label>
                </div>
                <div class="setting-option">
                    <label>Video Quality</label>
                    <select id="videoQuality">
                        <option value="auto" ${currentSettings.videoQuality === 'auto' ? 'selected' : ''}>Auto</option>
                        <option value="720p" ${currentSettings.videoQuality === '720p' ? 'selected' : ''}>720p</option>
                        <option value="1080p" ${currentSettings.videoQuality === '1080p' ? 'selected' : ''}>1080p</option>
                    </select>
                </div>
                <div class="setting-option">
                    <label>Skip Intro Button</label>
                    <select id="skipIntro">
                        <option value="always" ${currentSettings.skipIntro === 'always' ? 'selected' : ''}>Always</option>
                        <option value="never" ${currentSettings.skipIntro === 'never' ? 'selected' : ''}>Never</option>
                        <option value="after10s" ${currentSettings.skipIntro === 'after10s' ? 'selected' : ''}>After 10 seconds</option>
                    </select>
                </div>
                <div class="setting-option">
                    <label>Double-tap skip seconds</label>
                    <select id="doubleTapSkip">
                        <option value="5" ${currentSettings.doubleTapSkip === 5 ? 'selected' : ''}>5 seconds</option>
                        <option value="10" ${currentSettings.doubleTapSkip === 10 ? 'selected' : ''}>10 seconds</option>
                        <option value="15" ${currentSettings.doubleTapSkip === 15 ? 'selected' : ''}>15 seconds</option>
                    </select>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Notifications</h3>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="pushNotifications" ${currentSettings.pushNotifications ? 'checked' : ''}>
                        Push notifications
                    </label>
                </div>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="newMovieAlerts" ${currentSettings.newMovieAlerts ? 'checked' : ''}>
                        New movie alerts
                    </label>
                </div>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="newEpisodeAlerts" ${currentSettings.newEpisodeAlerts ? 'checked' : ''}>
                        New episode alerts
                    </label>
                </div>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="subscriptionReminder" ${currentSettings.subscriptionReminder ? 'checked' : ''}>
                        Subscription reminder (2 days before expiry)
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Downloads</h3>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="wifiOnlyDownload" ${currentSettings.wifiOnlyDownload ? 'checked' : ''}>
                        Download over Wi-Fi only
                    </label>
                </div>
                <div class="setting-option">
                    <label>Max storage limit</label>
                    <select id="maxStorage">
                        <option value="2" ${currentSettings.maxStorage === 2 ? 'selected' : ''}>2 GB</option>
                        <option value="5" ${currentSettings.maxStorage === 5 ? 'selected' : ''}>5 GB</option>
                        <option value="0" ${currentSettings.maxStorage === 0 ? 'selected' : ''}>Unlimited</option>
                    </select>
                </div>
                <div class="setting-option">
                    <label>
                        <input type="checkbox" id="autoDeleteWatched" ${currentSettings.autoDeleteWatched ? 'checked' : ''}>
                        Auto-delete watched downloads after 7 days
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Privacy & Security</h3>
                <button id="clearWatchHistoryBtn" class="setting-action-btn">🗑️ Clear watch history</button>
                <button id="clearSearchHistoryBtn" class="setting-action-btn">🔍 Clear search history</button>
                <button id="logoutAllDevicesBtn" class="setting-action-btn">🚪 Log out from all devices</button>
                <button id="deleteAccountBtn" class="setting-action-btn danger">⚠️ Request account deletion</button>
            </div>
            
            <div class="settings-section">
                <h3>About</h3>
                <p>App Version: <strong>v1.0.0</strong></p>
                <a href="#" id="whatsappChannelLink" class="about-link">💬 WhatsApp Channel</a>
                <a href="#" class="about-link">📜 Privacy Policy</a>
                <a href="#" class="about-link">📋 Terms of Service</a>
            </div>
            
            <div id="adminSettingsSection" class="settings-section admin-section" style="display:none">
                <h3>Admin Settings 🔧</h3>
                <button id="debugModeBtn" class="setting-action-btn">🐛 Firestore debugging mode</button>
                <button id="forceSyncDataBtn" class="setting-action-btn">🔄 Force sync data</button>
                <button id="clearLocalStorageBtn" class="setting-action-btn danger">🗑️ Clear all local storage</button>
            </div>
        `;
        
        // Attach event listeners
        attachSettingsListeners();
    }
}

// Attach event listeners to settings controls
function attachSettingsListeners() {
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const theme = btn.dataset.theme;
            currentSettings.theme = theme;
            applySettings();
            updateThemeButtons(theme);
            
            // Update Firestore if user is logged in
            const userData = await getCurrentUserData();
            if (userData) {
                await updateDoc(doc(db, "users", currentUser.uid), {
                    settings: currentSettings
                });
            }
        });
    });
    
    // Compact cards
    const compactCards = document.getElementById('compactCards');
    if (compactCards) {
        compactCards.addEventListener('change', (e) => {
            currentSettings.compactCards = e.target.checked;
            applySettings();
        });
    }
    
    // Autoplay next
    const autoplayNext = document.getElementById('autoplayNext');
    if (autoplayNext) {
        autoplayNext.addEventListener('change', (e) => {
            currentSettings.autoplayNext = e.target.checked;
            saveSettings();
        });
    }
    
    // Video quality
    const videoQuality = document.getElementById('videoQuality');
    if (videoQuality) {
        videoQuality.addEventListener('change', (e) => {
            currentSettings.videoQuality = e.target.value;
            saveSettings();
        });
    }
    
    // Skip intro
    const skipIntro = document.getElementById('skipIntro');
    if (skipIntro) {
        skipIntro.addEventListener('change', (e) => {
            currentSettings.skipIntro = e.target.value;
            saveSettings();
        });
    }
    
    // Double tap skip
    const doubleTapSkip = document.getElementById('doubleTapSkip');
    if (doubleTapSkip) {
        doubleTapSkip.addEventListener('change', (e) => {
            currentSettings.doubleTapSkip = parseInt(e.target.value);
            saveSettings();
        });
    }
    
    // Notifications
    const pushNotif = document.getElementById('pushNotifications');
    if (pushNotif) {
        pushNotif.addEventListener('change', (e) => {
            currentSettings.pushNotifications = e.target.checked;
            saveSettings();
            if (e.target.checked && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });
    }
    
    const newMovieAlerts = document.getElementById('newMovieAlerts');
    if (newMovieAlerts) {
        newMovieAlerts.addEventListener('change', (e) => {
            currentSettings.newMovieAlerts = e.target.checked;
            saveSettings();
        });
    }
    
    const newEpisodeAlerts = document.getElementById('newEpisodeAlerts');
    if (newEpisodeAlerts) {
        newEpisodeAlerts.addEventListener('change', (e) => {
            currentSettings.newEpisodeAlerts = e.target.checked;
            saveSettings();
        });
    }
    
    const subReminder = document.getElementById('subscriptionReminder');
    if (subReminder) {
        subReminder.addEventListener('change', (e) => {
            currentSettings.subscriptionReminder = e.target.checked;
            saveSettings();
        });
    }
    
    // Download settings
    const wifiOnly = document.getElementById('wifiOnlyDownload');
    if (wifiOnly) {
        wifiOnly.addEventListener('change', (e) => {
            currentSettings.wifiOnlyDownload = e.target.checked;
            saveSettings();
        });
    }
    
    const maxStorage = document.getElementById('maxStorage');
    if (maxStorage) {
        maxStorage.addEventListener('change', (e) => {
            currentSettings.maxStorage = parseInt(e.target.value);
            saveSettings();
        });
    }
    
    const autoDelete = document.getElementById('autoDeleteWatched');
    if (autoDelete) {
        autoDelete.addEventListener('change', (e) => {
            currentSettings.autoDeleteWatched = e.target.checked;
            saveSettings();
        });
    }
    
    // Privacy buttons
    const clearWatchHistory = document.getElementById('clearWatchHistoryBtn');
    if (clearWatchHistory) {
        clearWatchHistory.addEventListener('click', () => {
            if (confirm('Clear all watch history? This cannot be undone.')) {
                // Clear watch history logic
                showToast('Watch history cleared', 'success');
            }
        });
    }
    
    const clearSearchHistory = document.getElementById('clearSearchHistoryBtn');
    if (clearSearchHistory) {
        clearSearchHistory.addEventListener('click', () => {
            localStorage.removeItem('mp_recent_searches');
            showToast('Search history cleared', 'success');
        });
    }
    
    const deleteAccount = document.getElementById('deleteAccountBtn');
    if (deleteAccount) {
        deleteAccount.addEventListener('click', () => {
            if (confirm('Request account deletion? Admin will process your request.')) {
                showToast('Deletion request sent to admin', 'info');
            }
        });
    }
    
    // Check if user is admin
    checkAndShowAdminSection();
}

// Check if current user is admin and show admin section
async function checkAndShowAdminSection() {
    const userData = await getCurrentUserData();
    const adminSection = document.getElementById('adminSettingsSection');
    
    if (userData && userData.isAdmin && adminSection) {
        adminSection.style.display = 'block';
        
        // Admin buttons
        const debugMode = document.getElementById('debugModeBtn');
        if (debugMode) {
            debugMode.addEventListener('click', () => {
                localStorage.setItem('mp_debug_mode', 'true');
                showToast('Debug mode enabled. Check console for Firestore logs.', 'info');
            });
        }
        
        const forceSync = document.getElementById('forceSyncDataBtn');
        if (forceSync) {
            forceSync.addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        const clearStorage = document.getElementById('clearLocalStorageBtn');
        if (clearStorage) {
            clearStorage.addEventListener('click', () => {
                localStorage.clear();
                showToast('Local storage cleared. Refresh to apply.', 'warning');
            });
        }
    }
}

// Update theme buttons UI
function updateThemeButtons(activeTheme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.dataset.theme === activeTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('mp_settings', JSON.stringify(currentSettings));
}

// Get a specific setting
export function getSetting(key) {
    return currentSettings[key];
}

// Get all settings
export function getAllSettings() {
    return { ...currentSettings };
}

// Update a setting
export function updateSetting(key, value) {
    currentSettings[key] = value;
    saveSettings();
    applySettings();
}

// Double-tap skip handler for video player
export function setupDoubleTapSkip(videoElement) {
    let lastTap = 0;
    let tapTimeout;
    
    videoElement.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 500 && tapLength > 0) {
            // Double tap detected
            const tapX = e.touches[0].clientX;
            const screenWidth = window.innerWidth;
            
            if (tapX < screenWidth / 2) {
                // Tap left side - skip backward
                videoElement.currentTime = Math.max(0, videoElement.currentTime - currentSettings.doubleTapSkip);
                showSkipToast(`⏪ Rewind ${currentSettings.doubleTapSkip}s`);
            } else {
                // Tap right side - skip forward
                videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + currentSettings.doubleTapSkip);
                showSkipToast(`⏩ Forward ${currentSettings.doubleTapSkip}s`);
            }
            
            if (tapTimeout) clearTimeout(tapTimeout);
        }
        
        lastTap = currentTime;
        
        tapTimeout = setTimeout(() => {
            // Single tap - show/hide controls
            const controls = document.querySelector('.video-controls');
            if (controls) {
                controls.style.opacity = controls.style.opacity === '0' ? '1' : '0';
            }
        }, 200);
    });
}

function showSkipToast(message) {
    const toast = document.createElement('div');
    toast.className = 'skip-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 1000);
}

// Export settings for use in video player
export default {
    initSettings,
    getSetting,
    getAllSettings,
    updateSetting,
    setupDoubleTapSkip
};

