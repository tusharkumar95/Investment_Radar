/*
 * INVESTMENT RADAR
 * DATA QUALITY ENGINE
 *
 * Purpose:
 * - Detect missing financial data
 * - Calculate data completeness and confidence
 * - Prevent missing data from becoming a false bad score
 * - Explain which information is unavailable
 */


/* =========================================
   BASIC HELPERS
========================================= */

function isValidNumber(value) {
    if (value === null || value === undefined || value === "") {
        return false;
    }

    const n = Number(value);
    return Number.isFinite(n);
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
   FIELD GROUPS
========================================= */

const DATA_FIELDS = {

    quality: [
        "fundamentals.revenueGrowth5Y",
        "fundamentals.epsGrowth5Y",
        "fundamentals.profitMargin",
        "fundamentals.roe",
        "fundamentals.roic",
        "fundamentals.freeCashFlow",
        "fundamentals.debtToEquity"
    ],

    valuation: [
        "valuation.pe",
        "valuation.forwardPE",
        "valuation.peg",
        "valuation.evEbitda",
        "valuation.priceToFcf",
        "valuation.priceToBook"
    ],

    growth: [
        "fundamentals.revenueGrowth3Y",
        "fundamentals.revenueGrowth5Y",
        "fundamentals.epsGrowth5Y",
        "fundamentals.fcfGrowth5Y"
    ],

    market: [
        "technical.momentum3M",
        "technical.momentum6M",
        "technical.sma50",
        "technical.sma200",
        "technical.high52Week",
        "technical.low52Week"
    ],

    ownership: [
        "ownership.insiderHolding",
        "ownership.promoterHolding",
        "ownership.promoterChange",
        "ownership.promoterPledge",
        "ownership.institutionalHolding",
        "ownership.institutionalChange",
        "ownership.majorInvestorActivity"
    ],

    income: [
        "dividend.yield",
        "dividend.growth",
        "dividend.payout"
    ]
};


/* =========================================
   COMPLETENESS
========================================= */

function calculateCategoryScore(investment, fields) {

    if (!fields || fields.length === 0) {
        return 0;
    }

    let available = 0;

    fields.forEach(field => {
        if (checkField(investment, field)) {
            available++;
        }
    });

    return Math.round((available / fields.length) * 100);
}


function calculateDataCompleteness(investment) {

    const allFields = Object.values(DATA_FIELDS).flat();

    let available = 0;

    allFields.forEach(field => {

        if (checkField(investment, field)) {
            available++;
        }

    });

    if (allFields.length === 0) {
        return 0;
    }

    return Math.round(
        (available / allFields.length) * 100
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
                DATA_FIELDS.quality
            ),

        valuation:
            calculateCategoryScore(
                investment,
                DATA_FIELDS.valuation
            ),

        growth:
            calculateCategoryScore(
                investment,
                DATA_FIELDS.growth
            ),

        market:
            calculateCategoryScore(
                investment,
                DATA_FIELDS.market
            ),

        ownership:
            calculateCategoryScore(
                investment,
                DATA_FIELDS.ownership
            ),

        income:
            calculateCategoryScore(
                investment,
                DATA_FIELDS.income
            )
    };
}


/* =========================================
   DATA CONFIDENCE
========================================= */

function calculateDataConfidence(investment) {

    const completeness =
        calculateDataCompleteness(investment);

    let label;
    let className;

    if (completeness >= 90) {

        label = "Very High";
        className = "green";

    } else if (completeness >= 75) {

        label = "High";
        className = "green";

    } else if (completeness >= 55) {

        label = "Moderate";
        className = "yellow";

    } else if (completeness >= 35) {

        label = "Low";
        className = "yellow";

    } else {

        label = "Very Low";
        className = "red";
    }

    return {
        score: completeness,
        label: label,
        className: className
    };
}


/* =========================================
   MISSING DATA
========================================= */

function getMissingFields(investment) {

    const fields = [

        {
            path: "fundamentals.revenueGrowth5Y",
            label: "5-year revenue growth"
        },

        {
            path: "fundamentals.epsGrowth5Y",
            label: "5-year EPS growth"
        },

        {
            path: "fundamentals.profitMargin",
            label: "Profit margin"
        },

        {
            path: "fundamentals.roe",
            label: "ROE"
        },

        {
            path: "fundamentals.roic",
            label: "ROIC"
        },

        {
            path: "fundamentals.freeCashFlow",
            label: "Free cash flow"
        },

        {
            path: "fundamentals.debtToEquity",
            label: "Debt/equity"
        },

        {
            path: "valuation.pe",
            label: "P/E"
        },

        {
            path: "valuation.forwardPE",
            label: "Forward P/E"
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
            path: "valuation.priceToBook",
            label: "Price/Book"
        },

        {
            path: "ownership.insiderHolding",
            label: "Insider holding"
        },

        {
            path: "ownership.promoterHolding",
            label: "Promoter holding"
        },

        {
            path: "ownership.promoterChange",
            label: "Promoter ownership change"
        },

        {
            path: "ownership.promoterPledge",
            label: "Promoter pledge"
        },

        {
            path: "ownership.institutionalHolding",
            label: "Institutional holding"
        },

        {
            path: "ownership.institutionalChange",
            label: "Institutional ownership change"
        },

        {
            path: "ownership.majorInvestorActivity",
            label: "Major investor activity"
        }
    ];


    return fields
        .filter(field => !checkField(investment, field.path))
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

        usable: completeness >= 40
    };
}
