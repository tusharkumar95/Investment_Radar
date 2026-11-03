/* India Big Order Wins: never treat media headlines or tentative bids as wins. */
(() => {
"use strict";
const $=q=>document.querySelector(q);
const buttons=[...document.querySelectorAll("[data-tab]")];
const state={d:null,tab:"alerts",query:"",size:100,sort:"newest"};
const esc=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[x]));
const number=v=>Number(v).toLocaleString("en-IN",{maximumFractionDigits:2});
function date(t){
 if(!t)return "Time unavailable";
 const d=new Date(t);
 if(Number.isNaN(+d))return esc(t);
 return d.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"});
}
function link(url,label){
 try{const u=new URL(url);if(u.protocol==="https:")return '<a href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+" ↗</a>";}catch{}return "";
}
const views={
 alerts:"Significant reported contract awards",
 verifiedOrders:"Source-verified awarded contracts",
 exchangeNotices:"Official NSE/BSE order notifications",
 researchLeads:"Unverified news and company announcements",
};
function valueDisplay(r){
 const lo=r.valueMinCr,hi=r.valueMaxCr;
 if(lo==null)return "Value not available";
 if(hi!=null&&hi!==lo)return "₹"+number(lo)+"–"+number(hi)+" Cr (range)";
 return "₹"+number(lo)+" Cr";
}
function tag(r){
 if(r.verified)return '<span class="pill ok">Verified · award</span>';
 if(!r.isFinal)return '<span class="pill warn">Not final · bid / intent</span>';
 if(r.sourceClass==="official-exchange")return '<span class="pill warn">Exchange notice · review PDF</span>';
 return '<span class="pill">Research lead only</span>';
}
function card(r){
 const exact=r.verified?"Original filed document reviewed":r.sourceClass==="official-exchange"?
   "Official exchange feed; original document still needs checking":"Unverified media report — NOT an award confirmation";
 const amount=(r.valueMinCr!=null)?valueDisplay(r):"Not stated in available notice";
 return '<article class="card">'+
 '<div class="top"><span class="cat">'+esc(r.source||"Order announcement")+'</span>'+tag(r)+'</div>'+
 '<h3>'+esc(r.title||r.company)+'</h3><div class="muted">'+esc(r.company||"Unknown issuer")+
 (r.symbol?" · "+esc(r.symbol):"")+
 ' · '+date(r.announcedAt||r.announcementDate)+'</div>'+
 '<div class="metrics"><div><small>Disclosed order value</small><b>'+esc(amount)+'</b></div>'+
 '<div><small>Client / customer</small><b style="font-size:12px">'+esc(r.customer||"Not established")+'</b></div></div>'+
 '<div class="note">'+esc(r.summary||"No additional filing details available in this feed.")+'</div>'+
 (r.contractType&&r.contractType!=="Not independently classified"?'<div class="note">Project: '+esc(r.contractType)+'</div>':"")+
 (r.notes?'<div class="note">'+esc(r.notes)+'</div>':"")+
 '<div class="foot">'+esc(exact)+' · '+link(r.sourceUrl,r.verified?"Open original filing":"Read announcement")+'</div></article>';
}
function draw(){
 const d=state.d;if(!d)return;
 buttons.forEach(b=>{const yes=b.dataset.tab===state.tab;b.classList.toggle("active",yes);b.setAttribute("aria-pressed",String(yes))});
 $("#viewTitle").textContent=views[state.tab];
 let rows=Array.isArray(d[state.tab])?[...d[state.tab]]:[];
 const needle=state.query.toLowerCase().trim();
 rows=rows.filter(r=>!needle||[r.title,r.company,r.symbol,r.customer,r.summary,r.contractType].some(s=>String(s||"").toLowerCase().includes(needle)));
 if(state.size>0)rows=rows.filter(r=>r.valueMinCr==null?state.tab!=="alerts"&&state.tab!=="verifiedOrders":r.valueMinCr>=state.size);
 if(state.sort==="largest")rows.sort((a,b)=>(b.valueMinCr??-1)-(a.valueMinCr??-1));
 else rows.sort((a,b)=>String(b.announcedAt||b.announcementDate||"").localeCompare(String(a.announcedAt||a.announcementDate||"")));
 $("#cards").innerHTML=rows.length?rows.map(card).join(""):
  '<div class="warning">No qualifying announcements in this view. If the exchange feeds are unavailable, this does not mean no orders were won. Check source status below or choose another view.</div>';
}
async function load(){
 try{
  const r=await fetch("india-order-wins.json?t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw Error("Order feed not published");
  const d=await r.json();
  if(d.schema!==1||!["alerts","verifiedOrders","exchangeNotices","researchLeads","sourceHealth"].every(k=>Array.isArray(d[k])))throw Error("Invalid order feed");
  state.d=d;
  $("#lastSync").textContent="Last scan: "+date(d.updated)+" · NSE/BSE source responses vary; alerts depend on published disclosures.";
  const s=d.status||{};
  $("#stats").innerHTML=[["Verified awards",s.verified||0],["Large alerts",s.significantAlerts||0],["Exchange notices",s.exchangeNotices||0],["Needs verification",s.researchLeads||0]]
    .map(([label,val])=>'<div class="stat"><small>'+esc(label)+'</small><b>'+val+'</b></div>').join("");
  const statuses=d.sourceHealth;
  $("#sourceHealth").innerHTML='<div class="muted">'+(s.sourcesAvailable??0)+' of '+(s.sourcesChecked??0)+' feeds responded in this scan.</div>'+
  statuses.map(s=>'<div class="status">'+(s.ok?"✓ ":"Unavailable: ")+esc(s.name)+
    (s.ok?" · "+(s.items??0)+" announcements · "+(s.orderMentions??0)+" relevant":" · "+esc(s.error||"No response"))+'</div>').join("");
  draw();
 }catch(e){
  $("#lastSync").textContent="Order feed unavailable";
  $("#cards").innerHTML='<div class="warning">No trustworthy order feed is available. No awards have been invented to fill the gap.</div>';
  $("#sourceHealth").textContent=String(e);
 }
}
buttons.forEach(b=>b.addEventListener("click",()=>{state.tab=b.dataset.tab;$("#size").value=state.tab==="alerts"?"100":"0";state.size=Number($("#size").value);draw()}));
$("#query").addEventListener("input",e=>{state.query=e.target.value;draw()});
$("#size").addEventListener("change",e=>{state.size=Number(e.target.value);draw()});
$("#sort").addEventListener("change",e=>{state.sort=e.target.value;draw()});
load();
})();