/* INVESTMENT RADAR - Score explanation and confidence layer */
/* Frontend-only layer: no market-data workflow required. */

// Load valuation v2 synchronously before the application starts.
document.write('<script src="engine/valuationV2.js"></script>');

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

    function longTermBreakdown(stock) {
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

    function shortTermBreakdown(stock) {
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

        function lower(value, levels) {
            if (value === null || value <= 0) return null;
            for (const level of levels) if (value <= level.max) return level.score;
            return 0;
        }
        function avg(items) {
            const valid = items.filter(x => x !== null);
            return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
        }

        const valuation = avg([
            lower(fpe, [{max:15,score:100},{max:20,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:25}]),
            lower(pe, [{max:15,score:100},{max:20,score:85},{max:25,score:70},{max:35,score:50},{max:50,score:25}])
        ]);
        const trend = sma50 !== null && sma200 !== null ? (sma50 > sma200 ? 100 : 35) : null;
        const fundamental = avg([
            rg === null ? null : rg >= 20 ? 100 : rg >= 10 ? 85 : rg >= 5 ? 70 : rg >= 0 ? 50 : 0,
            eg === null ? null : eg >= 20 ? 100 : eg >= 10 ? 85 : eg >= 5 ? 70 : eg >= 0 ? 50 : 0
        ]);

        return [
            ["Momentum", momentum, 30],
            ["Price Action", priceAction, 20],
            ["Valuation", valuation, 15],
            ["Market Trend", trend, 15],
            ["Fundamentals", fundamental, 10],
            ["Psychology", investmentPsychologyScore(stock), 10]
        ];
    }

    // Correct schema aliases used by the live data so confidence does not
    // penalize fields that are present under their canonical names.
    const originalDataQuality = window.getDataQualityReport;
    if (typeof originalDataQuality === "function") {
        window.getDataQualityReport = function (investment) {
            const original = originalDataQuality(investment) || {};
            const fields = [
                ["fundamentals.revenueGrowth5Y", investment?.fundamentals?.revenueGrowth5Y],
                ["fundamentals.epsGrowth5Y", investment?.fundamentals?.epsGrowth5Y],
                ["fundamentals.profitMargin", investment?.fundamentals?.profitMargin],
                ["fundamentals.roe", investment?.fundamentals?.roe],
                ["fundamentals.roic", investment?.fundamentals?.roic],
                ["fundamentals.freeCashFlow", investment?.fundamentals?.freeCashFlow],
                ["fundamentals.debtToEquity", investment?.fundamentals?.debtToEquity],
                ["valuation.pe", investment?.valuation?.pe],
                ["valuation.forwardPE", investment?.valuation?.forwardPE],
                ["valuation.peg", investment?.valuation?.peg],
                ["valuation.evToEbitda", investment?.valuation?.evToEbitda],
                ["valuation.priceToFcf", investment?.valuation?.priceToFcf],
                ["valuation.priceToBook", investment?.valuation?.priceToBook],
                ["fundamentals.revenueGrowth3Y", investment?.fundamentals?.revenueGrowth3Y],
                ["fundamentals.fcfGrowth5Y", investment?.fundamentals?.fcfGrowth5Y],
                ["technical.momentum3M", investment?.technical?.momentum3M],
                ["technical.momentum6M", investment?.technical?.momentum6M],
                ["technical.sma50", investment?.technical?.sma50],
                ["technical.sma200", investment?.technical?.sma200],
                ["technical.high52Week", investment?.technical?.high52Week],
                ["technical.low52Week", investment?.technical?.low52Week],
                ["ownership.insiderHolding", investment?.ownership?.insiderHolding],
                ["ownership.promoterHolding", investment?.ownership?.promoterHolding],
                ["ownership.promoterChange", investment?.ownership?.promoterChange],
                ["ownership.promoterPledge", investment?.ownership?.promoterPledge],
                ["ownership.institutionalHolding", investment?.ownership?.institutionalHolding],
                ["ownership.institutionalChange", investment?.ownership?.institutionalChange],
                ["ownership.recentBigInvestors", investment?.ownership?.recentBigInvestors],
                ["dividend.yield", investment?.dividend?.yield],
                ["dividend.growth", investment?.dividend?.growth],
                ["dividend.payout", investment?.dividend?.payout]
            ];

            const available = fields.filter(([, value]) => {
                if (value === null || value === undefined || value === "") return false;
                if (typeof value === "number") return Number.isFinite(value);
                return true;
            }).length;
            const completeness = Math.round((available / fields.length) * 100);
            const confidence = completeness >= 90 ? { score: completeness, label: "Very High", className: "green" }
                : completeness >= 75 ? { score: completeness, label: "High", className: "green" }
                : completeness >= 55 ? { score: completeness, label: "Moderate", className: "yellow" }
                : completeness >= 35 ? { score: completeness, label: "Low", className: "yellow" }
                : { score: completeness, label: "Very Low", className: "red" };

            return { ...original, completeness, confidence, usable: completeness >= 40 };
        };
    }

    function injectInsights(stock) {
        const detail = document.getElementById("detailView");
        if (!detail || detail.style.display === "none") return;
        if (detail.querySelector(".radar-score-breakdown")) return;

        const report = typeof getDataQualityReport === "function" ? getDataQualityReport(stock) : null;
        const confidence = report?.confidence?.score ?? report?.completeness ?? null;
        const confidenceLabel = report?.confidence?.label || "Unknown";
        const breakdown = currentView === "Long Term" ? longTermBreakdown(stock) : shortTermBreakdown(stock);

        const section = document.createElement("section");
        section.className = "detail-section radar-score-breakdown";
        section.innerHTML = `
            <div class="section-title">Radar Score Breakdown</div>
            ${breakdown.map(item => bar(item[0], item[1], item[2])).join("")}
            <p class="investment-thesis" style="margin-top:6px;">
                Weights are the agreed ${currentView} model. Missing metrics are excluded rather than automatically treated as zero.
            </p>
        `;

        const firstSection = detail.querySelector(".detail-section");
        if (firstSection) firstSection.after(section);
        else detail.appendChild(section);

        const decisionSection = detail.querySelector(".detail-section");
        if (decisionSection && confidence !== null) {
            const confidenceMetric = Array.from(decisionSection.querySelectorAll(".metric")).find(metric => {
                const label = metric.querySelector(".metric-label");
                return label && label.textContent.trim().toLowerCase() === "data confidence";
            });
            if (confidenceMetric) {
                const value = confidenceMetric.querySelector(".metric-value");
                if (value) value.textContent = `${Math.round(confidence)}% · ${confidenceLabel}`;
            }
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
})();
