/*
 * INVESTMENT RADAR
 * VALUATION ENGINE
 *
 * Produces:
 * - Fair Value Range
 * - Attractive Buy Price
 * - Strong Buy Price
 * - Margin of Safety
 *
 * Important:
 * This is an estimation framework, not a prediction.
 */


/* =========================================
   HELPERS
========================================= */

function valuationNumber(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


function valuationRound(value) {

    if (!Number.isFinite(value)) {
        return 0;
    }

    return Number(value.toFixed(2));
}


/* =========================================
   MAIN VALUATION
========================================= */

function calculateValuation(stock) {

    const price =
        valuationNumber(stock.price) || 0;

    const f =
        stock.fundamentals || {};

    const v =
        stock.valuation || {};


    const revenueGrowth =
        valuationNumber(f.revenueGrowth5Y);

    const epsGrowth =
        valuationNumber(f.epsGrowth5Y);

    const profitMargin =
        valuationNumber(f.profitMargin);

    const roe =
        valuationNumber(f.roe);

    const pe =
        valuationNumber(v.pe);

    const forwardPE =
        valuationNumber(v.forwardPE);

    const peg =
        valuationNumber(v.peg);

    const priceToFcf =
        valuationNumber(v.priceToFcf);

    const priceToBook =
        valuationNumber(v.priceToBook);


    if (price <= 0) {

        return {

            fairValue: 0,
            fairValueLow: 0,
            fairValueHigh: 0,

            buyPrice: 0,
            strongBuyPrice: 0,

            marginOfSafety: 0,

            valuationStatus:
                "Insufficient data",

            confidence:
                "Low"
        };
    }


    /* =========================================
       METHOD 1 — CURRENT P/E NORMALIZATION
    ========================================= */

    let peValue = null;

    if (
        pe !== null &&
        pe > 0
    ) {

        let targetPE = 18;

        if (
            epsGrowth !== null &&
            epsGrowth >= 20
        ) {
            targetPE = 28;

        } else if (
            epsGrowth !== null &&
            epsGrowth >= 15
        ) {
            targetPE = 25;

        } else if (
            epsGrowth !== null &&
            epsGrowth >= 10
        ) {
            targetPE = 22;

        } else if (
            epsGrowth !== null &&
            epsGrowth >= 5
        ) {
            targetPE = 18;

        } else {
            targetPE = 15;
        }


        /*
         * Avoid rewarding extremely high
         * growth indefinitely.
         */

        targetPE =
            Math.max(
                12,
                Math.min(28, targetPE)
            );


        peValue =
            price *
            (targetPE / pe);
    }


    /* =========================================
       METHOD 2 — FORWARD P/E
    ========================================= */

    let forwardValue = null;

    if (
        forwardPE !== null &&
        forwardPE > 0
    ) {

        let targetForwardPE = 18;

        if (
            revenueGrowth !== null &&
            revenueGrowth >= 20
        ) {
            targetForwardPE = 26;

        } else if (
            revenueGrowth !== null &&
            revenueGrowth >= 15
        ) {
            targetForwardPE = 24;

        } else if (
            revenueGrowth !== null &&
            revenueGrowth >= 10
        ) {
            targetForwardPE = 21;

        } else if (
            revenueGrowth !== null &&
            revenueGrowth >= 5
        ) {
            targetForwardPE = 18;

        } else {
            targetForwardPE = 15;
        }


        targetForwardPE =
            Math.max(
                12,
                Math.min(26, targetForwardPE)
            );


        forwardValue =
            price *
            (targetForwardPE / forwardPE);
    }


    /* =========================================
       METHOD 3 — PEG
    ========================================= */

    let pegValue = null;

    if (
        peg !== null &&
        peg > 0 &&
        epsGrowth !== null &&
        epsGrowth > 0
    ) {

        /*
         * A PEG around 1 is treated as
         * broadly reasonable rather than
         * automatically "cheap".
         */

        const reasonablePEG =
            epsGrowth >= 20
                ? 1.25
                : epsGrowth >= 10
                    ? 1.15
                    : 1.00;


        const targetPE =
            Math.max(
                12,
                Math.min(
                    28,
                    epsGrowth * reasonablePEG
                )
            );


        if (pe !== null && pe > 0) {

            pegValue =
                price *
                (targetPE / pe);
        }
    }


    /* =========================================
       COLLECT ESTIMATES
    ========================================= */

    const estimates = [];

    if (peValue !== null && peValue > 0) {
        estimates.push({
            value: peValue,
            weight: 35
        });
    }

    if (
        forwardValue !== null &&
        forwardValue > 0
    ) {
        estimates.push({
            value: forwardValue,
            weight: 40
        });
    }

    if (
        pegValue !== null &&
        pegValue > 0
    ) {
        estimates.push({
            value: pegValue,
            weight: 25
        });
    }


    /* =========================================
       NO USABLE VALUATION
    ========================================= */

    if (estimates.length === 0) {

        return {

            fairValue: 0,
            fairValueLow: 0,
            fairValueHigh: 0,

            buyPrice: 0,
            strongBuyPrice: 0,

            marginOfSafety: 0,

            valuationStatus:
                "Insufficient valuation data",

            confidence:
                "Low"
        };
    }


    /* =========================================
       WEIGHTED FAIR VALUE
    ========================================= */

    let weightedValue = 0;
    let totalWeight = 0;

    estimates.forEach(item => {

        weightedValue +=
            item.value * item.weight;

        totalWeight +=
            item.weight;
    });


    let fairValue =
        weightedValue / totalWeight;


    /*
     * Prevent a single extreme estimate
     * from producing a ridiculous result.
     */

    fairValue =
        Math.max(
            price * 0.60,
            Math.min(
                price * 1.80,
                fairValue
            )
        );


    /* =========================================
       QUALITY ADJUSTMENT
    ========================================= */

    let qualityAdjustment = 1;


    if (
        roe !== null &&
        roe >= 20
    ) {
        qualityAdjustment += 0.05;

    } else if (
        roe !== null &&
        roe < 8
    ) {
        qualityAdjustment -= 0.05;
    }


    if (
        profitMargin !== null &&
        profitMargin >= 20
    ) {
        qualityAdjustment += 0.03;
    }


    fairValue *= qualityAdjustment;


    fairValue =
        Math.max(
            price * 0.60,
            Math.min(
                price * 1.80,
                fairValue
            )
        );


    /* =========================================
       FAIR VALUE RANGE
    ========================================= */

    const fairValueLow =
        fairValue * 0.90;

    const fairValueHigh =
        fairValue * 1.10;


    /* =========================================
       ENTRY ZONES
    ========================================= */

    /*
     * Buy:
     * approximately 15% below fair value
     */

    const buyPrice =
        fairValue * 0.85;


    /*
     * Strong Buy:
     * approximately 30% below fair value
     */

    const strongBuyPrice =
        fairValue * 0.70;


    /* =========================================
       MARGIN OF SAFETY
    ========================================= */

    const marginOfSafety =
        ((fairValue - price) / fairValue) * 100;


    /* =========================================
       VALUATION STATUS
    ========================================= */

    let valuationStatus;

    if (price <= strongBuyPrice) {

        valuationStatus =
            "Exceptional opportunity";

    } else if (price <= buyPrice) {

        valuationStatus =
            "Attractive";

    } else if (price <= fairValueHigh) {

        valuationStatus =
            "Fairly valued";

    } else if (price <= fairValueHigh * 1.20) {

        valuationStatus =
            "Expensive";

    } else {

        valuationStatus =
            "Very expensive";
    }


    /* =========================================
       CONFIDENCE
    ========================================= */

    let confidence = "Moderate";

    if (estimates.length >= 3) {
        confidence = "High";
    } else if (estimates.length === 1) {
        confidence = "Low";
    }


    return {

        fairValue:
            valuationRound(fairValue),

        fairValueLow:
            valuationRound(fairValueLow),

        fairValueHigh:
            valuationRound(fairValueHigh),

        buyPrice:
            valuationRound(buyPrice),

        strongBuyPrice:
            valuationRound(strongBuyPrice),

        marginOfSafety:
            Number(marginOfSafety.toFixed(1)),

        valuationStatus,

        confidence
    };
}
