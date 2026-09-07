/*
 * INVESTMENT RADAR
 * INVESTMENT SCORING ENGINE
 *
 * Score: 0 - 100
 *
 * LONG TERM
 * - Business Quality       25%
 * - Valuation              25%
 * - Growth                 15%
 * - Market Behaviour       10%
 * - Investment Psychology  10%
 * - Ownership              10%
 * - Income                  5%
 *
 * SHORT TERM
 * - Momentum               30%
 * - Price Action            20%
 * - Valuation               15%
 * - Market Trend            15%
 * - Fundamentals            10%
 * - Psychology              10%
 */


/* =========================================
   HELPERS
========================================= */

function clamp(value, min = 0, max = 100) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


function number(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


/*
 * Convert a raw metric into a 0-100 score.
 *
 * Missing values return null so they do not
 * automatically become a zero.
 */

function scoreMetric(value, levels) {

    if (value === null) {
        return null;
    }

    for (const level of levels) {

        if (value >= level.min) {
            return level.score;
        }
    }

    return 0;
}


function lowerIsBetterScore(value, levels) {

    if (value === null || value <= 0) {
        return null;
    }

    for (const level of levels) {

        if (value <= level.max) {
            return level.score;
        }
    }

    return 0;
}


/*
 * Average only the metrics that actually exist.
 */

function weightedAverage(items) {

    let total = 0;
    let weight = 0;

    items.forEach(item => {

        if (
            item.score !== null &&
            item.score !== undefined &&
            item.weight > 0
        ) {

            total += item.score * item.weight;
            weight += item.weight;
        }

    });

    if (weight === 0) {
        return 0;
    }

    return total / weight;
}


/* =========================================
   BUSINESS QUALITY
========================================= */

function businessQualityScore(stock) {

    const f = stock.fundamentals || {};

    const revenueGrowth =
        number(f.revenueGrowth5Y);

    const epsGrowth =
        number(f.epsGrowth5Y);

    const margin =
        number(f.profitMargin);

    const roe =
        number(f.roe);

    const roic =
        number(f.roic);

    const fcf =
        number(f.freeCashFlow);

    const debt =
        number(f.debtToEquity);


    const revenueScore =
        scoreMetric(
            revenueGrowth,
            [
                { min: 25, score: 100 },
                { min: 20, score: 90 },
                { min: 15, score: 80 },
                { min: 10, score: 70 },
                { min: 5, score: 55 },
                { min: 0, score: 35 }
            ]
        );

    const epsScore =
        scoreMetric(
            epsGrowth,
            [
                { min: 25, score: 100 },
                { min: 20, score: 90 },
                { min: 15, score: 80 },
                { min: 10, score: 70 },
                { min: 5, score: 55 },
                { min: 0, score: 35 }
            ]
        );

    const marginScore =
        scoreMetric(
            margin,
            [
                { min: 30, score: 100 },
                { min: 25, score: 90 },
                { min: 20, score: 80 },
                { min: 15, score: 70 },
                { min: 10, score: 55 },
                { min: 0, score: 35 }
            ]
        );

    const roeScore =
        scoreMetric(
            roe,
            [
                { min: 25, score: 100 },
                { min: 20, score: 90 },
                { min: 15, score: 80 },
                { min: 10, score: 65 },
                { min: 5, score: 45 },
                { min: 0, score: 25 }
            ]
        );

    const roicScore =
        scoreMetric(
            roic,
            [
                { min: 25, score: 100 },
                { min: 20, score: 90 },
                { min: 15, score: 80 },
                { min: 10, score: 65 },
                { min: 5, score: 45 },
                { min: 0, score: 25 }
            ]
        );

    const fcfScore =
        fcf === null
            ? null
            : fcf > 0
                ? 100
                : 15;

    const debtScore =
        lowerIsBetterScore(
            debt,
            [
                { max: 0.25, score: 100 },
                { max: 0.50, score: 90 },
                { max: 1.00, score: 75 },
                { max: 1.50, score: 55 },
                { max: 2.00, score: 35 }
            ]
        );


    return weightedAverage([

        { score: revenueScore, weight: 20 },
        { score: epsScore, weight: 20 },
        { score: marginScore, weight: 15 },
        { score: roeScore, weight: 15 },
        { score: roicScore, weight: 15 },
        { score: fcfScore, weight: 7 },
        { score: debtScore, weight: 8 }

    ]);
}


/* =========================================
   VALUATION
========================================= */

function valuationScore(stock) {

    const v = stock.valuation || {};

    const pe =
        number(v.pe);

    const forwardPE =
        number(v.forwardPE);

    const peg =
        number(v.peg);

    const priceToFcf =
        number(v.priceToFcf);

    const priceToBook =
        number(v.priceToBook);


    const peScore =
        lowerIsBetterScore(
            pe,
            [
                { max: 12, score: 100 },
                { max: 15, score: 90 },
                { max: 20, score: 80 },
                { max: 25, score: 65 },
                { max: 35, score: 45 },
                { max: 50, score: 25 }
            ]
        );

    const forwardScore =
        lowerIsBetterScore(
            forwardPE,
            [
                { max: 12, score: 100 },
                { max: 15, score: 90 },
                { max: 20, score: 80 },
                { max: 25, score: 65 },
                { max: 35, score: 45 },
                { max: 50, score: 25 }
            ]
        );

    const pegScore =
        lowerIsBetterScore(
            peg,
            [
                { max: 0.75, score: 100 },
                { max: 1.00, score: 90 },
                { max: 1.50, score: 80 },
                { max: 2.00, score: 65 },
                { max: 3.00, score: 40 }
            ]
        );

    const fcfScore =
        lowerIsBetterScore(
            priceToFcf,
            [
                { max: 12, score: 100 },
                { max: 18, score: 85 },
                { max: 25, score: 70 },
                { max: 35, score: 50 },
                { max: 50, score: 30 }
            ]
        );

    const pbScore =
        lowerIsBetterScore(
            priceToBook,
            [
                { max: 1.5, score: 100 },
                { max: 2.5, score: 85 },
                { max: 4, score: 70 },
                { max: 6, score: 50 },
                { max: 10, score: 30 }
            ]
        );


    return weightedAverage([

        { score: peScore, weight: 25 },
        { score: forwardScore, weight: 25 },
        { score: pegScore, weight: 20 },
        { score: fcfScore, weight: 15 },
        { score: pbScore, weight: 15 }

    ]);
}


/* =========================================
   GROWTH
========================================= */

function growthScore(stock) {

    const f = stock.fundamentals || {};

    const revenueGrowth =
        number(f.revenueGrowth5Y);

    const revenueGrowth3Y =
        number(f.revenueGrowth3Y);

    const epsGrowth =
        number(f.epsGrowth5Y);

    const fcfGrowth =
        number(f.fcfGrowth5Y);


    return weightedAverage([

        {
            score: scoreMetric(
                revenueGrowth,
                [
                    { min: 25, score: 100 },
                    { min: 20, score: 90 },
                    { min: 15, score: 80 },
                    { min: 10, score: 70 },
                    { min: 5, score: 55 },
                    { min: 0, score: 35 }
                ]
            ),
            weight: 30
        },

        {
            score: scoreMetric(
                revenueGrowth3Y,
                [
                    { min: 25, score: 100 },
                    { min: 20, score: 90 },
                    { min: 15, score: 80 },
                    { min: 10, score: 70 },
                    { min: 5, score: 55 },
                    { min: 0, score: 35 }
                ]
            ),
            weight: 20
        },

        {
            score: scoreMetric(
                epsGrowth,
                [
                    { min: 25, score: 100 },
                    { min: 20, score: 90 },
                    { min: 15, score: 80 },
                    { min: 10, score: 70 },
                    { min: 5, score: 55 },
                    { min: 0, score: 35 }
                ]
            ),
            weight: 30
        },

        {
            score: scoreMetric(
                fcfGrowth,
                [
                    { min: 25, score: 100 },
                    { min: 20, score: 90 },
                    { min: 15, score: 80 },
                    { min: 10, score: 70 },
                    { min: 5, score: 55 },
                    { min: 0, score: 35 }
                ]
            ),
            weight: 20
        }

    ]);
}


/* =========================================
   MARKET BEHAVIOUR
========================================= */

function marketBehaviourScore(stock) {

    const t = stock.technical || {};

    const momentum3M =
        number(t.momentum3M);

    const momentum6M =
        number(t.momentum6M);

    const price =
        number(stock.price);

    const sma50 =
        number(t.sma50);

    const sma200 =
        number(t.sma200);


    let momentum3Score = null;

    if (momentum3M !== null) {

        if (momentum3M >= 20) momentum3Score = 100;
        else if (momentum3M >= 10) momentum3Score = 85;
        else if (momentum3M >= 5) momentum3Score = 75;
        else if (momentum3M >= 0) momentum3Score = 60;
        else if (momentum3M >= -10) momentum3Score = 40;
        else momentum3Score = 20;
    }


    let momentum6Score = null;

    if (momentum6M !== null) {

        if (momentum6M >= 30) momentum6Score = 100;
        else if (momentum6M >= 20) momentum6Score = 90;
        else if (momentum6M >= 10) momentum6Score = 80;
        else if (momentum6M >= 0) momentum6Score = 60;
        else if (momentum6M >= -10) momentum6Score = 40;
        else momentum6Score = 20;
    }


    let trendScore = null;

    if (
        price !== null &&
        sma50 !== null &&
        sma200 !== null &&
        sma200 > 0
    ) {

        if (
            price > sma50 &&
            sma50 > sma200
        ) {
            trendScore = 100;

        } else if (
            price > sma50 &&
            sma50 <= sma200
        ) {
            trendScore = 70;

        } else if (
            price < sma50 &&
            sma50 > sma200
        ) {
            trendScore = 55;

        } else {
            trendScore = 25;
        }
    }


    return weightedAverage([

        {
            score: momentum3Score,
            weight: 35
        },

        {
            score: momentum6Score,
            weight: 35
        },

        {
            score: trendScore,
            weight: 30
        }

    ]);
}


/* =========================================
   OWNERSHIP
========================================= */

function ownershipScore(stock) {

    const o = stock.ownership || {};

    const insider =
        number(o.insiderHolding);

    const promoter =
        number(o.promoterHolding);

    const promoterChange =
        number(o.promoterChange);

    const pledge =
        number(o.promoterPledge);

    const institutional =
        number(o.institutionalHolding);


    const insiderScore =
        scoreMetric(
            insider,
            [
                { min: 20, score: 100 },
                { min: 10, score: 90 },
                { min: 5, score: 75 },
                { min: 2, score: 60 },
                { min: 0, score: 40 }
            ]
        );

    const promoterScore =
        scoreMetric(
            promoter,
            [
                { min: 60, score: 100 },
                { min: 50, score: 90 },
                { min: 30, score: 75 },
                { min: 10, score: 60 },
                { min: 0, score: 40 }
            ]
        );

    let promoterChangeScore = null;

    if (promoterChange !== null) {

        if (promoterChange >= 2) promoterChangeScore = 100;
        else if (promoterChange >= 0.5) promoterChangeScore = 85;
        else if (promoterChange >= -0.5) promoterChangeScore = 65;
        else if (promoterChange >= -2) promoterChangeScore = 40;
        else promoterChangeScore = 20;
    }


    const pledgeScore =
        lowerIsBetterScore(
            pledge,
            [
                { max: 0, score: 100 },
                { max: 5, score: 85 },
                { max: 10, score: 70 },
                { max: 20, score: 40 },
                { max: 50, score: 15 }
            ]
        );


    const institutionalScore =
        scoreMetric(
            institutional,
            [
                { min: 70, score: 100 },
                { min: 50, score: 90 },
                { min: 30, score: 75 },
                { min: 10, score: 60 },
                { min: 0, score: 40 }
            ]
        );


    return weightedAverage([

        { score: insiderScore, weight: 20 },
        { score: promoterScore, weight: 25 },
        { score: promoterChangeScore, weight: 25 },
        { score: pledgeScore, weight: 15 },
        { score: institutionalScore, weight: 15 }

    ]);
}


/* =========================================
   INCOME
========================================= */

function incomeScore(stock) {

    const d = stock.dividend || {};

    const yieldValue =
        number(d.yield);

    const growth =
        number(d.growth);

    const payout =
        number(d.payout);


    const yieldScore =
        scoreMetric(
            yieldValue,
            [
                { min: 5, score: 100 },
                { min: 3, score: 90 },
                { min: 2, score: 75 },
                { min: 1, score: 60 },
                { min: 0, score: 40 }
            ]
        );

    const growthScoreValue =
        scoreMetric(
            growth,
            [
                { min: 15, score: 100 },
                { min: 10, score: 90 },
                { min: 5, score: 75 },
                { min: 0, score: 50 }
            ]
        );


    let payoutScore = null;

    if (payout !== null) {

        if (payout >= 20 && payout <= 60) {
            payoutScore = 100;

        } else if (payout < 20) {
            payoutScore = 80;

        } else if (payout <= 75) {
            payoutScore = 70;

        } else if (payout <= 100) {
            payoutScore = 45;

        } else {
            payoutScore = 15;
        }
    }


    return weightedAverage([

        {
            score: yieldScore,
            weight: 35
        },

        {
            score: growthScoreValue,
            weight: 35
        },

        {
            score: payoutScore,
            weight: 30
        }

    ]);
}


/* =========================================
   PSYCHOLOGY
========================================= */

function investmentPsychologyScore(stock) {

    if (
        typeof psychologyAnalysis !== "function"
    ) {
        return 50;
    }

    const analysis =
        psychologyAnalysis(stock);

    return number(analysis.score) ?? 50;
}


/* =========================================
   LONG TERM SCORE
========================================= */

function longTermScore(stock) {

    const quality =
        businessQualityScore(stock);

    const valuation =
        valuationScore(stock);

    const growth =
        growthScore(stock);

    const market =
        marketBehaviourScore(stock);

    const psychology =
        investmentPsychologyScore(stock);

    const ownership =
        ownershipScore(stock);

    const income =
        incomeScore(stock);


    const score =
        weightedAverage([

            {
                score: quality,
                weight: 25
            },

            {
                score: valuation,
                weight: 25
            },

            {
                score: growth,
                weight: 15
            },

            {
                score: market,
                weight: 10
            },

            {
                score: psychology,
                weight: 10
            },

            {
                score: ownership,
                weight: 10
            },

            {
                score: income,
                weight: 5
            }

        ]);


    return Math.round(
        clamp(score)
    );
}


/* =========================================
   SHORT TERM SCORE
========================================= */

function shortTermScore(stock) {

    const t = stock.technical || {};
    const v = stock.valuation || {};
    const f = stock.fundamentals || {};


    const momentum3M =
        number(t.momentum3M);

    const momentum6M =
        number(t.momentum6M);

    const price =
        number(stock.price);

    const sma50 =
        number(t.sma50);

    const sma200 =
        number(t.sma200);

    const forwardPE =
        number(v.forwardPE);

    const pe =
        number(v.pe);

    const revenueGrowth =
        number(f.revenueGrowth5Y);

    const epsGrowth =
        number(f.epsGrowth5Y);


    /* =====================================
       MOMENTUM — 30%
    ===================================== */

    let momentumScore = null;

    if (
        momentum3M !== null ||
        momentum6M !== null
    ) {

        const scores = [];

        if (momentum3M !== null) {

            if (momentum3M >= 20) scores.push(100);
            else if (momentum3M >= 10) scores.push(85);
            else if (momentum3M >= 5) scores.push(75);
            else if (momentum3M >= 0) scores.push(60);
            else if (momentum3M >= -10) scores.push(40);
            else scores.push(20);
        }

        if (momentum6M !== null) {

            if (momentum6M >= 30) scores.push(100);
            else if (momentum6M >= 20) scores.push(90);
            else if (momentum6M >= 10) scores.push(80);
            else if (momentum6M >= 0) scores.push(60);
            else if (momentum6M >= -10) scores.push(40);
            else scores.push(20);
        }

        momentumScore =
            scores.reduce(
                (sum, value) => sum + value,
                0
            ) / scores.length;
    }


    /* =====================================
       PRICE ACTION — 20%
    ===================================== */

    let priceActionScore = null;

    if (
        price !== null &&
        sma50 !== null &&
        sma200 !== null &&
        sma200 > 0
    ) {

        const distance50 =
            ((price / sma50) - 1) * 100;

        if (
            price > sma50 &&
            sma50 > sma200 &&
            distance50 >= 0 &&
            distance50 <= 10
        ) {
            priceActionScore = 100;

        } else if (
            price > sma50 &&
            sma50 > sma200
        ) {
            priceActionScore = 85;

        } else if (
            price > sma50
        ) {
            priceActionScore = 70;

        } else if (
            price >= sma50 * 0.95
        ) {
            priceActionScore = 55;

        } else {
            priceActionScore = 25;
        }
    }


    /* =====================================
       VALUATION — 15%
    ===================================== */

    const valuationShort =
        weightedAverage([

            {
                score: lowerIsBetterScore(
                    forwardPE,
                    [
                        { max: 15, score: 100 },
                        { max: 20, score: 85 },
                        { max: 25, score: 70 },
                        { max: 35, score: 50 },
                        { max: 50, score: 25 }
                    ]
                ),
                weight: 60
            },

            {
                score: lowerIsBetterScore(
                    pe,
                    [
                        { max: 15, score: 100 },
                        { max: 20, score: 85 },
                        { max: 25, score: 70 },
                        { max: 35, score: 50 },
                        { max: 50, score: 25 }
                    ]
                ),
                weight: 40
            }

        ]);


    /* =====================================
       MARKET TREND — 15%
    ===================================== */

    let trendScore = null;

    if (
        sma50 !== null &&
        sma200 !== null
    ) {

        if (sma50 > sma200) {
            trendScore = 100;
        } else {
            trendScore = 35;
        }
    }


    /* =====================================
       FUNDAMENTALS — 10%
    ===================================== */

    const fundamentalShort =
        weightedAverage([

            {
                score: scoreMetric(
                    revenueGrowth,
                    [
                        { min: 20, score: 100 },
                        { min: 10, score: 85 },
                        { min: 5, score: 70 },
                        { min: 0, score: 50 }
                    ]
                ),
                weight: 50
            },

            {
                score: scoreMetric(
                    epsGrowth,
                    [
                        { min: 20, score: 100 },
                        { min: 10, score: 85 },
                        { min: 5, score: 70 },
                        { min: 0, score: 50 }
                    ]
                ),
                weight: 50
            }

        ]);


    /* =====================================
       PSYCHOLOGY — 10%
    ===================================== */

    const psychology =
        investmentPsychologyScore(stock);


    const finalScore =
        weightedAverage([

            {
                score: momentumScore,
                weight: 30
            },

            {
                score: priceActionScore,
                weight: 20
            },

            {
                score: valuationShort,
                weight: 15
            },

            {
                score: trendScore,
                weight: 15
            },

            {
                score: fundamentalShort,
                weight: 10
            },

            {
                score: psychology,
                weight: 10
            }

        ]);


    return Math.round(
        clamp(finalScore)
    );
}


/* =========================================
   VERDICT
========================================= */

function getVerdict(score) {

    if (score >= 85) {
        return "Strong Buy";
    }

    if (score >= 75) {
        return "Buy";
    }

    if (score >= 65) {
        return "Accumulate";
    }

    if (score >= 50) {
        return "Watch";
    }

    if (score >= 35) {
        return "Wait";
    }

    return "Avoid";
}
