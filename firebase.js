import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    addDoc,
    query, 
    where, 
    orderBy, 
    limit,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDe6N4Fgl02pz-27N5sDCZhVB5X_SHTiPI",
    authDomain: "moviepulse-256.firebaseapp.com",
    projectId: "moviepulse-256",
    storageBucket: "moviepulse-256.appspot.com",
    messagingSenderId: "673829570223",
    appId: "1:673829570223:web:6613983b25d600c7aff65a",
    measurementId: "G-NKWC9FN1YX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ==================== AUTH FUNCTIONS ====================

// Google Sign In
async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user document exists, create if not
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                fullName: user.displayName || user.email.split('@')[0],
                createdAt: serverTimestamp(),
                favorites: [],
                watchHistory: [],
                downloads: [],
                continueWatching: [],
                subscriptionStatus: "inactive",
                planType: null,
                expiryDate: null,
                dailyWatchCount: 0,
                lastWatchDate: null,
                isAdmin: false,
                referralCode: generateReferralCode(),
                referralCount: 0,
                streakCount: 0,
                lastWatchStreak: null
            });
        }
        
        showToast("Signed in successfully!", "success");
        return { success: true, user };
    } catch (error) {
        console.error("Google sign in error:", error);
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Email/Password Sign Up
async function signUpWithEmail(email, password, fullName) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        // Send email verification
        await sendEmailVerification(user);
        
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            fullName: fullName,
            createdAt: serverTimestamp(),
            favorites: [],
            watchHistory: [],
            downloads: [],
            continueWatching: [],
            subscriptionStatus: "inactive",
            planType: null,
            expiryDate: null,
            dailyWatchCount: 0,
            lastWatchDate: null,
            isAdmin: false,
            referralCode: generateReferralCode(),
            referralCount: 0,
            streakCount: 0,
            lastWatchStreak: null
        });
        
        showToast("Account created! Please verify your email.", "success");
        return { success: true, user };
    } catch (error) {
        console.error("Sign up error:", error);
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Email/Password Sign In
async function signInWithEmail(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        if (!user.emailVerified) {
            showToast("Please verify your email first. Check your inbox!", "warning");
            return { success: false, error: "Email not verified" };
        }
        
        showToast("Welcome back!", "success");
        return { success: true, user };
    } catch (error) {
        console.error("Sign in error:", error);
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Reset Password
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset email sent! Check your inbox.", "success");
        return { success: true };
    } catch (error) {
        console.error("Reset password error:", error);
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Logout
async function logoutUser() {
    try {
        await signOut(auth);
        showToast("Logged out successfully", "success");
        // Clear local storage
        localStorage.removeItem("mp_user");
        // Redirect to login page
        window.location.href = "login.html";
        return { success: true };
    } catch (error) {
        console.error("Logout error:", error);
        return { success: false, error: error.message };
    }
}

// ==================== FIRESTORE FUNCTIONS ====================

// Get current user data
async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() };
        }
        return null;
    } catch (error) {
        console.error("Get user data error:", error);
        return null;
    }
}

// Get movie by ID
async function getMovieById(movieId) {
    try {
        const movieDoc = await getDoc(doc(db, "movies", movieId));
        if (movieDoc.exists()) {
            return { id: movieDoc.id, ...movieDoc.data() };
        }
        return null;
    } catch (error) {
        console.error("Get movie error:", error);
        return null;
    }
}

