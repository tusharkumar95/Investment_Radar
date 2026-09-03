/*
 * INVESTMENT RADAR — SCORING ENGINE
 *
 * This file converts raw investment data into:
 * - Quality Score
 * - Growth Score
 * - Valuation Score
 * - Momentum Score
 * - Ownership Score
 * - Psychology Score
 * - Income Score
 * - Long-Term Score
 * - Short-Term Score
 *
 * Scores are 0–100.
 */

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}


/* ================================
   QUALITY
================================ */

function qualityScore(stock) {

    const q = stock.quality || {};

    const revenueGrowth = scoreGrowth(q.revenueGrowth);
    const epsGrowth = scoreGrowth(q.epsGrowth);
    const roe = scoreROE(q.roe);
    const roic = scoreROIC(q.roic);
    const cashFlow = scoreCashFlow(q.freeCashFlow);
    const balanceSheet = clamp(q.balanceSheet || 0);

    return Math.round(
        revenueGrowth * 0.15 +
        epsGrowth * 0.20 +
        roe * 0.20 +
        roic * 0.20 +
        cashFlow * 0.10 +
        balanceSheet * 0.15
    );
}


/* ================================
   GROWTH
================================ */

function growthScore(stock) {

    const g = stock.growth;

    if (g === null || g === undefined) {
        return 0;
    }

    /*
     * Rough framework:
     *
     * <0%     = poor
     * 0–5%    = weak
     * 5–10%   = acceptable
     * 10–15%  = good
     * 15–20%  = excellent
     * >20%    = exceptional
     */

    if (g < 0) return 20;
    if (g < 5) return 40;
    if (g < 10) return 60;
    if (g < 15) return 75;
    if (g < 20) return 90;

    return 100;
}


/* ================================
   VALUATION
================================ */

function valuationScore(stock) {

    const v = stock.valuation || {};

    const pe = scorePE(v.pe);
    const peg = scorePEG(v.peg);
    const evEbitda = scoreEVEBITDA(v.evEbitda);
    const priceToFCF = scorePriceToFCF(v.priceToFcf);
    const historical = clamp(v.historicalValuation || 0);

    return Math.round(
        pe * 0.20 +
        peg * 0.20 +
        evEbitda * 0.15 +
        priceToFCF * 0.20 +
        historical * 0.25
    );
}


/* ================================
   MOMENTUM
================================ */

function momentumScore(stock) {

    return clamp(stock.momentum || 0);
}


/* ================================
   OWNERSHIP
================================ */

function ownershipScore(stock) {

    const o = stock.ownership || {};

    const promoter = scorePromoter(o.promoterHolding);
    const promoterChange = scorePromoterChange(o.promoterChange);
    const pledge = scorePledge(o.promoterPledge);
    const institutional = scoreInstitutional(o.institutionalChange);
    const investors = scoreInvestorActivity(o.majorInvestorActivity);

    return Math.round(
        promoter * 0.30 +
        promoterChange * 0.15 +
        pledge * 0.25 +
        institutional * 0.15 +
        investors * 0.15
    );
}


/* ================================
   PSYCHOLOGY
================================ */

function psychologyScore(stock) {

    const p = stock.psychology || {};

    const marginOfSafety =
        clamp(p.marginOfSafety || 0);

    const sentiment =
        clamp(p.sentiment || 0);

    const cycle =
        clamp(p.cycle || 0);

    const qualityAtPrice =
        clamp(p.qualityAtPrice || 0);

    return Math.round(
        marginOfSafety * 0.35 +
        sentiment * 0.20 +
        cycle * 0.20 +
        qualityAtPrice * 0.25
    );
}


/* ================================
   INCOME
================================ */

function incomeScore(stock) {

    const d = stock.dividend || {};

    const yieldScore = scoreDividendYield(d.yield);
    const growthScoreValue = scoreDividendGrowth(d.growth);
    const payoutScore = scorePayout(d.payout);

    return Math.round(
        yieldScore * 0.35 +
        growthScoreValue * 0.35 +
        payoutScore * 0.30
    );
}


/* ================================
   LONG TERM
================================ */

function longTermScore(stock) {

    const quality = qualityScore(stock);
    const valuation = valuationScore(stock);
    const growth = growthScore(stock);
    const psychology = psychologyScore(stock);
    const ownership = ownershipScore(stock);
    const income = incomeScore(stock);

    /*
     * Personal long-term philosophy:
     *
     * Quality       30%
     * Valuation     25%
     * Growth        15%
     * Psychology    10%
     * Ownership     10%
     * Income         5%
     * Momentum       5%
     */

    return Math.round(
        quality * 0.30 +
        valuation * 0.25 +
        growth * 0.15 +
        psychology * 0.10 +
        ownership * 0.10 +
        income * 0.05 +
        momentumScore(stock) * 0.05
    );
}


/* ================================
   SHORT TERM
================================ */

