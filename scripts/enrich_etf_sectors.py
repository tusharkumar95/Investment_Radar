import json
import math
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

STATIC_SECTORS = {
    "BANKBEES.NS": [("Financial Services", 100.0)],
    "ITBEES.NS": [("Technology", 100.0)],
    "ITETF.NS": [("Technology", 100.0)],
    "PHARMABEES.NS": [("Healthcare", 100.0)],
    "HEALTHIETF.NS": [("Healthcare", 100.0)],
    "AUTOBEES.NS": [("Consumer Cyclical", 100.0)],
    "PSUBNKBEES.NS": [("Financial Services", 100.0)],
    "PVTBANIETF.NS": [("Financial Services", 100.0)],
    "METALIETF.NS": [("Basic Materials", 100.0)],
    "FMCGIETF.NS": [("Consumer Defensive", 100.0)],
}

SECTOR_NAMES = {
    "basic_materials": "Basic Materials",
    "consumer_cyclical": "Consumer Cyclical",
    "financial_services": "Financial Services",
    "realestate": "Real Estate",
    "real_estate": "Real Estate",
    "communication_services": "Communication Services",
    "energy": "Energy",
    "industrials": "Industrials",
    "technology": "Technology",
    "consumer_defensive": "Consumer Defensive",
    "healthcare": "Healthcare",
    "utilities": "Utilities",
}


def num(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def pct(value):
    value = num(value)
    if value is None:
        return None
    return value * 100 if abs(value) <= 1 else value


def sector_name(raw):
    key = str(raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    return SECTOR_NAMES.get(key) or key.replace("_", " ").title()


def live_sectors(ticker):
    try:
        raw = getattr(yf.Ticker(ticker).funds_data, "sector_weightings", None)
        if raw is None:
            return []
        items = raw.items() if hasattr(raw, "items") else []
        rows = []
        for key, value in items:
            weight = pct(value)
            if weight is None or weight <= 0:
                continue
            rows.append({"sector": sector_name(key), "weight": round(weight, 4)})
        rows.sort(key=lambda x: x["weight"], reverse=True)
        return rows
    except Exception as exc:
        print(f"Sector weights unavailable for {ticker}: {exc}")
        return []


def sectors(ticker):
    rows = live_sectors(ticker)
    if rows:
        return rows
    return [{"sector": name, "weight": weight} for name, weight in STATIC_SECTORS.get(ticker, [])]


def enrich(path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    covered = 0
    for etf in payload.get("etfs", []):
        etf["sectors"] = sectors(str(etf.get("ticker") or ""))
        if etf["sectors"]:
            covered += 1
        print(f"{payload.get('market')}: {etf.get('ticker')} -> {len(etf['sectors'])} sectors")
    payload["sectorCoverageEtfs"] = covered
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return covered, len(payload.get("etfs", []))


def main():
    for filename in ("etf_canada.json", "etf_india.json"):
        path = DATA / filename
        covered, total = enrich(path)
        print(f"{filename}: sector exposure available for {covered}/{total} ETFs")


if __name__ == "__main__":
    main()
