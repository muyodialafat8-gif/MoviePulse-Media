function goHome(){location.href="index.html";}
function goSearch(){location.href="search.html";}
function goSeries(){location.href="series.html";}
function goDownloads(){location.href="downloads.html";}
function goAccount(){location.href="account.html";}

function toast(msg){
let t=document.getElementById("toast");
t.innerText=msg;
t.style.display="block";
setTimeout(()=>t.style.display="none",3000);
}

// MOVIES
function loadMovies(){
db.collection("movies").where("trending","==",true)
.onSnapshot(snap=>{
let el=document.getElementById("trending");
if(!el) return;

el.innerHTML="";
snap.forEach(doc=>{
let m=doc.data();

el.innerHTML+=`
<div class="card" onclick="openMovie('${doc.id}')">
<img src="${m.poster}">
</div>`;
});
});
}

function openMovie(id){
location.href=`movie.html?id=${id}`;
}

// HERO
function loadHero(){
db.collection("movies").where("featured","==",true)
.get().then(snap=>{
let hero=document.getElementById("hero");
if(!hero) return;

snap.forEach(doc=>{
let m=doc.data();
hero.innerHTML=`<h1>${m.title}</h1>`;
});
});
}

// POPUPS
function closeWelcome(){
localStorage.setItem("mp_welcomed","true");
document.getElementById("welcomePopup").classList.add("hidden");
showNotif();
}

function showWelcome(){
if(!localStorage.getItem("mp_welcomed")){
document.getElementById("welcomePopup").classList.remove("hidden");
}
}

function enableNotif(){
Notification.requestPermission().then(()=>{
toast("Notifications enabled!");
localStorage.setItem("mp_notif","granted");
closeNotif();
});
}

function closeNotif(){
localStorage.setItem("mp_notif","later");
document.getElementById("notifPopup").classList.add("hidden");
}

function showNotif(){
if(!localStorage.getItem("mp_notif")){
document.getElementById("notifPopup").classList.remove("hidden");
}
}

// INIT
window.onload=()=>{

setTimeout(()=>{
let s=document.getElementById("splash");
if(s) s.style.display="none";
},2500);

loadMovies();
loadHero();

setTimeout(showWelcome,2000);
};