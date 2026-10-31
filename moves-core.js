"use strict";
const state={moveMarket:"All",investorQuery:"",companyQuery:"",movesDaily:null,movesTracking:null,moveMode:"All"};
let movesView=()=>'<div class="moves-empty">Loading Moves…</div>';
let moveFilterOptions=()=>[];
function escapeHTML(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function render(){const n=document.getElementById("moves-root");if(n)n.innerHTML=movesView();}
function setInvestorFilter(v){state.investorQuery=v||"";render();}
function setCompanyFilter(v){state.companyQuery=v||"";render();}
function clearMoveFilters(){state.investorQuery="";state.companyQuery="";render();}
