/* Canada New Try — verified named acquisitions only, no activity-based signals. */
(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const tabs=[...document.querySelectorAll("[data-tab]")];
  const descriptions={
    purchases:["Documented acquisitions","Named buyers and disclosed transactions from independently reviewed Canadian sources. The disclosure may post days or weeks after the actual trade."],
    companies:["Companies with documented buyers","Aggregate only the named purchases in this dataset. Total values are disclosed transactions, not estimates of corporate ownership."],
    multipleBuyers:["Multiple independently identified buyers","Two or more distinct named buyers disclosed transactions in the same Canadian security within the past seven days. No event is invented when only one buyer is known."],
    tracks:["Purchase-based Track Sheet","Tracks are created only from verified acquisition records. Closing prices measure subsequent performance, not whether another investor bought."]
  };
  const state={feed:null,tab:"purchases",query:"",sort:"newest"};
  const esc=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[x]));
  const money=n=>n!=null&&Number.isFinite(Number(n))?"C$"+Number(n).toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
  const quantity=n=>n!=null&&Number.isFinite(Number(n))?Number(n).toLocaleString("en-CA"):"—";
  const percent=n=>n==null?"—":'<span class="'+(Number(n)>=0?"up":"down")+'">'+(Number(n)>0?"+":"")+Number(n).toFixed(2)+"%</span>";
  function fmt(v){
    if(!v)return "Not disclosed";
    const d=new Date(String(v).slice(0,10)+"T12:00:00Z");
    return Number.isFinite(d.valueOf())?d.toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):esc(v);
  }
  function sourceLink(url,label){
    try{const u=new URL(url);if(u.protocol==="https:")return '<a target="_blank" rel="noopener noreferrer" href="'+esc(u.href)+'">'+esc(label)+" ↗</a>";}catch(_){}
    return "";
  }
  const metric=(a,b)=>'<div><small>'+esc(a)+'</small><b>'+b+'</b></div>';
  function disclosureCard(r){
    return '<article class="rowcard">'+
      '<div class="cardtop"><span class="label">DOCUMENTED PURCHASE</span><span class="pill">'+fmt(r.disclosureDate)+'</span></div>'+
      '<h3>'+esc(r.name)+'</h3><div class="ticker">'+esc(r.symbol)+'</div>'+
      '<div class="signal">Buyer: '+esc(r.investor)+'</div>'+
      '<div class="reason">'+esc(r.buyerType||"Named investor")+'</div>'+
      '<div class="numbers">'+metric("Shares purchased",quantity(r.shares))+metric("Disclosed investment",money(r.valueCAD))+metric("Price per share",money(r.disclosedPrice))+'</div>'+
      '<div class="reason">Trade: '+fmt(r.transactionDate)+' · Disclosed: '+fmt(r.disclosureDate)+'</div>'+
      '<div class="foot">'+sourceLink(r.sourceUrl,"View disclosed transaction")+
      ' · '+esc(r.source||"Reviewed acquisition")+
      (r.notes?'<div>'+esc(r.notes)+'</div>':"")+'</div></article>';
  }
  function companyCard(r){
    const sources=(state.feed.purchases||[]).filter(x=>r.sourceIds.includes(x.id));
    return '<article class="rowcard">'+
      '<div class="cardtop"><span class="label">DISCLOSED INVESTOR PURCHASES</span><span class="pill">'+fmt(r.latestDisclosure)+'</span></div>'+
      '<h3>'+esc(r.name)+'</h3><div class="ticker">'+esc(r.symbol)+'</div>'+
      '<div class="numbers">'+metric("Distinct named buyers",quantity(r.distinctBuyers))+metric("Verified transactions",quantity(r.transactions))+metric("Total disclosed",money(r.totalDisclosedCAD))+'</div>'+
      '<div class="reason">Buyers: '+(r.investors||[]).map(esc).join(" · ")+'</div>'+
      '<div class="foot">'+sources.map(x=>sourceLink(x.sourceUrl, x.investor)).join(" · ")+'</div></article>';
  }
  function trackCard(r){
    const points=r.checkpoints||[];
    const val=o=>points.find(x=>x.offset===o);
    return '<article class="rowcard">'+
      '<div class="cardtop"><span class="label">VERIFIED PURCHASE TRACK</span><span class="pill">Started '+fmt(r.started)+'</span></div>'+
      '<h3>'+esc(r.name)+'</h3><div class="ticker">'+esc(r.symbol)+'</div>'+
      '<div class="signal">'+esc(r.investor)+'</div>'+
      '<div class="reason">'+money(r.valueCAD)+' disclosed · Published '+fmt(r.disclosureDate)+'</div>'+
      '<div class="numbers">'+metric("Signal-day close",money(val(0)?.price))+metric("Last confirmed close",money(r.lastPrice))+metric("Price change",percent(r.priceChangePct))+'</div>'+
      '<div class="tablewrap"><table><thead><tr><th>Checkpoint</th><th>Session</th><th>Close (CAD)</th></tr></thead><tbody>'+
      [0,5,10,15,30].map(n=>'<tr><td>D+'+n+'</td><td>'+fmt(val(n)?.day)+'</td><td>'+money(val(n)?.price)+'</td></tr>').join("")+
      '</tbody></table></div><div class="foot">'+esc(r.quoteStatus||"Unconfirmed quote")+' · '+sourceLink(r.sourceUrl,"Original disclosure")+'</div></article>';
  }
  function valueOf(x){return x.valueCAD??x.totalDisclosedCAD??0;}
  function repaint(){
    if(!state.feed)return;
    tabs.forEach(t=>{const on=t.dataset.tab===state.tab;t.classList.toggle("active",on);t.setAttribute("aria-pressed",String(on));});
    $("#sectionTitle").textContent=descriptions[state.tab][0];
    $("#sectionDescription").textContent=descriptions[state.tab][1];
    const query=state.query.toLowerCase().trim();
    const input=Array.isArray(state.feed[state.tab])?[...state.feed[state.tab]]:[];
    const rows=input.filter(x=>[x.symbol,x.name,x.investor,x.buyerType,...(x.investors||[])].some(v=>String(v||"").toLowerCase().includes(query)));
    if(state.sort==="largest")rows.sort((a,b)=>valueOf(b)-valueOf(a));
    else if(state.sort==="ticker")rows.sort((a,b)=>String(a.symbol).localeCompare(String(b.symbol)));
    else rows.sort((a,b)=>String(b.disclosureDate||b.latestDisclosure||b.started||"").localeCompare(String(a.disclosureDate||a.latestDisclosure||a.started||"")));
    let view=state.tab==="tracks"?trackCard:state.tab==="purchases"?disclosureCard:companyCard;
    $("#cards").innerHTML=rows.length?rows.map(view).join(""):
      '<div class="empty">No verified named purchases match these filters. This is a data-coverage gap, not evidence that companies are not buying.</div>';
  }
  async function load(){
    try{
      const resp=await fetch("canada-new-try.json?t="+Date.now(),{cache:"no-store"});
      if(!resp.ok)throw Error("Purchase dataset not yet published");
      const feed=await resp.json();
      if(feed.schema!==2||!["purchases","companies","multipleBuyers","tracks"].every(k=>Array.isArray(feed[k])))throw Error("Outdated or invalid purchase dataset");
      state.feed=feed;
      const s=feed.status||{};
      $("#updated").textContent="Data refreshed "+(feed.updated?new Date(feed.updated).toLocaleString("en-CA",{timeZone:"America/Toronto"}):"unavailable")+
        " · Last documented purchase "+(feed.purchases[0]?fmt(feed.purchases[0].disclosureDate):"not available");
      $("#stats").innerHTML=[
        ["Verified purchases",s.verifiedPurchases??0],["Named investors",s.distinctBuyers??0],
        ["Companies bought",s.companies??0],["Purchase-based tracks",s.tracked??0]
      ].map(([a,b])=>'<div class="metric"><small>'+esc(a)+'</small><b>'+b+'</b></div>').join("");
      $("#sourceHealth").textContent="Only reviewed acquisition records and manually verified SEDI imports are included. "+
        "A Canadian listing or a U.S. CDR does not qualify without a transaction naming a buyer. "+
        "Records may arrive after the trading date. Delayed closing prices are used only after a purchase is documented. "+
        ((s.quoteErrors||[]).length?"Some historical closes are unavailable; blanks are intentional.":"Unavailable prices are never estimated.");
      repaint();
    }catch(e){
      $("#updated").textContent="Verified-purchase feed unavailable";
      $("#cards").innerHTML='<div class="empty">The revised purchase-only dataset is not available yet. There are no substitute market-activity signals.</div>';
      $("#sourceHealth").textContent=String(e);
    }
  }
  tabs.forEach(t=>t.addEventListener("click",()=>{state.tab=t.dataset.tab;state.query="";$("#filter").value="";repaint();}));
  $("#filter").addEventListener("input",e=>{state.query=e.target.value;repaint();});
  $("#sort").addEventListener("change",e=>{state.sort=e.target.value;repaint();});
  load();
})();