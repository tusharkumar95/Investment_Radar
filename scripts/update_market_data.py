import json
from pathlib import Path

import yfinance as yf


DATA_DIR = Path("data")


def get_stock_data(ticker_symbol, name, market, currency):

    ticker = yf.Ticker(ticker_symbol)

    history = ticker.history(period="1y")

    if history.empty:
        raise Exception(f"No price data returned for {ticker_symbol}")

    current_price = float(history["Close"].iloc[-1])

    high_52 = float(history["High"].max())
    low_52 = float(history["Low"].min())

    result = {
        "ticker": ticker_symbol,
        "name": name,
        "type": "stock",

        "price": round(current_price, 2),

        "fundamentals": {
            "revenueGrowth5Y": 0,
            "revenueGrowth3Y": 0,
            "epsGrowth5Y": 0,
            "profitMargin": 0,
            "roe": 0,
            "roic": 0,
            "debtToEquity": 0,
            "freeCashFlow": 0,
            "fcfGrowth5Y": 0
        },

        "valuation": {
            "pe": 0,
            "forwardPE": 0,
            "peg": 0,
            "priceToSales": 0,
            "priceToBook": 0
        },

        "ownership": {
            "insiderHolding": 0,
            "institutionalHolding": 0,
            "recentBigInvestors": []
        },

        "technical": {
            "52WeekHigh": round(high_52, 2),
            "52WeekLow": round(low_52, 2),
            "sma50": 0,
            "sma200": 0,
            "momentum3M": 0,
            "momentum6M": 0
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

    canada_stock = get_stock_data(
        "SHOP.TO",
        "Shopify",
        "Canada",
        "CAD"
    )

    canada_data = {
        "market": "Canada",
        "currency": "CAD",
        "lastUpdated": None,
        "stocks": [canada_stock],
        "etfs": [],
        "mutualFunds": []
    }

    with open(DATA_DIR / "canada.json", "w") as file:
        json.dump(canada_data, file, indent=2)

    print("Canada data updated successfully.")


if __name__ == "__main__":
    main()
