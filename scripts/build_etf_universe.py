import json
import math
from pathlib import Path
from datetime import datetime, timezone

import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data"

# Curated ETF candidates; data is refreshed by GitHub Actions.
CANDIDATES = {
    "Canada": [
        "XIU.TO", "XIC.TO", "VCN.TO", "ZCN.TO", "VFV.TO", "ZSP.TO", "XQQ.TO", "QQC.F.TO",
        "XEF.TO", "VIU.TO", "XEC.TO", "VEE.TO", "XBB.TO", "ZAG.TO", "VAB.TO", "XRE.TO",
        "XEI.TO", "VDY.TO", "XDIV.TO", "CDZ.TO", "TEC.TO", "HCLN.TO", "HURA.TO", "CEF.TO",
        "ZLB.TO", "ZLU.TO", "XMV.TO", "XUU.TO", "XAW.TO", "ZSP.U.TO"
    ],
    "India": [
        "NIFTYBEES.NS", "JUNIORBEES.NS", "BANKBEES.NS", "ITBEES.NS", "PHARMABEES.NS", "CPSEETF.NS",
        "GOLDBEES.NS", "SILVERBEES.NS", "MON100.NS", "SETFNIF50.NS", "ICICIB22.NS", "HDFCNIFTY.NS",
        "NIFTYIETF.NS", "LOWVOL1.NS", "MID150BEES.NS", "MIDCAPETF.NS", "ALPHA.NS", "MOM100.NS",
        "AUTOBEES.NS", "CONSUMBEES.NS", "FMCGIETF.NS", "HEALTHIETF.NS", "METALIETF.NS", "PSUBNKBEES.NS",
        "PVTBANIETF.NS", "ITETF.NS", "GILT5YBEES.NS", "LIQUIDBEES.NS", "MNC.NS"
    ]
}

def num(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None

def pct(v):
    x = num(v)
    if x is None: return None
    return x * 100 if abs(x) <= 1 else x

def safe_info(ticker):
    try: return yf.Ticker(ticker).info or {}
    except Exception: return {}

def holdings(ticker):
    try:
        data = yf.Ticker(ticker).funds_data
        top = getattr(data, "top_holdings", None)
        if top is None: return []
        return [{"ticker": str(symbol), "weight": pct(row.get("Holding Percent") if hasattr(row, "get") else None)} for symbol, row in top.iterrows()][:25]
    except Exception:
        return []

def build_market(market):
    rows = []
    for ticker in CANDIDATES[market]:
        info = safe_info(ticker)
        price = num(info.get("regularMarketPrice") or info.get("currentPrice"))
        if price is None:
            try: price = num(yf.Ticker(ticker).fast_info.get("last_price"))
            except Exception: price = None
        if price is None: continue
        expense = num(info.get("annualReportExpenseRatio"))
        if expense is not None and expense > 1: expense /= 100
        rows.append({
            "ticker": ticker, "name": info.get("longName") or info.get("shortName") or ticker,
            "market": market, "category": info.get("category") or info.get("fundFamily") or "ETF",
            "currency": info.get("currency") or ("CAD" if market == "Canada" else "INR"),
            "price": price, "aum": num(info.get("totalAssets")), "expenseRatio": expense,
            "yield": pct(info.get("yield") or info.get("trailingAnnualDividendYield")),
            "threeYearReturn": pct(info.get("threeYearAverageReturn")), "fiveYearReturn": pct(info.get("fiveYearAverageReturn")),
            "beta3Y": num(info.get("beta3Year")), "inception": info.get("fundInceptionDate"),
            "issuer": info.get("fundFamily") or info.get("issuer") or "", "holdings": holdings(ticker)
        })
        print(f"{market}: {ticker} -> OK")
    rows.sort(key=lambda x: (x.get("aum") or 0), reverse=True)
    return rows

def main():
    OUT.mkdir(exist_ok=True)
    for market, filename in [("Canada", "etf_canada.json"), ("India", "etf_india.json")]:
        rows = build_market(market)
        payload = {"market": market, "updatedAt": datetime.now(timezone.utc).isoformat(), "count": len(rows), "etfs": rows}
        (OUT / filename).write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Saved {filename}: {len(rows)} ETFs")

if __name__ == "__main__": main()
