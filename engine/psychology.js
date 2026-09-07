/*
 * INVESTMENT RADAR
 * Investment Psychology Engine
 *
 * Inspired by principles associated with:
 * Benjamin Graham
 * Warren Buffett
 * Howard Marks
 * Peter Lynch
 * Charlie Munger
 *
 * These are translated into measurable rules,
 * not direct investment recommendations.
 */

function psychologyAnalysis(stock) {

    const price = Number(stock.price) || 0;

    const fairValue = Number(stock.analysis?.fairValue) || 0;

    const pe = Number(stock.valuation?.pe) || 0;
    const forwardPE = Number(stock.valuation?.forwardPE) || 0;
    const peg = Number(stock.valuation?.peg) || 0;

    const revenueGrowth =
        Number(stock.fundamentals?.revenueGrowth5Y) || 0;

    const roe =
        Number(stock.fundamentals?.roe) || 0;

    const debt =
        Number(stock.fundamentals?.debtToEquity) || 0;

    let quality = 0;
    let valuation = 0;
    let risk = 0;


    /* ==============================
       BUSINESS QUALITY
    ============================== */

    if (revenueGrowth >= 20) quality += 30;
    else if (revenueGrowth >= 10) quality += 20;
    else if (revenueGrowth > 0) quality += 10;

    if (roe >= 20) quality += 30;
    else if (roe >= 15) quality += 25;
    else if (roe >= 10) quality += 15;

    if (debt <= 0.5) quality += 25;
    else if (debt <= 1) quality += 15;
    else if (debt <= 2) quality += 5;

    if ((stock.fundamentals?.freeCashFlow || 0) > 0) {
        quality += 15;
    }

    quality = Math.min(100, quality);


    /* ==============================
       VALUATION
    ============================== */

    if (peg > 0) {

        if (peg <= 1) valuation += 40;
        else if (peg <= 1.5) valuation += 30;
        else if (peg <= 2) valuation += 20;
        else valuation += 5;

    } else if (forwardPE > 0) {

        if (forwardPE <= 15) valuation += 40;
        else if (forwardPE <= 25) valuation += 30;
        else if (forwardPE <= 35) valuation += 20;
        else valuation += 5;

    }

    if (pe > 0) {

        if (pe <= 20) valuation += 30;
        else if (pe <= 30) valuation += 20;
        else if (pe <= 40) valuation += 10;
        else valuation += 2;

    }

    if (fairValue > 0 && price > 0) {

        const discount =
            ((fairValue - price) / fairValue) * 100;

        if (discount >= 30) valuation += 30;
        else if (discount >= 20) valuation += 25;
        else if (discount >= 10) valuation += 15;
        else if (discount >= 0) valuation += 5;

    }

    valuation = Math.min(100, valuation);


    /* ==============================
       RISK
    ============================== */

    if (debt <= 0.5) risk += 10;
    else if (debt <= 1) risk += 6;
    else if (debt <= 2) risk += 3;

    if (pe > 50 || forwardPE > 50) {
        risk += 20;
    } else if (pe > 35 || forwardPE > 35) {
        risk += 10;
    }

    if (peg > 2) {
        risk += 15;
    }

    risk = Math.min(100, risk);


    /* ==============================
       FINAL PSYCHOLOGY SCORE
    ============================== */

    const psychologyScore = Math.round(
        quality * 0.40 +
        valuation * 0.40 +
        (100 - risk) * 0.20
    );


    /* ==============================
       DECISION
    ============================== */

    let decision = "WAIT";
    let reason = "Price does not currently provide enough margin of safety.";

    if (psychologyScore >= 80) {

        decision = "STRONG BUY";
        reason = "Strong business quality with attractive valuation and risk characteristics.";

    } else if (psychologyScore >= 70) {

        decision = "BUY";
        reason = "Good combination of business quality and valuation.";

    } else if (psychologyScore >= 55) {

        decision = "WATCH";
        reason = "Interesting business, but valuation or risk requires patience.";

    }


    return {
        score: psychologyScore,
        qualityScore: quality,
        valuationScore: valuation,
        riskScore: risk,
        decision: decision,
        reason: reason
    };
}
