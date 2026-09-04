/*
 * INVESTMENT RADAR
 * INVESTMENT DETAIL VIEW
 */

let selectedInvestment = null;


/* =========================================
   OPEN INVESTMENT
========================================= */

window.openInvestment = function(investment) {

    selectedInvestment = investment;

    const radar = document.getElementById("radarView");
    const detail = document.getElementById("detailView");

    if (!radar || !detail) {
        console.error("Detail view containers not found.");
        return;
    }

    radar.style.display = "none";
    detail.style.display = "block";

    renderInvestmentDetail(investment);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};


/* =========================================
   BACK TO RADAR
========================================= */

window.closeInvestment = function() {

    const radar = document.getElementById("radarView");
    const detail = document.getElementById("detailView");

    if (!radar || !detail) {
        return;
    }

    detail.style.display = "none";
    radar.style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};


/* =========================================
   FORMAT NUMBER
========================================= */

function formatNumber(value, decimals = 2) {

    if (
        value === null ||
        value === undefined ||
        value === "" ||
        isNaN(Number(value))
    ) {
        return "—";
    }

    return Number(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits: decimals
        }
    );
}


/* =========================================
   FORMAT PERCENTAGE
========================================= */

function formatPercent(value) {

    if (
        value === null ||
        value === undefined ||
        value === "" ||
        isNaN(Number(value))
    ) {
        return "—";
    }

    return `${formatNumber(value)}%`;
}


/* =========================================
   DATA VALUE
========================================= */

function getValue(object, path) {

    const parts = path.split(".");

    let value = object;

    for (const part of parts) {

        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        value = value[part];
    }

    return value;
}


/* =========================================
   METRIC
========================================= */

function metric(label, value) {

    return `
        <div class="metric">

            <span class="metric-label">
                ${label}
            </span>

            <strong class="metric-value">
                ${value}
            </strong>

        </div>
    `;
}


/* =========================================
   DETAIL PAGE
========================================= */

