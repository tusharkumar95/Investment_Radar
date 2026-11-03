"""Canada New Try — named, documented investment transactions ONLY.

Independent of India Moves, Radar ranking, and the production Track Sheet.
Market data is used solely for post-disclosure tracking of verified purchases.
No volume, price-trend, RSI, breakout or momentum detection anywhere.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

ROOT = Path(".")
OUT = ROOT / "canada-new-try.json"
TODAY = datetime.now(ZoneInfo("America/Toronto")).date()
NOW = datetime.now(timezone.utc).isoformat()
DAYS_TO_RETAIN = 90
TRACK_DAYS = 45

def read(path, default):
    try:
        return json.loads((ROOT / path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def number(v):
    try:
        f = float(v)
        return f if math.isfinite(f) and f > 0 else None
    except (ValueError, TypeError):
        return None

def iso(v):
    try:
        return date.fromisoformat(str(v)[:10]).isoformat()
    except (ValueError, TypeError):
        return None

def entity_type(name):
    """A *name-based label*, not proof of legal status or beneficial ownership."""
    normalized = unicodedata.normalize("NFKD", str(name or "").upper())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    simple = re.sub(r"[^A-Z0-9]+", " ", normalized)
    tokens = set(simple.split())
    if tokens & {"FUND", "FUNDS", "ASSET", "BANK", "INSURANCE"}:
        return "Fund / financial institution (name-based)"
    if tokens & {"CORP", "CORPORATION", "INC", "LIMITED", "LTD", "LLP", "LP",
                 "PARTNERS", "CAPITAL", "HOLDINGS", "HOLDING", "INVESTMENTS",
                 "INVESTMENT", "RESOURCES", "MINERALS"} or "SARL" in simple.replace(" ", ""):
        return "Corporate / investment entity (name-based)"
    return "Named investor (type unconfirmed)"

def ticker_exchange(row):
    symbol = str(row.get("symbol") or "").upper().strip()
    if not re.fullmatch(r"[A-Z0-9.-]{1,15}", symbol):
        return None
    exchange = str(row.get("exchange") or "").upper().strip()
    if exchange in ("TSX", "TOR"):
        return symbol + ".TO"
    if exchange in ("TSXV", "TSX-V"):
        return symbol + ".V"
    return None  # Never guess which exchange the shares trade on.

def normalized_purchase(record):
    direction = str(record.get("direction") or "").upper()
    transaction_type = str(record.get("type") or record.get("transactionType") or "")
    if direction == "SELL":
        return None
    if direction not in ("", "BUY"):
        return None
    if direction == "" and not re.search(r"\bacqui(?:sition|red|res?)\b|\bpurchas", transaction_type, re.I):
        return None
    if "propos" in str(record.get("status") or "").lower():
        return None
    disclosed = iso(record.get("disclosureDate"))
    if not disclosed or not 0 <= (TODAY - date.fromisoformat(disclosed)).days <= DAYS_TO_RETAIN:
        return None
    investor = str(record.get("investor") or "").strip()
    company = str(record.get("company") or "").strip()
    symbol = str(record.get("symbol") or "").strip().upper()
    source = str(record.get("sourceUrl") or "").strip()
    quantity = number(record.get("shares") or record.get("quantity"))
    price = number(record.get("priceCAD") or record.get("avgPrice"))
    value = number(record.get("valueCAD"))
    if not all((investor, company, symbol, source, quantity, price, value)):
        return None
    if not source.startswith("https://"):
        return None
    # Source is an independently verified, manually curated dataset. The value
    # is the disclosed dollar amount; don't silently recompute or embellish it.
    trade = iso(record.get("transactionDate"))
    stable = "|".join([symbol, investor.casefold(), disclosed, trade or "", str(int(quantity))])
    rid = "owner:" + hashlib.sha256(stable.encode()).hexdigest()[:20]
    return {
        "id": rid, "symbol": ticker_exchange(record) or symbol,
        "symbolRaw": symbol, "name": company, "investor": investor,
        "buyerType": entity_type(investor), "direction": "BUY",
        "shares": int(quantity), "disclosedPrice": round(price, 4),
        "valueCAD": round(value, 2),
        "transactionDate": trade, "disclosureDate": disclosed,
        "transactionType": transaction_type or "Verified acquisition",
        "source": str(record.get("sourceName") or "Verified public disclosure"),
        "sourceUrl": source, "verifiedPurchase": True,
        "evidence": "Named acquisition documented in a reviewed public disclosure",
        "notes": str(record.get("notes") or ""),
        "buyerGroup": str(record.get("buyerGroup") or "").strip() or None,
        "jointActors": bool(record.get("jointActors")),
        "provenance": "Individually checked primary corporate release" if record.get("verifiedBy") else "Reviewed public acquisition disclosure",
    }

def purchases():
    # Do not import secondary reported-only SEDI feeds, Google News headlines,
    # or generic price-volume scans as confirmed acquisitions.
    manual = read("moves-canada-verified.json", {}).get("records", [])
    corporate = read("canada-corporate-verified.json", {}).get("records", [])
    sedi = read("moves-canada-sedi.json", {}).get("records", [])
    records = {}
    for record in [*manual, *corporate, *sedi]:
        row = normalized_purchase(record)
        if row:
            records[row["id"]] = row
    return sorted(records.values(), key=lambda r: (r["disclosureDate"], r["valueCAD"]), reverse=True)

def identity_group(event):
    # Related joint actors count as ONE independent investment group,
    # even if each legal entity's actual purchase is itemized separately.
    return event.get("buyerGroup") or "investor:"+" ".join(event["investor"].lower().split())

def company_summary(events):
    groups = defaultdict(list)
    for event in events:
        groups[event["symbolRaw"]].append(event)
    result = []
    for ticker, records in groups.items():
        buyers = sorted({r["investor"] for r in records})
        identities = {identity_group(r) for r in records}
        recurring = sorted({r["investor"] for r in records
                            if sum(1 for t in records if t["investor"]==r["investor"]) > 1})
        dates = [r["disclosureDate"] for r in records]
        result.append({
            "symbol": records[0]["symbol"], "name": records[0]["name"],
            "distinctBuyers": len(buyers), "independentGroups": len(identities),
            "investors": buyers, "repeatInvestors": recurring,
            "jointActorDisclosure": any(x.get("jointActors") for x in records),
            "transactions": len(records), "latestDisclosure": max(dates),
            "totalDisclosedCAD": round(sum(r["valueCAD"] for r in records),2),
            "sourceIds": [r["id"] for r in records],
        })
    return sorted(result, key=lambda x: (x["latestDisclosure"], x["totalDisclosedCAD"]),reverse=True)

def multiple_buyers(events):
    # Distinct independently operating buyer groups, not just separate
    # company names. For example Matachewan + McChip act jointly.
    recent = [e for e in events if 0 <= (TODAY-date.fromisoformat(e["disclosureDate"])).days <= 7]
    groups = company_summary(recent)
    return [dict(x,status="Two or more independent named buyer groups disclosed within seven days")
            for x in groups if x["independentGroups"] >= 2]

def investor_watch(events, leads):
    followed = [
      "Brookfield Corporation", "Fairfax Financial Holdings", "Sprott",
      "Altius Minerals Corporation", "Matachewan Consolidated Mines, Limited",
      "McChip Resources Inc.", "Nemesia S.à.r.l.", "Hartree Partners, LP",
      "PowerOne Capital Corp."
    ]
    names = list(followed)
    for e in events:
        if e["investor"] not in names:
            names.append(e["investor"])
    out = []
    for name in names:
        transactions = [e for e in events if name.lower() in e["investor"].lower()
                        or e["investor"].lower() in name.lower()]
        clean = name.lower().split()[0]
        candidate_count = sum(1 for x in leads if clean in x.get("title","").lower())
        out.append({
            "name":name, "verifiedPurchases":len(transactions),
            "totalDisclosedCAD":round(sum(x["valueCAD"] for x in transactions),2),
            "companies":sorted({x["name"] for x in transactions}),
            "latestDisclosure":max((x["disclosureDate"] for x in transactions),default=None),
            "candidateArticles":candidate_count,
            "status":"Verified transactions found" if transactions else "Monitored — no confirmed purchase in ledger"
        })
    return sorted(out,key=lambda x:(x["verifiedPurchases"],x["latestDisclosure"] or ""),reverse=True)

def download_closes(symbols):
    """Quotes ONLY for companies with verified purchase; never used to find buys."""
    found, errors = {}, []
    for ticker in sorted(set(s for s in symbols if s and (s.endswith(".TO") or s.endswith(".V")))):
        try:
            frame = yf.download(
                tickers=ticker, period="4mo", interval="1d",
                auto_adjust=False, progress=False, threads=False, timeout=20
            )
            if frame is None or frame.empty:
                continue
            if isinstance(frame.columns, pd.MultiIndex):
                if ("Close", ticker) in frame.columns:
                    col = frame[("Close", ticker)]
                elif (ticker, "Close") in frame.columns:
                    col = frame[(ticker, "Close")]
                else:
                    continue
            else:
                col = frame["Close"]
            values = {}
            for stamp, price in col.items():
                day = pd.Timestamp(stamp).date()
                p = number(price)
                if p and day <= TODAY:
                    values[day.isoformat()] = round(p,4)
            if values:
                found[ticker] = values
        except Exception as ex:
            errors.append(ticker+": "+str(ex)[:100])
    return found, errors

def checkpoint(close_map, begin, n):
    target = begin + timedelta(days=n)
    if target > TODAY:
        return {"offset": n, "day": None, "price": None}
    choices = sorted((d,p) for d,p in close_map.items()
                     if target <= date.fromisoformat(d) <= target+timedelta(days=7))
    return {"offset": n, "day": choices[0][0] if choices else None,
            "price": choices[0][1] if choices else None}

def tracks_for(events, quotes):
    old = read("canada-new-try.json", {})
    # Drop ALL old momentum/CDR/scan-created tracking records, permanently.
    old_verified = {t["id"]:t for t in old.get("tracks",[])
                    if str(t.get("id","")).startswith("owner:") and
                    t.get("lane")=="Verified ownership"}
    rebuilt=[]
    for e in events:
        previous = old_verified.get(e["id"], {})
        # Preserve previous snapshot by matching the original investor/source if
        # possible, but NEVER preserve any momentum-based tracked stock.
        if not previous:
            previous = next((t for t in old_verified.values()
                             if t.get("symbol")==e["symbol"] and
                             t.get("sourceUrl")==e["sourceUrl"]),{})
        started = iso(previous.get("started")) or TODAY.isoformat()
        start_day = date.fromisoformat(started)
        if (TODAY - start_day).days > TRACK_DAYS:
            continue
        quote_map = quotes.get(e["symbol"], {})
        checks = [checkpoint(quote_map,start_day,n) for n in (0,5,10,15,30)]
        last_date = max(quote_map,default=None)
        last_price = quote_map.get(last_date) if last_date else None
        first_price = checks[0]["price"]
        change = round((last_price/first_price-1)*100,2) if last_price and first_price else None
        rebuilt.append({
            "id": e["id"], "symbol": e["symbol"], "name": e["name"],
            "lane": "Verified ownership", "investor": e["investor"],
            "started": started, "disclosureDate": e["disclosureDate"],
            "transactionDate": e["transactionDate"], "valueCAD": e["valueCAD"],
            "reason": "Verified named investment purchase",
            "sourceUrl": e["sourceUrl"], "checkpoints": checks,
            "lastPrice": last_price, "lastPriceDate": last_date,
            "priceChangePct": change,
            "quoteStatus": "Available" if last_price else "No confirmed CAD close",
        })
    return sorted(rebuilt,key=lambda x:(x["started"],x["valueCAD"]),reverse=True)

def build_report(events, quotes=None, quote_errors=None):
    if quotes is None: quotes = {}
    if quote_errors is None: quote_errors = []
    companies = company_summary(events)
    alerts = multiple_buyers(events)
    tracked = tracks_for(events, quotes)
    discovery = read("canada-new-try-leads.json", {})
    leads = discovery.get("leads", [])
    sec = discovery.get("usFilings", [])
    sources = discovery.get("sourceHealth", [])
    watchers = investor_watch(events, leads)
    return {
        "schema": 2, "updated": NOW, "day": TODAY.isoformat(),
        "name": "Canada New Try — named institutional & corporate purchases",
        "policy": "Verified buys: manually reviewed buyer-specific original disclosures and SEDI confirmations only. Separate headline leads and SEC filings are NOT buy signals. Joint actors count as one independent group. No volume screening; U.S. CAD-hedged CDRs excluded without evidence of purchases of the CDR itself.",
        "purchases": events, "companies": companies,
        "multipleBuyers": alerts, "tracks": tracked,
        "investorWatch": watchers, "leads": leads[:160],
        "usFilings": sec[:100], "sourceHealth": sources,
        "officialSources": discovery.get("officialSources", []),
        "status": {"verifiedPurchases":len(events),"companies":len(companies),
                   "distinctBuyers":len(set(x["investor"] for x in events)),
                   "multipleBuyerSignals":len(alerts),
                   "tracked":len(tracked),"quoteErrors":quote_errors[:8],
                   "disclosureLeads":len(leads),"usFilingNotices":len(sec),
                   "sourcesOnline":sum(1 for s in sources if s.get("ok")),
                   "sourcesChecked":len(sources),
                   "quotePurpose":"Price tracking for verified purchases only"},
        "sources": [
            {"name":"Independently reviewed Canadian acquisition disclosures",
             "file":"moves-canada-verified.json"},
            {"name":"Individually verified corporate placements and early-warning announcements",
             "file":"canada-corporate-verified.json"},
            {"name":"Manually verified SEDI transactions (if imported)",
             "file":"moves-canada-sedi.json"},
            {"name":"Post-disclosure price history only",
             "url":"https://finance.yahoo.com"},
        ],
    }

def main():
    events=purchases()
    quotes, errors = download_closes(x["symbol"] for x in events)
    report=build_report(events,quotes,errors)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Canada New Try: verified buyers",report["status"]["distinctBuyers"],
          "verified acquisitions",len(events),"tracked",len(report["tracks"]),
          "quotes found",len(quotes),"errors",len(errors))

if __name__=="__main__":
    main()
