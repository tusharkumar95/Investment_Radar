import json
import math
from pathlib import Path
from datetime import datetime, timezone

import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data"

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
    if x is None:
        return None
    return x * 100 if abs(x) <= 1 else x

def safe_info(ticker):
    try:
        return yf.Ticker(ticker).info or {}
    except Exception:
        return {}

def holdings(ticker):
    """Return equity holdings from Yahoo, using top_holdings first and
    equity_holdings as a fallback. Some non-US ETFs expose only the latter."""
    try:
        fund = yf.Ticker(ticker).funds_data
        frames = []
        top = getattr(fund, "top_holdings", None)
        if top is not None and not getattr(top, "empty", True):
            frames.append(top)
        equity = getattr(fund, "equity_holdings", None)
        if equity is not None and not getattr(equity, "empty", True):
            frames.append(equity)
        for frame in frames:
            result = []
            for symbol, row in frame.iterrows():
                symbol = str(symbol).strip().upper()
                if not symbol or symbol in {"NAN", "NONE"}:
                    continue
                weight = None
                if hasattr(row, "get"):
                    for key in ("Holding Percent", "holdingPercent", "Weight", "weight"):
                        weight = pct(row.get(key))
                        if weight is not None:
                            break
                result.append({"ticker": symbol, "weight": weight})
            if result:
                return result[:25]
    except Exception as exc:
        print(f"Holdings unavailable for {ticker}: {exc}")
    return []

def load_company_names():
    names = {}
    for filename in ("canada.json", "india.json"):
        path = OUT / filename
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for stock in data.get("stocks", []):
                ticker = str(stock.get("ticker") or "").upper()
                if ticker and stock.get("name"):
                    names[ticker] = stock["name"]
        except Exception:
            pass
    return names

def enrich_holding_names(items, names):
    out = []
    for item in items:
        ticker = str(item.get("ticker") or "").upper()
        row = dict(item)
        row["name"] = names.get(ticker, ticker)
        out.append(row)
    return out

def build_market(market):
    rows = []
    names = load_company_names()
    for ticker in CANDIDATES[market]:
        info = safe_info(ticker)
        price = num(info.get("regularMarketPrice") or info.get("currentPrice"))
        if price is None:
            try:
                price = num(yf.Ticker(ticker).fast_info.get("last_price"))
            except Exception:
                price = None
        if price is None:
            continue
        expense = num(info.get("annualReportExpenseRatio"))
        if expense is not None and expense > 1:
            expense /= 100
        raw_holdings = holdings(ticker)
        rows.append({
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName") or ticker,
            "market": market,
            "category": info.get("category") or info.get("fundFamily") or "ETF",
            "currency": info.get("currency") or ("CAD" if market == "Canada" else "INR"),
            "price": price,
            "aum": num(info.get("totalAssets")),
            "expenseRatio": expense,
            "yield": pct(info.get("yield") or info.get("trailingAnnualDividendYield")),
            "threeYearReturn": pct(info.get("threeYearAverageReturn")),
            "fiveYearReturn": pct(info.get("fiveYearAverageReturn")),
            "beta3Y": num(info.get("beta3Year")),
            "inception": info.get("fundInceptionDate"),
            "issuer": info.get("fundFamily") or info.get("issuer") or "",
            "holdings": enrich_holding_names(raw_holdings, names)
        })
        print(f"{market}: {ticker} -> OK ({len(raw_holdings)} holdings)")
    rows.sort(key=lambda x: (x.get("aum") or 0), reverse=True)
    return rows

def main():
    OUT.mkdir(exist_ok=True)
    for market, filename in [("Canada", "etf_canada.json"), ("India", "etf_india.json")]:
        rows = build_market(market)
        payload = {"market": market, "updatedAt": datetime.now(timezone.utc).isoformat(), "count": len(rows), "etfs": rows}
        (OUT / filename).write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Saved {filename}: {len(rows)} ETFs")

if __name__ == "__main__":
    main()
