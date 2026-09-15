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
BATCH_SIZE = 25


def num(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None


def clean(v):
    if isinstance(v, dict): return {str(k): clean(x) for k, x in v.items()}
    if isinstance(v, list): return [clean(x) for x in v]
    return v


def rsi(close, length=14):
    if len(close) < length + 1: return None
    delta = close.diff().dropna()
    gains = delta.clip(lower=0).tail(length).mean()
    losses = (-delta.clip(upper=0)).tail(length).mean()
    if losses == 0: return 100.0
    return float(100 - 100 / (1 + gains / losses))


def atr(history, length=14):
    if len(history) < length + 1: return None
    prev = history["Close"].shift(1)
    tr = pd.concat([history["High"] - history["Low"], (history["High"] - prev).abs(), (history["Low"] - prev).abs()], axis=1).max(axis=1).dropna()
    return num(tr.tail(length).mean())


def macd(close):
    if len(close) < 35: return {"value": None, "signal": None, "histogram": None}
    fast = close.ewm(span=12, adjust=False).mean()
    slow = close.ewm(span=26, adjust=False).mean()
    line = fast - slow
    signal = line.ewm(span=9, adjust=False).mean()
    return {"value": num(line.iloc[-1]), "signal": num(signal.iloc[-1]), "histogram": num((line - signal).iloc[-1])}


def technical_history(history):
    rows = []
    for idx, row in history.tail(KEEP_DAYS).iterrows():
        rows.append({"date": str(idx.date()) if hasattr(idx, "date") else str(idx), "open": num(row.get("Open")), "high": num(row.get("High")), "low": num(row.get("Low")), "close": num(row.get("Close")), "volume": num(row.get("Volume"))})
    return rows


def single_ticker_frame(downloaded, ticker):
    if downloaded is None or downloaded.empty: return None
    try:
        if isinstance(downloaded.columns, pd.MultiIndex):
            frame = None
            for level in range(downloaded.columns.nlevels):
                values = [str(v) for v in downloaded.columns.get_level_values(level)]
                if ticker in values:
                    frame = downloaded.xs(ticker, axis=1, level=level, drop_level=True).copy()
                    break
            if frame is None: return None
            if isinstance(frame.columns, pd.MultiIndex):
                frame.columns = [str(v[-1]) if isinstance(v, tuple) else str(v) for v in frame.columns]
        else:
            frame = downloaded.copy()
        needed = ["Open", "High", "Low", "Close", "Volume"]
        if not all(col in frame.columns for col in needed): return None
        frame = frame[needed].copy()
        for col in needed: frame[col] = pd.to_numeric(frame[col], errors="coerce")
        return frame.dropna(subset=["Close"])
    except Exception as exc:
        print(f"    column parsing error {ticker}: {exc}")
        return None


def fallback_history(ticker):
    try:
        frame = yf.Ticker(ticker).history(period=HISTORY_PERIOD, auto_adjust=False)
        if frame is None or frame.empty: return None
        needed = ["Open", "High", "Low", "Close", "Volume"]
        if not all(col in frame.columns for col in needed): return None
        frame = frame[needed].copy()
        for col in needed: frame[col] = pd.to_numeric(frame[col], errors="coerce")
        return frame.dropna(subset=["Close"])
    except Exception as exc:
        print(f"    fallback error {ticker}: {exc}")
        return None


def download_histories(tickers):
    result = {}
    tickers = [t for t in tickers if t]
    if not tickers:
        print("  No tickers were found for technical enrichment.")
        return result

    for start in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[start:start + BATCH_SIZE]
        end = start + len(batch)
        print(f"  Technical batch {start + 1}-{end}")
        try:
            downloaded = yf.download(batch, period=HISTORY_PERIOD, auto_adjust=False, group_by="ticker", threads=True, progress=False)
        except Exception as exc:
            print(f"  batch download error: {exc}")
            downloaded = None
        missing = []
        for ticker in batch:
            frame = single_ticker_frame(downloaded, ticker)
            if frame is not None and len(frame) >= 100:
                result[ticker] = frame
                print(f"    history OK: {ticker} ({len(frame)} days)")
            else:
                missing.append(ticker)
        if missing:
            print(f"  Falling back to individual history for {len(missing)} tickers")
            for ticker in missing:
                frame = fallback_history(ticker)
                if frame is not None and len(frame) >= 100:
                    result[ticker] = frame
                    print(f"    fallback history OK: {ticker} ({len(frame)} days)")
                else:
                    print(f"    history unavailable: {ticker}")
        time.sleep(0.5)
    return result


def enrich(stock, history):
    ticker = stock.get("ticker") or stock.get("symbol") or stock.get("id")
    if ticker and not stock.get("ticker"):
        stock["ticker"] = ticker
    if not ticker or history is None or history.empty: return stock
    try:
        history = history.dropna(subset=["Close"])
        close = pd.to_numeric(history["Close"], errors="coerce").dropna()
        if close.empty: return stock
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
        high52 = num(pd.to_numeric(last252["High"], errors="coerce").max())
        low52 = num(pd.to_numeric(last252["Low"], errors="coerce").min())
        volume = pd.to_numeric(history["Volume"], errors="coerce").dropna()
        current_volume = num(volume.iloc[-1]) if not volume.empty else None
        average_volume20 = num(volume.tail(20).mean()) if len(volume) >= 20 else None
        trend = None
        if sma50 is not None and sma200 is not None:
            trend = "Strong Uptrend" if current > sma50 > sma200 else "Downtrend" if current < sma50 < sma200 else "Uptrend" if current > sma50 else "Mixed"
        elif sma50 is not None:
            trend = "Uptrend" if current > sma50 else "Downtrend"
        t = stock.get("technical") or {}
        t.update({"price": current, "currentPrice": current, "sma20": sma20, "sma50": sma50, "sma200": sma200, "momentum3M": m3, "momentum6M": m6, "momentum1Y": m1y, "volatility30d": vol30, "volatility90d": vol90, "high52Week": high52, "low52Week": low52, "drawdown52w": num((current / high52 - 1) * 100) if high52 else None, "volume": current_volume, "averageVolume20d": average_volume20, "rsi14": rsi(close), "atr14": atr(history), "macd": macd(close), "trend": trend, "historyDays": len(history), "history": technical_history(history)})
        stock["technical"] = clean(t)
        stock["sma50"] = sma50
        stock["sma200"] = sma200
        stock["momentum3M"] = m3
        stock["momentum6M"] = m6
        print(f"  technical enriched: {ticker} ({len(history)} days)")
    except Exception as exc:
        print(f"  technical error {ticker}: {exc}")
    return stock


def main():
    total_enriched = 0
    for path in FILES:
        with path.open(encoding="utf-8") as f: data = json.load(f)
        stocks = data.get("stocks", [])
        tickers = [s.get("ticker") or s.get("symbol") or s.get("id") for s in stocks]
        print(f"\nEnriching {path.name}: {len(stocks)} stocks; {sum(bool(t) for t in tickers)} tickers found")
        histories = download_histories(tickers)
        data["stocks"] = [enrich(s, histories.get(s.get("ticker") or s.get("symbol") or s.get("id"))) for s in stocks]
        enriched_count = sum(len(s.get("technical", {}).get("history", [])) >= 100 for s in data["stocks"])
        total_enriched += enriched_count
        data["technicalEnrichment"] = {"historyPeriod": HISTORY_PERIOD, "storedDays": KEEP_DAYS, "batchSize": BATCH_SIZE, "stocksWithHistory": enriched_count, "updatedAt": pd.Timestamp.now(tz="UTC").isoformat()}
        with path.open("w", encoding="utf-8") as f: json.dump(data, f, indent=2, ensure_ascii=False, allow_nan=False)
        print(f"Saved {path} ({enriched_count}/{len(stocks)} with technical history)")
        time.sleep(1)
    if total_enriched == 0:
        raise SystemExit("Technical enrichment produced zero usable histories across both markets")

if __name__ == "__main__": main()
