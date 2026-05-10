// Firebase configuration and exports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDe6N4Fgl02pz-27N5sDCZhVB5X_SHTiPI",
    authDomain: "moviepulse-256.firebaseapp.com",
    projectId: "moviepulse-256",
    storageBucket: "moviepulse-256.appspot.com",
    messagingSenderId: "673829570223",
    appId: "1:673829570223:web:6613983b25d600c7aff65a",
    measurementId: "G-NKWC9FN1YX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, db, googleProvider,
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    sendEmailVerification, signOut, onAuthStateChanged,
    doc, setDoc, getDoc, collection, query, where, getDocs, onSnapshot,
    addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment, serverTimestamp
};