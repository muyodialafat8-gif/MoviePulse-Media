function register(){
let email=document.getElementById("email").value;
let pass=document.getElementById("password").value;

auth.createUserWithEmailAndPassword(email,pass)
.then(res=>{
return db.collection("users").doc(res.user.uid).set({
email:email,
favorites:[],
downloads:[],
continueWatching:[],
subscriptionStatus:"none",
createdAt:Date.now()
});
});
}