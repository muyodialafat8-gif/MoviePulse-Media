// HERO SLIDER
function loadHero(){
db.collection("movies").where("featured","==",true)
.get().then(snap=>{
let hero=document.getElementById("hero");
if(!hero) return;

snap.forEach(doc=>{
let m=doc.data();

hero.innerHTML=`
<div onclick="openMovie('${doc.id}')">
<h1>${m.title}</h1>
</div>`;
});
});
}

// BANNER AD
function loadBanner(){
if(!settings.ad_image) return;

let link=document.getElementById("bannerAd");
let img=document.getElementById("bannerImg");

link.href=settings.ad_link;
img.src=settings.ad_image;
}

// POPUPS
function showWelcome(){
if(localStorage.getItem("mp_welcomed")) return;

document.getElementById("welcomePopup").classList.remove("hidden");
}

function closeWelcome(){
localStorage.setItem("mp_welcomed","true");
document.getElementById("welcomePopup").classList.add("hidden");
showNotif();
}

function showNotif(){
if(localStorage.getItem("mp_notif")) return;

document.getElementById("notifPopup").classList.remove("hidden");
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

// SHARE
function shareMovie(){
let id=new URLSearchParams(location.search).get("id");
let url=location.origin+"/movie.html?id="+id;

navigator.clipboard.writeText(url);
toast("Link copied!");
}

// INIT
window.onload=()=>{

setTimeout(()=>{
let splash=document.getElementById("splash");
if(splash) splash.style.display="none";
},2500);

loadMovies();
loadHero();
loadBanner();

setTimeout(showWelcome,3000);
};