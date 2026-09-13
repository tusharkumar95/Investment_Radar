import json
import math
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "data" / "canada.json", ROOT / "data" / "india.json"]
HISTORY_PERIOD = "5y"
KEEP_DAYS = 420


def num(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None


def clean(v):
    if isinstance(v, dict):
        return {str(k): clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [clean(x) for x in v]
    return v


def rsi(close, length=14):
    if len(close) < length + 1:
        return None
    delta = close.diff().dropna()
    gains = delta.clip(lower=0).tail(length).mean()
    losses = (-delta.clip(upper=0)).tail(length).mean()
    if losses == 0:
        return 100.0
    return float(100 - 100 / (1 + gains / losses))


def atr(history, length=14):
    if len(history) < length + 1:
        return None
    prev = history["Close"].shift(1)
    tr = pd.concat([
        history["High"] - history["Low"],
        (history["High"] - prev).abs(),
        (history["Low"] - prev).abs(),
    ], axis=1).max(axis=1).dropna()
    return num(tr.tail(length).mean())


def macd(close):
    if len(close) < 35:
        return {"value": None, "signal": None, "histogram": None}
    fast = close.ewm(span=12, adjust=False).mean()
    slow = close.ewm(span=26, adjust=False).mean()
    line = fast - slow
    signal = line.ewm(span=9, adjust=False).mean()
    return {
        "value": num(line.iloc[-1]),
        "signal": num(signal.iloc[-1]),
        "histogram": num((line - signal).iloc[-1]),
    }


def technical_history(history):
    rows = []
    for idx, row in history.tail(KEEP_DAYS).iterrows():
        rows.append({
            "date": str(idx.date()) if hasattr(idx, "date") else str(idx),
            "open": num(row.get("Open")),
            "high": num(row.get("High")),
            "low": num(row.get("Low")),
            "close": num(row.get("Close")),
            "volume": num(row.get("Volume")),
        })
    return rows


def enrich(stock):
    ticker = stock.get("ticker")
    if not ticker:
        return stock
    try:
        history = yf.Ticker(ticker).history(period=HISTORY_PERIOD, auto_adjust=False)
        if history is None or history.empty:
            print(f"  no history: {ticker}")
            return stock
        history = history.dropna(subset=["Close"])
        close = pd.to_numeric(history["Close"], errors="coerce").dropna()
        if close.empty:
            return stock

        current = num(close.iloc[-1])
        sma20 = num(close.tail(20).mean()) if len(close) >= 20 else None
        sma50 = num(close.tail(50).mean()) if len(close) >= 50 else None
        sma200 = num(close.tail(200).mean()) if len(close) >= 200 else None
        m3 = num((current / close.iloc[-64] - 1) * 100) if len(close) >= 64 else None
        m6 = num((current / close.iloc[-127] - 1) * 100) if len(close) >= 127 else None
        m1y = num((current / close.iloc[-252] - 1) * 100) if len(close) >= 252 else None
        returns = close.pct_change().dropna()
        vol30 = num(returns.tail(30).std() * math.sqrt(252) * 100) if len(returns) >= 30 else None
        vol90 = num(returns.tail(90).std() * math.sqrt(252) * 100) if len(returns) >= 90 else None
        last252 = history.tail(252)
        high52 = num(last252["High"].max())
        low52 = num(last252["Low"].min())
        volume = pd.to_numeric(history["Volume"], errors="coerce").dropna()
        current_volume = num(volume.iloc[-1]) if not volume.empty else None
        average_volume20 = num(volume.tail(20).mean()) if len(volume) >= 20 else None
        trend = None
        if sma50 is not None and sma200 is not None:
            trend = "Strong Uptrend" if current > sma50 > sma200 else "Downtrend" if current < sma50 < sma200 else "Uptrend" if current > sma50 else "Mixed"
        elif sma50 is not None:
            trend = "Uptrend" if current > sma50 else "Downtrend"

        t = stock.get("technical") or {}
        t.update({
            "price": current, "currentPrice": current,
            "sma20": sma20, "sma50": sma50, "sma200": sma200,
            "momentum3M": m3, "momentum6M": m6, "momentum1Y": m1y,
            "volatility30d": vol30, "volatility90d": vol90,
            "high52Week": high52, "low52Week": low52,
            "drawdown52w": num((current / high52 - 1) * 100) if high52 else None,
            "volume": current_volume, "averageVolume20d": average_volume20,
            "rsi14": rsi(close), "atr14": atr(history), "macd": macd(close),
            "trend": trend, "historyDays": len(history),
            "history": technical_history(history),
        })
        stock["technical"] = clean(t)
        stock["sma50"] = sma50
        stock["sma200"] = sma200
        stock["momentum3M"] = m3
        stock["momentum6M"] = m6
        print(f"  technical OK: {ticker} ({len(history)} days)")
    except Exception as exc:
        print(f"  technical error {ticker}: {exc}")
    return stock


def main():
    for path in FILES:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        stocks = data.get("stocks", [])
        print(f"\nEnriching {path.name}: {len(stocks)} stocks")
        data["stocks"] = [enrich(s) for s in stocks]
        data["technicalEnrichment"] = {
            "historyPeriod": HISTORY_PERIOD,
            "storedDays": KEEP_DAYS,
            "updatedAt": pd.Timestamp.utcnow().isoformat(),
        }
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, allow_nan=False)
        print(f"Saved {path}")
        time.sleep(1)


if __name__ == "__main__":
    main()