// Get movies by category/condition
async function getMovies(condition = "trending", limitCount = 20) {
    try {
        let q;
        switch(condition) {
            case "trending":
                q = query(collection(db, "movies"), where("trending", "==", true), limit(limitCount));
                break;
            case "featured":
                q = query(collection(db, "movies"), where("featured", "==", true), limit(limitCount));
                break;
            case "newReleases":
                q = query(collection(db, "movies"), where("isNew", "==", true), limit(limitCount));
                break;
            default:
                q = query(collection(db, "movies"), limit(limitCount));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Get movies error:", error);
        return [];
    }
}

// Search movies
async function searchMovies(searchTerm, category = "all") {
    try {
        let q = collection(db, "movies");
        const snapshot = await getDocs(q);
        let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter by search term
        if (searchTerm) {
            results = results.filter(movie => 
                movie.title?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // Filter by category
        if (category !== "all") {
            results = results.filter(movie => movie.category === category);
        }
        
        return results;
    } catch (error) {
        console.error("Search error:", error);
        return [];
    }
}

// Add to favorites
async function addToFavorites(movieId) {
    const user = auth.currentUser;
    if (!user) {
        showToast("Please login to add favorites", "warning");
        return false;
    }
    
    try {
        await updateDoc(doc(db, "users", user.uid), {
            favorites: arrayUnion(movieId)
        });
        showToast("Added to favorites ❤️", "success");
        return true;
    } catch (error) {
        console.error("Add favorite error:", error);
        return false;
    }
}

// Remove from favorites
async function removeFromFavorites(movieId) {
    const user = auth.currentUser;
    if (!user) return false;
    
    try {
        await updateDoc(doc(db, "users", user.uid), {
            favorites: arrayRemove(movieId)
        });
        showToast("Removed from favorites", "info");
        return true;
    } catch (error) {
        console.error("Remove favorite error:", error);
        return false;
    }
}

// Add to watch history
async function addToWatchHistory(movieId, watchedSeconds = 0) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        await updateDoc(doc(db, "users", user.uid), {
            watchHistory: arrayUnion({
                movieId: movieId,
                timestamp: new Date().toISOString(),
                watchedSeconds: watchedSeconds
            })
        });
    } catch (error) {
        console.error("Add to watch history error:", error);
    }
}

// Update continue watching
async function updateContinueWatching(movieId, progress, title, poster) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const currentData = userDoc.data();
        let continueWatching = currentData.continueWatching || [];
        
        // Remove existing entry for this movie
        continueWatching = continueWatching.filter(item => item.movieId !== movieId);
        
        // Add updated entry
        continueWatching.push({
            movieId: movieId,
            progress: progress,
            timestamp: new Date().toISOString(),
            title: title,
            poster: poster
        });
        
        // Keep only last 20
        if (continueWatching.length > 20) {
            continueWatching = continueWatching.slice(-20);
        }
        
        await updateDoc(doc(db, "users", user.uid), {
            continueWatching: continueWatching
        });
    } catch (error) {
        console.error("Update continue watching error:", error);
    }
}

// Get settings
async function getAppSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
        if (settingsDoc.exists()) {
            return settingsDoc.data();
        }
        return getDefaultSettings();
    } catch (error) {
        console.error("Get settings error:", error);
        return getDefaultSettings();
    }
}

// Get all categories (distinct from movies)
async function getAllCategories() {
    try {
        const snapshot = await getDocs(collection(db, "movies"));
        const categories = new Set();
        snapshot.docs.forEach(doc => {
            const category = doc.data().category;
            if (category) categories.add(category);
        });
        return ["all", ...Array.from(categories)];
    } catch (error) {
        console.error("Get categories error:", error);
        return ["all"];
    }
}

// Helper Functions
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getDefaultSettings() {
    return {
        ads_enabled: false,
        ad_skip_time: 5,
        price_daily: 1600,
        price_weekly: 6000,
        price_monthly: 25000,
        price_lifetime: 55000,
        whatsapp_channel_url: "https://whatsapp.com/channel/0029Vb73dtF5kg76mEEo1L3a",
        free_user_daily_limit: 3,
        guarantee_text: "If you don't love MoviePulse within 24 hours, admin will refund your money – no questions asked.",
        trust_badges: [
            { icon: "🔒", text: "No auto-renewal" },
            { icon: "✅", text: "Manual activation by admin" }
        ]
    };
}

// Show Toast Notification
function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Export all functions
export {
    auth,
    db,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
    logoutUser,
    getCurrentUserData,
    getMovieById,
    getMovies,
    searchMovies,
    addToFavorites,
    removeFromFavorites,
    addToWatchHistory,
    updateContinueWatching,
    getAppSettings,
    getAllCategories,
    showToast,
    onAuthStateChanged,
    updateDoc,
    doc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    increment,
    serverTimestamp,
    arrayUnion,
    arrayRemove
};