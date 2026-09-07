import json
from pathlib import Path
from datetime import datetime, timezone

import yfinance as yf


DATA_DIR = Path("data")


# ==========================================
# HELPERS
# ==========================================

def safe_number(value, default=0):
    try:
        if value is None:
            return default

        number = float(value)

        if number != number:
            return default

        return round(number, 2)

    except Exception:
        return default


def percent(value):
    if value is None:
        return 0

    return safe_number(float(value) * 100)


def get_growth(financials, row_name, years=5):

    try:

        if row_name not in financials.index:
            return 0

        row = financials.loc[row_name].dropna()

        if len(row) < 2:
            return 0

        newest = float(row.iloc[0])
        oldest = float(row.iloc[-1])

        if newest <= 0 or oldest <= 0:
            return 0

        periods = min(len(row) - 1, years)

        growth = (
            (newest / oldest) ** (1 / periods) - 1
        ) * 100

        return safe_number(growth)

    except Exception:
        return 0


def get_fcf_growth(financials):

    try:

        if "Free Cash Flow" not in financials.index:
            return 0

        row = financials.loc["Free Cash Flow"].dropna()

        if len(row) < 2:
            return 0

        newest = float(row.iloc[0])
        oldest = float(row.iloc[-1])

        if newest <= 0 or oldest <= 0:
            return 0

        periods = len(row) - 1

        growth = (
            (newest / oldest) ** (1 / periods) - 1
        ) * 100

        return safe_number(growth)

    except Exception:
        return 0


# ==========================================
# STOCK DATA
# ==========================================

def get_stock_data(ticker_symbol, name, currency):

    print(f"Updating {ticker_symbol}...")

    ticker = yf.Ticker(ticker_symbol)

    info = ticker.info

    history = ticker.history(
        period="1y",
        auto_adjust=False
    )

    if history.empty:
        raise Exception(
            f"No market data returned for {ticker_symbol}"
        )

    current_price = float(
        history["Close"].iloc[-1]
    )

    high_52 = float(
        history["High"].max()
    )

    low_52 = float(
        history["Low"].min()
    )


    # ==========================================
    # MOVING AVERAGES
    # ==========================================

    history["SMA50"] = (
        history["Close"]
        .rolling(50)
        .mean()
    )

    history["SMA200"] = (
        history["Close"]
        .rolling(200)
        .mean()
    )

    sma50 = history["SMA50"].iloc[-1]
    sma200 = history["SMA200"].iloc[-1]


    # ==========================================
    # MOMENTUM
    # ==========================================

    momentum_3m = 0
    momentum_6m = 0

    if len(history) >= 63:

        old_price = float(
            history["Close"].iloc[-63]
        )

        if old_price > 0:

            momentum_3m = (
                current_price / old_price - 1
            ) * 100


    if len(history) >= 126:

        old_price = float(
            history["Close"].iloc[-126]
        )

        if old_price > 0:

            momentum_6m = (
                current_price / old_price - 1
            ) * 100


    # ==========================================
    # FINANCIAL STATEMENTS
    # ==========================================

    financials = ticker.financials

    revenue_growth_5y = get_growth(
        financials,
        "Total Revenue",
        5
    )

    revenue_growth_3y = get_growth(
        financials,
        "Total Revenue",
        3
    )

    fcf_growth_5y = get_fcf_growth(
        financials
    )


    # ==========================================
    # VALUATION
    # ==========================================

    pe = info.get("trailingPE")

    forward_pe = info.get("forwardPE")

    peg = info.get("pegRatio")

    price_to_sales = (
        info.get(
            "priceToSalesTrailing12Months"
        )
    )

    price_to_book = info.get(
        "priceToBook"
    )


    # ==========================================
    # FUNDAMENTALS
    # ==========================================

    profit_margin = info.get(
        "profitMargins"
    )

    roe = info.get(
        "returnOnEquity"
    )

    debt_to_equity = info.get(
        "debtToEquity"
    )

    free_cash_flow = info.get(
        "freeCashflow"
    )


    # ==========================================
    # OWNERSHIP
    # ==========================================

    insider_holding = info.get(
        "heldPercentInsiders"
    )

    institutional_holding = info.get(
        "heldPercentInstitutions"
    )


    # ==========================================
    # RESULT
    # ==========================================

    result = {

        "ticker": ticker_symbol,

        "name": name,

        "type": "stock",

        "currency": currency,

        "price": safe_number(
            current_price
        ),


        "fundamentals": {

            "revenueGrowth5Y":
                safe_number(
                    revenue_growth_5y
                ),

            "revenueGrowth3Y":
                safe_number(
                    revenue_growth_3y
                ),

            "epsGrowth5Y":
                percent(
                    info.get(
                        "earningsGrowth"
                    )
                ),

            "profitMargin":
                percent(
                    profit_margin
                ),

            "roe":
                percent(
                    roe
                ),

            "roic": 0,

            "debtToEquity":
                safe_number(
                    debt_to_equity
                ),

            "freeCashFlow":
                safe_number(
                    free_cash_flow
                ),

            "fcfGrowth5Y":
                safe_number(
                    fcf_growth_5y
                )
        },


        "valuation": {

            "pe":
                safe_number(pe),

            "forwardPE":
                safe_number(forward_pe),

            "peg":
                safe_number(peg),

            "priceToSales":
                safe_number(
                    price_to_sales
                ),

            "priceToBook":
                safe_number(
                    price_to_book
                )
        },


        "ownership": {

            "insiderHolding":
                percent(
                    insider_holding
                ),

            "institutionalHolding":
                percent(
                    institutional_holding
                ),

            "recentBigInvestors": []
        },


        "technical": {

            "52WeekHigh":
                safe_number(
                    high_52
                ),

            "52WeekLow":
                safe_number(
                    low_52
                ),

            "sma50":
                safe_number(
                    sma50
                ),

            "sma200":
                safe_number(
                    sma200
                ),

            "momentum3M":
                safe_number(
                    momentum_3m
                ),

            "momentum6M":
                safe_number(
                    momentum_6m
                )
        },


        "analysis": {

            "fairValue": 0,

            "buyPrice": 0,

            "strongBuyPrice": 0,

            "marginOfSafety": 0
        }

    }

    return result


