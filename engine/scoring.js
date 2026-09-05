/*
 * INVESTMENT RADAR
 * Scoring Engine
 */

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}


/* =========================================
   LONG TERM SCORE
========================================= */

function longTermScore(investment) {

    const f = investment.fundamentals || {};
    const v = investment.valuation || {};
    const o = investment.ownership || {};

    let score = 0;


    // Growth — 25 points
    if (f.revenueGrowth5Y > 15) score += 10;
    else if (f.revenueGrowth5Y > 8) score += 7;
    else if (f.revenueGrowth5Y > 3) score += 4;

    if (f.epsGrowth5Y > 15) score += 10;
    else if (f.epsGrowth5Y > 8) score += 7;
    else if (f.epsGrowth5Y > 3) score += 4;

    if (f.fcfGrowth5Y > 10) score += 5;
    else if (f.fcfGrowth5Y > 5) score += 3;


    // Business quality — 25 points
    if (f.roe > 20) score += 7;
    else if (f.roe > 12) score += 5;
    else if (f.roe > 8) score += 3;

    if (f.roic > 15) score += 8;
    else if (f.roic > 10) score += 5;
    else if (f.roic > 7) score += 3;

    if (f.debtToEquity < 0.5) score += 5;
    else if (f.debtToEquity < 1) score += 3;

    if (f.profitMargin > 20) score += 5;
    else if (f.profitMargin > 10) score += 3;


    // Valuation — 25 points
    if (v.pe > 0 && v.pe < 20) score += 8;
    else if (v.pe > 0 && v.pe < 30) score += 5;

    if (v.peg > 0 && v.peg < 1.5) score += 8;
    else if (v.peg > 0 && v.peg < 2) score += 5;

    if (v.priceToSales > 0 && v.priceToSales < 5) {
        score += 4;
    }

    if (v.priceToBook > 0 && v.priceToBook < 4) {
        score += 5;
    }


    // Ownership / alignment — 15 points
    if (o.insiderHolding > 10) score += 8;
    else if (o.insiderHolding > 5) score += 5;

    if (o.institutionalHolding > 30) score += 7;
    else if (o.institutionalHolding > 15) score += 4;


    return clamp(Math.round(score));
}


/* =========================================
   SHORT TERM SCORE
========================================= */

function shortTermScore(investment) {

    const t = investment.technical || {};
    const v = investment.valuation || {};

    let score = 0;


    if (t.momentum3M > 10) score += 20;
    else if (t.momentum3M > 5) score += 14;
    else if (t.momentum3M > 0) score += 8;


    if (t.momentum6M > 15) score += 20;
    else if (t.momentum6M > 5) score += 14;
    else if (t.momentum6M > 0) score += 8;


    if (
        t.price > 0 &&
        t.sma50 > 0 &&
        t.price > t.sma50
    ) {
        score += 15;
    }


    if (
        t.price > 0 &&
        t.sma200 > 0 &&
        t.price > t.sma200
    ) {
        score += 15;
    }


    if (v.pe > 0 && v.pe < 30) {
        score += 15;
    }


    if (v.peg > 0 && v.peg < 2) {
        score += 15;
    }


    return clamp(Math.round(score));
}


/* =========================================
   VERDICT
========================================= */

function getVerdict(score) {

    if (score >= 85) {
        return "Strong Buy";
    }

    if (score >= 70) {
        return "Buy";
    }

    if (score >= 55) {
        return "Watch";
    }

    return "Avoid";
}
