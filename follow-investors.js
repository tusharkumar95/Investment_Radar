/* Follow Investors — original source disclosures, no price/volume-based identities. */
(() => {
"use strict";
const $=s=>document.querySelector(s);
const state={region:"India",india:null,canada:null,search:"",onlyObserved:true,onlySaved:false};
const esc=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
let favorites=[];
try{favorites=JSON.parse(localStorage.getItem("radar-follow-investors-v1")||"[]");if(!Array.isArray(favorites))favorites=[]}catch{favorites=[]}
const key=p=>state.region+":"+String(p.name||"").trim().toUpperCase();
const fav=p=>favorites.includes(key(p));
function toggle(id){if(favorites.includes(id))favorites=favorites.filter(x=>x!==id);else favorites.push(id);
  try{localStorage.setItem("radar-follow-investors-v1",JSON.stringify(favorites))}catch{}
  draw();
}
function date(x){if(!x)return "Not reported";const t=new Date(x.slice(0,10)+"T12:00:00Z");return Number.isNaN(+t)?esc(x):t.toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}
const cr=n=>n==null?"—":"₹"+Number(n).toLocaleString("en-IN",{maximumFractionDigits:2})+" Cr";
const cad=n=>n==null?"—":"C$"+Number(n).toLocaleString("en-CA",{maximumFractionDigits:0});
const metric=(label,value)=>'<div><small>'+esc(label)+'</small><b>'+value+'</b></div>';
const link=(url,label)=>{try{const u=new URL(url);if(u.protocol==="https:")return '<a href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+" ↗</a>";}catch{}return ""};
function observedText(p){
  const notes=[];
  if(p.repeatBuyCompanies?.length)notes.push("Repeat reported buying: "+p.repeatBuyCompanies.join(", "));
  if(p.observedBuyDays>=1&&p.observedSellDays>=1)notes.push("Both purchases and sales were reported in this period; net matters.");
  if(p.uniqueCompanies>=3)notes.push("Reported purchases span multiple listed companies.");
  if(!notes.length)notes.push(p.observedTransactions?
    "Insufficient repeated disclosures to infer a consistent approach.":"No qualifying transaction in the retained NSE archive.");
  return notes;
}
function indianCard(p){
  const active=(p.observedTransactions||0)>0;
  const id=key(p);
  const stocks=(p.companies||[]).slice(0,6);
  return '<article class="item">'+
    '<div class="top"><div><span class="cat">'+esc(p.type||"Investor")+'</span><h3>'+esc(p.displayName||p.name)+'</h3>'+
    (p.displayName&&p.name!==p.displayName?'<div class="muted">Reported name: '+esc(p.name)+'</div>':"")+
    '<span class="pill">'+(active?"Exchange-recorded activity":"Watching · no matched deal")+'</span></div>'+
    '<button class="star" type="button" data-fav="'+esc(id)+'" aria-label="Star investor">'+(fav(p)?"★":"☆")+'</button></div>'+
    '<div class="metrics">'+metric("Reported buys",cr(active?p.buyValueCr:null))+
    metric("Reported sells",cr(active?p.sellValueCr:null))+
    metric("Net disclosed value",cr(active?p.netDisclosedValueCr:null))+'</div>'+
    '<div class="muted">Purchase dates: '+(p.observedBuyDays||0)+' · Sale dates: '+(p.observedSellDays||0)+
    ' · Companies: '+(p.uniqueCompanies||0)+' · Last recorded: '+date(p.latestDisclosure)+'</div>'+
    observedText(p).map(t=>'<div class="company">'+esc(t)+'</div>').join("")+
    stocks.map(x=>'<div class="company"><b>'+esc(x.symbol)+'</b> · '+esc(x.company)+
      ' · Buy '+cr(x.buyValueCr)+' · Sell '+cr(x.sellValueCr)+
      (x.buyDays>=2?' · '+x.buyDays+' buying dates':"")+'</div>').join("")+
    (active?'<details><summary>Show reported individual transactions</summary><div class="tablewrap"><table><thead><tr><th>Trade date</th><th>Company</th><th>Buy</th><th>Sell</th></tr></thead><tbody>'+
     (p.tradeRecords||[]).slice(0,30).map(x=>'<tr><td>'+date(x.date)+'</td><td>'+esc(x.symbol)+'</td><td>'+cr(x.buyValueINR/1e7)+'</td><td>'+cr(x.sellValueINR/1e7)+'</td></tr>').join("")+
     '</tbody></table></div></details>':"")+
    '<div class="links" style="margin-top:10px">'+link("https://www.nseindia.com/report-detail/display-bulk-and-block-deals","Official NSE deals")+'</div></article>';
}
function canadianCard(p,all){
  const trades=(all.purchases||[]).filter(x=>String(x.investor||"").toLowerCase()===String(p.name||"").toLowerCase());
  const grouped=new Map();
  for(const r of trades){const k=r.name||r.symbol;const arr=grouped.get(k)||[];arr.push(r);grouped.set(k,arr)}
  const repeat=[...grouped.entries()].filter(([_,v])=>new Set(v.map(x=>x.transactionDate||x.disclosureDate)).size>=2).map(([k])=>k);
  const dealsPrivate=trades.filter(t=>/private placement|unit/i.test(t.transactionType||"")).length;
  const dealsMarket=trades.filter(t=>/open.market/i.test(t.transactionType||"")).length;
  const active=(p.verifiedPurchases||0)>0;
  const id=key(p);
  return '<article class="item"><div class="top"><div><span class="cat">CANADIAN VERIFIED INVESTOR</span><h3>'+esc(p.name)+'</h3>'+
     '<span class="pill">'+(active?"Named corporate purchases":"Watching · not verified")+'</span></div>'+
     '<button type="button" class="star" data-fav="'+esc(id)+'" aria-label="Star investor">'+(fav(p)?"★":"☆")+'</button></div>'+
     '<div class="metrics">'+metric("Disclosed acquisitions",active?String(p.verifiedPurchases):"—")+
     metric("Disclosed capital",cad(active?p.totalDisclosedCAD:null))+
     metric("Companies",String((p.companies||[]).length))+'</div>'+
     '<p class="muted">Latest disclosure: '+date(p.latestDisclosure)+'</p>'+
     (active?'<div class="company">Observed transaction types: '+dealsMarket+' open-market · '+dealsPrivate+' private placement / units.</div>':
       '<div class="company">No purchase verified in the currently retained Canadian transaction ledger.</div>')+
     (repeat.length?'<div class="company">Repeat disclosed purchases: '+repeat.map(esc).join(", ")+'</div>':"")+
     (p.companies?.length?'<div class="company">Invested in: '+p.companies.map(esc).join(", ")+'</div>':"")+
     (trades.length?'<details><summary>Show individual documented purchases</summary><div class="tablewrap"><table><thead><tr><th>Transaction</th><th>Company</th><th>Investment</th></tr></thead><tbody>'+
       trades.map(x=>'<tr><td>'+date(x.transactionDate||x.disclosureDate)+'</td><td>'+esc(x.symbol)+'</td><td>'+cad(x.valueCAD)+'</td></tr>').join("")+
       '</tbody></table></div>'+trades.map(x=>'<div class="links">'+link(x.sourceUrl,esc(x.symbol)+" · "+date(x.disclosureDate))+'</div>').join("")+'</details>':"")+
     '<div class="links" style="margin-top:10px">These are individually documented transactions; they do not establish all holdings or intent.</div></article>';
}
function draw(){
  const isIn=state.region==="India";
  const d=isIn?state.india:state.canada;
  $("[data-region='India']").classList.toggle("active",isIn);
  $("[data-region='Canada']").classList.toggle("active",!isIn);
  $("#onlyObserved").classList.toggle("active",state.onlyObserved);
  $("#onlySaved").classList.toggle("active",state.onlySaved);
  $("#panelTitle").textContent=isIn?"Indian investor transaction histories":"Canadian corporate investor histories";
  if(!d){$("#cards").innerHTML='<div class="notice">Feed unavailable. No investor transactions are being inferred.</div>';return}
  const raw=isIn?[...(d.featured||[]),...(d.discovered||[])]:[...(d.investorWatch||[])];
  let unique=new Map();
  for(const p of raw){const k=key(p);if(!unique.has(k))unique.set(k,p)}
  let list=[...unique.values()];
  const q=state.search.trim().toLowerCase();
  if(q)list=list.filter(p=>[p.name,p.displayName,...(p.companies||[]).map(x=>typeof x==="string"?x:x.company+" "+x.symbol)].some(x=>String(x||"").toLowerCase().includes(q)));
  if(state.onlyObserved)list=list.filter(p=>isIn?(p.observedTransactions||0)>0:(p.verifiedPurchases||0)>0);
  if(state.onlySaved)list=list.filter(p=>fav(p));
  list.sort((a,b)=>Number(fav(b))-Number(fav(a))||
     ((isIn?Number(b.netDisclosedValueCr||0):Number(b.totalDisclosedCAD||0))-
       (isIn?Number(a.netDisclosedValueCr||0):Number(a.totalDisclosedCAD||0))));
  const count=isIn?d.coverage||{}:d.status||{};
  $("#overview").textContent=isIn?
    "Official NSE bulk/block client disclosures from "+date(count.earliest)+" to "+date(count.latest)+
    ". Publicly known investors with no matching deals can be displayed by switching off 'With activity'. These are observed transactions, not full portfolios.":
    "Named acquisitions verified from Canadian corporate releases and available ownership disclosures. Joint investors are not automatically independent decision-makers.";
  const stat=isIn?[["Individual disclosures",count.trades||0],["Reported participants",count.investors||0],["Monitored profiles",raw.length],["Visible",list.length]]:
    [["Verified investments",count.verifiedPurchases||0],["Named investors",count.distinctBuyers||0],["Corporate issuers",count.companies||0],["Visible",list.length]];
  $("#stats").innerHTML=stat.map(([label,n])=>'<div class="stat"><small>'+esc(label)+'</small><b>'+n+'</b></div>').join("");
  $("#health").textContent=isIn?
    "Source: official NSE bulk/block trade files. Coverage: "+date(count.earliest)+"–"+date(count.latest)+". NSE files identify the disclosed participant, not necessarily its ultimate beneficial owner. Buy/sell values are disclosed-side trade notionals. Quarterly shareholding patterns are NOT yet integrated.":
    "Source: reviewed original Canadian acquisition press releases; date ranges and available coverage are incomplete. Prices never substitute for named acquisitions. No automated SEDI scraping.";
  $("#cards").innerHTML=list.length?list.slice(0,95).map(p=>isIn?indianCard(p):canadianCard(p,d)).join(""):
    '<div class="notice">No profiles match these filters. This does not indicate the investor made no purchases.</div>';
  document.querySelectorAll("[data-fav]").forEach(el=>el.addEventListener("click",()=>toggle(el.dataset.fav)));
}
async function load(){
  const paths=[["india","investor-watch-india.json"],["canada","canada-new-try.json"]];
  const result=await Promise.all(paths.map(async ([name,path])=>{
    try{let r=await fetch(path+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error(path);
      let j=await r.json();
      if(name==="india"&&(!Array.isArray(j.featured)||!Array.isArray(j.discovered)))throw Error("Invalid India watch");
      if(name==="canada"&&(!Array.isArray(j.investorWatch)||!Array.isArray(j.purchases)))throw Error("Invalid Canada watch");
      return [name,j];
    }catch{return [name,null]}
  }));
  for(const [name,d] of result)state[name]=d;
  draw();
}
document.querySelectorAll("[data-region]").forEach(b=>b.addEventListener("click",()=>{
  state.region=b.dataset.region;state.search="";$("#search").value="";draw();
}));
$("#search").addEventListener("input",e=>{state.search=e.target.value;draw()});
$("#onlyObserved").addEventListener("click",()=>{state.onlyObserved=!state.onlyObserved;draw()});
$("#onlySaved").addEventListener("click",()=>{state.onlySaved=!state.onlySaved;draw()});
load();
})();