# ==========================================
# MARKET UPDATE
# ==========================================

def update_market(
    filename,
    market,
    currency
):

    file_path = DATA_DIR / filename

    print(
        f"\nUpdating {market}..."
    )

    with open(
        file_path,
        "r",
        encoding="utf-8"
    ) as file:

        existing_data = json.load(file)


    stocks = existing_data.get(
        "stocks",
        []
    )


    updated_stocks = []


    for stock in stocks:

        ticker = stock.get(
            "ticker"
        )

        name = stock.get(
            "name",
            ticker
        )

        if not ticker:
            continue


        try:

            updated_stock = get_stock_data(
                ticker,
                name,
                currency
            )

            updated_stocks.append(
                updated_stock
            )

            print(
                f"✓ {ticker}"
            )

        except Exception as error:

            print(
                f"✗ {ticker}: {error}"
            )

            # Preserve existing data if
            # the live source fails.

            updated_stocks.append(
                stock
            )


    output = {

        "market": market,

        "currency": currency,

        "lastUpdated":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "stocks":
            updated_stocks,

        "etfs":
            existing_data.get(
                "etfs",
                []
            ),

        "mutualFunds":
            existing_data.get(
                "mutualFunds",
                []
            )
    }


    with open(
        file_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            output,
            file,
            indent=2,
            ensure_ascii=False
        )


    print(
        f"{market} updated: "
        f"{len(updated_stocks)} stocks"
    )


# ==========================================
# MAIN
# ==========================================

def main():

    update_market(
        "canada.json",
        "Canada",
        "CAD"
    )

    update_market(
        "india.json",
        "India",
        "INR"
    )

    print(
        "\nInvestment Radar data "
        "updated successfully."
    )


if __name__ == "__main__":

    main()
