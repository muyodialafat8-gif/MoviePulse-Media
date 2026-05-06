const firebaseConfig = {
apiKey: "AIzaSyDe6N4Fgl02pz-27N5sDCZhVB5X_SHTiPI",
authDomain: "moviepulse-256.firebaseapp.com",
projectId: "moviepulse-256"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let settings = {};

db.collection("settings").doc("main").onSnapshot(doc=>{
settings = doc.data() || {};
});