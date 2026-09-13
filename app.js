/*
 * INVESTMENT RADAR
 * Main application controller
 */

let currentMarket = "Canada";
let currentView = "Long Term";

let marketData = {
    Canada: null,
    India: null
};


/* =========================================
   NORMALIZE INVESTMENT DATA
========================================= */

function normalizeMarketData(data) {

    if (!data || !Array.isArray(data.stocks)) {
        return data;
    }

    data.stocks = data.stocks.map(stock => ({
        ...stock,

        name:
            stock.name ||
            stock.shortName ||
            stock.longName ||
            stock.companyName ||
            stock.symbol ||
            stock.ticker ||
            "Unknown",

        ticker:
            stock.ticker ||
            stock.symbol ||
            stock.id ||
            "",

        type:
            stock.type ||
            stock.quoteType ||
            "Investment"
    }));

    return data;
}


/* =========================================
   FRONT-END FORMATTING
========================================= */

function cleanNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function formatPlain(value) {
    const number = cleanNumber(value);

    if (number === null) {
        return "—";
    }

    return number.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function formatPercent(value) {
    const number = cleanNumber(value);

    if (number === null) {
        return "—";
    }

    return `${number.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}%`;
}

function formatMoney(value) {
    const number = cleanNumber(value);

    if (number === null) {
        return "—";
    }

    const symbol = currentMarket === "India" ? "₹" : "$";

    return `${symbol}${number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatRatio(value) {
    const number = cleanNumber(value);

    if (number === null) {
        return "—";
    }

    return `${number.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}x`;
}

function formatMetricByLabel(label, value) {
    const text = String(label || "").toLowerCase();

    if (
        text.includes("growth") ||
        text.includes("margin") ||
        text.includes("roe") ||
        text.includes("roic") ||
        text.includes("yield") ||
        text.includes("holding") ||
        text.includes("change") ||
        text.includes("pledge") ||
        text.includes("momentum") ||
        text.includes("volatility") ||
        text.includes("drawdown") ||
        text.includes("payout") ||
        text.includes("confidence")
    ) {
        return formatPercent(value);
    }

    if (
        text === "p/e" ||
        text.includes("forward p/e") ||
        text === "peg" ||
        text.includes("price / sales") ||
        text.includes("price / book") ||
        text.includes("debt / equity") ||
        text.includes("interest coverage") ||
        text === "beta" ||
        text.includes("ev / ebitda") ||
        text.includes("ev / revenue")
    ) {
        return formatRatio(value);
    }

    if (
        text.includes("price") ||
        text.includes("fair value") ||
        text.includes("entry") ||
        text.includes("opportunity") ||
        text.includes("cash flow") ||
        text.includes("revenue") ||
        text.includes("net income") ||
        text.includes("operating income") ||
        text.includes("gross profit") ||
        text.includes("ebitda") ||
        text.includes("cash") ||
        text.includes("debt") ||
        text.includes("equity") ||
        text.includes("assets") ||
        text.includes("market cap") ||
        text.includes("enterprise value") ||
        text.includes("52 week") ||
        text.includes("average")
    ) {
        return formatMoney(value);
    }

    return formatPlain(value);
}

function formatExistingDetailMetrics() {

    const detail = document.getElementById("detailView");

    if (!detail || detail.style.display === "none") {
        return;
    }

    detail.querySelectorAll(".metric").forEach(metric => {

        const label = metric.querySelector(".metric-label");
        const value = metric.querySelector(".metric-value");

        if (!label || !value) {
            return;
        }

        const raw = value.textContent.trim();

        if (!raw || raw === "—") {
            return;
        }

        if (
            /^[A-Za-z₹$—]/.test(raw) &&
            !/^[₹$-]?\d/.test(raw)
        ) {
            return;
        }

        const numeric = raw.replace(/[$₹,%x,\s]/g, "");

        if (!numeric || !Number.isFinite(Number(numeric))) {
            return;
        }

        value.textContent = formatMetricByLabel(
            label.textContent,
            numeric
        );
    });
}


/* =========================================
   ADDITIONAL FINANCIAL DATA
========================================= */

function buildFinancialMetric(label, value, formatter) {
    const formatted = formatter(value);

    return `
        <div class="metric">
            <span class="metric-label">${label}</span>
            <span class="metric-value">${formatted}</span>
        </div>
    `;
}

function enhanceDetailView() {

    const detail = document.getElementById("detailView");

    if (!detail || detail.style.display === "none") {
        return;
    }

    if (detail.querySelector(".radar-financial-enhancements")) {
        formatExistingDetailMetrics();
        return;
    }

    const tickerElement = detail.querySelector(".detail-header p");
    const ticker = tickerElement
        ? tickerElement.textContent.trim()
        : "";

    if (!ticker) {
        return;
    }

    const investment = (marketData[currentMarket]?.stocks || [])
        .find(stock => stock.ticker === ticker);

    if (!investment) {
        return;
    }

    const f = investment.fundamentals || {};
    const v = investment.valuation || {};
    const d = investment.dividend || {};
    const p = investment.price || {};
    const t = investment.technical || {};

    const financialSection = document.createElement("section");
    financialSection.className = "detail-section radar-financial-enhancements";

    financialSection.innerHTML = `
        <div class="section-title">Financial Statements & Cash Flow</div>
        <div class="metric-grid">
            ${buildFinancialMetric("Revenue", f.revenue, formatMoney)}
            ${buildFinancialMetric("Net Income", f.netIncome, formatMoney)}
            ${buildFinancialMetric("Operating Income", f.operatingIncome, formatMoney)}
            ${buildFinancialMetric("Gross Profit", f.grossProfit, formatMoney)}
            ${buildFinancialMetric("EBITDA", f.ebitda, formatMoney)}
            ${buildFinancialMetric("Operating Cash Flow", f.operatingCashFlow, formatMoney)}
            ${buildFinancialMetric("Free Cash Flow", f.freeCashFlow, formatMoney)}
            ${buildFinancialMetric("Cash", f.cash, formatMoney)}
            ${buildFinancialMetric("Total Debt", f.totalDebt, formatMoney)}
            ${buildFinancialMetric("Total Assets", f.totalAssets, formatMoney)}
            ${buildFinancialMetric("Shareholders' Equity", f.stockholdersEquity, formatMoney)}
            ${buildFinancialMetric("Interest Coverage", f.interestCoverage, formatRatio)}
        </div>
    `;

    const valuationSection = document.createElement("section");
    valuationSection.className = "detail-section radar-financial-enhancements";

    valuationSection.innerHTML = `
        <div class="section-title">Valuation & Income</div>
        <div class="metric-grid">
            ${buildFinancialMetric("Market Capitalization", v.marketCap, formatMoney)}
            ${buildFinancialMetric("Enterprise Value", v.enterpriseValue, formatMoney)}
            ${buildFinancialMetric("EV / EBITDA", v.evToEbitda, formatRatio)}
            ${buildFinancialMetric("EV / Revenue", v.evToRevenue, formatRatio)}
            ${buildFinancialMetric("Beta", v.beta, formatRatio)}
            ${buildFinancialMetric("Dividend Yield", d.yield, formatPercent)}
            ${buildFinancialMetric("Dividend Rate", d.rate, formatMoney)}
            ${buildFinancialMetric("Payout Ratio", d.payoutRatio, formatPercent)}
        </div>
    `;

    const technicalSection = document.createElement("section");
    technicalSection.className = "detail-section radar-financial-enhancements";

    technicalSection.innerHTML = `
        <div class="section-title">Market Behaviour — Additional</div>
        <div class="metric-grid">
            ${buildFinancialMetric("Current Price", p.current, formatMoney)}
            ${buildFinancialMetric("Previous Close", p.previousClose, formatMoney)}
            ${buildFinancialMetric("Daily Change", p.changePercent, formatPercent)}
            ${buildFinancialMetric("1 Year Momentum", t.momentum1y, formatPercent)}
            ${buildFinancialMetric("30 Day Volatility", t.volatility30d, formatPercent)}
            ${buildFinancialMetric("90 Day Volatility", t.volatility90d, formatPercent)}
            ${buildFinancialMetric("52 Week Drawdown", t.drawdown52w, formatPercent)}
            ${buildFinancialMetric("Current Volume", t.volume, formatPlain)}
            ${buildFinancialMetric("20 Day Average Volume", t.averageVolume20d, formatPlain)}
        </div>
    `;

    detail.appendChild(financialSection);
    detail.appendChild(valuationSection);
    detail.appendChild(technicalSection);

    formatExistingDetailMetrics();
}


/* =========================================
   DETAIL VIEW OBSERVER
========================================= */

function startDetailEnhancements() {

    const detail = document.getElementById("detailView");

    if (!detail || detail.dataset.radarObserver === "true") {
        return;
    }

    detail.dataset.radarObserver = "true";

    const observer = new MutationObserver(() => {
        if (detail.style.display !== "none") {
            enhanceDetailView();
        }
    });

    observer.observe(detail, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"]
    });
}


/* =========================================
   LOAD DATA
========================================= */

async function loadMarketData() {

    try {

        const canadaResponse =
            await fetch("data/canada.json");

        const indiaResponse =
            await fetch("data/india.json");

        if (!canadaResponse.ok) {
            throw new Error("Canada data could not be loaded.");
        }

        if (!indiaResponse.ok) {
            throw new Error("India data could not be loaded.");
        }

        marketData.Canada = normalizeMarketData(
            await canadaResponse.json()
        );

        marketData.India = normalizeMarketData(
            await indiaResponse.json()
        );

        renderRadar();
        startDetailEnhancements();

    }

    catch (error) {

        console.error(
            "Unable to load investment data:",
            error
        );

        const container =
            document.getElementById("investments");

        if (container) {

            container.innerHTML = `
                <div class="investment">
                    <div class="investment-info">
                        <h3>Data loading error</h3>
                        <p>${error.message}</p>
                    </div>
                </div>
            `;

        }

    }

}


/* =========================================
   MARKET SELECTION
========================================= */

window.selectMarket = function(newMarket, button) {

    currentMarket = newMarket;

    document
        .querySelectorAll(".market-btn")
        .forEach(btn => {
            btn.classList.remove("active");
        });

    button.classList.add("active");
    renderRadar();

};


/* =========================================
   VIEW SELECTION
========================================= */

window.selectView = function(newView, button) {

    currentView = newView;

    document
        .querySelectorAll(".view-btn")
        .forEach(btn => {
            btn.classList.remove("active");
        });

    button.classList.add("active");
    renderRadar();

};


/* =========================================
   GET INVESTMENTS
========================================= */

function getInvestments() {

    const data = marketData[currentMarket];

    if (!data) {
        return [];
    }

    return data.stocks || [];

}


/* =========================================
   SCORE INVESTMENT
========================================= */

function scoreInvestment(investment) {

    let score;

    if (currentView === "Long Term") {
        score = longTermScore(investment);
    }
    else {
        score = shortTermScore(investment);
    }

    const dataQuality = getDataQualityReport(investment);
    const psychology = psychologyAnalysis(investment);
    const valuation = calculateValuation(investment);

    return {
        ...investment,
        score: score,
        verdict: getVerdict(score),
        dataQuality: dataQuality,
        psychology: psychology,
        calculatedValuation: valuation
    };

}


/* =========================================
   RENDER RADAR
========================================= */

window.renderRadar = function() {

    const data = marketData[currentMarket];

    if (!data) {
        return;
    }

    const investments =
        getInvestments()
            .map(scoreInvestment)
            .sort((a, b) => b.score - a.score);

    document
        .getElementById("pageTitle")
        .textContent =
            `${currentMarket} ${currentView} Radar`;

    document
        .getElementById("pageDescription")
        .textContent =
        currentView === "Long Term"
            ? "Finding high-quality investments with attractive fundamentals, valuation and margin of safety."
            : "Finding investments with strong momentum, valuation, market behaviour and near-term opportunity.";

    document
        .getElementById("stockCount")
        .textContent = investments.length;

    document
        .getElementById("candidateCount")
        .textContent =
            investments.filter(item => item.score >= 80).length;

    document
        .getElementById("watchlistCount")
        .textContent =
            investments.filter(
                item => item.score >= 60 && item.score < 80
            ).length;

    const container =
        document.getElementById("investments");

    container.innerHTML = "";

    if (investments.length === 0) {

        container.innerHTML = `
            <div class="investment">
                <div class="investment-info">
                    <h3>No investments loaded yet</h3>
                    <p>Our investment database is being built.</p>
                </div>
            </div>
        `;

        return;

    }

    investments.forEach(item => {

        let badgeClass = "yellow";

        if (item.score >= 85) {
            badgeClass = "green";
        }

        if (item.score < 60) {
            badgeClass = "red";
        }

        const fundamentals = item.fundamentals || {};
        const valuation = item.valuation || {};
        const price = item.price || {};

        const card = document.createElement("div");

        card.className = "investment";
        card.style.cursor = "pointer";
        card.dataset.ticker = item.ticker;

        card.innerHTML = `
            <div class="investment-info">
                <h3>${item.name || "Unknown"}</h3>
                <p>${item.ticker || ""}</p>

                <span class="badge ${badgeClass}">
                    ${item.verdict}
                </span>

                <div style="margin-top:10px;font-size:14px;line-height:1.6;">
                    Price: <strong>${formatMoney(price.current)}</strong>
                    &nbsp;·&nbsp;
                    P/E: <strong>${formatRatio(valuation.pe)}</strong>
                    &nbsp;·&nbsp;
                    ROE: <strong>${formatPercent(fundamentals.roe)}</strong>
                    <br>
                    Revenue Growth: <strong>${formatPercent(fundamentals.revenueGrowth5Y)}</strong>
                    &nbsp;·&nbsp;
                    Psychology: <strong>${item.psychology?.decision || "WAIT"}</strong>
                </div>
            </div>

            <div class="score">
                ${Math.round(item.score)}
            </div>
        `;

        card.addEventListener("click", function() {
            openInvestmentByTicker(item.ticker);
        });

        container.appendChild(card);

    });

};


/* =========================================
   START APPLICATION
========================================= */

loadMarketData();
