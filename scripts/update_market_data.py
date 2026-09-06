import json
from pathlib import Path
from datetime import datetime, timezone

import yfinance as yf


DATA_DIR = Path("data")


def safe_number(value, default=0):
    try:
        if value is None:
            return default
        return round(float(value), 2)
    except:
        return default


def get_growth(financials, row_name, years=5):
    try:
        if row_name not in financials.index:
            return 0

        row = financials.loc[row_name].dropna()

        if len(row) < 2:
            return 0

        newest = float(row.iloc[0])
        oldest = float(row.iloc[-1])

        if oldest <= 0 or newest <= 0:
            return 0

        periods = min(len(row) - 1, years)

        growth = ((newest / float(row.iloc[-1])) ** (1 / periods) - 1) * 100

        return round(growth, 2)

    except:
        return 0


def get_stock_data(ticker_symbol, name):

    ticker = yf.Ticker(ticker_symbol)

    info = ticker.info

    history = ticker.history(period="1y")

    if history.empty:
        raise Exception(f"No market data returned for {ticker_symbol}")

    current_price = float(history["Close"].iloc[-1])

    high_52 = float(history["High"].max())
    low_52 = float(history["Low"].min())

    # Moving averages
    history["SMA50"] = history["Close"].rolling(50).mean()
    history["SMA200"] = history["Close"].rolling(200).mean()

    sma50 = history["SMA50"].iloc[-1]
    sma200 = history["SMA200"].iloc[-1]

    # Momentum
    momentum_3m = 0
    momentum_6m = 0

    if len(history) >= 63:
        momentum_3m = (
            (current_price / float(history["Close"].iloc[-63])) - 1
        ) * 100

    if len(history) >= 126:
        momentum_6m = (
            (current_price / float(history["Close"].iloc[-126])) - 1
        ) * 100

    # Financial statements
    financials = ticker.financials

    revenue_growth_5y = get_growth(
        financials,
        "Total Revenue",
        5
    )

    # Valuation
    pe = info.get("trailingPE")
    forward_pe = info.get("forwardPE")
    peg = info.get("pegRatio")

    price_to_sales = info.get("priceToSalesTrailing12Months")
    price_to_book = info.get("priceToBook")

    # Fundamentals
    profit_margin = info.get("profitMargins")
    roe = info.get("returnOnEquity")
    debt_to_equity = info.get("debtToEquity")

    # Convert ratios to percentages where appropriate
    if profit_margin is not None:
        profit_margin = profit_margin * 100

    if roe is not None:
        roe = roe * 100

    result = {
        "ticker": ticker_symbol,
        "name": name,
        "type": "stock",

        "price": safe_number(current_price),

        "fundamentals": {
            "revenueGrowth5Y": safe_number(revenue_growth_5y),
            "revenueGrowth3Y": safe_number(
                info.get("revenueGrowth", 0) * 100
                if info.get("revenueGrowth") is not None
                else 0
            ),
            "epsGrowth5Y": safe_number(
                info.get("earningsGrowth", 0) * 100
                if info.get("earningsGrowth") is not None
                else 0
            ),
            "profitMargin": safe_number(profit_margin),
            "roe": safe_number(roe),
            "roic": 0,
            "debtToEquity": safe_number(debt_to_equity),
            "freeCashFlow": safe_number(
                info.get("freeCashflow")
            ),
            "fcfGrowth5Y": 0
        },

        "valuation": {
            "pe": safe_number(pe),
            "forwardPE": safe_number(forward_pe),
            "peg": safe_number(peg),
            "priceToSales": safe_number(price_to_sales),
            "priceToBook": safe_number(price_to_book)
        },

        "ownership": {
            "insiderHolding": safe_number(
                (info.get("heldPercentInsiders", 0) or 0) * 100
            ),
            "institutionalHolding": safe_number(
                (info.get("heldPercentInstitutions", 0) or 0) * 100
            ),
            "recentBigInvestors": []
        },

        "technical": {
            "52WeekHigh": safe_number(high_52),
            "52WeekLow": safe_number(low_52),
            "sma50": safe_number(sma50),
            "sma200": safe_number(sma200),
            "momentum3M": safe_number(momentum_3m),
            "momentum6M": safe_number(momentum_6m)
        },

        "analysis": {
            "fairValue": 0,
            "buyPrice": 0,
            "strongBuyPrice": 0,
            "marginOfSafety": 0
        }
    }

    return result


def main():

    shopify = get_stock_data(
        "SHOP.TO",
        "Shopify"
    )

    canada_data = {
        "market": "Canada",
        "currency": "CAD",
        "lastUpdated": datetime.now(timezone.utc).isoformat(),

        "stocks": [
            shopify
        ],

        "etfs": [],

        "mutualFunds": []
    }

    with open(DATA_DIR / "canada.json", "w") as file:
        json.dump(
            canada_data,
            file,
            indent=2
        )

    print("Investment Radar data updated successfully.")


if __name__ == "__main__":
    main()
