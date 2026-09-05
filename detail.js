/*
 * INVESTMENT RADAR
 * Investment Detail View
 */

window.openInvestmentByTicker = function(ticker) {

    const data = marketData[currentMarket];

    if (!data || !data.stocks) {
        return;
    }

    const investment =
        data.stocks.find(item => item.ticker === ticker);

    if (!investment) {
        return;
    }

    const scored =
        scoreInvestment(investment);

    const radar =
        document.getElementById("radarView");

    const detail =
        document.getElementById("detailView");


    radar.style.display = "none";

    detail.style.display = "block";


    const f = investment.fundamentals || {};
    const v = investment.valuation || {};
    const o = investment.ownership || {};
    const t = investment.technical || {};
    const a = investment.analysis || {};


    detail.innerHTML = `

        <button
            class="back-button"
            onclick="closeInvestmentDetail()"
        >
            ← Back to Radar
        </button>


        <section class="detail-header">

            <div>

                <div class="detail-market">
                    ${currentMarket} · ${investment.type || "Investment"}
                </div>

                <h1>
                    ${investment.name}
                </h1>

                <p>
                    ${investment.ticker}
                </p>

            </div>


            <div class="detail-score">

                <div class="big-score">
                    ${scored.score}
                </div>

                <div>
                    ${scored.verdict}
                </div>

            </div>

        </section>


        <section class="detail-section">

            <div class="section-title">
                Price & Valuation
            </div>

            <div class="metric-grid">

                <div class="metric">
                    <span class="metric-label">
                        Current Price
                    </span>
                    <span class="metric-value">
                        ${investment.price || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        P/E
                    </span>
                    <span class="metric-value">
                        ${v.pe || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Forward P/E
                    </span>
                    <span class="metric-value">
                        ${v.forwardPE || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        PEG
                    </span>
                    <span class="metric-value">
                        ${v.peg || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Price / Sales
                    </span>
                    <span class="metric-value">
                        ${v.priceToSales || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Price / Book
                    </span>
                    <span class="metric-value">
                        ${v.priceToBook || "—"}
                    </span>
                </div>

            </div>

        </section>


        <section class="detail-section">

            <div class="section-title">
                Business Fundamentals
            </div>

            <div class="metric-grid">

                <div class="metric">
                    <span class="metric-label">
                        Revenue Growth — 5Y
                    </span>
                    <span class="metric-value">
                        ${f.revenueGrowth5Y || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        EPS Growth — 5Y
                    </span>
                    <span class="metric-value">
                        ${f.epsGrowth5Y || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Profit Margin
                    </span>
                    <span class="metric-value">
                        ${f.profitMargin || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        ROE
                    </span>
                    <span class="metric-value">
                        ${f.roe || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        ROIC
                    </span>
                    <span class="metric-value">
                        ${f.roic || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Debt / Equity
                    </span>
                    <span class="metric-value">
                        ${f.debtToEquity || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Free Cash Flow
                    </span>
                    <span class="metric-value">
                        ${f.freeCashFlow || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        FCF Growth — 5Y
                    </span>
                    <span class="metric-value">
                        ${f.fcfGrowth5Y || "—"}%
                    </span>
                </div>

            </div>

        </section>


        <section class="detail-section">

            <div class="section-title">
                Ownership & Big Investors
            </div>

            <div class="metric-grid">

                <div class="metric">
                    <span class="metric-label">
                        Insider / Promoter Holding
                    </span>
                    <span class="metric-value">
                        ${o.insiderHolding || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Institutional Holding
                    </span>
                    <span class="metric-value">
                        ${o.institutionalHolding || "—"}%
                    </span>
                </div>

            </div>


            <br>


            <div class="section-title">
                Recent Major Investors
            </div>

            <p class="investment-thesis">

                ${
                    o.recentBigInvestors &&
                    o.recentBigInvestors.length
                    ? o.recentBigInvestors.join(", ")
                    : "No investor data available yet."
                }

            </p>

        </section>


        <section class="detail-section">

            <div class="section-title">
                Investment Price Map
            </div>

            <div class="metric-grid">

                <div class="metric">
                    <span class="metric-label">
                        Fair Value
                    </span>
                    <span class="metric-value">
                        ${a.fairValue || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Buy Price
                    </span>
                    <span class="metric-value">
                        ${a.buyPrice || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Strong Buy Price
                    </span>
                    <span class="metric-value">
                        ${a.strongBuyPrice || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        Margin of Safety
                    </span>
                    <span class="metric-value">
                        ${a.marginOfSafety || "—"}%
                    </span>
                </div>

            </div>

        </section>


        <section class="detail-section">

            <div class="section-title">
                Market Behaviour
            </div>

            <div class="metric-grid">

                <div class="metric">
                    <span class="metric-label">
                        52 Week High
                    </span>
                    <span class="metric-value">
                        ${t["52WeekHigh"] || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        52 Week Low
                    </span>
                    <span class="metric-value">
                        ${t["52WeekLow"] || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        50 Day Average
                    </span>
                    <span class="metric-value">
                        ${t.sma50 || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        200 Day Average
                    </span>
                    <span class="metric-value">
                        ${t.sma200 || "—"}
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        3 Month Momentum
                    </span>
                    <span class="metric-value">
                        ${t.momentum3M || "—"}%
                    </span>
                </div>

                <div class="metric">
                    <span class="metric-label">
                        6 Month Momentum
                    </span>
                    <span class="metric-value">
                        ${t.momentum6M || "—"}%
                    </span>
                </div>

            </div>

        </section>

    `;
};


window.closeInvestmentDetail = function() {

    document.getElementById("detailView").style.display =
        "none";

    document.getElementById("radarView").style.display =
        "block";

};
