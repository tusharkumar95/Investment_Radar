"""Import the openly licensed Market Clerk Canadian insider feed.

This is *secondary*, SEDI-derived coverage. The publisher imports Canadian data
periodically, so these are reported transactions, NOT independently verified SEDI
filings. Never guess the currency when the API omits it.
"""
import hashlib
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

URL = "https://marketclerk.com/api/v1/insiders.json?country=CA&days=90&limit=200"
OUT = Path("moves-canada-reported.json")
NOW = datetime.now(timezone.utc)
USER_AGENT = "InvestmentRadar/1.0 (personal research; GitHub tusharkumar95/Investment_Radar)"


def clean_day(value):
    try:
        return datetime.strptime(str(value or "")[:10], "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


def amount(value):
    try:
        n = float(value)
        return n if n > 0 and n < 1e15 else 0
    except (ValueError, TypeError):
        return 0


def normalize(item):
    if str(item.get("country") or "").upper() != "CA":
        return None
    direction = str(item.get("direction") or "").upper()
    if direction not in {"BUY", "SELL"}:
        return None
    symbol = str(item.get("ticker") or "").strip().upper()
    issuer = str(item.get("issuer") or "").strip()
    insider = str(item.get("insider") or "").strip()
    filed = clean_day(item.get("filed"))
    trade = clean_day(item.get("date"))
    qty = amount(item.get("shares"))
    price = amount(item.get("price"))
    value = amount(item.get("value"))
    if not symbol or not re.fullmatch(r"[A-Z0-9.]{1,14}", symbol):
        return None
    if not issuer or not insider or not filed or not trade or not qty or not price or not value:
        return None
    if trade > filed or (NOW.date() - datetime.fromisoformat(filed).date()).days not in range(-2, 100):
        return None
    raw_url = str(item.get("url") or "")
    parsed = urllib.parse.urlparse(raw_url)
    if parsed.scheme != "https" or parsed.hostname not in {"marketclerk.com", "www.marketclerk.com"}:
        return None
    currency = str(item.get("currency") or "").upper().strip()
    if currency in {"CAD", "CA$", "C$"}:
        currency = "CAD"
    elif currency in {"USD", "US$"}:
        currency = "USD"
    else:
        currency = "UNSPECIFIED"
    role = str(item.get("role") or "Reported insider").strip()
    key = "|".join((trade, filed, symbol, insider.casefold(), direction, str(qty), str(price)))
    rid = "marketclerk:" + hashlib.sha256(key.encode()).hexdigest()[:18]
    return {
        "id": rid, "market": "Canada", "symbol": symbol, "company": issuer,
        "investor": insider, "role": role, "direction": direction,
        "transactionDate": trade, "disclosureDate": filed, "date": filed,
        "quantity": int(qty), "netQty": int(qty), "avgPrice": price,
        "reportedValue": value, "currency": currency,
        "valueCAD": value if currency == "CAD" else None,
        "dealType": "Reported open-market insider transaction",
        "source": "Market Clerk (SEDI-derived; third-party)",
        "sourceName": "Market Clerk (SEDI-derived; third-party)",
        "sourceUrl": raw_url, "verified": False, "reported": True,
        "sourceQuality": "Secondary SEDI-derived report; check original filing",
        "actorType": role, "moveScore": 40, "strength": "Reported",
        "tags": ["insider buying"] if direction == "BUY" else ["selling"],
        "whyNotable": "Reported as an open-market insider trade by Market Clerk. Original SEDI filing not independently checked.",
        "notes": "Canadian records are periodically imported by this source; not necessarily same-day.",
    }


def run():
    previous = {}
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    archive = {r["id"]: r for r in previous.get("records", []) if r.get("id")}
    status = {"ok": False, "url": URL, "count": 0, "error": None}
    try:
        request = urllib.request.Request(URL, headers={
            "User-Agent": USER_AGENT, "Accept": "application/json"
        })
        with urllib.request.urlopen(request, timeout=18) as response:
            payload = json.loads(response.read(1200000))
        if not isinstance(payload, dict) or payload.get("country") != "CA" or not isinstance(payload.get("items"), list):
            raise ValueError("Not a Canadian insider feed")
        for item in payload["items"]:
            if isinstance(item, dict):
                row = normalize(item)
                if row:
                    archive[row["id"]] = row
                    status["count"] += 1
        status["ok"] = True
        status["asOf"] = payload.get("as_of")
    except (ValueError, OSError, TimeoutError) as error:
        status["error"] = str(error)[:180]
    cutoff = (NOW - timedelta(days=100)).date().isoformat()
    rows = [r for r in archive.values() if r.get("disclosureDate", "") >= cutoff]
    rows.sort(key=lambda r: (r["disclosureDate"], r["id"]), reverse=True)
    OUT.write_text(json.dumps({
        "updated": NOW.isoformat(), "source": "Market Clerk",
        "attributionUrl": "https://marketclerk.com",
        "license": "CC BY 4.0 — attribute and link back",
        "policy": "Secondary reports only; these are not primary-verified SEDI data.",
        "status": status, "records": rows[:2000],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Canadian secondary insider reports:", len(rows), "stored; source:", status)


if __name__ == "__main__":
    run()
