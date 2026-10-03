(function(){
const KEY='investmentRadarPortfolioV1';
function cleanMarket(v){return v==='India'?'India':v==='Canada'?'Canada':null}
function load(){try{const rows=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.map(x=>({...x,ticker:String(x.ticker||'').toUpperCase(),market:cleanMarket(x.market)})):[]}catch(e){return[]}}
function save(rows){localStorage.setItem(KEY,JSON.stringify(rows))}
function add(row){const rows=load(),key=String(row.ticker||'').toUpperCase(),market=cleanMarket(row.market);const i=rows.findIndex(x=>x.ticker===key&&(!market||!x.market||x.market===market));if(i>=0){const old=rows[i],shares=Number(old.shares||0)+Number(row.shares||0),cost=Number(old.shares||0)*Number(old.avgCost||0)+Number(row.shares||0)*Number(row.avgCost||0);rows[i]={...old,...row,ticker:key,market:market||old.market,shares,avgCost:shares?cost/shares:0}}else rows.push({...row,ticker:key,market});save(rows);return rows}
function remove(ticker,market){ticker=String(ticker||'').toUpperCase();market=cleanMarket(market);const rows=load().filter(x=>!(x.ticker===ticker&&(!market||x.market===market)));save(rows);return rows}
function migrateMarket(ticker,market){const rows=load();let changed=false;rows.forEach(x=>{if(x.ticker===ticker&&!x.market){x.market=cleanMarket(market);changed=true}});if(changed)save(rows);return rows}
window.PORTFOLIO={load,save,add,remove,migrateMarket}
})();