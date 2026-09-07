/*
 * INVESTMENT RADAR
 * Valuation Engine
 *
 * Produces:
 * Fair Value
 * Buy Price
 * Strong Buy Price
 * Margin of Safety
 */

function calculateValuation(stock) {

    const price = Number(stock.price) || 0;

    const f = stock.fundamentals || {};
    const v = stock.valuation || {};

    const revenueGrowth = Number(f.revenueGrowth5Y) || 0;
    const epsGrowth = Number(f.epsGrowth5Y) || 0;
    const pe = Number(v.pe) || 0;
    const forwardPE = Number(v.forwardPE) || 0;


    /*
     * We deliberately use multiple methods.
     * A single formula can produce misleading
     * results for different types of companies.
     */

    let estimates = [];


    /* ==============================
       METHOD 1
       Growth-adjusted valuation
    ============================== */

    if (epsGrowth > 0 && pe > 0) {

        const sustainableGrowth =
            Math.min(epsGrowth, 30);

        const reasonablePE =
            Math.max(
                12,
                Math.min(
                    30,
                    sustainableGrowth * 1.2
                )
            );

        const growthValue =
            price *
            (reasonablePE / pe);

        if (growthValue > 0) {
            estimates.push(growthValue);
        }
    }


    /* ==============================
       METHOD 2
       Forward P/E normalization
    ============================== */

    if (forwardPE > 0 && price > 0) {

        let targetPE = 20;

        if (revenueGrowth >= 20) {
            targetPE = 28;
        } else if (revenueGrowth >= 10) {
            targetPE = 24;
        } else if (revenueGrowth >= 5) {
            targetPE = 20;
        } else {
            targetPE = 16;
        }

        const forwardValue =
            price *
            (targetPE / forwardPE);

        if (forwardValue > 0) {
            estimates.push(forwardValue);
        }
    }


    /* ==============================
       FALLBACK
    ============================== */

    let fairValue = price;

    if (estimates.length > 0) {

        fairValue =
            estimates.reduce(
                (sum, value) => sum + value,
                0
            ) / estimates.length;
    }


    /*
     * Prevent extreme estimates from
     * dominating the model.
     */

    fairValue =
        Math.max(
            price * 0.50,
            Math.min(
                price * 2.00,
                fairValue
            )
        );


    /* ==============================
       BUY LEVELS
    ============================== */

    const buyPrice =
        fairValue * 0.85;

    const strongBuyPrice =
        fairValue * 0.70;


    /* ==============================
       MARGIN OF SAFETY
    ============================== */

    const marginOfSafety =
        ((fairValue - price) / fairValue) * 100;


    return {

        fairValue: Number(fairValue.toFixed(2)),

        buyPrice: Number(buyPrice.toFixed(2)),

        strongBuyPrice:
            Number(strongBuyPrice.toFixed(2)),

        marginOfSafety:
            Number(marginOfSafety.toFixed(1))
    };
}