function shortTermScore(stock) {

    const momentum = momentumScore(stock);
    const valuation = valuationScore(stock);
    const psychology = psychologyScore(stock);
    const quality = qualityScore(stock);
    const growth = growthScore(stock);

    /*
     * Short-term philosophy:
     *
     * Momentum       30%
     * Valuation      20%
     * Psychology     20%
     * Quality        15%
     * Growth         10%
     * Ownership       5%
     */

    return Math.round(
        momentum * 0.30 +
        valuation * 0.20 +
        psychology * 0.20 +
        quality * 0.15 +
        growth * 0.10 +
        ownershipScore(stock) * 0.05
    );
}


/* ================================
   VERDICT
================================ */

function getVerdict(score) {

    if (score >= 90) {
        return "Strong Opportunity";
    }

    if (score >= 80) {
        return "Accumulate";
    }

    if (score >= 70) {
        return "Candidate";
    }

    if (score >= 60) {
        return "Watch";
    }

    if (score >= 45) {
        return "Wait";
    }

    return "Avoid";
}


/* ================================
   PRICE ZONES
================================ */

function getPriceVerdict(currentPrice, valuationRange) {

    if (!valuationRange || currentPrice === null) {
        return "Insufficient data";
    }

    if (currentPrice <= valuationRange.strongBuyBelow) {
        return "Strong Opportunity";
    }

    if (
        currentPrice >= valuationRange.buyLow &&
        currentPrice <= valuationRange.buyHigh
    ) {
        return "Attractive";
    }

    if (
        currentPrice >= valuationRange.fairLow &&
        currentPrice <= valuationRange.fairHigh
    ) {
        return "Fair Value";
    }

    return "Expensive";
}


/* ================================
   HELPER FUNCTIONS
================================ */

function scoreGrowth(value) {

    if (value === null || value === undefined) return 0;

    if (value < 0) return 20;
    if (value < 5) return 40;
    if (value < 10) return 60;
    if (value < 15) return 75;
    if (value < 20) return 90;

    return 100;
}


function scoreROE(value) {

    if (!value) return 0;

    if (value < 5) return 25;
    if (value < 10) return 45;
    if (value < 15) return 65;
    if (value < 20) return 80;
    if (value < 30) return 92;

    return 100;
}


function scoreROIC(value) {

    if (!value) return 0;

    if (value < 5) return 25;
    if (value < 10) return 50;
    if (value < 15) return 70;
    if (value < 20) return 85;
    if (value < 30) return 95;

    return 100;
}


function scoreCashFlow(value) {

    if (!value) return 0;

    return value > 0 ? 100 : 20;
}


function scorePE(value) {

    if (!value) return 0;

    if (value < 10) return 100;
    if (value < 15) return 90;
    if (value < 20) return 80;
    if (value < 25) return 65;
    if (value < 35) return 45;

    return 20;
}


function scorePEG(value) {

    if (!value) return 0;

    if (value < 0.8) return 100;
    if (value < 1.0) return 90;
    if (value < 1.5) return 75;
    if (value < 2.0) return 55;
    if (value < 3.0) return 35;

    return 20;
}


function scoreEVEBITDA(value) {

    if (!value) return 0;

    if (value < 8) return 100;
    if (value < 12) return 85;
    if (value < 16) return 70;
    if (value < 22) return 50;
    if (value < 30) return 30;

    return 15;
}


function scorePriceToFCF(value) {

    if (!value) return 0;

    if (value < 10) return 100;
    if (value < 15) return 85;
    if (value < 20) return 70;
    if (value < 30) return 50;
    if (value < 40) return 30;

    return 15;
}


function scorePromoter(value) {

    if (value === null || value === undefined) return 0;

    if (value < 10) return 30;
    if (value < 25) return 50;
    if (value < 40) return 70;
    if (value < 55) return 85;

    return 100;
}


function scorePromoterChange(value) {

    if (value === null || value === undefined) return 50;

    if (value > 2) return 100;
    if (value > 0.5) return 90;
    if (value > -0.5) return 70;
    if (value > -2) return 40;

    return 15;
}


function scorePledge(value) {

    if (value === null || value === undefined) return 50;

    if (value === 0) return 100;
    if (value < 5) return 90;
    if (value < 10) return 70;
    if (value < 25) return 40;

    return 10;
}


function scoreInstitutional(value) {

    if (value === null || value === undefined) return 50;

    if (value > 2) return 100;
    if (value > 0.5) return 85;
    if (value > -0.5) return 70;
    if (value > -2) return 45;

    return 20;
}


function scoreInvestorActivity(value) {

    if (!value) return 50;

    return clamp(value);
}


function scoreDividendYield(value) {

    if (!value) return 30;

    if (value >= 5) return 100;
    if (value >= 3) return 85;
    if (value >= 2) return 70;
    if (value >= 1) return 55;

    return 35;
}


function scoreDividendGrowth(value) {

    if (!value) return 30;

    if (value >= 10) return 100;
    if (value >= 7) return 85;
    if (value >= 5) return 70;
    if (value >= 2) return 55;

    return 35;
}


function scorePayout(value) {

    if (!value) return 50;

    if (value >= 20 && value <= 60) return 100;
    if (value < 20) return 75;
    if (value <= 75) return 70;
    if (value <= 100) return 40;

    return 15;
}
