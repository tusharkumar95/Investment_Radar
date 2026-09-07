/*
 * INVESTMENT RADAR
 * Investment Detail View
 */

function displayValue(value, suffix = "") {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
        return "—";
    }

    return `${value}${suffix}`;
}

function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "—";
    }

    return n.toFixed(decimals);
}

function formatMoney(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "—";
    }

    return n.toFixed(2);
}

function getValuationStatusClass(status) {
    if (!status) return "yellow";

    const text = String(status).toLowerCase();

    if (
        text.includes("exceptional") ||
        text.includes("attractive") ||
        text.includes("undervalued")
    ) {
        return "green";
    }

    if (
        text.includes("expensive") ||
        text.includes("overvalued")
    ) {
        return "red";
    }

    return "yellow";
}

function buildScoreBar(label, score) {

    const value = Number(score);

    if (!Number.isFinite(value)) {
        return "";
    }

    const safeScore = Math.max(0, Math.min(100, value));

    return `
        <div style="margin-bottom:14px;">

            <div style="
                display:flex;
                justify-content:space-between;
                margin-bottom:5px;
            ">
                <span>${label}</span>
                <strong>${Math.round(safeScore)}/100</strong>
            </div>

            <div style="
                width:100%;
                height:8px;
                background:#e5e7eb;
                border-radius:10px;
                overflow:hidden;
            ">
                <div style="
                    width:${safeScore}%;
                    height:100%;
                    background:currentColor;
                    border-radius:10px;
                "></div>
            </div>

        </div>
    `;
}


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


    /*
     * Attach valuation and psychology analysis
     * to a local enriched version of the investment.
     */

    const valuation =
        calculateValuation(investment);

    const enrichedInvestment = {
        ...investment,
        analysis: valuation
    };

    const psychology =
        psychologyAnalysis(enrichedInvestment);

    const scored =
        scoreInvestment(enrichedInvestment);


    const radar =
        document.getElementById("radarView");

    const detail =
        document.getElementById("detailView");


    if (!radar || !detail) {
        return;
    }


    radar.style.display = "none";
    detail.style.display = "block";


    const f = investment.fundamentals || {};
    const v = investment.valuation || {};
    const o = investment.ownership || {};
    const t = investment.technical || {};


    const fairLow =
        valuation.fairValueLow ??
        valuation.fairValueLower ??
        null;

    const fairHigh =
        valuation.fairValueHigh ??
        valuation.fairValueUpper ??
        null;

    const fairValue =
        valuation.fairValue ??
        null;

    const buyPrice =
        valuation.buyPrice ??
        null;

    const strongBuyPrice =
        valuation.strongBuyPrice ??
        null;

    const marginOfSafety =
        valuation.marginOfSafety ??
        null;

    const valuationStatus =
        valuation.valuationStatus ??
        valuation.status ??
        "—";


    const qualityScore =
        psychology.qualityScore ?? 0;

    const valuationScore =
        psychology.valuationScore ?? 0;

    const riskScore =
        psychology.riskScore ?? 0;

    const disciplineScore =
        psychology.disciplineScore ?? 0;

    const ownershipScore =
        psychology.ownershipScore ?? 0;


    /*
     * Determine whether current price is above/below
     * the calculated fair-value range.
     */

    let pricePosition = "—";

    const currentPrice = Number(investment.price);

    if (
        Number.isFinite(currentPrice) &&
        Number.isFinite(Number(fairLow)) &&
        Number.isFinite(Number(fairHigh))
    ) {

        if (currentPrice < Number(fairLow)) {
            pricePosition = "Below Fair Value";
        } else if (currentPrice > Number(fairHigh)) {
            pricePosition = "Above Fair Value";
        } else {
            pricePosition = "Within Fair Value";
        }
    }


    detail.innerHTML = `

        <button
            class="back-button"
            onclick="closeInvestmentDetail()"
        >
            ← Back to Radar
        </button>


        <!-- HEADER -->

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
                    ${Math.round(scored.score)}
                </div>

                <div>
                    ${scored.verdict}
                </div>

            </div>

        </section>


        <!-- INVESTMENT DECISION -->

        <section class="detail-section">

            <div class="section-title">
                Investment Decision
            </div>

            <div class="metric-grid">

                <div class="metric">

                    <span class="metric-label">
                        Radar Score
                    </span>

                    <span class="metric-value">
                        ${Math.round(scored.score)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Verdict
                    </span>

                    <span class="metric-value">
                        ${scored.verdict}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Psychology Score
                    </span>

                    <span class="metric-value">
                        ${Math.round(psychology.score)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Data Confidence
                    </span>

                    <span class="metric-value">
                        ${
                            scored.dataQuality
                            ? Math.round(scored.dataQuality.confidence)
                            : "—"
                        }%
                    </span>

                </div>

            </div>


            <p class="investment-thesis">
                ${psychology.reason || "No investment thesis available yet."}
            </p>

        </section>


        <!-- WHY THIS SCORED -->

        <section class="detail-section">

            <div class="section-title">
                Why This Investment Scored This Way
            </div>


            ${buildScoreBar("Business Quality", qualityScore)}

            ${buildScoreBar("Valuation", valuationScore)}

            ${buildScoreBar(
                "Risk Management",
                100 - Number(riskScore || 0)
            )}

            ${buildScoreBar("Ownership", ownershipScore)}

            ${buildScoreBar("Discipline", disciplineScore)}


            <p class="investment-thesis">

                The score combines business quality,
                valuation, growth, market behaviour,
                ownership, income and investment psychology.

            </p>

        </section>


        <!-- PRICE & VALUATION -->

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
                        ${formatMoney(investment.price)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Valuation Status
                    </span>

                    <span class="metric-value">
                        ${valuationStatus}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Price Position
                    </span>

                    <span class="metric-value">
                        ${pricePosition}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Fair Value
                    </span>

                    <span class="metric-value">
                        ${formatMoney(fairValue)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Fair Value — Low
                    </span>

                    <span class="metric-value">
                        ${formatMoney(fairLow)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Fair Value — High
                    </span>

                    <span class="metric-value">
                        ${formatMoney(fairHigh)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Attractive Entry
                    </span>

                    <span class="metric-value">
                        ${formatMoney(buyPrice)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Strong Opportunity
                    </span>

                    <span class="metric-value">
                        ${formatMoney(strongBuyPrice)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Margin of Safety
                    </span>

                    <span class="metric-value">
                        ${
                            marginOfSafety === null ||
                            marginOfSafety === undefined
                            ? "—"
                            : `${formatNumber(marginOfSafety)}%`
                        }
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        P/E
                    </span>

                    <span class="metric-value">
                        ${displayValue(v.pe)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Forward P/E
                    </span>

                    <span class="metric-value">
                        ${displayValue(v.forwardPE)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        PEG
                    </span>

                    <span class="metric-value">
                        ${displayValue(v.peg)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Price / Sales
                    </span>

                    <span class="metric-value">
                        ${displayValue(v.priceToSales)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Price / Book
                    </span>

                    <span class="metric-value">
                        ${displayValue(v.priceToBook)}
                    </span>

                </div>

            </div>

        </section>


        <!-- FUNDAMENTALS -->

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
                        ${displayValue(f.revenueGrowth5Y, "%")}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        Revenue Growth — 3Y
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.revenueGrowth3Y, "%")}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        EPS Growth — 5Y
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.epsGrowth5Y, "%")}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        Profit Margin
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.profitMargin, "%")}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        ROE
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.roe, "%")}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        ROIC
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.roic, "%")}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        Debt / Equity
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.debtToEquity)}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        Free Cash Flow
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.freeCashFlow)}
                    </span>
                </div>


                <div class="metric">
                    <span class="metric-label">
                        FCF Growth — 5Y
                    </span>
                    <span class="metric-value">
                        ${displayValue(f.fcfGrowth5Y, "%")}
                    </span>
                </div>

            </div>

        </section>


        <!-- OWNERSHIP -->

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
                        ${displayValue(o.insiderHolding, "%")}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Promoter Holding
                    </span>

                    <span class="metric-value">
                        ${displayValue(o.promoterHolding, "%")}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Promoter Change
                    </span>

                    <span class="metric-value">
                        ${displayValue(o.promoterChange, "%")}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Promoter Pledge
                    </span>

                    <span class="metric-value">
                        ${displayValue(o.promoterPledge, "%")}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Institutional Holding
                    </span>

                    <span class="metric-value">
                        ${displayValue(o.institutionalHolding, "%")}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Institutional Change
                    </span>

                    <span class="metric-value">
                        ${displayValue(o.institutionalChange, "%")}
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
                    : "No major investor activity data available yet."
                }

            </p>

        </section>


        <!-- MARKET BEHAVIOUR -->

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
                        ${
                            t.high52Week ??
                            t["52WeekHigh"] ??
                            "—"
                        }
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        52 Week Low
                    </span>

                    <span class="metric-value">
                        ${
                            t.low52Week ??
                            t["52WeekLow"] ??
                            "—"
                        }
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        50 Day Average
                    </span>

                    <span class="metric-value">
                        ${displayValue(t.sma50)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        200 Day Average
                    </span>

                    <span class="metric-value">
                        ${displayValue(t.sma200)}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        3 Month Momentum
                    </span>

                    <span class="metric-value">
                        ${displayValue(t.momentum3M, "%")}
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        6 Month Momentum
                    </span>

                    <span class="metric-value">
                        ${displayValue(t.momentum6M, "%")}
                    </span>

                </div>

            </div>

        </section>


        <!-- PSYCHOLOGY -->

        <section class="detail-section">

            <div class="section-title">
                Investment Psychology
            </div>


            <div class="metric-grid">

                <div class="metric">

                    <span class="metric-label">
                        Business Quality
                    </span>

                    <span class="metric-value">
                        ${Math.round(qualityScore)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Valuation
                    </span>

                    <span class="metric-value">
                        ${Math.round(valuationScore)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Risk
                    </span>

                    <span class="metric-value">
                        ${Math.round(riskScore)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Ownership
                    </span>

                    <span class="metric-value">
                        ${Math.round(ownershipScore)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Discipline
                    </span>

                    <span class="metric-value">
                        ${Math.round(disciplineScore)}/100
                    </span>

                </div>


                <div class="metric">

                    <span class="metric-label">
                        Overall Psychology
                    </span>

                    <span class="metric-value">
                        ${Math.round(psychology.score)}/100
                    </span>

                </div>

            </div>


            <p class="investment-thesis">

                ${psychology.reason ||
                "Quality, valuation, risk, ownership and discipline are evaluated using the investment framework."}

            </p>

        </section>


        <!-- STRENGTHS & RISKS -->

        <section class="detail-section">

            <div class="section-title">
                Strengths & Risks
            </div>


            <p class="investment-thesis">

                <strong>Strengths</strong><br>

                ${
                    psychology.qualityScore >= 70
                    ? "Strong business-quality characteristics."
                    : "Business quality is not yet a major strength based on available data."
                }

                <br><br>

                ${
                    valuationScore >= 70
                    ? "Valuation currently provides a favourable setup."
                    : "Valuation is not currently providing a strong margin of safety."
                }

                <br><br>

                ${
                    Number(f.revenueGrowth5Y) > 10
                    ? "Healthy long-term revenue growth."
                    : "Long-term revenue growth is currently moderate or unavailable."
                }

                <br><br>


                <strong>Risks</strong><br>

                ${
                    riskScore >= 60
                    ? "Risk indicators require attention."
                    : "No major risk signal is currently dominating the psychology score."
                }

                <br><br>

                ${
                    Number(f.debtToEquity) > 1
                    ? "Debt/equity is relatively elevated."
                    : "Debt/equity does not currently appear elevated."
                }

                <br><br>

                ${
                    currentPrice > Number(fairHigh)
                    ? "Current price is above the calculated fair-value range."
                    : "Current price is not above the calculated fair-value range."
                }

            </p>

        </section>

    `;
};


window.closeInvestmentDetail = function() {

    const detail =
        document.getElementById("detailView");

    const radar =
        document.getElementById("radarView");

    if (detail) {
        detail.style.display = "none";
    }

    if (radar) {
        radar.style.display = "block";
    }

};
