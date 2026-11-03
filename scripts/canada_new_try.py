"""Canada New Try: standalone Canadian market activity / verified ownership / CAD-hedged CDR pilot.

This DOES NOT modify India's NSE engine or the existing Moves data files.
No trading signal is attributed to an investor from price/volume data.
Canadian Depositary Receipts are CAD-traded products, NOT U.S. shares.
Quotes come from the Canadian listing ticker only; missing quotes stay missing.
"""
from __future__ import annotations

import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

ROOT = Path(".")
OUT = ROOT / "canada-new-try.json"
TODAY = datetime.now(ZoneInfo("America/Toronto")).date()
UPDATED = datetime.now(timezone.utc).isoformat()
# Listed CAD-hedged CDRs confirmed against issuer's directory / 2026 launches;
# suffix .TO is the Yahoo/Toronto quote convention, NOT the printed CDR ticker.
# CDR ratio, spread and CAD hedge costs mean returns may differ from U.S. share returns.
CDRS = {
    "NVDA": "Nvidia", "AAPL": "Apple", "MSFT": "Microsoft", "AMZN": "Amazon",
    "TSLA": "Tesla", "AMD": "Advanced Micro Devices", "GOOG": "Alphabet",
    "META": "Meta Platforms", "AVGO": "Broadcom", "PLTR": "Palantir",
    "NFLX": "Netflix", "COST": "Costco", "VISA": "Visa", "LLY": "Eli Lilly",
    "CRWD": "CrowdStrike", "ORAC": "Oracle", "PANW": "Palo Alto Networks",
    "ADBE": "Adobe", "XOM": "Exxon Mobil", "VRT": "Vertiv",
    "DHI": "D.R. Horton", "INTU": "Intuit", "LRCX": "Lam Research",
    "APH": "Amphenol", "CRWV": "CoreWeave",
    "DDOG": "Datadog", "RKLB": "Rocket Lab", "SNOW": "Snowflake",
}
CDR_DIRECTORY = "https://cdr.cibc.com/en/cdr-directory"