function renderInvestmentDetail(investment) {

    const container =
        document.getElementById("detailView");

    const quality =
        investment.dataQuality || {};

    const confidence =
        quality.confidence || {
            score: 0,
            label: "Unknown",
            className: "yellow"
        };


    container.innerHTML = `

        <div class="detail-container">

            <button
                class="back-button"
                onclick="closeInvestment()"
            >
                ← Back to Radar
            </button>


            <div class="detail-header">

                <div>

                    <div class="detail-market">
                        ${currentMarket}
                    </div>

                    <h1>
                        ${investment.name || "Unknown Investment"}
                    </h1>

                    <p>
                        ${investment.ticker || ""}
                    </p>

                </div>


                <div class="detail-score">

                    <div class="big-score">
                        ${investment.score ?? "—"}
                    </div>

                    <div>
                        ${investment.verdict || "WATCH"}
                    </div>

                </div>

            </div>


            <!-- DATA CONFIDENCE -->

            <section class="detail-section">

                <div class="section-title">
                    Data Confidence
                </div>

                <div class="confidence-box">

                    <strong>
                        ${confidence.score}%
                    </strong>

                    <span>
                        ${confidence.label}
                    </span>

                </div>

                ${
                    quality.missing &&
                    quality.missing.length
                    ? `
                        <p class="missing-data">
                            Missing:
                            ${quality.missing.join(", ")}
                        </p>
                    `
                    : `
                        <p class="complete-data">
                            Core investment data available.
                        </p>
                    `
                }

            </section>


            <!-- PRICE -->

            <section class="detail-section">

                <div class="section-title">
                    Price & Market
                </div>

                <div class="metric-grid">

                    ${metric(
                        "Current Price",
                        formatNumber(
                            getValue(
                                investment,
                                "price.current"
                            )
                        )
                    )}

                    ${metric(
                        "Market Cap",
                        formatNumber(
                            getValue(
                                investment,
                                "price.marketCap"
                            )
                    )}

                    ${metric(
                        "52W High",
                        formatNumber(
                            getValue(
                                investment,
                                "price.high52w"
                            )
                        )
                    )}

                    ${metric(
                        "52W Low",
                        formatNumber(
                            getValue(
                                investment,
                                "price.low52w"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- FINANCIALS -->

            <section class="detail-section">

                <div class="section-title">
                    Financial Performance
                </div>

                <div class="metric-grid">

                    ${metric(
                        "Revenue",
                        formatNumber(
                            getValue(
                                investment,
                                "financials.revenue"
                            )
                        )
                    )}

                    ${metric(
                        "Revenue Growth",
                        formatPercent(
                            getValue(
                                investment,
                                "quality.revenueGrowth"
                            )
                        )
                    )}

                    ${metric(
                        "EPS",
                        formatNumber(
                            getValue(
                                investment,
                                "financials.eps"
                            )
                        )
                    )}

                    ${metric(
                        "EPS Growth",
                        formatPercent(
                            getValue(
                                investment,
                                "quality.epsGrowth"
                            )
                        )
                    )}

                    ${metric(
                        "Free Cash Flow",
                        formatNumber(
                            getValue(
                                investment,
                                "quality.freeCashFlow"
                            )
                        )
                    )}

                    ${metric(
                        "ROE",
                        formatPercent(
                            getValue(
                                investment,
                                "quality.roe"
                            )
                        )
                    )}

                    ${metric(
                        "ROIC",
                        formatPercent(
                            getValue(
                                investment,
                                "quality.roic"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- VALUATION -->

            <section class="detail-section">

                <div class="section-title">
                    Valuation
                </div>

                <div class="metric-grid">

                    ${metric(
                        "P/E",
                        formatNumber(
                            getValue(
                                investment,
                                "valuation.pe"
                            )
                        )
                    )}

                    ${metric(
                        "PEG",
                        formatNumber(
                            getValue(
                                investment,
                                "valuation.peg"
                            )
                        )
                    )}

                    ${metric(
                        "EV / EBITDA",
                        formatNumber(
                            getValue(
                                investment,
                                "valuation.evEbitda"
                            )
                        )
                    )}

                    ${metric(
                        "Price / FCF",
                        formatNumber(
                            getValue(
                                investment,
                                "valuation.priceToFcf"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- OWNERSHIP -->

            <section class="detail-section">

                <div class="section-title">
                    Ownership
                </div>

                <div class="metric-grid">

                    ${metric(
                        "Promoter Holding",
                        formatPercent(
                            getValue(
                                investment,
                                "ownership.promoterHolding"
                            )
                        )
                    )}

                    ${metric(
                        "Promoter Change",
                        formatPercent(
                            getValue(
                                investment,
                                "ownership.promoterChange"
                            )
                        )
                    )}

                    ${metric(
                        "Promoter Pledge",
                        formatPercent(
                            getValue(
                                investment,
                                "ownership.promoterPledge"
                            )
                        )
                    )}

                    ${metric(
                        "Institutional Change",
                        formatPercent(
                            getValue(
                                investment,
                                "ownership.institutionalChange"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- PSYCHOLOGY -->

            <section class="detail-section">

                <div class="section-title">
                    Investment Psychology
                </div>

                <div class="metric-grid">

                    ${metric(
                        "Margin of Safety",
                        formatNumber(
                            getValue(
                                investment,
                                "psychology.marginOfSafety"
                            )
                        )
                    )}

                    ${metric(
                        "Market Sentiment",
                        formatNumber(
                            getValue(
                                investment,
                                "psychology.sentiment"
                            )
                        )
                    )}

                    ${metric(
                        "Business Cycle",
                        formatNumber(
                            getValue(
                                investment,
                                "psychology.cycle"
                            )
                        )
                    )}

                    ${metric(
                        "Quality at Price",
                        formatNumber(
                            getValue(
                                investment,
                                "psychology.qualityAtPrice"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- BUY ZONE -->

            <section class="detail-section">

                <div class="section-title">
                    Price Strategy
                </div>

                <div class="price-strategy">

                    ${metric(
                        "Fair Value",
                        formatNumber(
                            getValue(
                                investment,
                                "priceStrategy.fairValue"
                            )
                        )
                    )}

                    ${metric(
                        "Buy Zone",
                        formatNumber(
                            getValue(
                                investment,
                                "priceStrategy.buyZone"
                            )
                        )
                    )}

                    ${metric(
                        "Strong Opportunity",
                        formatNumber(
                            getValue(
                                investment,
                                "priceStrategy.strongBuy"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- INVESTMENT VIEW -->

            <section class="detail-section">

                <div class="section-title">
                    Investment View
                </div>

                <p class="investment-thesis">
                    ${
                        investment.thesis ||
                        "Investment thesis will appear here once sufficient data is available."
                    }
                </p>

            </section>

        </div>
    `;
}
