/*
 * INVESTMENT RADAR
 * DATA QUALITY ENGINE
 *
 * Purpose:
 * - Detect missing financial data
 * - Calculate data confidence
 * - Prevent missing data from becoming a false "bad" score
 * - Tell the user which information is unavailable
 */


/* =========================================
   BASIC HELPERS
========================================= */

function isValidNumber(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !isNaN(Number(value))
    );
}


function hasValue(value) {

    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === "string" && value.trim() === "") {
        return false;
    }

    return true;
}


/* =========================================
   FIELD CHECK
========================================= */

function checkField(object, path) {

    const parts = path.split(".");
    let current = object;

    for (const part of parts) {

        if (
            current === null ||
            current === undefined ||
            !Object.prototype.hasOwnProperty.call(current, part)
        ) {
            return false;
        }

        current = current[part];
    }

    return hasValue(current);
}


/* =========================================
   DATA COMPLETENESS
========================================= */

function calculateDataCompleteness(investment) {

    const fields = [

        "quality.revenueGrowth",
        "quality.epsGrowth",
        "quality.roe",
        "quality.roic",
        "quality.freeCashFlow",
        "quality.balanceSheet",

        "valuation.pe",
        "valuation.peg",
        "valuation.evEbitda",
        "valuation.priceToFcf",
        "valuation.historicalValuation",

        "growth",
        "momentum",

        "ownership.promoterHolding",
        "ownership.promoterChange",
        "ownership.promoterPledge",
        "ownership.institutionalChange",
        "ownership.majorInvestorActivity",

        "dividend.yield",
        "dividend.growth",
        "dividend.payout",

        "psychology.marginOfSafety",
        "psychology.sentiment",
        "psychology.cycle",
        "psychology.qualityAtPrice"
    ];


    let available = 0;

    fields.forEach(field => {

        if (checkField(investment, field)) {
            available++;
        }

    });


    return Math.round(
        (available / fields.length) * 100
    );
}


/* =========================================
   CATEGORY COMPLETENESS
========================================= */

function categoryCompleteness(investment) {

    return {

        quality:
            calculateCategoryScore(
                investment,
                [
                    "quality.revenueGrowth",
                    "quality.epsGrowth",
                    "quality.roe",
                    "quality.roic",
                    "quality.freeCashFlow",
                    "quality.balanceSheet"
                ]
            ),

        valuation:
            calculateCategoryScore(
                investment,
                [
                    "valuation.pe",
                    "valuation.peg",
                    "valuation.evEbitda",
                    "valuation.priceToFcf",
                    "valuation.historicalValuation"
                ]
            ),

        ownership:
            calculateCategoryScore(
                investment,
                [
                    "ownership.promoterHolding",
                    "ownership.promoterChange",
                    "ownership.promoterPledge",
                    "ownership.institutionalChange",
                    "ownership.majorInvestorActivity"
                ]
            ),

        psychology:
            calculateCategoryScore(
                investment,
                [
                    "psychology.marginOfSafety",
                    "psychology.sentiment",
                    "psychology.cycle",
                    "psychology.qualityAtPrice"
                ]
            ),

        dividend:
            calculateCategoryScore(
                investment,
                [
                    "dividend.yield",
                    "dividend.growth",
                    "dividend.payout"
                ]
            )
    };
}


function calculateCategoryScore(investment, fields) {

    if (!fields.length) {
        return 0;
    }

    let available = 0;

    fields.forEach(field => {

        if (checkField(investment, field)) {
            available++;
        }

    });

    return Math.round(
        (available / fields.length) * 100
    );
}


/* =========================================
   DATA CONFIDENCE
========================================= */

function calculateDataConfidence(investment) {

    const completeness =
        calculateDataCompleteness(investment);


    /*
     * At the moment confidence is based primarily
     * on completeness.
     *
     * Later we will also incorporate:
     *
     * - source reliability
     * - data age
     * - official vs secondary source
     * - calculation confidence
     */

    let confidence = completeness;


    if (confidence >= 90) {

        return {
            score: confidence,
            label: "Very High",
            className: "green"
        };

    }


    if (confidence >= 75) {

        return {
            score: confidence,
            label: "High",
            className: "green"
        };

    }


    if (confidence >= 55) {

        return {
            score: confidence,
            label: "Moderate",
            className: "yellow"
        };

    }


    if (confidence >= 35) {

        return {
            score: confidence,
            label: "Low",
            className: "yellow"
        };

    }


    return {
        score: confidence,
        label: "Very Low",
        className: "red"
    };
}


/* =========================================
   MISSING DATA
========================================= */

function getMissingFields(investment) {

    const fields = [

        {
            path: "quality.revenueGrowth",
            label: "Revenue growth"
        },

        {
            path: "quality.epsGrowth",
            label: "EPS growth"
        },

        {
            path: "quality.roe",
            label: "ROE"
        },

        {
            path: "quality.roic",
            label: "ROIC"
        },

        {
            path: "quality.freeCashFlow",
            label: "Free cash flow"
        },

        {
            path: "valuation.pe",
            label: "P/E"
        },

        {
            path: "valuation.peg",
            label: "PEG"
        },

        {
            path: "valuation.evEbitda",
            label: "EV/EBITDA"
        },

        {
            path: "valuation.priceToFcf",
            label: "Price/FCF"
        },

        {
            path: "ownership.promoterHolding",
            label: "Promoter holding"
        },

        {
            path: "ownership.promoterChange",
            label: "Promoter change"
        },

        {
            path: "ownership.promoterPledge",
            label: "Promoter pledge"
        },

        {
            path: "ownership.institutionalChange",
            label: "Institutional ownership change"
        },

        {
            path: "ownership.majorInvestorActivity",
            label: "Major investor activity"
        },

        {
            path: "psychology.marginOfSafety",
            label: "Margin of safety"
        },

        {
            path: "psychology.sentiment",
            label: "Market sentiment"
        },

        {
            path: "psychology.cycle",
            label: "Business cycle"
        }
    ];


    return fields
        .filter(field =>
            !checkField(investment, field.path)
        )
        .map(field => field.label);
}


/* =========================================
   INVESTMENT DATA REPORT
========================================= */

function getDataQualityReport(investment) {

    const completeness =
        calculateDataCompleteness(investment);

    const confidence =
        calculateDataConfidence(investment);

    const categories =
        categoryCompleteness(investment);

    const missing =
        getMissingFields(investment);


    return {

        completeness,

        confidence,

        categories,

        missing,

        usable:
            completeness >= 50

    };
}