def read(path, default):
    try:
        return json.loads((ROOT / path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def safe(v):
    try:
        a = float(v)
        return a if math.isfinite(a) else None
    except (ValueError, TypeError):
        return None


def iso(v):
    try:
        return date.fromisoformat(str(v)[:10]).isoformat()
    except (ValueError, TypeError):
        return None


def ticker_exchange(row):
    symbol = str(row.get("symbol") or "").upper().strip()
    exchange = str(row.get("exchange") or "").upper()
    return symbol + (".V" if exchange in ("TSXV", "TSX-V") else ".TO")


def watch_universe():
    raw = read("data/canada_universe.json", {})
    stocks = {}
    for row in raw.get("stocks", []):
        sym = str(row.get("ticker") or "").upper()
        if not sym.endswith(".TO") and not sym.endswith(".V"):
            continue
        if row.get("currency") != "CAD":
            continue
        stocks[sym] = {"symbol": sym, "name": str(row.get("name") or sym), "sector": str(row.get("sector") or ""), "lane": "Canadian Stocks"}
    events = read("moves-canada-verified.json", {}).get("records", [])
    for r in events:
        if r.get("symbol") and r.get("exchange"):
            s = ticker_exchange(r)
            stocks.setdefault(s, {"symbol": s, "name": r.get("company") or s, "sector": "", "lane": "Canadian Stocks"})
    for symbol, name in CDRS.items():
        sym = symbol + ".TO"
        stocks[sym] = {"symbol": sym, "name": name + " CDR (CAD Hedged)", "sector": "U.S. reference stock", "lane": "CAD-Hedged CDRs", "cdr": symbol}
    return stocks, events


def parse_frame(frame, ticker, multi):
    if frame is None or frame.empty:
        return None
    try:
        if isinstance(frame.columns, pd.MultiIndex):
            # yfinance group_by="ticker" => (ticker, "Close").
            if (ticker, "Close") in frame.columns:
                close, volume = frame[ticker]["Close"], frame[ticker]["Volume"]
            elif ("Close", ticker) in frame.columns:
                close, volume = frame["Close"][ticker], frame["Volume"][ticker]
            else:
                return None
        else:
            close, volume = frame["Close"], frame["Volume"]
        work = pd.DataFrame({"close": close, "volume": volume}).dropna(subset=["close"])
        work = work[work.close > 0].tail(85)
        if len(work) < 26:
            return None
        prices = [float(x) for x in work["close"].to_list()]
        vols = [float(x) if pd.notna(x) else 0 for x in work["volume"].to_list()]
        stamps = [pd.Timestamp(i).date().isoformat() for i in work.index]
        latest = date.fromisoformat(stamps[-1])
        if (TODAY - latest).days > 7:
            return None
        last = prices[-1]
        vbase = sum(vols[-21:-1]) / 20 if len(vols) >= 21 else 0
        relative = (vols[-1] / vbase) if vbase > 0 else None
        ret5 = 100 * (last / prices[-6] - 1) if len(prices) >= 6 else None
        ret20 = 100 * (last / prices[-21] - 1) if len(prices) >= 21 else None
        sma20 = sum(prices[-20:]) / 20
        sma50 = sum(prices[-50:]) / 50 if len(prices) >= 50 else None
        prev20 = max(prices[-21:-1])
        diffs = [prices[k] - prices[k - 1] for k in range(-14, 0)]
        gain = sum(max(x, 0) for x in diffs) / 14
        loss = sum(max(-x, 0) for x in diffs) / 14
        rsi = (100 - 100 / (1 + gain / loss)) if loss else (100 if gain else 50)
        return {
            "price": round(last, 4), "priceDate": stamps[-1],
            "volume": int(vols[-1]), "relativeVolume": round(relative, 2) if relative is not None else None,
            "return5d": round(ret5, 2) if ret5 is not None else None,
            "return20d": round(ret20, 2) if ret20 is not None else None,
            "sma20": round(sma20, 4), "sma50": round(sma50, 4) if sma50 is not None else None,
            "rsi14": round(rsi, 1), "breakout20": last > prev20 * 1.005,
            "closes": {d: round(p, 4) for d, p in zip(stamps, prices)},
        }
    except (KeyError, ValueError, TypeError, IndexError, ZeroDivisionError) as e:
        print("Quote parse error:", ticker, str(e)[:90])
        return None


def download_quotes(tickers):
    found, errors = {}, []
    names = sorted(tickers)
    for offset in range(0, len(names), 16):
        batch = names[offset:offset+16]
        try:
            frame = yf.download(
                tickers=batch, period="5mo", interval="1d", group_by="ticker",
                auto_adjust=False, progress=False, threads=True, timeout=25,
            )
            for t in batch:
                result = parse_frame(frame, t, len(batch) > 1)
                if result:
                    found[t] = result
        except Exception as exc:
            errors.append(str(exc)[:130])
    # Retry a few essential test symbols individually when group quotes fail.
    for t in ["FDY.TO", "LTC.V", "NVDA.TO", "MSFT.TO", "AAPL.TO"]:
        if t not in tickers or t in found:
            continue
        try:
            frame = yf.download(tickers=t, period="5mo", interval="1d", auto_adjust=False, progress=False, threads=False, timeout=20)
            v = parse_frame(frame, t, False)
            if v:
                found[t] = v
        except Exception as exc:
            errors.append(f"{t}: {str(exc)[:110]}")
    return found, errors


def momentum(info, quote):
    rvol = quote.get("relativeVolume")
    ret5 = quote.get("return5d")
    rsi = quote.get("rsi14")
    up = quote.get("sma50") is not None and quote["sma20"] > quote["sma50"]
    trend = quote["price"] > quote["sma20"]
    spike = rvol is not None and rvol >= 1.8
    breakout = bool(quote["breakout20"])
    score = 25
    if trend: score += 12
    if up: score += 10
    if rvol is not None:
        score += min(22, round(9 * max(0, rvol - 1)))
    if breakout: score += 14
    if ret5 is not None and ret5 >= 2: score += min(10, round(ret5))
    if rsi is not None and 45 <= rsi <= 75: score += 7
    score = min(score, 100)
    if breakout and spike:
        signal = "Breakout + unusual volume"
    elif spike and ret5 is not None and ret5 > 0:
        signal = "Unusual buying-side activity"
    elif up and trend and ret5 is not None and ret5 > 0:
        signal = "Positive price trend"
    else:
        signal = "Monitoring"
    # Volume + price can NOT establish actual institutional buying.
    reason = f"5-session return {ret5:+.1f}% · relative volume {rvol:.1f}×" if ret5 is not None and rvol is not None else "Price trend; some volume metrics unavailable"
    return {
        **{k: v for k, v in info.items() if k != "closes"},
        **{k: v for k, v in quote.items() if k != "closes"},
        "score": score, "signal": signal, "reason": reason,
        "evidence": "Price and exchange volume, not identified investor transactions",
        "source": "Yahoo Finance delayed Canadian listing quotes (research)",
        "sourceUrl": CDR_DIRECTORY if info.get("cdr") else "https://www.tsx.com",
        "verifiedPurchase": False,
        "isLiveQuote": True,
    }


def owner_signal(event, quote):
    if str(event.get("direction") or "BUY").upper() != "BUY":
        return None
    filed = iso(event.get("disclosureDate"))
    if not filed or (TODAY - date.fromisoformat(filed)).days > 45:
        return None
    if event.get("status", "").lower().startswith("proposed"):
        return None
    trade = iso(event.get("transactionDate"))
    value = safe(event.get("valueCAD"))
    shares = event.get("shares") or 0
    price = safe(event.get("priceCAD"))
    if not value or not shares or not price:
        return None
    symbol = ticker_exchange(event)
    score = min(95, 62 + (18 if value >= 1000000 else 8 if value >= 250000 else 0) + (6 if (TODAY - date.fromisoformat(filed)).days < 8 else 0))
    return {
        "id": "owner:" + str(event.get("symbol")) + ":" + str(filed) + ":" + str(event.get("investor", ""))[:80],
        "lane": "Verified ownership", "symbol": symbol,
        "name": event.get("company") or symbol, "score": score,
        "signal": "Completed disclosed acquisition",
        "investor": event.get("investor"), "shares": shares,
        "transactionDate": trade, "disclosureDate": filed,
        "valueCAD": round(value, 2), "disclosedPrice": price,
        "price": quote.get("price") if quote else None,
        "priceDate": quote.get("priceDate") if quote else None,
        "return5d": quote.get("return5d") if quote else None,
        "relativeVolume": quote.get("relativeVolume") if quote else None,
        "source": event.get("sourceName") or "Original acquiror disclosure",
        "sourceUrl": event.get("sourceUrl") or "",
        "verifiedPurchase": True, "isLiveQuote": bool(quote),
        "evidence": "Specific completed transaction in an original public disclosure",
        "reason": f"{event.get('investor')} disclosed {int(shares):,} shares purchased. Filed {filed}; trade {trade or 'date unspecified'}.",
    }


def checkpoint(close_map, origin, n):
    target = origin + timedelta(days=n)
    if target > TODAY:
        return {"offset": n, "target": target.isoformat(), "day": None, "price": None}
    candidates = sorted((d, p) for d, p in close_map.items() if target <= date.fromisoformat(d) <= target + timedelta(days=7))
    if not candidates:
        return {"offset": n, "target": target.isoformat(), "day": None, "price": None}
    return {"offset": n, "target": target.isoformat(), "day": candidates[0][0], "price": candidates[0][1]}


def main():
    universe, events = watch_universe()
    quotes, errors = download_quotes(universe.keys())
    market = []
    cdr = []
    for sym, item in universe.items():
        q = quotes.get(sym)
        if not q:
            continue
        record = momentum(item, q)
        record["symbol"] = sym
        record["id"] = "market:" + sym
        if item.get("cdr"):
            cdr.append(record)
        else:
            market.append(record)
    market.sort(key=lambda r: (r["score"], r["relativeVolume"] or 0), reverse=True)
    cdr.sort(key=lambda r: (r["score"], r["relativeVolume"] or 0), reverse=True)
    ownership = [x for e in events if (x := owner_signal(e, quotes.get(ticker_exchange(e))))]
    ownership.sort(key=lambda r: r["disclosureDate"], reverse=True)

    old = read("canada-new-try.json", {})
    existing = {r["id"]: r for r in old.get("tracks", []) if r.get("id")}
    choices = (ownership[:12] + [r for r in market[:4] if r["score"] >= 53] +
               [r for r in cdr[:4] if r["score"] >= 53])
    for item in choices:
        key = item["id"] if item["lane"] == "Verified ownership" else "scan:" + TODAY.isoformat() + ":" + item["symbol"]
        if key not in existing:
            existing[key] = {
                "id": key, "symbol": item["symbol"], "name": item["name"],
                "lane": item["lane"], "started": TODAY.isoformat(),
                "reason": item["signal"], "sourceUrl": item.get("sourceUrl"),
            }
    tracks = []
    for track in existing.values():
        began = iso(track.get("started"))
        if not began or (TODAY - date.fromisoformat(began)).days > 40:
            continue
        data = quotes.get(track.get("symbol"))
        checkpoints = [checkpoint(data["closes"], date.fromisoformat(began), x) for x in [0, 5, 10, 15, 30]] if data else []
        baseline = checkpoints[0]["price"] if checkpoints else None
        last_price = data["price"] if data else None
        tracks.append({**track, "checkpoints": checkpoints, "lastPrice": last_price,
                       "priceChangePct": round(100*(last_price/baseline-1),2) if last_price and baseline else None,
                       "quoteStatus": "Available" if data else "Missing / not confirmed"})
    tracks.sort(key=lambda x: (x["started"], x["lane"] == "Verified ownership"), reverse=True)
    # Keep track records, not the price history for every ticker.
    report = {
        "schema": 1, "updated": UPDATED, "day": TODAY.isoformat(),
        "name": "Canada New Try — isolated pilot",
        "policy": "Canadian pricing momentum is not verified investor buying. CDRs are distinct CAD-hedged securities, not US shares.",
        "sources": [
            {"name": "Canadian equity universe", "url": "https://www.tsx.com"},
            {"name": "CIBC CAD-hedged CDR directory", "url": CDR_DIRECTORY},
            {"name": "Original verified acquisition releases", "url": "https://www.newswire.ca"},
            {"name": "Delayed market quotes (Yahoo Finance)", "url": "https://finance.yahoo.com"},
        ],
        "status": {"universe": len(universe), "canadaQuoted": len(market),
                   "cdrUniverse": len(CDRS), "cdrQuoted": len(cdr),
                   "ownership": len(ownership), "quoteErrors": errors[:8],
                   "lastPriceDate": max((q["priceDate"] for q in quotes.values()), default=None)},
        "ownership": ownership, "canadaStocks": market[:45], "cdrs": cdr,
        "tracks": tracks[:100],
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Canada New Try:", report["status"], "tracks:", len(tracks))


if __name__ == "__main__":
    main()
