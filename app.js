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
   LOAD DATA
========================================= */

async function loadMarketData() {

    try {

        const canadaResponse =
            await fetch("data/canada.json");

        const indiaResponse =
            await fetch("data/india.json");


        if (!canadaResponse.ok) {

            throw new Error(
                "Canada data could not be loaded."
            );

        }


        if (!indiaResponse.ok) {

            throw new Error(
                "India data could not be loaded."
            );

        }


        marketData.Canada =
            await canadaResponse.json();

        marketData.India =
            await indiaResponse.json();


        renderRadar();

    }

    catch (error) {

        console.error(
            "Unable to load investment data:",
            error
        );


        const container =
            document.getElementById(
                "investments"
            );


        if (container) {

            container.innerHTML = `

                <div class="investment">

                    <div class="investment-info">

                        <h3>
                            Data loading error
                        </h3>

                        <p>
                            ${error.message}
                        </p>

                    </div>

                </div>

            `;

        }

    }

}


/* =========================================
   MARKET SELECTION
========================================= */

window.selectMarket = function(
    newMarket,
    button
) {

    currentMarket = newMarket;


    document
        .querySelectorAll(".market-btn")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );

        });


    button.classList.add("active");


    renderRadar();

};


/* =========================================
   VIEW SELECTION
========================================= */

window.selectView = function(
    newView,
    button
) {

    currentView = newView;


    document
        .querySelectorAll(".view-btn")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );

        });


    button.classList.add("active");


    renderRadar();

};


/* =========================================
   GET INVESTMENTS
========================================= */

function getInvestments() {

    const data =
        marketData[currentMarket];


    if (!data) {

        return [];

    }


    return data.stocks || [];

}


/* =========================================
   SCORE INVESTMENT
========================================= */

function scoreInvestment(
    investment
) {

    let score;


    if (
        currentView === "Long Term"
    ) {

        score =
            longTermScore(
                investment
            );

    }

    else {

        score =
            shortTermScore(
                investment
            );

    }


    const dataQuality =
        getDataQualityReport(
            investment
        );


    return {

        ...investment,

        score: score,

        verdict:
            getVerdict(score),

        dataQuality:
            dataQuality

    };

}


/* =========================================
   RENDER RADAR
========================================= */

window.renderRadar = function() {

    const data =
        marketData[currentMarket];


    if (!data) {

        return;

    }


    const investments =

        getInvestments()

            .map(
                scoreInvestment
            )

            .sort(
                (a, b) =>
                    b.score - a.score
            );


    /* PAGE TITLE */

    document
        .getElementById(
            "pageTitle"
        )
        .textContent =
            `${currentMarket} ${currentView} Radar`;


    /* PAGE DESCRIPTION */

    document
        .getElementById(
            "pageDescription"
        )
        .textContent =

        currentView === "Long Term"

            ? "Finding high-quality investments with attractive fundamentals, valuation and margin of safety."

            : "Finding investments with strong momentum, valuation, market behaviour and near-term opportunity.";


    /* STOCK COUNT */

    document
        .getElementById(
            "stockCount"
        )
        .textContent =
            investments.length;


    /* STRONG CANDIDATES */

    document
        .getElementById(
            "candidateCount"
        )
        .textContent =

            investments.filter(
                item =>
                    item.score >= 80
            ).length;


    /* WATCHLIST */

    document
        .getElementById(
            "watchlistCount"
        )
        .textContent =

            investments.filter(
                item =>
                    item.score >= 60 &&
                    item.score < 80
            ).length;


    /* INVESTMENT CONTAINER */

    const container =
        document.getElementById(
            "investments"
        );


    container.innerHTML = "";


    /* NO DATA */

    if (
        investments.length === 0
    ) {

        container.innerHTML = `

            <div class="investment">

                <div class="investment-info">

                    <h3>
                        No investments loaded yet
                    </h3>

                    <p>
                        Our investment database
                        is being built.
                    </p>

                </div>

            </div>

        `;

        return;

    }


    /* CREATE CARDS */

    investments.forEach(
        item => {


            let badgeClass =
                "yellow";


            if (
                item.score >= 85
            ) {

                badgeClass =
                    "green";

            }


            if (
                item.score < 60
            ) {

                badgeClass =
                    "red";

            }


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "investment";


            card.style.cursor =
                "pointer";


            /*
             * Store ticker safely.
             */

            card.dataset.ticker =
                item.ticker;


            card.innerHTML = `

                <div class="investment-info">

                    <h3>
                        ${item.name || "Unknown"}
                    </h3>

                    <p>
                        ${item.ticker || ""}
                    </p>

                    <span
                        class="badge ${badgeClass}"
                    >
                        ${item.verdict || "WATCH"}
                    </span>

                </div>


                <div class="score">

                    ${item.score}

                </div>

            `;


            /*
             * Proper event listener.
             * No inline onclick.
             */

            card.addEventListener(
                "click",
                function() {

                    openInvestmentByTicker(
                        item.ticker
                    );

                }
            );


            container.appendChild(
                card
            );

        }
    );

};


/* =========================================
   START APPLICATION
========================================= */

loadMarketData();
