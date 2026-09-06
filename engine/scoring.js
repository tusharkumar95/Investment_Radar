/*
 * INVESTMENT RADAR
 * Investment Scoring Engine
 *
 * Score: 0 - 100
 */

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}


/* =================================
   LONG TERM SCORE
================================= */

function longTermScore(stock) {

    const f = stock.fundamentals || {};
    const v = stock.valuation || {};
    const o = stock.ownership || {};

    let score = 0;
    let available = 0;


    // Revenue growth — 15 points
    const revenueGrowth = number(f.revenueGrowth5Y);

    if (revenueGrowth !== null) {
        available++;
        score += clamp(revenueGrowth / 30 * 15);
    }


    // EPS growth — 15 points
    const epsGrowth = number(f.epsGrowth5Y);

    if (epsGrowth !== null) {
        available++;
        score += clamp(epsGrowth / 30 * 15);
    }


    // Profitability — 10 points
    const margin = number(f.profitMargin);

    if (margin !== null) {
        available++;
        score += clamp(margin / 25 * 10);
    }


    // ROE — 10 points
    const roe = number(f.roe);

    if (roe !== null) {
        available++;
        score += clamp(roe / 25 * 10);
    }


    // Debt — 10 points
    const debt = number(f.debtToEquity);

    if (debt !== null) {
        available++;

        if (debt <= 0.25) {
            score += 10;
        } else if (debt <= 0.5) {
            score += 8;
        } else if (debt <= 1) {
            score += 6;
        } else if (debt <= 2) {
            score += 3;
        }
    }


    // Free cash flow — 10 points
    const fcf = number(f.freeCashFlow);

    if (fcf !== null) {
        available++;
        score += fcf > 0 ? 10 : 0;
    }


    // P/E valuation — 10 points
    const pe = number(v.pe);

    if (pe !== null && pe > 0) {
        available++;

        if (pe <= 15) score += 10;
        else if (pe <= 20) score += 8;
        else if (pe <= 25) score += 6;
        else if (pe <= 35) score += 3;
    }


    // PEG — 5 points
    const peg = number(v.peg);

    if (peg !== null && peg > 0) {
        available++;

        if (peg <= 1) score += 5;
        else if (peg <= 1.5) score += 4;
        else if (peg <= 2) score += 2;
    }


    // Insider ownership — 5 points
    const insider = number(o.insiderHolding);

    if (insider !== null) {
        available++;

        if (insider >= 10) score += 5;
        else if (insider >= 5) score += 4;
        else if (insider >= 2) score += 2;
    }


    /*
     * Do not punish a company heavily
     * simply because a particular data
     * field is unavailable.
     */

    if (available === 0) {
        return 0;
    }

    return Math.round(clamp(score));
}


/* =================================
   SHORT TERM SCORE
================================= */

function shortTermScore(stock) {

    const t = stock.technical || {};
    const v = stock.valuation || {};

    let score = 0;


    // 3-month momentum — 25 points
    const momentum3M = number(t.momentum3M);

    if (momentum3M !== null) {

        if (momentum3M >= 20) score += 25;
        else if (momentum3M >= 10) score += 20;
        else if (momentum3M >= 5) score += 15;
        else if (momentum3M >= 0) score += 10;
    }


    // 6-month momentum — 20 points
    const momentum6M = number(t.momentum6M);

    if (momentum6M !== null) {

        if (momentum6M >= 30) score += 20;
        else if (momentum6M >= 15) score += 16;
        else if (momentum6M >= 5) score += 12;
        else if (momentum6M >= 0) score += 7;
    }


    // Price vs 50-day SMA — 20 points
    const price = number(stock.price);
    const sma50 = number(t.sma50);

    if (price !== null && sma50 !== null && sma50 > 0) {

        const distance = ((price / sma50) - 1) * 100;

        if (distance >= 0 && distance <= 10) score += 20;
        else if (distance > 10 && distance <= 20) score += 15;
        else if (distance >= -5) score += 12;
        else score += 5;
    }


    // 50-day vs 200-day trend — 20 points
    const sma200 = number(t.sma200);

    if (sma50 !== null && sma200 !== null && sma200 > 0) {

        if (sma50 > sma200) score += 20;
        else score += 5;
    }


    // Valuation sanity check — 15 points
    const forwardPE = number(v.forwardPE);

    if (forwardPE !== null && forwardPE > 0) {

        if (forwardPE <= 20) score += 15;
        else if (forwardPE <= 30) score += 12;
        else if (forwardPE <= 40) score += 7;
        else score += 2;
    }


    return Math.round(clamp(score));
}


/* =================================
   VERDICT
================================= */

function getVerdict(score) {

    if (score >= 85) {
        return "Strong Buy";
    }

    if (score >= 75) {
        return "Buy";
    }

    if (score >= 60) {
        return "Watch";
    }

    if (score >= 40) {
        return "Weak";
    }

    return "Avoid";
}
