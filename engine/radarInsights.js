/* INVESTMENT RADAR - Score explanation, confidence, and analysis layer */
/* Frontend-only layer: no market-data workflow required. */

(function () {
    function safeNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function clamp(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function bar(label, score, weight) {
        const value = clamp(score);
        return `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:6px;">
                    <span style="font-weight:700;">${label}</span>
                    <strong>${Math.round(value)}/100 <span style="font-size:12px;color:#7a8590;font-weight:600;">(${weight}%)</span></strong>
                </div>
                <div style="height:9px;background:#e5e7eb;border-radius:10px;overflow:hidden;">
                    <div style="width:${value}%;height:100%;background:currentColor;border-radius:10px;"></div>
                </div>
            </div>
        `;
    }

    function legacyLongTermBreakdown(stock) {
        return [
            ["Business Quality", businessQualityScore(stock), 25],
            ["Valuation", valuationScore(stock), 25],
            ["Growth", growthScore(stock), 15],
            ["Market Behaviour", marketBehaviourScore(stock), 10],
            ["Psychology", investmentPsychologyScore(stock), 10],
            ["Ownership", ownershipScore(stock), 10],
            ["Income", incomeScore(stock), 5]
        ];
    }

    function legacyShortTermBreakdown(stock) {
        const t = stock.technical || {};
        const v = stock.valuation || {};
        const f = stock.fundamentals || {};
        const price = safeNumber(stock.price);
        const sma50 = safeNumber(t.sma50);
        const sma200 = safeNumber(t.sma200);
        const m3 = safeNumber(t.momentum3M);
        const m6 = safeNumber(t.momentum6M);
        const pe = safeNumber(v.pe);
        const fpe = safeNumber(v.forwardPE);
        const rg = safeNumber(f.revenueGrowth5Y);
        const eg = safeNumber(f.epsGrowth5Y);
        const momentumValues = [];
        if (m3 !== null) momentumValues.push(m3 >= 20 ? 100 : m3 >= 10 ? 85 : m3 >= 5 ? 75 : m3 >= 0 ? 60 : m3 >= -10 ? 40 : 20);
        if (m6 !== null) momentumValues.push(m6 >= 30 ? 100 : m6 >= 20 ? 90 : m6 >= 10 ? 80 : m6 >= 0 ? 60 : m6 >= -10 ? 40 : 20);
        const momentum = momentumValues.length ? momentumValues.reduce((a, b) => a + b, 0) / momentumValues.length : null;
        let priceAction = null;
        if (price !== null && sma50 !== null && sma200 !== null && sma200 > 0) {
            const distance50 = ((price / sma50) - 1) * 100;
            if (price > sma50 && sma50 > sma200 && distance50 >= 0 && distance50 <= 10) priceAction = 100;
            else if (price > sma50 && sma50 > sma200) priceAction = 85;
            else if (price > sma50) priceAction = 70;
            else if (price >= sma50 * 0.95) priceAction = 55;
            else priceAction = 25;
        }
        function lower(value, levels) { if (value === null || value <= 0) return null; for (const level of levels) if (value <= level.max) return level.score; return 0; }
        function avg(items) { const valid = items.filter(x => x !== null); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; }
        const valuation = avg([
            lower(fpe, [{max:15,score:100},{max:20,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:25}]),
            lower(pe, [{max:15,score:100},{max:20,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:25}])
        ]);
        const trend = sma50 !== null && sma200 !== null ? (sma50 > sma200 ? 100 : 35) : null;
        const fundamental = avg([
            rg === null ? null : rg >= 20 ? 100 : rg >= 10 ? 85 : rg >= 5 ? 70 : rg >= 0 ? 50 : 0,
            eg === null ? null : eg >= 20 ? 100 : eg >= 10 ? 85 : eg >= 5 ? 70 : eg >= 0 ? 50 : 0
        ]);
        return [["Momentum", momentum, 30],["Price Action", priceAction, 20],["Valuation", valuation, 15],["Market Trend", trend, 15],["Fundamentals", fundamental, 10],["Psychology", investmentPsychologyScore(stock), 10]];
    }

    function getBreakdown(stock) {
        if (typeof window.getRadarScoreComponents === "function") return window.getRadarScoreComponents(stock, currentView);
        return currentView === "Long Term" ? legacyLongTermBreakdown(stock) : legacyShortTermBreakdown(stock);
    }

    const originalDataQuality = window.getDataQualityReport;
    if (typeof originalDataQuality === "function") {
        window.getDataQualityReport = function (investment) {
            const original = originalDataQuality(investment) || {};
            const fields = [
                ["fundamentals.revenueGrowth5Y", investment?.fundamentals?.revenueGrowth5Y],["fundamentals.epsGrowth5Y", investment?.fundamentals?.epsGrowth5Y],["fundamentals.profitMargin", investment?.fundamentals?.profitMargin],["fundamentals.roe", investment?.fundamentals?.roe],["fundamentals.roic", investment?.fundamentals?.roic],["fundamentals.freeCashFlow", investment?.fundamentals?.freeCashFlow],["fundamentals.debtToEquity", investment?.fundamentals?.debtToEquity],["valuation.pe", investment?.valuation?.pe],["valuation.forwardPE", investment?.valuation?.forwardPE],["valuation.peg", investment?.valuation?.peg],["valuation.evToEbitda", investment?.valuation?.evToEbitda],["valuation.priceToFcf", investment?.valuation?.priceToFcf],["valuation.priceToBook", investment?.valuation?.priceToBook],["fundamentals.revenueGrowth3Y", investment?.fundamentals?.revenueGrowth3Y],["fundamentals.fcfGrowth5Y", investment?.fundamentals?.fcfGrowth5Y],["technical.momentum3M", investment?.technical?.momentum3M],["technical.momentum6M", investment?.technical?.momentum6M],["technical.sma50", investment?.technical?.sma50],["technical.sma200", investment?.technical?.sma200],["technical.high52Week", investment?.technical?.high52Week],["technical.low52Week", investment?.technical?.low52Week],["ownership.insiderHolding", investment?.ownership?.insiderHolding],["ownership.promoterHolding", investment?.ownership?.promoterHolding],["ownership.promoterChange", investment?.ownership?.promoterChange],["ownership.promoterPledge", investment?.ownership?.promoterPledge],["ownership.institutionalHolding", investment?.ownership?.institutionalHolding],["ownership.institutionalChange", investment?.ownership?.institutionalChange],["ownership.recentBigInvestors", investment?.ownership?.recentBigInvestors],["dividend.yield", investment?.dividend?.yield],["dividend.growth", investment?.dividend?.growth],["dividend.payout", investment?.dividend?.payout]
            ];
            const available = fields.filter(([, value]) => value !== null && value !== undefined && value !== "" && (typeof value !== "number" || Number.isFinite(value))).length;
            const completeness = Math.round((available / fields.length) * 100);
            const confidence = completeness >= 90 ? {score:completeness,label:"Very High",className:"green"} : completeness >= 75 ? {score:completeness,label:"High",className:"green"} : completeness >= 55 ? {score:completeness,label:"Moderate",className:"yellow"} : completeness >= 35 ? {score:completeness,label:"Low",className:"yellow"} : {score:completeness,label:"Very Low",className:"red"};
            return {...original,completeness,confidence,usable:completeness>=40};
        };
    }

    function qualityPriceSection(stock) {
        const quality = typeof window.radarQualityScore === "function" ? clamp(window.radarQualityScore(stock)) : null;
        const price = typeof window.radarPriceScore === "function" ? clamp(window.radarPriceScore(stock)) : null;
        if (quality === null && price === null) return null;
        const qualityLabel = quality >= 80 ? "High-quality business" : quality >= 65 ? "Good business" : quality >= 50 ? "Mixed quality" : "Quality concerns";
        const priceLabel = price >= 80 ? "Attractive price" : price >= 65 ? "Reasonable price" : price >= 50 ? "Mixed valuation" : "Expensive price";
        const section = document.createElement("section"); section.className = "detail-section radar-quality-price";
        section.innerHTML = `<div class="section-title">Quality vs Price</div><div class="metric-grid"><div class="metric"><span class="metric-label">Company Quality</span><span class="metric-value">${quality === null ? "—" : Math.round(quality)+"/100"}</span></div><div class="metric"><span class="metric-label">Current Price Attractiveness</span><span class="metric-value">${price === null ? "—" : Math.round(price)+"/100"}</span></div></div><p class="investment-thesis" style="margin-top:14px;">${quality !== null ? qualityLabel : "Quality data unavailable"} · ${price !== null ? priceLabel : "Price data unavailable"}. A strong company can still be a poor investment when bought at an excessive valuation.</p>`;
        return section;
    }

    function decisionSnapshot(stock) {
        if (typeof window.getRadarDecision !== "function") return null;
        const d = window.getRadarDecision(stock, currentView);
        const v = d.valuation || {};
        const money = value => {
            const n = Number(value);
            if (!Number.isFinite(n) || n <= 0) return "—";
            const currency = currentMarket === "India" ? "₹" : "$";
            return currency + n.toLocaleString(undefined,{maximumFractionDigits:2});
        };
        const mos = Number(v.marginOfSafety);
        const section = document.createElement("section");
        section.className = "detail-section radar-decision-snapshot";
        section.innerHTML = `<div class="section-title">Decision Snapshot</div>
            <div class="metric-grid">
                <div class="metric"><span class="metric-label">Current Action</span><span class="metric-value">${d.verdict}</span></div>
                <div class="metric"><span class="metric-label">Price Zone</span><span class="metric-value">${d.priceZone}</span></div>
                <div class="metric"><span class="metric-label">Business Quality</span><span class="metric-value">${Math.round(d.qualityScore)}/100</span></div>
                <div class="metric"><span class="metric-label">Price Attractiveness</span><span class="metric-value">${Math.round(d.priceScore)}/100</span></div>
                <div class="metric"><span class="metric-label">Fair Value Range</span><span class="metric-value">${money(v.fairValueLow)} – ${money(v.fairValueHigh)}</span></div>
                <div class="metric"><span class="metric-label">Attractive Entry</span><span class="metric-value">${money(v.buyPrice)}</span></div>
                <div class="metric"><span class="metric-label">Strong Opportunity</span><span class="metric-value">${money(v.strongBuyPrice)}</span></div>
                <div class="metric"><span class="metric-label">Margin of Safety</span><span class="metric-value">${Number.isFinite(mos) ? mos.toFixed(1)+"%" : "—"}</span></div>
                <div class="metric"><span class="metric-label">Data Confidence</span><span class="metric-value">${Math.round(d.confidence.score)}% · ${d.confidence.label}</span></div>
            </div>
            <p class="investment-thesis" style="margin-top:14px;">${d.reason} Fair value is a modelled range, not a precise price target.</p>`;
        return section;
    }

    function scoreExplanation(stock) {
        const d = typeof window.getRadarDecision === "function" ? window.getRadarDecision(stock, currentView) : null;
        const parts = getBreakdown(stock).filter(x => Number.isFinite(Number(x[1])));
        if (!parts.length) return null;
        const sorted = [...parts].sort((a,b) => Number(b[1])-Number(a[1]));
        const strengths = sorted.slice(0,2);
        const risks = sorted.slice(-2).reverse();
        const label = x => `${x[0]} ${Math.round(Number(x[1]))}/100`;
        const section = document.createElement("section");
        section.className = "detail-section radar-score-explanation";
        section.innerHTML = `<div class="section-title">What Is Driving The Score?</div>
            <div class="metric-grid">
                <div class="metric"><span class="metric-label">Strongest Factors</span><span class="metric-value">${strengths.map(label).join(" · ")}</span></div>
                <div class="metric"><span class="metric-label">Main Weaknesses</span><span class="metric-value">${risks.map(label).join(" · ")}</span></div>
            </div>
            <p class="investment-thesis" style="margin-top:14px;">${currentView === "Long Term"
                ? "Long-term mode emphasizes business quality, valuation and durable growth. Sector-aware weights adjust the importance of each factor."
                : "Short-term mode emphasizes momentum, price action and market trend while still checking valuation and fundamentals."} ${d ? d.reason : ""}</p>`;
        return section;
    }

    function injectInsights(stock) {
        const detail = document.getElementById("detailView");
        if (!detail || detail.style.display === "none" || !stock) return;
        if (detail.querySelector(".radar-score-breakdown")) return;
        const report = typeof getDataQualityReport === "function" ? getDataQualityReport(stock) : null;
        const confidence = report?.confidence?.score ?? report?.completeness ?? null;
        const confidenceLabel = report?.confidence?.label || "Unknown";
        const breakdown = getBreakdown(stock);
        const section = document.createElement("section"); section.className = "detail-section radar-score-breakdown";
        section.innerHTML = `<div class="section-title">Radar Score Breakdown</div>${breakdown.map(item => bar(item[0], item[1], item[2])).join("")}<p class="investment-thesis" style="margin-top:6px;">${currentView === "Long Term" ? "Weights adapt modestly to the business model/sector." : "Weights follow the agreed short-term model."} Missing metrics reduce confidence rather than automatically becoming zero.</p>`;
        const firstSection = detail.querySelector(".detail-section"); if (firstSection) firstSection.after(section); else detail.appendChild(section);
        const snapshot = decisionSnapshot(stock); if (snapshot) section.after(snapshot);\n        const explanation = scoreExplanation(stock); if (explanation) (snapshot || section).after(explanation);\n        const qp = qualityPriceSection(stock); if (qp) (explanation || snapshot || section).after(qp);
        const decisionSection = detail.querySelector(".detail-section");
        if (decisionSection && confidence !== null) {
            const confidenceMetric = Array.from(decisionSection.querySelectorAll(".metric")).find(metric => { const label=metric.querySelector(".metric-label"); return label && label.textContent.trim().toLowerCase()==="data confidence"; });
            if (confidenceMetric) { const value=confidenceMetric.querySelector(".metric-value"); if(value)value.textContent=`${Math.round(confidence)}% · ${confidenceLabel}`; }
        }
    }

    const originalOpen = window.openInvestmentByTicker;
    if (typeof originalOpen === "function") {
        window.openInvestmentByTicker = function (ticker) {
            originalOpen(ticker);
            const stock = (marketData[currentMarket]?.stocks || []).find(item => item.ticker === ticker);
            setTimeout(() => injectInsights(stock), 0);
        };
    }

    function loadScript(src, done) {
        const s=document.createElement("script"); s.src=src; s.onload=done; s.onerror=()=>console.warn(`${src} could not be loaded.`); document.head.appendChild(s);
    }
    loadScript("engine/technicalAnalysis.js", function () {
        loadScript("engine/priceTarget.js", function () {
            loadScript("engine/technicalInsights.js", function () {
                if (typeof window.refreshRadarTechnicalDetail === "function" && typeof window.getSelectedInvestment === "function") window.refreshRadarTechnicalDetail(window.getSelectedInvestment());
            });
        });
    });

})();
