(function(){
const KEY='investmentRadarPortfolioV1';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return[]}}
function save(rows){localStorage.setItem(KEY,JSON.stringify(rows))}
function add(row){const rows=load();const key=(row.ticker||'').toUpperCase();const i=rows.findIndex(x=>x.ticker===key);if(i>=0){const old=rows[i];const shares=Number(old.shares||0)+Number(row.shares||0);const cost=Number(old.shares||0)*Number(old.avgCost||0)+Number(row.shares||0)*Number(row.avgCost||0);rows[i]={...old,...row,ticker:key,shares,avgCost:shares?cost/shares:0}}else rows.push({...row,ticker:key});save(rows);return rows}
function remove(ticker){const rows=load().filter(x=>x.ticker!==(ticker||'').toUpperCase());save(rows);return rows}
window.PORTFOLIO={load,save,add,remove}
})();
