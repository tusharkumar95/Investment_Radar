# scripts/build_universe.py

import json
import re
import time
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

HEADERS = {
    "User-Agent": "Mozilla/5.0 InvestmentRadar/1.0"
}

MIN_MARKET_CAP_CANADA = 1_000_000_000
MIN_MARKET_CAP_INDIA = 10_000_000_000
MIN_AVG_VOLUME = 50_000
MIN_HISTORY_DAYS = 250

CANADA_TARGET = 150
INDIA_TARGET = 150


def safe_float(value):
    try:
        if value is None:
            return None
        value = float(value)
        if pd.isna(value):
            return None
        return value
    except Exception:
        return None


def get_info(ticker):
    try:
        return yf.Ticker(ticker).info
    except Exception:
        return {}


def test_stock(ticker, market):
    try:
        yf_stock = yf.Ticker(ticker)

        history = yf_stock.history(
            period="2y",
            auto_adjust=False
        )

        if history is None or history.empty:
            return None

        history = history.dropna(subset=["Close"])

        if len(history) < MIN_HISTORY_DAYS:
            return None

        avg_volume = safe_float(
            history["Volume"].tail(60).mean()
        )

        if avg_volume is None or avg_volume < MIN_AVG_VOLUME:
            return None

        info = get_info(ticker)

        market_cap = safe_float(
            info.get("marketCap")
        )

        if market == "Canada":
            if market_cap is not None and market_cap < MIN_MARKET_CAP_CANADA:
                return None

        else:
            if market_cap is not None and market_cap < MIN_MARKET_CAP_INDIA:
                return None

        price = safe_float(
            history["Close"].iloc[-1]
        )

        if price is None or price <= 0:
            return None

        return {
            "ticker": ticker,
            "name": (
                info.get("longName")
                or info.get("shortName")
                or ticker
            ),
            "sector": info.get("sector") or "Unknown",
            "industry": info.get("industry") or "Unknown",
            "marketCap": market_cap,
            "avgVolume60D": round(avg_volume),
            "currency": info.get("currency"),
            "exchange": info.get("exchange"),
            "historyDays": len(history)
        }

    except Exception as e:
        print(f"SKIP {ticker}: {e}")
        return None


def get_canada_candidates():
    url = "https://en.wikipedia.org/wiki/S%26P/TSX_Composite_Index"

    response = requests.get(
        url,
        headers=HEADERS,
        timeout=30
    )

    response.raise_for_status()

    tables = pd.read_html(response.text)

    candidates = []

    for table in tables:
        symbol_column = None

        for column in table.columns:
            text = str(column).lower()

            if "symbol" in text or "ticker" in text:
                symbol_column = column
                break

        if symbol_column is None:
            continue

        for value in table[symbol_column].dropna():
            ticker = str(value).strip()

            ticker = re.sub(
                r"\[.*?\]",
                "",
                ticker
            )

            ticker = ticker.replace(".", "-")
            ticker = ticker.strip()

            if not ticker:
                continue

            if ticker.lower() in {
                "symbol",
                "ticker"
            }:
                continue

            if re.match(
                r"^[A-Z0-9-]{1,8}$",
                ticker
            ):
                candidates.append(
                    f"{ticker}.TO"
                )

    return sorted(set(candidates))


def get_india_candidates():
    # Current NSE security master
    urls = [
        "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
        "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
    ]

    response = None

    for url in urls:
        try:
            response = requests.get(
                url,
                headers=HEADERS,
                timeout=30
            )

            if response.ok:
                break

        except Exception:
            continue

    if response is None or not response.ok:
        raise RuntimeError(
            "Could not download NSE equity security list"
        )

    df = pd.read_csv(
        response.content
    )

    symbol_column = None

    for column in df.columns:
        if str(column).strip().upper() == "SYMBOL":
            symbol_column = column
            break

    if symbol_column is None:
        raise RuntimeError(
            "NSE SYMBOL column not found"
        )

    candidates = []

    for symbol in df[symbol_column].dropna():
        symbol = str(symbol).strip().upper()

        if not re.match(
            r"^[A-Z0-9&-]+$",
            symbol
        ):
            continue

        candidates.append(
            f"{symbol}.NS"
        )

    return sorted(set(candidates))


def rank_stocks(stocks):
    return sorted(
        stocks,
        key=lambda x: (
            x.get("marketCap") or 0,
            x.get("avgVolume60D") or 0
        ),
        reverse=True
    )


def build_market(candidates, market, target):
    results = []

    print()
    print("=" * 60)
    print(f"BUILDING {market.upper()} UNIVERSE")
    print(f"Candidates: {len(candidates)}")
    print("=" * 60)

    for number, ticker in enumerate(
        candidates,
        start=1
    ):
        print(
            f"[{number}/{len(candidates)}] {ticker}"
        )

        result = test_stock(
            ticker,
            market
        )

        if result:
            results.append(result)

        time.sleep(0.15)

    results = rank_stocks(results)

    return results[:target]


def save_universe(filename, market, stocks):
    output = {
        "market": market,
        "lastUpdated": pd.Timestamp.utcnow().isoformat(),
        "universeSize": len(stocks),
        "stocks": stocks
    }

    path = DATA_DIR / filename

    with open(
        path,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            output,
            file,
            indent=2,
            ensure_ascii=False
        )

    print()
    print(f"Saved {path}")
    print(f"Stocks: {len(stocks)}")


def main():
    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    print("Downloading Canada universe...")
    canada_candidates = get_canada_candidates()

    print(
        f"Canada candidates found: "
        f"{len(canada_candidates)}"
    )

    print("Downloading India universe...")
    india_candidates = get_india_candidates()

    print(
        f"India candidates found: "
        f"{len(india_candidates)}"
    )

    canada = build_market(
        canada_candidates,
        "Canada",
        CANADA_TARGET
    )

    india = build_market(
        india_candidates,
        "India",
        INDIA_TARGET
    )

    if len(canada) < 50:
        raise RuntimeError(
            f"Canada universe too small: {len(canada)}"
        )

    if len(india) < 50:
        raise RuntimeError(
            f"India universe too small: {len(india)}"
        )

    save_universe(
        "canada_universe.json",
        "Canada",
        canada
    )

    save_universe(
        "india_universe.json",
        "India",
        india
    )


if __name__ == "__main__":
    main()
