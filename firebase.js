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

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyDe6N4Fgl02pz-27N5sDCZhVB5X_SHTiPI",
    authDomain: "moviepulse-256.firebaseapp.com",
    projectId: "moviepulse-256",
    storageBucket: "moviepulse-256.appspot.com",
    messagingSenderId: "673829570223",
    appId: "1:673829570223:web:6613983b25d600c7aff65a",
    measurementId: "G-NKWC9FN1YX"
};

// ===== INITIALIZE =====
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
                streakCount: 0,
                lastWatchStreak: null
            });
        }
        
        showToast("Signed in successfully!", "success");
        return { success: true, user };
    } catch (error) {
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Email Sign Up
async function signUpWithEmail(email, password, fullName) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await sendEmailVerification(user);
        
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
            streakCount: 0,
            lastWatchStreak: null
        });
        
        showToast("Account created! Please verify your email.", "success");
        return { success: true, user };
    } catch (error) {
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Email Sign In
async function signInWithEmail(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        if (!user.emailVerified) {
            showToast("Please verify your email first!", "warning");
            return { success: false, error: "Email not verified" };
        }
        
        showToast("Welcome back!", "success");
        return { success: true, user };
    } catch (error) {
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Reset Password
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset email sent!", "success");
        return { success: true };
    } catch (error) {
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

// Logout
async function logoutUser() {
    try {
        await signOut(auth);
        localStorage.removeItem("mp_user");
        showToast("Logged out", "success");
        window.location.href = "login.html";
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== USER DATA ====================

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
        return null;
    }
}

// ==================== MOVIE FUNCTIONS ====================

async function getMovieById(movieId) {
    try {
        const movieDoc = await getDoc(doc(db, "movies", movieId));
        if (movieDoc.exists()) {
            return { id: movieDoc.id, ...movieDoc.data() };
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getMovies(type = "all", limitCount = 20) {
    try {
        let q;
        const moviesRef = collection(db, "movies");
        
        if (type === "trending") {
            q = query(moviesRef, where("trending", "==", true), limit(limitCount));
        } else if (type === "featured") {
            q = query(moviesRef, where("featured", "==", true), limit(limitCount));
        } else if (type === "newReleases") {
            q = query(moviesRef, where("isNew", "==", true), limit(limitCount));
        } else {
            q = query(moviesRef, limit(limitCount));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        return [];
    }
}

async function getAllMovies() {
    try {
        const snapshot = await getDocs(collection(db, "movies"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        return [];
    }
}

async function searchMovies(searchTerm) {
    try {
        const allMovies = await getAllMovies();
        if (!searchTerm) return allMovies;
        
        return allMovies.filter(movie => 
            movie.title?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    } catch (error) {
        return [];
    }
}

// ==================== FAVORITES ====================

async function addToFavorites(movieId) {
    const user = auth.currentUser;
    if (!user) { showToast("Please login first", "warning"); return false; }
    
    try {
        await updateDoc(doc(db, "users", user.uid), {
            favorites: arrayUnion(movieId)
        });
        showToast("Added to favorites ❤️", "success");
        return true;
    } catch (error) {
        return false;
    }
}

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
        return false;
    }
}

// ==================== WATCH HISTORY ====================

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
    } catch (error) {}
}

// ==================== SETTINGS ====================

async function getAppSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
        if (settingsDoc.exists()) {
            return settingsDoc.data();
        }
        return {
            ads_enabled: false,
            ad_skip_time: 5,
            price_daily: 1600,
            price_weekly: 6000,
            price_monthly: 25000,
            price_lifetime: 55000,
            whatsapp_channel_url: "https://whatsapp.com/channel/0029Vb73dtF5kg76mEEo1L3a",
            free_user_daily_limit: 3,
            guarantee_text: "Money back guarantee within 24 hours",
            trust_badges: [{ icon: "🔒", text: "No auto-renewal" }]
        };
    } catch (error) {
        return {};
    }
}

// ==================== ADMIN FUNCTIONS ====================

async function addMovie(movieData) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Not logged in" };
    
    const userData = await getCurrentUserData();
    if (!userData?.isAdmin) return { success: false, error: "Admin only" };
    
    try {
        const docRef = await addDoc(collection(db, "movies"), {
            ...movieData,
            views: 0,
            createdAt: serverTimestamp()
        });
        showToast("Movie added successfully!", "success");
        return { success: true, id: docRef.id };
    } catch (error) {
        showToast(error.message, "error");
        return { success: false, error: error.message };
    }
}

async function updateMovie(movieId, movieData) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Not logged in" };
    
    const userData = await getCurrentUserData();
    if (!userData?.isAdmin) return { success: false, error: "Admin only" };
    
    try {
        await updateDoc(doc(db, "movies", movieId), movieData);
        showToast("Movie updated!", "success");
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteMovie(movieId) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Not logged in" };
    
    const userData = await getCurrentUserData();
    if (!userData?.isAdmin) return { success: false, error: "Admin only" };
    
    try {
        await deleteDoc(doc(db, "movies", movieId));
        showToast("Movie deleted", "success");
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateSettings(settingsData) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Not logged in" };
    
    const userData = await getCurrentUserData();
    if (!userData?.isAdmin) return { success: false, error: "Admin only" };
    
    try {
        await setDoc(doc(db, "settings", "appSettings"), settingsData, { merge: true });
        showToast("Settings updated!", "success");
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function activateSubscription(userId, planType, daysToAdd) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Not logged in" };
    
    const userData = await getCurrentUserData();
    if (!userData?.isAdmin) return { success: false, error: "Admin only" };
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);
    
    try {
        await updateDoc(doc(db, "users", userId), {
            subscriptionStatus: "active",
            planType: planType,
            expiryDate: expiryDate.toISOString()
        });
        showToast("Subscription activated!", "success");
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== HELPER ====================

function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) {
        // Create toast if doesn't exist
        const newToast = document.createElement("div");
        newToast.id = "toast";
        newToast.className = "toast";
        document.body.appendChild(newToast);
    }
    
    const toastEl = document.getElementById("toast");
    toastEl.textContent = message;
    toastEl.style.display = "block";
    
    setTimeout(() => {
        toastEl.style.display = "none";
    }, 3000);
}

// ==================== EXPORTS ====================

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
    getAllMovies,
    searchMovies,
    addToFavorites,
    removeFromFavorites,
    addToWatchHistory,
    getAppSettings,
    addMovie,
    updateMovie,
    deleteMovie,
    updateSettings,
    activateSubscription,
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
    addDoc,
    deleteDoc,
    setDoc,
    increment,
    serverTimestamp,
    arrayUnion,
    arrayRemove
};