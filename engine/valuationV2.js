/* INVESTMENT RADAR - Valuation Engine v2 */
/* Uses multiple valuation methods and exposes the methods used. */

(function () {
    function n(value) {
        const x = Number(value);
        return Number.isFinite(x) ? x : null;
    }

    function round(value) {
        return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
    }

    function targetPE(growth) {
        if (growth === null) return 18;
        if (growth >= 25) return 28;
        if (growth >= 20) return 26;
        if (growth >= 15) return 24;
        if (growth >= 10) return 21;
        if (growth >= 5) return 18;
        return 15;
    }

    function targetPFCF(growth) {
        if (growth === null) return 18;
        if (growth >= 20) return 28;
        if (growth >= 15) return 25;
        if (growth >= 10) return 22;
        if (growth >= 5) return 18;
        return 15;
    }

    function targetEVEBITDA(growth) {
        if (growth === null) return 12;
        if (growth >= 20) return 18;
        if (growth >= 15) return 16;
        if (growth >= 10) return 14;
        if (growth >= 5) return 12;
        return 10;
    }

    function targetPB(roe) {
        if (roe === null) return 2.0;
        if (roe >= 25) return 4.0;
        if (roe >= 20) return 3.5;
        if (roe >= 15) return 3.0;
        if (roe >= 10) return 2.25;
        return 1.5;
    }

    function calculateValuationV2(stock) {
        const price = n(stock.price);
        const f = stock.fundamentals || {};
        const v = stock.valuation || {};
        const growth = n(f.epsGrowth5Y) ?? n(f.revenueGrowth5Y);
        const roe = n(f.roe);
        const pe = n(v.pe);
        const forwardPE = n(v.forwardPE);
        const pfcf = n(v.priceToFcf);
        const pb = n(v.priceToBook);
        const ev = n(v.enterpriseValue);
        const marketCap = n(v.marketCap);
        const ebitda = n(f.ebitda);
        const pSales = n(v.priceToSales);

        if (price === null || price <= 0) {
            return { fairValue: 0, fairValueLow: 0, fairValueHigh: 0, buyPrice: 0, strongBuyPrice: 0, marginOfSafety: 0, valuationStatus: "Insufficient data", confidence: "Low", methodsUsed: [] };
        }

        const estimates = [];
        const methodsUsed = [];

        if (pe !== null && pe > 0) {
            estimates.push({ value: price * targetPE(growth) / pe, weight: 30 });
            methodsUsed.push("P/E normalization");
        }
        if (forwardPE !== null && forwardPE > 0) {
            estimates.push({ value: price * targetPE(growth) / forwardPE, weight: 25 });
            methodsUsed.push("Forward P/E");
        }
        if (pfcf !== null && pfcf > 0) {
            estimates.push({ value: price * targetPFCF(growth) / pfcf, weight: 20 });
            methodsUsed.push("Price / FCF");
        }
        if (ev !== null && marketCap !== null && ebitda !== null && ebitda > 0) {
            const netDebt = ev - marketCap;
            const targetEV = ebitda * targetEVEBITDA(growth);
            const targetMarketCap = targetEV - netDebt;
            if (targetMarketCap > 0 && marketCap > 0) {
                estimates.push({ value: price * targetMarketCap / marketCap, weight: 15 });
                methodsUsed.push("EV / EBITDA");
            }
        }
        if (pb !== null && pb > 0 && marketCap !== null && marketCap > 0) {
            const targetMarketCap = marketCap * targetPB(roe);
            estimates.push({ value: price * targetMarketCap / marketCap, weight: 10 });
            methodsUsed.push("Price / Book");
        }
        if (!estimates.length && pSales !== null && pSales > 0) {
            const targetPS = growth !== null && growth >= 15 ? 3 : 2;
            estimates.push({ value: price * targetPS / pSales, weight: 100 });
            methodsUsed.push("Price / Sales fallback");
        }

        if (!estimates.length) {
            return { fairValue: 0, fairValueLow: 0, fairValueHigh: 0, buyPrice: 0, strongBuyPrice: 0, marginOfSafety: 0, valuationStatus: "Insufficient valuation data", confidence: "Low", methodsUsed: [] };
        }

        const totalWeight = estimates.reduce((sum, item) => sum + item.weight, 0);
        let fairValue = estimates.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
        fairValue = Math.max(price * 0.60, Math.min(price * 1.80, fairValue));

        if (roe !== null) {
            if (roe >= 25) fairValue *= 1.04;
            else if (roe < 8) fairValue *= 0.96;
        }
        fairValue = Math.max(price * 0.60, Math.min(price * 1.80, fairValue));

        const fairValueLow = fairValue * 0.90;
        const fairValueHigh = fairValue * 1.10;
        const buyPrice = fairValue * 0.85;
        const strongBuyPrice = fairValue * 0.70;
        const marginOfSafety = ((fairValue - price) / fairValue) * 100;

        let valuationStatus = "Fairly valued";
        if (price <= strongBuyPrice) valuationStatus = "Exceptional opportunity";
        else if (price <= buyPrice) valuationStatus = "Attractive";
        else if (price <= fairValueHigh) valuationStatus = "Fairly valued";
        else if (price <= fairValueHigh * 1.20) valuationStatus = "Expensive";
        else valuationStatus = "Very expensive";

        const confidence = methodsUsed.length >= 4 ? "High" : methodsUsed.length >= 2 ? "Moderate" : "Low";

        return { fairValue: round(fairValue), fairValueLow: round(fairValueLow), fairValueHigh: round(fairValueHigh), buyPrice: round(buyPrice), strongBuyPrice: round(strongBuyPrice), marginOfSafety: round(marginOfSafety), valuationStatus, confidence, methodsUsed };
    }

    window.calculateValuation = calculateValuationV2;
})();
