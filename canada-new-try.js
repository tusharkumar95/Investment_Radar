/* Canada New Try — verified named acquisitions only, no activity-based signals. */
(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const tabs=[...document.querySelectorAll("[data-tab]")];
  const descriptions={
    purchases:["Documented acquisitions","Named buyers and disclosed transactions from independently reviewed Canadian sources. The disclosure may post days or weeks after the actual trade."],
    companies:["Companies with documented buyers","Aggregate only the named purchases in this dataset. Total values are disclosed transactions, not estimates of corporate ownership."],
    multipleBuyers:["Independent buyer groups","Two or more independent investor groups must disclose purchases of the same Canadian issuer within seven days. Related joint actors count as one group."],
    investorWatch:["Named investors to follow","Confirmed investments are linked to investor names. Monitored investor names with no documented purchase are shown as such; they are NOT buys."],
    leads:["Disclosures awaiting verification","Research queue from corporate press releases and public news feeds. These are headlines, not established purchases. No tracking or alerts until source review."],
    usFilings:["U.S. institutional filings","SEC 13D/13G beneficial-ownership and 13F portfolio notices. Filings do not establish a purchase on the publication date or any purchase of a Canadian-hedged CDR."],
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
      (r.jointActors?'<div class="reason">Joint-acting investor group · counts as one independent buyer</div>':"")+
      '<div class="reason">'+esc(r.buyerType||"Named investor")+'</div>'+
      '<div class="numbers">'+metric("Shares purchased",quantity(r.shares))+metric("Disclosed investment",money(r.valueCAD))+metric("Price per share",money(r.disclosedPrice))+'</div>'+
      '<div class="reason">'+esc(r.transactionType||"Acquisition")+' · Trade: '+fmt(r.transactionDate)+' · Disclosed: '+fmt(r.disclosureDate)+'</div>'+
      '<div class="foot">'+sourceLink(r.sourceUrl,"View disclosed transaction")+
      ' · '+esc(r.source||"Reviewed acquisition")+
      (r.notes?'<div>'+esc(r.notes)+'</div>':"")+'</div></article>';
  }
  function companyCard(r){
    const sources=(state.feed.purchases||[]).filter(x=>r.sourceIds.includes(x.id));
    return '<article class="rowcard">'+
      '<div class="cardtop"><span class="label">DISCLOSED INVESTOR PURCHASES</span><span class="pill">'+fmt(r.latestDisclosure)+'</span></div>'+
      '<h3>'+esc(r.name)+'</h3><div class="ticker">'+esc(r.symbol)+'</div>'+
      '<div class="numbers">'+metric("Independent investor groups",quantity(r.independentGroups??r.distinctBuyers))+metric("Verified transactions",quantity(r.transactions))+metric("Total disclosed",money(r.totalDisclosedCAD))+'</div>'+
      (r.jointActorDisclosure?'<div class="reason">Related entities disclosed joint action; not separate independent buyers.</div>':"")+
      (r.repeatInvestors?.length?'<div class="signal">Repeat disclosed buying: '+r.repeatInvestors.map(esc).join(", ")+'</div>':"")+
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
  function watchCard(r){
    return '<article class="rowcard"><div class="cardtop"><span class="label">FOLLOWING NAMED INVESTOR</span>'+
    '<span class="pill">'+(r.verifiedPurchases?esc(r.verifiedPurchases)+" verified":"No confirmed purchases")+'</span></div>'+
    '<h3>'+esc(r.name)+'</h3><div class="numbers">'+metric("Confirmed transactions",quantity(r.verifiedPurchases))+
    metric("Total disclosed",money(r.verifiedPurchases?r.totalDisclosedCAD:null))+metric("Headlines to review",quantity(r.candidateArticles))+'</div>'+
    '<div class="reason">'+esc(r.status)+'</div>'+
    (r.companies?.length?'<div class="signal">Bought: '+r.companies.map(esc).join(", ")+'</div>':"")+
    '<div class="foot">Latest confirmation: '+fmt(r.latestDisclosure)+'</div></article>';
  }
  function leadCard(r){
    return '<article class="rowcard"><div class="cardtop"><span class="label">NEEDS VERIFICATION · NOT A BUY</span>'+
    '<span class="pill">'+fmt(r.date)+'</span></div><h3>'+esc(r.title)+'</h3>'+
    '<div class="signal">'+esc(r.type)+'</div>'+
    (r.summary?'<div class="reason">'+esc(r.summary)+'</div>':"")+
    '<div class="foot">'+sourceLink(r.url,"Open discovery article")+
    ' · '+esc(r.discoveredVia||"Public feed")+'</div></article>';
  }
  function secCard(r){
    return '<article class="rowcard"><div class="cardtop"><span class="label">SEC FILING · NOT A CONFIRMED BUY</span>'+
    '<span class="pill">'+fmt(r.date)+'</span></div><h3>'+esc(r.title)+'</h3>'+
    '<div class="signal">'+esc(r.form)+" · "+esc(r.status)+'</div>'+
    '<div class="reason">'+esc(r.notes)+'</div><div class="foot">'+sourceLink(r.url,"Read SEC filing")+'</div></article>';
  }
  function valueOf(x){return x.valueCAD??x.totalDisclosedCAD??0;}
  function repaint(){
    if(!state.feed)return;
    tabs.forEach(t=>{const on=t.dataset.tab===state.tab;t.classList.toggle("active",on);t.setAttribute("aria-pressed",String(on));});
    $("#sectionTitle").textContent=descriptions[state.tab][0];
    $("#sectionDescription").textContent=descriptions[state.tab][1];
    const query=state.query.toLowerCase().trim();
    const input=Array.isArray(state.feed[state.tab])?[...state.feed[state.tab]]:[];
    const rows=input.filter(x=>[x.symbol,x.name,x.investor,x.buyerType,x.title,x.form,x.discoveredVia,x.status,...(x.investors||[]),...(x.companies||[])].some(v=>String(v||"").toLowerCase().includes(query)));
    if(state.sort==="largest")rows.sort((a,b)=>valueOf(b)-valueOf(a));
    else if(state.sort==="ticker")rows.sort((a,b)=>String(a.symbol).localeCompare(String(b.symbol)));
    else rows.sort((a,b)=>String(b.disclosureDate||b.latestDisclosure||b.started||b.date||"").localeCompare(String(a.disclosureDate||a.latestDisclosure||a.started||a.date||"")));
    let view=({tracks:trackCard,purchases:disclosureCard,companies:companyCard,multipleBuyers:companyCard,investorWatch:watchCard,leads:leadCard,usFilings:secCard})[state.tab]||disclosureCard;
    $("#cards").innerHTML=rows.length?rows.map(view).join(""):
      '<div class="empty">No matching records for this view. Missing records or unavailable feeds never imply that no investors are buying.</div>';
  }
  async function load(){
    try{
      const resp=await fetch("canada-new-try.json?t="+Date.now(),{cache:"no-store"});
      if(!resp.ok)throw Error("Purchase dataset not yet published");
      const feed=await resp.json();
      if(feed.schema!==2||!["purchases","companies","multipleBuyers","tracks","investorWatch","leads","usFilings"].every(k=>Array.isArray(feed[k])))throw Error("Outdated or invalid purchase dataset");
      state.feed=feed;
      const s=feed.status||{};
      $("#updated").textContent="Data refreshed "+(feed.updated?new Date(feed.updated).toLocaleString("en-CA",{timeZone:"America/Toronto"}):"unavailable")+
        " · Last documented purchase "+(feed.purchases[0]?fmt(feed.purchases[0].disclosureDate):"not available");
      $("#stats").innerHTML=[
        ["Verified purchases",s.verifiedPurchases??0],["Named investors",s.distinctBuyers??0],
        ["Companies bought",s.companies??0],["Disclosure leads (unverified)",s.disclosureLeads??0]
      ].map(([a,b])=>'<div class="metric"><small>'+esc(a)+'</small><b>'+b+'</b></div>').join("");
      $("#sourceHealth").textContent="Confirmed purchases require a named investor and an individually reviewed original acquisition disclosure. "+
        "Press release headlines and SEC filings go to separate research queues; they do not trigger purchase alerts or tracking. "+
        "Joint actors count as one independent investor group. Historical prices are used only after confirmed purchases.";
      const sourceRows=feed.sourceHealth||[];
      $("#sourceStatus").innerHTML=sourceRows.length?sourceRows.map(x=>
        '<div class="healthrow"><span class="'+(x.ok?"sourceok":"sourcefail")+'">'+(x.ok?"✓ ":"Unavailable: ")+esc(x.name)+'</span>'+
        (x.ok?" · "+esc(x.items??0)+" items":" · "+esc(x.error||""))+'</div>').join(""):
        'Disclosure feed diagnostics will appear after the next scan.';
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