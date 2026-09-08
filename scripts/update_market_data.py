# scripts/update_market_data.py

import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


def safe_float(value):
    try:
        if value is None:
            return None

        value = float(value)

        if math.isnan(value) or math.isinf(value):
            return None

        return value
    except Exception:
        return None


def calculate_cagr(start, end, years):
    start = safe_float(start)
    end = safe_float(end)

    if start is None or end is None:
        return None

    if start <= 0 or end <= 0:
        return None

    try:
        return ((end / start) ** (1 / years) - 1) * 100
    except Exception:
        return None


def annual_values(statement, row_name):
    if statement is None or statement.empty:
        return []

    if row_name not in statement.index:
        return []

    row = statement.loc[row_name]

    values = []

    for value in row.tolist():
        value = safe_float(value)

        if value is not None:
            values.append(value)

    return values


def get_financial_metric(statement, names):
    if statement is None or statement.empty:
        return None

    for name in names:
        if name in statement.index:
            values = annual_values(statement, name)

            if values:
                return values[0]

    return None


def calculate_growth(statement, names, years):
    values = annual_values(
        statement,
        next(
            (
                name
                for name in names
                if name in statement.index
            ),
            ""
        )
    )

    if len(values) < years + 1:
        return None

    latest = values[0]
    oldest = values[years]

    return calculate_cagr(
        oldest,
        latest,
        years
    )


def update_stock(stock):
    ticker = stock["ticker"]

    print(f"Updating {ticker}")

    try:
        yf_stock = yf.Ticker(ticker)

        history = yf_stock.history(
            period="5y",
            auto_adjust=False
        )

        if history.empty:
            print(f"No history: {ticker}")
            return stock

        history = history.dropna(subset=["Close"])

        info = yf_stock.info

        financials = yf_stock.financials

        price = safe_float(
            history["Close"].iloc[-1]
        )

        high_52 = safe_float(
            history["High"].tail(252).max()
        )

        low_52 = safe_float(
            history["Low"].tail(252).min()
        )

        sma50 = safe_float(
            history["Close"].rolling(50).mean().iloc[-1]
        )

        sma200 = safe_float(
            history["Close"].rolling(200).mean().iloc[-1]
        )

        price_3m = safe_float(
            history["Close"].iloc[
                max(0, len(history) - 64)
            ]
        )

        price_6m = safe_float(
            history["Close"].iloc[
                max(0, len(history) - 126)
            ]
        )

        momentum_3m = None
        momentum_6m = None

        if price and price_3m:
            momentum_3m = (
                (price / price_3m) - 1
            ) * 100

        if price and price_6m:
            momentum_6m = (
                (price / price_6m) - 1
            ) * 100

        revenue_growth_3y = calculate_growth(
            financials,
            [
                "Total Revenue",
                "Operating Revenue"
            ],
            3
        )

        revenue_growth_5y = calculate_growth(
            financials,
            [
                "Total Revenue",
                "Operating Revenue"
            ],
            5
        )

        fcf = safe_float(
            info.get("freeCashflow")
        )

        operating_cashflow = safe_float(
            info.get("operatingCashflow")
        )

        capital_expenditure = safe_float(
            info.get("capitalExpenditures")
        )

        if fcf is None and (
            operating_cashflow is not None
            and capital_expenditure is not None
        ):
            fcf = (
                operating_cashflow
                + capital_expenditure
            )

        data = {
            **stock,

            "name": (
                info.get("longName")
                or info.get("shortName")
                or stock.get("name")
            ),

            "sector": (
                info.get("sector")
                or stock.get("sector")
                or "Unknown"
            ),

            "industry": (
                info.get("industry")
                or stock.get("industry")
                or "Unknown"
            ),

            "currentPrice": price,

            "marketCap": safe_float(
                info.get("marketCap")
            ),

            "currency": info.get(
                "currency",
                stock.get("currency")
            ),

            "exchange": info.get(
                "exchange",
                stock.get("exchange")
            ),

            "high52Week": high_52,
            "low52Week": low_52,

            "sma50": sma50,
            "sma200": sma200,

            "momentum3M": momentum_3m,
            "momentum6M": momentum_6m,

            "revenueGrowth3Y": revenue_growth_3y,
            "revenueGrowth5Y": revenue_growth_5y,

            "epsGrowth5Y": safe_float(
                info.get("earningsGrowth")
            ),

            "pe": safe_float(
                info.get("trailingPE")
            ),

            "forwardPE": safe_float(
                info.get("forwardPE")
            ),

            "peg": safe_float(
                info.get("pegRatio")
            ),

            "priceSales": safe_float(
                info.get("priceToSalesTrailing12Months")
            ),

            "priceBook": safe_float(
                info.get("priceToBook")
            ),

            "profitMargin": (
                safe_float(
                    info.get("profitMargins")
                ) * 100
                if safe_float(
                    info.get("profitMargins")
                ) is not None
                else None
            ),

            "roe": (
                safe_float(
                    info.get("returnOnEquity")
                ) * 100
                if safe_float(
                    info.get("returnOnEquity")
                ) is not None
                else None
            ),

            "roic": None,

            "debtToEquity": safe_float(
                info.get("debtToEquity")
            ),

            "freeCashFlow": fcf,

            "fcfGrowth5Y": None,

            "dividendYield": (
                safe_float(
                    info.get("dividendYield")
                ) * 100
                if safe_float(
                    info.get("dividendYield")
                ) is not None
                else None
            ),

            "dividendRate": safe_float(
                info.get("dividendRate")
            ),

            "payoutRatio": (
                safe_float(
                    info.get("payoutRatio")
                ) * 100
                if safe_float(
                    info.get("payoutRatio")
                ) is not None
                else None
            ),

            "insiderOwnership": (
                safe_float(
                    info.get("heldPercentInsiders")
                ) * 100
                if safe_float(
                    info.get("heldPercentInsiders")
                ) is not None
                else None
            ),

            "institutionalOwnership": (
                safe_float(
                    info.get("heldPercentInstitutions")
                ) * 100
                if safe_float(
                    info.get("heldPercentInstitutions")
                ) is not None
                else None
            ),

            "recentBigInvestors": [],

            "dataSource": "Yahoo Finance / yfinance",

            "dataQuality": {
                "historyDays": len(history),
                "hasFinancials": (
                    financials is not None
                    and not financials.empty
                ),
                "hasPrice": price is not None,
            },
        }

        return data

    except Exception as e:
        print(f"ERROR {ticker}: {e}")
        return stock


def load_universe(filename):
    path = DATA_DIR / filename

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def update_market(
    universe_filename,
    output_filename,
    market
):
    universe = load_universe(universe_filename)

    stocks = universe.get("stocks", [])

    updated = []

    print(
        f"\nUpdating {market}: "
        f"{len(stocks)} stocks"
    )

    for stock in stocks:
        updated_stock = update_stock(stock)
        updated.append(updated_stock)

        time.sleep(0.25)

    output = {
        "market": market,
        "lastUpdated": pd.Timestamp.utcnow().isoformat(),
        "universeSize": len(updated),
        "stocks": updated,
    }

    output_path = DATA_DIR / output_filename

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            output,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(
        f"Saved {output_path}"
    )


def main():
    update_market(
        "canada_universe.json",
        "canada.json",
        "Canada"
    )

    update_market(
        "india_universe.json",
        "india.json",
        "India"
    )


if __name__ == "__main__":
    main()
