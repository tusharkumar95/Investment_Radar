/*
 * INVESTMENT RADAR
 * INVESTMENT PSYCHOLOGY ENGINE
 *
 * Inspired by measurable principles associated with:
 * Benjamin Graham
 * Warren Buffett
 * Howard Marks
 * Peter Lynch
 * Charlie Munger
 * Philip Fisher
 *
 * These are translated into rules.
 */


/* =========================================
   HELPERS
========================================= */

function psychologyNumber(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


function psychologyClamp(value, min = 0, max = 100) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


/* =========================================
   MAIN ANALYSIS
========================================= */

function psychologyAnalysis(stock) {

    const price =
        psychologyNumber(stock.price) || 0;

    const f = stock.fundamentals || {};
    const v = stock.valuation || {};
    const t = stock.technical || {};
    const o = stock.ownership || {};

    const revenueGrowth =
        psychologyNumber(f.revenueGrowth5Y);

    const epsGrowth =
        psychologyNumber(f.epsGrowth5Y);

    const roe =
        psychologyNumber(f.roe);

    const roic =
        psychologyNumber(f.roic);

    const margin =
        psychologyNumber(f.profitMargin);

    const debt =
        psychologyNumber(f.debtToEquity);

    const fcf =
        psychologyNumber(f.freeCashFlow);

    const pe =
        psychologyNumber(v.pe);

    const forwardPE =
        psychologyNumber(v.forwardPE);

    const peg =
        psychologyNumber(v.peg);

    const fairValue =
        psychologyNumber(stock.analysis?.fairValue) || 0;

    const momentum3M =
        psychologyNumber(t.momentum3M);

    const momentum6M =
        psychologyNumber(t.momentum6M);

    let quality = 0;
    let valuation = 0;
    let risk = 0;
    let ownership = 0;
    let discipline = 0;


    /* =========================================
       1. BUSINESS QUALITY
    ========================================= */

    let qualityPoints = 0;
    let qualityAvailable = 0;

    if (revenueGrowth !== null) {

        qualityAvailable++;

        if (revenueGrowth >= 20) qualityPoints += 20;
        else if (revenueGrowth >= 10) qualityPoints += 16;
        else if (revenueGrowth >= 5) qualityPoints += 12;
        else if (revenueGrowth > 0) qualityPoints += 7;
    }

    if (epsGrowth !== null) {

        qualityAvailable++;

        if (epsGrowth >= 20) qualityPoints += 20;
        else if (epsGrowth >= 10) qualityPoints += 16;
        else if (epsGrowth >= 5) qualityPoints += 12;
        else if (epsGrowth > 0) qualityPoints += 7;
    }

    if (roe !== null) {

        qualityAvailable++;

        if (roe >= 20) qualityPoints += 20;
        else if (roe >= 15) qualityPoints += 16;
        else if (roe >= 10) qualityPoints += 12;
        else if (roe > 0) qualityPoints += 7;
    }

    if (roic !== null) {

        qualityAvailable++;

        if (roic >= 20) qualityPoints += 20;
        else if (roic >= 15) qualityPoints += 16;
        else if (roic >= 10) qualityPoints += 12;
        else if (roic > 0) qualityPoints += 7;
    }

    if (margin !== null) {

        qualityAvailable++;

        if (margin >= 25) qualityPoints += 20;
        else if (margin >= 15) qualityPoints += 16;
        else if (margin >= 10) qualityPoints += 12;
        else if (margin > 0) qualityPoints += 7;
    }

    if (qualityAvailable > 0) {

        quality =
            (qualityPoints / (qualityAvailable * 20)) * 100;
    }


    /* =========================================
       2. BALANCE SHEET / RISK
    ========================================= */

    if (debt !== null) {

        if (debt <= 0.25) {
            risk += 5;
        } else if (debt <= 0.5) {
            risk += 12;
        } else if (debt <= 1) {
            risk += 25;
        } else if (debt <= 2) {
            risk += 50;
        } else {
            risk += 80;
        }

    } else {

        risk += 45;
    }


    if (fcf !== null) {

        if (fcf > 0) {
            risk -= 15;
        } else {
            risk += 20;
        }
    }


    risk = psychologyClamp(risk);


    /* =========================================
       3. VALUATION DISCIPLINE
    ========================================= */

    let valuationPoints = 0;
    let valuationAvailable = 0;

    if (pe !== null && pe > 0) {

        valuationAvailable++;

        if (pe <= 15) valuationPoints += 25;
        else if (pe <= 20) valuationPoints += 21;
        else if (pe <= 25) valuationPoints += 17;
        else if (pe <= 35) valuationPoints += 11;
        else if (pe <= 50) valuationPoints += 5;
    }

    if (forwardPE !== null && forwardPE > 0) {

        valuationAvailable++;

        if (forwardPE <= 15) valuationPoints += 25;
        else if (forwardPE <= 20) valuationPoints += 21;
        else if (forwardPE <= 25) valuationPoints += 17;
        else if (forwardPE <= 35) valuationPoints += 11;
        else if (forwardPE <= 50) valuationPoints += 5;
    }

    if (peg !== null && peg > 0) {

        valuationAvailable++;

        if (peg <= 1) valuationPoints += 25;
        else if (peg <= 1.5) valuationPoints += 21;
        else if (peg <= 2) valuationPoints += 15;
        else if (peg <= 3) valuationPoints += 7;
    }

    if (fairValue > 0 && price > 0) {

        valuationAvailable++;

        const discount =
            ((fairValue - price) / fairValue) * 100;

        if (discount >= 30) valuationPoints += 25;
        else if (discount >= 20) valuationPoints += 21;
        else if (discount >= 10) valuationPoints += 17;
        else if (discount >= 0) valuationPoints += 11;
        else if (discount >= -15) valuationPoints += 5;
    }

    if (valuationAvailable > 0) {

        valuation =
            (valuationPoints / (valuationAvailable * 25)) * 100;
    }


    /* =========================================
       4. OWNERSHIP
    ========================================= */

    let ownershipPoints = 0;
    let ownershipAvailable = 0;

    const insider =
        psychologyNumber(o.insiderHolding);

    const promoter =
        psychologyNumber(o.promoterHolding);

    const promoterChange =
        psychologyNumber(o.promoterChange);

    const promoterPledge =
        psychologyNumber(o.promoterPledge);

    if (insider !== null) {

        ownershipAvailable++;

        if (insider >= 10) ownershipPoints += 25;
        else if (insider >= 5) ownershipPoints += 20;
        else if (insider >= 2) ownershipPoints += 15;
        else ownershipPoints += 8;
    }

    if (promoter !== null) {

        ownershipAvailable++;

        if (promoter >= 50) ownershipPoints += 25;
        else if (promoter >= 30) ownershipPoints += 20;
        else if (promoter >= 10) ownershipPoints += 15;
        else ownershipPoints += 8;
    }

    if (promoterChange !== null) {

        ownershipAvailable++;

        if (promoterChange > 1) ownershipPoints += 25;
        else if (promoterChange > 0) ownershipPoints += 20;
        else if (promoterChange >= -1) ownershipPoints += 15;
        else ownershipPoints += 5;
    }

    if (promoterPledge !== null) {

        ownershipAvailable++;

        if (promoterPledge === 0) ownershipPoints += 25;
        else if (promoterPledge <= 5) ownershipPoints += 20;
        else if (promoterPledge <= 15) ownershipPoints += 12;
        else ownershipPoints += 3;
    }

    if (ownershipAvailable > 0) {

        ownership =
            (ownershipPoints / (ownershipAvailable * 25)) * 100;
    }


    /* =========================================
       5. BEHAVIOURAL DISCIPLINE
    ========================================= */

    if (fairValue > 0 && price > 0) {

        const discount =
            ((fairValue - price) / fairValue) * 100;

        if (discount >= 30) discipline += 40;
        else if (discount >= 20) discipline += 32;
        else if (discount >= 10) discipline += 25;
        else if (discount >= 0) discipline += 18;
        else if (discount >= -15) discipline += 8;
    }

    if (momentum3M !== null && momentum6M !== null) {

        if (
            momentum3M > 0 &&
            momentum6M > 0
        ) {
            discipline += 30;

        } else if (
            momentum3M < 0 &&
            momentum6M < 0
        ) {
            discipline += 5;

        } else {
            discipline += 18;
        }

    } else {

        discipline += 15;
    }


    if (epsGrowth !== null) {

        if (epsGrowth > 15) discipline += 30;
        else if (epsGrowth > 5) discipline += 22;
        else if (epsGrowth > 0) discipline += 15;
        else discipline += 5;

    } else {

        discipline += 15;
    }

    discipline = psychologyClamp(discipline);


    /* =========================================
       FINAL PSYCHOLOGY SCORE
    ========================================= */

    const psychologyScore =
        Math.round(
            quality * 0.30 +
            valuation * 0.30 +
            (100 - risk) * 0.15 +
            ownership * 0.10 +
            discipline * 0.15
        );


    /* =========================================
       DECISION
    ========================================= */

    let decision = "WAIT";
    let reason =
        "The investment does not yet provide enough evidence of quality, valuation or margin of safety.";

    if (psychologyScore >= 85) {

        decision = "STRONG BUY";

        reason =
            "Strong business characteristics combined with attractive valuation and disciplined risk characteristics.";

    } else if (psychologyScore >= 75) {

        decision = "BUY";

        reason =
            "The business quality and valuation combination is attractive, although some uncertainty may remain.";

    } else if (psychologyScore >= 65) {

        decision = "ACCUMULATE";

        reason =
            "The investment has several attractive characteristics, but a better entry price or stronger evidence would improve the opportunity.";

    } else if (psychologyScore >= 50) {

        decision = "WATCH";

        reason =
            "The company may be interesting, but valuation, quality, ownership or risk factors require patience.";

    } else {

        decision = "WAIT";

        reason =
            "Current evidence does not provide a sufficiently attractive combination of quality, valuation and risk.";
    }


    return {

        score: psychologyScore,

        qualityScore:
            Math.round(quality),

        valuationScore:
            Math.round(valuation),

        riskScore:
            Math.round(risk),

        ownershipScore:
            Math.round(ownership),

        disciplineScore:
            Math.round(discipline),

        decision,

        reason
    };
}
