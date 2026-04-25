// ============================================================
// MoviePulse — Firebase initialization (Modular SDK v10)
// Loaded as ES module from CDN. Exposes everything via
// window.MP_FIREBASE for shared use by app.js.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDe6N4Fgl02pz-27N5sDCZhVB5X_SHTiPI",
  authDomain: "moviepulse-256.firebaseapp.com",
  projectId: "moviepulse-256",
  storageBucket: "moviepulse-256.appspot.com",
  messagingSenderId: "673829570223",
  appId: "1:673829570223:web:6613983b25d600c7aff65a",
  measurementId: "G-NKWC9FN1YX",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

window.MP_FIREBASE = {
  app,
  auth,
  db,
  storage,
  googleProvider,
  // auth helpers
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  // firestore helpers
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  // storage helpers
  storageRef,
  uploadBytes,
  getDownloadURL,
};

// Signal that Firebase is ready
window.dispatchEvent(new CustomEvent("mp:firebase-ready"));
