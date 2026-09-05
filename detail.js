/*
 * INVESTMENT RADAR
 * Investment Detail View
 */


let selectedInvestment = null;


/* =========================================
   OPEN INVESTMENT
========================================= */

window.openInvestmentByTicker =
function(ticker) {


    console.log(
        "Opening investment:",
        ticker
    );


    const investments =
        marketData[currentMarket]?.stocks || [];


    const investment =
        investments.find(
            item =>
                item.ticker === ticker
        );


    if (!investment) {

        console.error(
            "Investment not found:",
            ticker
        );

        return;

    }


    selectedInvestment =
        scoreInvestment(
            investment
        );


    openInvestment(
        selectedInvestment
    );

};


/* =========================================
   OPEN DETAIL VIEW
========================================= */

window.openInvestment =
function(investment) {


    selectedInvestment =
        investment;


    const radar =
        document.getElementById(
            "radarView"
        );


    const detail =
        document.getElementById(
            "detailView"
        );


    if (!radar || !detail) {

        console.error(
            "Radar/detail containers not found."
        );

        return;

    }


    radar.style.display =
        "none";


    detail.style.display =
        "block";


    renderInvestmentDetail(
        investment
    );


    window.scrollTo(
        0,
        0
    );

};


/* =========================================
   CLOSE DETAIL
========================================= */

window.closeInvestment =
function() {


    const radar =
        document.getElementById(
            "radarView"
        );


    const detail =
        document.getElementById(
            "detailView"
        );


    if (!radar || !detail) {

        return;

    }


    detail.style.display =
        "none";


    radar.style.display =
        "block";


    window.scrollTo(
        0,
        0
    );

};


/* =========================================
   SAFE VALUE
========================================= */

function getDetailValue(
    object,
    path
) {


    const parts =
        path.split(".");


    let value =
        object;


    for (
        const part of parts
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return null;

        }


        value =
            value[part];

    }


    return value;

}


/* =========================================
   FORMAT NUMBER
========================================= */

function formatDetailNumber(
    value
) {


    if (
        value === null ||
        value === undefined ||
        value === "" ||
        isNaN(Number(value))
    ) {

        return "—";

    }


    return Number(value)
        .toLocaleString(
            undefined,
            {
                maximumFractionDigits: 2
            }
        );

}


/* =========================================
   FORMAT PERCENT
========================================= */

function formatDetailPercent(
    value
) {


    if (
        value === null ||
        value === undefined ||
        value === "" ||
        isNaN(Number(value))
    ) {

        return "—";

    }


    return `${formatDetailNumber(value)}%`;

}


/* =========================================
   METRIC
========================================= */

function detailMetric(
    label,
    value
) {


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
   RENDER DETAIL
========================================= */

function renderInvestmentDetail(
    investment
) {


    const container =
        document.getElementById(
            "detailView"
        );


    const quality =
        investment.dataQuality || {};


    const confidence =
        quality.confidence || {

            score: 0,

            label: "Unknown"

        };


    const currentPrice =
        getDetailValue(
            investment,
            "price.current"
        );


    container.innerHTML = `

        <div class="detail-container">


            <!-- BACK -->

            <button
                class="back-button"
                id="backToRadar"
            >
                ← Back to Radar
            </button>


            <!-- HEADER -->

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


            <!-- CURRENT PRICE -->

            <section class="detail-section">

                <div class="section-title">
                    Current Price
                </div>

                <div class="current-price">

                    ${formatDetailNumber(
                        currentPrice
                    )}

                </div>

            </section>


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
                    quality.missing.length > 0

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


            <!-- PRICE & MARKET -->

            <section class="detail-section">

                <div class="section-title">
                    Price & Market
                </div>


                <div class="metric-grid">

                    ${detailMetric(
                        "Current Price",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "price.current"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Market Cap",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "price.marketCap"
                            )
                        )
                    )}


                    ${detailMetric(
                        "52W High",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "price.high52w"
                            )
                        )
                    )}


                    ${detailMetric(
                        "52W Low",
                        formatDetailNumber(
                            getDetailValue(
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

                    ${detailMetric(
                        "Revenue",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "financials.revenue"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Revenue Growth",
                        formatDetailPercent(
                            getDetailValue(
                                investment,
                                "quality.revenueGrowth"
                            )
                        )
                    )}


                    ${detailMetric(
                        "EPS",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "financials.eps"
                            )
                        )
                    )}


                    ${detailMetric(
                        "EPS Growth",
                        formatDetailPercent(
                            getDetailValue(
                                investment,
                                "quality.epsGrowth"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Free Cash Flow",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "quality.freeCashFlow"
                            )
                        )
                    )}


                    ${detailMetric(
                        "ROE",
                        formatDetailPercent(
                            getDetailValue(
                                investment,
                                "quality.roe"
                            )
                        )
                    )}


                    ${detailMetric(
                        "ROIC",
                        formatDetailPercent(
                            getDetailValue(
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

                    ${detailMetric(
                        "P/E",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "valuation.pe"
                            )
                        )
                    )}


                    ${detailMetric(
                        "PEG",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "valuation.peg"
                            )
                        )
                    )}


                    ${detailMetric(
                        "EV / EBITDA",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "valuation.evEbitda"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Price / FCF",
                        formatDetailNumber(
                            getDetailValue(
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

                    ${detailMetric(
                        "Promoter Holding",
                        formatDetailPercent(
                            getDetailValue(
                                investment,
                                "ownership.promoterHolding"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Promoter Change",
                        formatDetailPercent(
                            getDetailValue(
                                investment,
                                "ownership.promoterChange"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Promoter Pledge",
                        formatDetailPercent(
                            getDetailValue(
                                investment,
                                "ownership.promoterPledge"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Institutional Change",
                        formatDetailPercent(
                            getDetailValue(
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

                    ${detailMetric(
                        "Margin of Safety",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "psychology.marginOfSafety"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Market Sentiment",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "psychology.sentiment"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Business Cycle",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "psychology.cycle"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Quality at Price",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "psychology.qualityAtPrice"
                            )
                        )
                    )}

                </div>

            </section>


            <!-- PRICE STRATEGY -->

            <section class="detail-section">

                <div class="section-title">
                    Price Strategy
                </div>


                <div class="metric-grid">

                    ${detailMetric(
                        "Fair Value",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "priceStrategy.fairValue"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Buy Zone",
                        formatDetailNumber(
                            getDetailValue(
                                investment,
                                "priceStrategy.buyZone"
                            )
                        )
                    )}


                    ${detailMetric(
                        "Strong Opportunity",
                        formatDetailNumber(
                            getDetailValue(
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


    /* BACK BUTTON */

    document
        .getElementById(
            "backToRadar"
        )
        .addEventListener(
            "click",
            closeInvestment
        );

}
