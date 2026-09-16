(function () {
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    function scoreETF(etf) {
        const mer=num(etf.expenseRatio), aum=num(etf.aum), yieldPct=num(etf.yield), r3=num(etf.threeYearReturn), r5=num(etf.fiveYearReturn), holdings=Array.isArray(etf.holdings)?etf.holdings:[];
        let score=50;
        if(mer!=null) score+=mer<=0.10?12:mer<=0.25?8:mer<=0.50?3:-6;
        if(aum!=null) score+=aum>=5e9?12:aum>=1e9?9:aum>=250e6?5:0;
        if(r5!=null) score+=r5>=15?10:r5>=10?7:r5>=5?3:r5<0?-5:0; else if(r3!=null) score+=r3>=10?8:r3>=5?4:r3<0?-4:0;
        if(holdings.length>=20) score+=5;
        if(yieldPct!=null&&yieldPct>0) score+=3;
        score=Math.max(0,Math.min(100,Math.round(score)));
        const verdict=score>=85?"Strong Buy":score>=75?"Buy":score>=65?"Accumulate":score>=50?"Watch":"Avoid";
        return {...etf,score,verdict};
    }
    function holdingKey(x){ return String(x.symbol||x.ticker||'').toUpperCase(); }
    function overlap(a,b){
        const ah=new Map((a.holdings||[]).map(x=>[holdingKey(x),num(x.weight)||0]).filter(x=>x[0]));
        const bh=new Map((b.holdings||[]).map(x=>[holdingKey(x),num(x.weight)||0]).filter(x=>x[0]));
        let sharedWeight=0; const shared=[];
        for(const [symbol,weight] of ah){if(bh.has(symbol)){sharedWeight+=Math.min(weight,bh.get(symbol));shared.push(symbol);}}
        return {percentage:Math.round(sharedWeight*10)/10,shared,flagged:sharedWeight>=50,preferred:a.score>=b.score?a.ticker:b.ticker};
    }
    function rank(etfs){return(Array.isArray(etfs)?etfs:[]).map(scoreETF).sort((a,b)=>b.score-a.score);}
    window.ETF_RADAR={scoreETF,rank,overlap};
})();
