/*
 * INVESTMENT RADAR - SCORING ENGINE V2
 * Calibrated, sector-aware, and quality-vs-price aware scoring layer.
 */
(function () {
    function n(value) {
        const x = Number(value);
        return Number.isFinite(x) ? x : null;
    }
    function clamp(value, min = 0, max = 100) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    }
    function avg(values) {
        const valid = values.filter(v => v !== null && v !== undefined && Number.isFinite(Number(v)));
        return valid.length ? valid.reduce((a, b) => a + Number(b), 0) / valid.length : null;
    }
    function confidenceScore(stock) {
        try {
            const r = typeof window.getDataQualityReport === "function" ? window.getDataQualityReport(stock) : null;
            return clamp(n(r?.confidence?.score ?? r?.completeness) ?? 50);
        } catch (_) { return 50; }
    }
    function applyConfidenceCalibration(raw, confidence) {
        /* Full data = 100% of score. Missing data can reduce, never inflate, it. */
        return clamp(raw * (0.78 + 0.22 * clamp(confidence) / 100));
    }
    function sector(stock) {
        return String(stock?.sector || stock?.industrySector || stock?.profile?.sector || "").toLowerCase();
    }
    function industry(stock) {
        return String(stock?.industry || stock?.industryName || stock?.profile?.industry || "").toLowerCase();
    }
    function sectorWeights(stock) {
        const s = sector(stock), i = industry(stock);
        const base = { quality:25, valuation:25, growth:15, market:10, psychology:10, ownership:10, income:5 };
        if (s.includes("financial") || i.includes("bank") || i.includes("insurance")) return {quality:28,valuation:27,growth:12,market:8,psychology:10,ownership:10,income:5};
        if (s.includes("utilities")) return {quality:29,valuation:27,growth:9,market:8,psychology:10,ownership:7,income:10};
        if (s.includes("real estate") || i.includes("reit")) return {quality:25,valuation:28,growth:10,market:8,psychology:10,ownership:9,income:10};
        if (s.includes("energy") || s.includes("materials")) return {quality:27,valuation:29,growth:11,market:9,psychology:10,ownership:9,income:5};
        if (s.includes("technology") || s.includes("communication")) return {quality:25,valuation:28,growth:20,market:8,psychology:9,ownership:7,income:3};
        return base;
    }
    function weighted(values, weights) {
        let total=0, weight=0;
        Object.keys(weights).forEach(k => {
            const v=values[k];
            if (v !== null && v !== undefined && Number.isFinite(Number(v))) { total += Number(v)*weights[k]; weight += weights[k]; }
        });
        return weight ? total/weight : 0;
    }
    function longComponents(stock) {
        return {
            quality: typeof window.businessQualityScore === "function" ? window.businessQualityScore(stock) : null,
            valuation: typeof window.valuationScore === "function" ? window.valuationScore(stock) : null,
            growth: typeof window.growthScore === "function" ? window.growthScore(stock) : null,
            market: typeof window.marketBehaviourScore === "function" ? window.marketBehaviourScore(stock) : null,
            psychology: typeof window.investmentPsychologyScore === "function" ? window.investmentPsychologyScore(stock) : null,
            ownership: typeof window.ownershipScore === "function" ? window.ownershipScore(stock) : null,
            income: typeof window.incomeScore === "function" ? window.incomeScore(stock) : null
        };
    }
    function lower(value, levels) {
        if (value === null || value <= 0) return null;
        for (const x of levels) if (value <= x.max) return x.score;
        return 10;
    }
    function shortComponents(stock) {
        const t=stock.technical||{}, v=stock.valuation||{}, f=stock.fundamentals||{};
        const price=n(stock.price), sma50=n(t.sma50), sma200=n(t.sma200), m3=n(t.momentum3M), m6=n(t.momentum6M);
        const momentum=avg([
            m3===null?null:m3>=20?100:m3>=10?85:m3>=5?75:m3>=0?60:m3>=-10?40:20,
            m6===null?null:m6>=30?100:m6>=20?90:m6>=10?80:m6>=0?60:m6>=-10?40:20
        ]);
        let priceAction=null;
        if(price!==null&&sma50!==null&&sma200!==null&&sma200>0){const d=((price/sma50)-1)*100;priceAction=price>sma50&&sma50>sma200&&d>=0&&d<=10?100:price>sma50&&sma50>sma200?85:price>sma50?70:price>=sma50*.95?55:25;}
        const valuation=avg([
            lower(n(v.forwardPE),[{max:15,score:100},{max:20,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:25}]),
            lower(n(v.pe),[{max:15,score:100},{max:20,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:25}])
        ]);
        const trend=sma50!==null&&sma200!==null?(sma50>sma200?100:35):null;
        const fundamentals=avg([
            n(f.revenueGrowth5Y)===null?null:n(f.revenueGrowth5Y)>=20?100:n(f.revenueGrowth5Y)>=10?85:n(f.revenueGrowth5Y)>=5?70:n(f.revenueGrowth5Y)>=0?50:0,
            n(f.epsGrowth5Y)===null?null:n(f.epsGrowth5Y)>=20?100:n(f.epsGrowth5Y)>=10?85:n(f.epsGrowth5Y)>=5?70:n(f.epsGrowth5Y)>=0?50:0
        ]);
        return {momentum,priceAction,valuation,trend,fundamentals,psychology:typeof window.investmentPsychologyScore==='function'?window.investmentPsychologyScore(stock):null};
    }
    function qualityScore(stock) {
        const f=stock.fundamentals||{};
        const vals=[f.revenueGrowth5Y,f.epsGrowth5Y,f.profitMargin,f.roe,f.roic].map(v=>{v=n(v);return v===null?null:v>=25?100:v>=20?90:v>=15?80:v>=10?70:v>=5?55:v>=0?35:15;});
        const fcf=n(f.freeCashFlow), debt=n(f.debtToEquity);
        if(fcf!==null) vals.push(fcf>0?85:20);
        if(debt!==null) vals.push(debt<=.5?90:debt<=1?75:debt<=2?45:20);
        return avg(vals)??0;
    }
    function priceScore(stock) {
        const v=stock.valuation||{};
        return avg([
            lower(n(v.pe),[{max:12,score:100},{max:15,score:90},{max:20,score:80},{max:25,score:65},{max:35,score:45},{max:50,score:25}]),
            lower(n(v.forwardPE),[{max:12,score:100},{max:15,score:90},{max:20,score:80},{max:25,score:65},{max:35,score:45},{max:50,score:25}]),
            lower(n(v.peg),[{max:.75,score:100},{max:1,score:90},{max:1.5,score:80},{max:2,score:65},{max:3,score:40}]),
            lower(n(v.priceToFcf),[{max:12,score:100},{max:18,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:30}])
        ])??0;
    }
    function longScore(stock) { return applyConfidenceCalibration(weighted(longComponents(stock),sectorWeights(stock)),confidenceScore(stock)); }
    function shortScore(stock) {
        const c=shortComponents(stock);
        return applyConfidenceCalibration(weighted(c,{momentum:30,priceAction:20,valuation:15,trend:15,fundamentals:10,psychology:10}),confidenceScore(stock));
    }
    window.longTermScore=longScore;
    window.shortTermScore=shortScore;
    window.radarQualityScore=qualityScore;
    window.radarPriceScore=priceScore;
    window.radarSectorWeights=sectorWeights;
    window.radarConfidenceCalibration=applyConfidenceCalibration;
    window.getRadarScoreComponents=function(stock,view){
        if(view==='Short Term'){const c=shortComponents(stock);return [["Momentum",c.momentum,30],["Price Action",c.priceAction,20],["Valuation",c.valuation,15],["Market Trend",c.trend,15],["Fundamentals",c.fundamentals,10],["Psychology",c.psychology,10]];}
        const c=longComponents(stock),w=sectorWeights(stock);return [["Business Quality",c.quality,w.quality],["Valuation",c.valuation,w.valuation],["Growth",c.growth,w.growth],["Market Behaviour",c.market,w.market],["Psychology",c.psychology,w.psychology],["Ownership",c.ownership,w.ownership],["Income",c.income,w.income]];
    };
})();
