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


/* ================================
   LOAD DATA
================================ */

async function loadMarketData() {

    try {

        const canadaResponse =
            await fetch("data/canada.json");

        const indiaResponse =
            await fetch("data/india.json");

        marketData.Canada =
            await canadaResponse.json();

        marketData.India =
            await indiaResponse.json();

        renderRadar();

    } catch (error) {

        console.error("Unable to load investment data:", error);

        document.getElementById("investments").innerHTML = `
            <div class="investment">
                <div class="investment-info">
                    <h3>Data loading error</h3>
                    <p>Please refresh the page and try again.</p>
                </div>
            </div>
        `;
    }
}


/* ================================
   MARKET SELECTION
================================ */

window.selectMarket = function(newMarket, button) {

    currentMarket = newMarket;

    document
        .querySelectorAll(".market-btn")
        .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");

    renderRadar();
};


/* ================================
   VIEW SELECTION
================================ */

window.selectView = function(newView, button) {

    currentView = newView;

    document
        .querySelectorAll(".view-btn")
        .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");

    renderRadar();
};


/* ================================
   GET INVESTMENTS
================================ */

function getInvestments() {

    const data = marketData[currentMarket];

    if (!data) {
        return [];
    }

    /*
     * For now we use stocks.
     *
     * Later this will combine:
     * stocks + ETFs + mutual funds
     * and apply the appropriate
     * scoring model to each.
     */

    return data.stocks || [];
}


/* ================================
   SCORE INVESTMENT
================================ */

function scoreInvestment(investment) {

    let score;

    if (currentView === "Long Term") {

        score = longTermScore(investment);

    } else {

        score = shortTermScore(investment);

    }

    const dataQuality =
    getDataQualityReport(investment);

return {
    ...investment,
    score: score,
    verdict: getVerdict(score),
    dataQuality: dataQuality
};
}


/* ================================
   RENDER RADAR
================================ */

window.renderRadar = function() {

    const data = marketData[currentMarket];

    if (!data) {
        return;
    }

    const investments =
        getInvestments()
            .map(scoreInvestment)
            .sort((a, b) => b.score - a.score);


    /* PAGE TITLE */

    document.getElementById("pageTitle").textContent =
        `${currentMarket} ${currentView} Radar`;


    /* DESCRIPTION */

    if (currentView === "Long Term") {

        document.getElementById("pageDescription").textContent =
            "Finding high-quality investments with attractive fundamentals, valuation and margin of safety.";

    } else {

        document.getElementById("pageDescription").textContent =
            "Finding investments with strong momentum, valuation, market behaviour and near-term opportunity.";
    }


    /* STOCK COUNT */

    document.getElementById("stockCount").textContent =
        investments.length;


    /* CANDIDATES */

    document.getElementById("candidateCount").textContent =
        investments.filter(item => item.score >= 80).length;


    /* INVESTMENT LIST */

    const container =
        document.getElementById("investments");

    container.innerHTML = "";


    if (investments.length === 0) {

        container.innerHTML = `
            <div class="investment">

                <div class="investment-info">

                    <h3>No investments loaded yet</h3>

                    <p>
                        Our investment database is being built.
                        Real Canadian and Indian securities will
                        be added next.
                    </p>

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


        container.innerHTML += `

            <div class="investment">

                <div class="investment-info">

                    <h3>${item.name}</h3>

                    <p>${item.ticker}</p>

                    <span class="badge ${badgeClass}">
                        ${item.verdict}
                    </span>

                </div>

                <div class="score">
                    ${item.score}
                </div>

            </div>

        `;
    });
};


/* ================================
   START APPLICATION
================================ */

loadMarketData();
