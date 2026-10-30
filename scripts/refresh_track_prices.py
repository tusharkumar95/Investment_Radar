"""Archive actual daily unadjusted closes for every still-active Track Sheet cohort."""
import json
import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

FILE = Path("data/track_sheet.json")
if not FILE.exists():
    raise SystemExit("Track Sheet file missing: snapshot must be created first")

data = json.loads(FILE.read_text(encoding="utf-8"))
quotes = data.setdefault("quotes", {})
today = datetime.now(ZoneInfo("America/Toronto")).date()
active = defaultdict(set)
first_days = {}

for cohort in data.get("cohorts", []):
    try:
        first_day = date.fromisoformat(cohort["date"])
    except (KeyError, TypeError, ValueError):
        continue
    if not (timedelta(0) <= today - first_day <= timedelta(days=40)):
        continue
    for market, group in cohort.get("markets", {}).items():
        for stock in group.get("stocks", []):
            ticker = stock.get("ticker", "")
            if not ticker or market not in ("Canada", "India"):
                continue
            active[market].add(ticker)
            key = market + ":" + ticker
            first_days[key] = min(first_day, first_days.get(key, first_day))

updated = 0
failed = []
for market, symbols in active.items():
    tickers = sorted(symbols)
    for i in range(0, len(tickers), 15):
        batch = tickers[i:i + 15]
        start = min(first_days[market + ":" + s] for s in batch) - timedelta(days=2)
        try:
            frame = yf.download(
                tickers=batch,
                start=start.isoformat(),
                end=(today + timedelta(days=2)).isoformat(),
                interval="1d", auto_adjust=False, group_by="ticker",
                progress=False, threads=False, timeout=20
            )
            if frame.empty:
                failed.extend(batch)
                continue
        except Exception as exc:
            print("Warning: price download failed for", batch, str(exc)[:200])
            failed.extend(batch)
            continue
        for ticker in batch:
            try:
                part = frame
                if isinstance(frame.columns, pd.MultiIndex):
                    if ticker in frame.columns.get_level_values(0):
                        part = frame[ticker]
                    elif ticker in frame.columns.get_level_values(1):
                        part = frame.xs(ticker, axis=1, level=1)
                    else:
                        failed.append(ticker)
                        continue
                if "Close" not in part:
                    failed.append(ticker)
                    continue
                key = market + ":" + ticker
                store = quotes.setdefault(key, {})
                for timestamp, value in part["Close"].items():
                    if pd.isna(value):
                        continue
                    price = float(value)
                    if not math.isfinite(price) or price <= 0:
                        continue
                    session_day = pd.Timestamp(timestamp).date()
                    if first_days[key] <= session_day <= today:
                        iso = session_day.isoformat()
                        rounded = round(price, 4)
                        if store.get(iso) != rounded:
                            store[iso] = rounded
                            updated += 1
            except Exception as exc:
                print("Warning: quote parsing failed", ticker, str(exc)[:160])
                failed.append(ticker)

data["quotesUpdatedAt"] = datetime.now(timezone.utc).isoformat()
data["quoteFailures"] = sorted(set(failed))
FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Tracked", sum(map(len, active.values())), "active market symbols;",
      updated, "new or revised close prices;", len(set(failed)), "failed symbols")
