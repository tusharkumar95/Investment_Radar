/*
 * INVESTMENT RADAR
 * DATA QUALITY ENGINE
 *
 * Canonical schema used by the live Radar data.
 * Missing data is reported separately from investment quality.
 */

function isValidNumber(value) {
    if (value === null || value === undefined || value === "") return false;
    const n = Number(value);
    return Number.isFinite(n);
}

function hasValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    return true;
}

function checkField(object, path) {
    const parts = path.split(".");
    let current = object;
    for (const part of parts) {
        if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, part)) return false;
        current = current[part];
    }
    return hasValue(current);
}

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
        "valuation.evToEbitda",
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
        "ownership.recentBigInvestors"
    ],
    income: [
        "dividend.yield",
        "dividend.growth",
        "dividend.payout"
    ]
};

function calculateCategoryScore(investment, fields) {
    if (!fields?.length) return 0;
    const available = fields.filter(field => checkField(investment, field)).length;
    return Math.round((available / fields.length) * 100);
}

function calculateDataCompleteness(investment) {
    const allFields = Object.values(DATA_FIELDS).flat();
    const available = allFields.filter(field => checkField(investment, field)).length;
    return allFields.length ? Math.round((available / allFields.length) * 100) : 0;
}

function categoryCompleteness(investment) {
    return Object.fromEntries(
        Object.entries(DATA_FIELDS).map(([key, fields]) => [key, calculateCategoryScore(investment, fields)])
    );
}

function calculateDataConfidence(investment) {
    const completeness = calculateDataCompleteness(investment);
    if (completeness >= 90) return { score: completeness, label: "Very High", className: "green" };
    if (completeness >= 75) return { score: completeness, label: "High", className: "green" };
    if (completeness >= 55) return { score: completeness, label: "Moderate", className: "yellow" };
    if (completeness >= 35) return { score: completeness, label: "Low", className: "yellow" };
    return { score: completeness, label: "Very Low", className: "red" };
}

function getMissingFields(investment) {
    const fields = [
        ["fundamentals.revenueGrowth5Y", "5-year revenue growth"],
        ["fundamentals.epsGrowth5Y", "5-year EPS growth"],
        ["fundamentals.profitMargin", "Profit margin"],
        ["fundamentals.roe", "ROE"],
        ["fundamentals.roic", "ROIC"],
        ["fundamentals.freeCashFlow", "Free cash flow"],
        ["fundamentals.debtToEquity", "Debt/equity"],
        ["valuation.pe", "P/E"],
        ["valuation.forwardPE", "Forward P/E"],
        ["valuation.peg", "PEG"],
        ["valuation.evToEbitda", "EV/EBITDA"],
        ["valuation.priceToFcf", "Price/FCF"],
        ["valuation.priceToBook", "Price/Book"],
        ["ownership.insiderHolding", "Insider holding"],
        ["ownership.promoterHolding", "Promoter holding"],
        ["ownership.promoterChange", "Promoter ownership change"],
        ["ownership.promoterPledge", "Promoter pledge"],
        ["ownership.institutionalHolding", "Institutional holding"],
        ["ownership.institutionalChange", "Institutional ownership change"],
        ["ownership.recentBigInvestors", "Major investor activity"]
    ];
    return fields.filter(([path]) => !checkField(investment, path)).map(([, label]) => label);
}

function getDataQualityReport(investment) {
    const completeness = calculateDataCompleteness(investment);
    return {
        completeness,
        confidence: calculateDataConfidence(investment),
        categories: categoryCompleteness(investment),
        missing: getMissingFields(investment),
        usable: completeness >= 40
    };
}
