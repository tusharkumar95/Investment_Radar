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
        const verdict=score>=85?"Excellent Fit":score>=75?"Strong Fit":score>=65?"Good Fit":score>=50?"Review":"Weak Fit";
        return {...etf,score,verdict};
    }

    function holdingKey(x){ return String(x.symbol||x.ticker||'').toUpperCase(); }
    function sectorKey(x){ return String(x.sector||x.name||'').trim().toLowerCase(); }

    function overlap(a,b){
        const ah=new Map((a.holdings||[]).map(x=>[holdingKey(x),num(x.weight)||0]).filter(x=>x[0]));
        const bh=new Map((b.holdings||[]).map(x=>[holdingKey(x),num(x.weight)||0]).filter(x=>x[0]));
        let sharedWeight=0; const shared=[],sharedDetails=[];
        for(const [symbol,weightA] of ah){
            if(!bh.has(symbol)) continue;
            const weightB=bh.get(symbol), overlapWeight=Math.min(weightA,weightB);
            sharedWeight+=overlapWeight;
            shared.push(symbol);
            sharedDetails.push({ticker:symbol,weightA,weightB,overlapWeight});
        }
        sharedDetails.sort((x,y)=>y.overlapWeight-x.overlapWeight);
        const coverageA=[...ah.values()].reduce((s,x)=>s+x,0),coverageB=[...bh.values()].reduce((s,x)=>s+x,0);
        return {
            percentage:Math.round(sharedWeight*10)/10,
            shared,
            sharedDetails,
            flagged:sharedWeight>=20,
            preferred:a.score>=b.score?a.ticker:b.ticker,
            coverageA:Math.round(coverageA*10)/10,
            coverageB:Math.round(coverageB*10)/10
        };
    }

    function sectorOverlap(a,b){
        const as=new Map((a.sectors||[]).map(x=>[sectorKey(x),{name:x.sector||x.name,weight:num(x.weight)||0}]).filter(x=>x[0]));
        const bs=new Map((b.sectors||[]).map(x=>[sectorKey(x),{name:x.sector||x.name,weight:num(x.weight)||0}]).filter(x=>x[0]));
        let sharedWeight=0; const shared=[];
        for(const [key,left] of as){
            const right=bs.get(key);
            if(!right) continue;
            const overlapWeight=Math.min(left.weight,right.weight);
            sharedWeight+=overlapWeight;
            shared.push({sector:left.name||right.name||key,weightA:left.weight,weightB:right.weight,overlapWeight});
        }
        shared.sort((x,y)=>y.overlapWeight-x.overlapWeight);
        const coverageA=[...as.values()].reduce((s,x)=>s+x.weight,0),coverageB=[...bs.values()].reduce((s,x)=>s+x.weight,0);
        return {
            percentage:Math.round(sharedWeight*10)/10,
            shared,
            coverageA:Math.round(coverageA*10)/10,
            coverageB:Math.round(coverageB*10)/10,
            available:as.size>0&&bs.size>0
        };
    }

    function portfolioOverlap(etf,portfolio,market){
        const hs=new Map((etf.holdings||[]).map(x=>[holdingKey(x),{weight:num(x.weight)||0,name:x.ticker||x.symbol}]).filter(x=>x[0])),matches=[];
        for(const p of portfolio||[]){
            if(market&&p.market&&p.market!==market)continue;
            const raw=holdingKey(p),base=raw.replace(/\.TO$|\.NS$|\.BO$/,'');
            let h=hs.get(raw);
            if(!h){for(const [k,v] of hs){if(k.replace(/\.TO$|\.NS$|\.BO$/,'')===base){h=v;break;}}}
            if(h)matches.push({ticker:raw,name:h.name,weight:h.weight});
        }
        const weight=matches.reduce((s,x)=>s+x.weight,0),coverage=[...hs.values()].reduce((s,x)=>s+x.weight,0);
        return {matches,weight:Math.round(weight*10)/10,coverage:Math.round(coverage*10)/10};
    }

    function rank(etfs){return(Array.isArray(etfs)?etfs:[]).map(scoreETF).sort((a,b)=>b.score-a.score);}
    window.ETF_RADAR={scoreETF,rank,overlap,sectorOverlap,portfolioOverlap};
})();
