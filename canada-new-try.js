/* Canada New Try — separate, read-only experimental UI; no production app state. */
(() => {
  "use strict";
  const qs = s => document.querySelector(s);
  const tabs = [...document.querySelectorAll("[data-tab]")];
  const descriptions = {
    ownership: ["Confirmed acquisitions","Verified company/acquiror releases. One identified buyer is enough for this lane; filing and transaction dates are shown separately."],
    canadaStocks: ["Canadian price + volume activity","A new approach based on Canadian-listing momentum, unusual volume and trend. It does NOT prove insider or institutional buying."],
    cdrs: ["U.S. stocks through CAD-hedged CDRs","These are Canadian-listed depositary receipts, not NYSE/Nasdaq shares. Only confirmed CAD listing quotes are shown."],
    tracks: ["Experimental Track Sheet","Signals are recorded separately from the production Track Sheet. Follow CAD listing closes at D+0/5/10/15/30 calendar days."]
  };
  const state = {feed:null, tab:"ownership", query:"", sort:"score"};
  const esc = s => String(s ?? "").replace(/[&<>"']/g, a => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[a]));
  const money = n => Number.isFinite(Number(n)) && n != null ? "C$"+Number(n).toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:4}) : "—";
  const dec = (n,places=1) => n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toFixed(places);
  const percent = n => n == null ? "—" : '<span class="'+(Number(n)>=0?"up":"down")+'">'+(Number(n)>0?"+":"")+dec(n,2)+"%</span>";
  const date = value => {if(!value)return "—";let d=new Date(value+"T12:00:00Z");return Number.isNaN(d.valueOf())?esc(value):d.toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});};
  const safeLink = (url,label) => {try {const u=new URL(url);return u.protocol==="https:"?'<a href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+" ↗</a>":"";} catch{return "";}};
  const foot = s => '<div class="foot">'+s+"</div>";
  const numeric = (label,content) => '<div><small>'+label+'</small><b>'+content+'</b></div>';

  function card(item) {
    const owner = state.tab === "ownership";
    const rvol = item.relativeVolume == null ? "—" : dec(item.relativeVolume,2)+"×";
    const source = safeLink(item.sourceUrl, owner?"Original disclosure":state.tab==="cdrs"?"CDR issuer":"Data source");
    const numbers = owner ?
      numeric("Disclosed value", money(item.valueCAD)) + numeric("Market close", money(item.price)) + numeric("Trade date", date(item.transactionDate)):
      numeric("CAD listing", money(item.price)) + numeric("5-day return", percent(item.return5d)) + numeric("Relative volume", rvol);
    return '<article class="rowcard">'+
      '<div class="cardtop"><span class="label">'+esc(owner?"CONFIRMED TRANSACTION":item.lane||"RESEARCH")+'</span><span class="score">'+(item.score??"—")+'<small style="font-size:10px;color:#8a949e"> / 100</small></span></div>'+
      '<h3>'+esc(item.name||item.symbol)+'</h3><div class="ticker">'+esc(item.symbol)+" · "+esc(item.priceDate ? "Close "+date(item.priceDate) : owner ? "Filed "+date(item.disclosureDate) : "Quote missing")+'</div>'+
      '<div class="signal">'+esc(item.signal||item.reason||"Research signal")+'</div>'+
      '<div class="reason">'+esc(item.reason||item.evidence||"")+'</div>'+
      '<div class="numbers">'+numbers+'</div>'+
      foot(source+(owner?' · <strong>Documented acquisition</strong>':' · <strong>Not evidence of identified investor buying</strong>')+
        (item.investor?'<div>Buyer: '+esc(item.investor)+'</div>':"")+
        (item.disclosureDate?'<div>Disclosure: '+date(item.disclosureDate)+'</div>':"")+
        (!item.isLiveQuote?'<div>Live CAD quote not confirmed</div>':""))+
      '</article>';
  }

  function trackCard(t) {
    const points=t.checkpoints||[];
    return '<article class="rowcard">'+
      '<div class="cardtop"><span class="label">'+esc(t.lane||"Tracking")+'</span><span class="pill">'+date(t.started)+'</span></div>'+
      '<h3>'+esc(t.name||t.symbol)+'</h3><div class="ticker">'+esc(t.symbol)+'</div>'+
      '<div class="signal">'+esc(t.reason||"")+'</div>'+
      '<div class="numbers">'+numeric("Start close",money(points[0]?.price))+numeric("Last close",money(t.lastPrice))+numeric("Change",percent(t.priceChangePct))+'</div>'+
      '<div class="tablewrap"><table><thead><tr><th>Checkpoint</th><th>Session</th><th>Close (CAD)</th></tr></thead><tbody>'+
      [0,5,10,15,30].map(offset=>{
         const p=points.find(x=>x.offset===offset);
         return '<tr><td>D+'+offset+'</td><td>'+date(p?.day)+'</td><td>'+money(p?.price)+'</td></tr>';
      }).join("")+'</tbody></table></div>'+
      foot('First observed '+date(t.started)+' · '+esc(t.quoteStatus||"Quote not confirmed")+' '+safeLink(t.sourceUrl,"Source"))+'</article>';
  }

  function repaint() {
    const feed=state.feed;
    if(!feed)return;
    tabs.forEach(b=>{const on=b.dataset.tab===state.tab;b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on));});
    qs("#sectionTitle").textContent=descriptions[state.tab][0];
    qs("#sectionDescription").textContent=descriptions[state.tab][1];
    const entries=Array.isArray(feed[state.tab])?[...feed[state.tab]]:[];
    const needle=state.query.trim().toLowerCase();
    const filtered=entries.filter(x=>[x.symbol,x.name,x.investor,x.reason,x.signal,x.lane].some(s=>String(s||"").toLowerCase().includes(needle)));
    if(state.sort==="ticker")filtered.sort((a,b)=>String(a.symbol).localeCompare(String(b.symbol)));
    else if(state.sort==="newest")filtered.sort((a,b)=>String(b.disclosureDate||b.started||b.priceDate||"").localeCompare(String(a.disclosureDate||a.started||a.priceDate||"")));
    else filtered.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
    qs("#cards").innerHTML=filtered.length ? filtered.map(state.tab==="tracks"?trackCard:card).join("") :
      '<div class="empty">No matching records yet. This can mean no qualifying disclosed transactions or no confirmed CAD quotes. Try another tab or clear the search.</div>';
  }

  async function load(){
    try{
      const res=await fetch("canada-new-try.json?t="+Date.now(),{cache:"no-store"});
      if(!res.ok)throw new Error("Pilot dataset not published");
      const feed=await res.json();
      if(feed.schema!==1||!Array.isArray(feed.ownership)||!Array.isArray(feed.cdrs)||!Array.isArray(feed.tracks))throw new Error("Invalid pilot dataset");
      state.feed=feed;
      const status=feed.status||{};
      qs("#updated").textContent="Feed updated "+(feed.updated?new Date(feed.updated).toLocaleString("en-CA",{timeZone:"America/Toronto"}):"not available")+" · Latest quoted session "+(status.lastPriceDate||"not available");
      qs("#stats").innerHTML=[
        ["Verified acquisitions",feed.ownership.length],
        ["Canadian quotes",status.canadaQuoted??0],
        ["CAD-hedged CDRs quoted",status.cdrQuoted??0],
        ["Experimental tracks",feed.tracks.length]
      ].map(x=>'<div class="metric"><small>'+esc(x[0])+'</small><b>'+x[1]+'</b></div>').join("");
      const errors=status.quoteErrors||[];
      qs("#sourceHealth").textContent="Scan universe: "+(status.universe??0)+
        " Canadian-listed tickers including "+(status.cdrUniverse??0)+" selected CAD-hedged CDRs. "+
        "Confirmed ownership comes from independently checked original releases. "+
        (errors.length?"Some quote requests failed; unavailable data are omitted.":"No quote transport errors reported.")+
        " CDR quotes may be delayed or temporarily unavailable.";
      repaint();
    }catch(e){
      qs("#updated").textContent="Pilot data unavailable";
      qs("#cards").innerHTML='<div class="empty">The pilot has not published valid data. The existing Investment Radar app is unaffected.</div>';
      qs("#sourceHealth").textContent=String(e);
    }
  }
  tabs.forEach(b=>b.addEventListener("click",()=>{state.tab=b.dataset.tab;state.query="";qs("#filter").value="";repaint();}));
  qs("#filter").addEventListener("input",e=>{state.query=e.target.value;repaint();});
  qs("#sort").addEventListener("change",e=>{state.sort=e.target.value;repaint();});
  load();
})();