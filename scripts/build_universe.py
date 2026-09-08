# scripts/build_universe.py

import json
import io
import re
import time
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

MIN_MARKET_CAP_CAD = 1_000_000_000
MIN_MARKET_CAP_INR = 10_000_000_000

MIN_AVG_VOLUME = 100_000
MIN_HISTORY_DAYS = 250

CANADA_TARGET = 150
INDIA_TARGET = 150


HEADERS = {
    "User-Agent": "Mozilla/5.0 Investment-Radar/1.0"
}


def clean_number(value):
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def get_yf_info(ticker):
    try:
        return yf.Ticker(ticker).info
    except Exception:
        return {}


def passes_yahoo_filters(ticker, market):
    try:
        stock = yf.Ticker(ticker)

        history = stock.history(period="2y", auto_adjust=False)

        if history is None or history.empty:
            return None

        history = history.dropna(subset=["Close"])

        if len(history) < MIN_HISTORY_DAYS:
            return None

        avg_volume = float(history["Volume"].tail(60).mean())

        if avg_volume < MIN_AVG_VOLUME:
            return None

        info = get_yf_info(ticker)

        market_cap = clean_number(info.get("marketCap"))

        if market == "Canada":
            if market_cap is not None and market_cap < MIN_MARKET_CAP_CAD:
                return None
        else:
            if market_cap is not None and market_cap < MIN_MARKET_CAP_INR:
                return None

        price = clean_number(history["Close"].iloc[-1])

        if price is None or price <= 0:
            return None

        name = (
            info.get("longName")
            or info.get("shortName")
            or ticker
        )

        sector = info.get("sector") or "Unknown"
        industry = info.get("industry") or "Unknown"

        return {
            "ticker": ticker,
            "name": name,
            "sector": sector,
            "industry": industry,
            "marketCap": market_cap,
            "avgVolume60D": round(avg_volume),
            "exchange": info.get("exchange"),
            "currency": info.get("currency"),
            "historyDays": len(history),
        }

    except Exception as e:
        print(f"SKIP {ticker}: {e}")
        return None


def get_canada_candidates():
    url = "https://en.wikipedia.org/wiki/S%26P/TSX_Composite_Index"

    tables = pd.read_html(
        requests.get(url, headers=HEADERS, timeout=30).text
    )

    candidates = []

    for table in tables:
        columns = [str(c).lower() for c in table.columns]

        ticker_col = None

        for i, column in enumerate(columns):
            if "symbol" in column or "ticker" in column:
                ticker_col = table.columns[i]
                break

        if ticker_col is None:
            continue

        for value in table[ticker_col].dropna():
            ticker = str(value).strip()

            ticker = re.sub(r"\[.*?\]", "", ticker)
            ticker = ticker.replace(".", "-")
            ticker = ticker.replace("/", "-")
            ticker = ticker.strip()

            if not ticker:
                continue

            if ticker.lower() in {"symbol", "ticker"}:
                continue

            candidates.append(ticker)

    candidates = sorted(set(candidates))

    return [
        f"{ticker}.TO"
        for ticker in candidates
        if ticker and len(ticker) <= 8
    ]


def get_india_candidates():
    url = (
        "https://archives.nseindia.com/content/equities/"
        "EQUITY_L.csv"
    )

    response = requests.get(
        url,
        headers=HEADERS,
        timeout=30
    )
    response.raise_for_status()

    df = pd.read_csv(io.BytesIO(response.content))

    symbol_column = None

    for column in df.columns:
        if str(column).strip().upper() == "SYMBOL":
            symbol_column = column
            break

    if symbol_column is None:
        raise RuntimeError("NSE SYMBOL column not found")

    candidates = []

    for symbol in df[symbol_column].dropna():
        symbol = str(symbol).strip().upper()

        if not symbol:
            continue

        if not re.match(r"^[A-Z0-9&-]+$", symbol):
            continue

        candidates.append(f"{symbol}.NS")

    return sorted(set(candidates))


def rank_universe(records):
    def score(x):
        market_cap = x.get("marketCap") or 0
        volume = x.get("avgVolume60D") or 0

        return (
            market_cap * 0.7
            + volume * 1000 * 0.3
        )

    return sorted(records, key=score, reverse=True)


def build_market(candidates, market, target):
    valid = []

    print(f"\nBuilding {market} universe")
    print(f"Candidates: {len(candidates)}")

    for i, ticker in enumerate(candidates, start=1):
        print(f"[{i}/{len(candidates)}] {ticker}")

        result = passes_yahoo_filters(ticker, market)

        if result:
            valid.append(result)

        time.sleep(0.15)

    valid = rank_universe(valid)

    valid = valid[:target]

    return valid


def save_universe(filename, market, records):
    output = {
        "market": market,
        "lastUpdated": pd.Timestamp.utcnow().isoformat(),
        "universeSize": len(records),
        "stocks": records,
    }

    path = DATA_DIR / filename

    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {path}")
    print(f"Universe size: {len(records)}")


def main():
    DATA_DIR.mkdir(exist_ok=True)

    canada_candidates = get_canada_candidates()
    india_candidates = get_india_candidates()

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
