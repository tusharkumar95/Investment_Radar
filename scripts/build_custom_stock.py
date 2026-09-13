import json
import math
import re
import sys
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
CUSTOM_DIR = ROOT / "data" / "custom"
MAX_CUSTOM = 25


def num(value):
    try:
        x = float(value)
        return x if math.isfinite(x) else None
    except Exception:
        return None


def pct(value):
    x = num(value)
    if x is None:
        return None
    return x * 100 if abs(x) <= 1 else x


def latest(frame, names):
    if frame is None or getattr(frame, "empty", True):
        return None
    for name in names:
        if name in frame.index:
            row = pd.to_numeric(frame.loc[name], errors="coerce").dropna()
            if not row.empty:
                return num(row.iloc[0])
    return None


def series(frame, names):
    if frame is None or getattr(frame, "empty", True):
        return []
    for name in names:
        if name in frame.index:
            row = pd.to_numeric(frame.loc[name], errors="coerce").dropna()
            if len(row) >= 2:
                return [num(x) for x in row.iloc[::-1].tolist() if num(x) is not None]
    return []


def cagr(values):
    values = [x for x in values if x is not None]
    if len(values) < 2:
        return None
    years = min(5, len(values) - 1)
    start = values[-1 - years]
    end = values[-1]
    # CAGR is not meaningful when the starting value is zero/negative.
    if start is None or end is None or start <= 0 or end <= 0:
        return None
    return ((end / start) ** (1 / years) - 1) * 100


def technical_rows(history):
    rows = []
    for idx, row in history.tail(420).iterrows():
        rows.append({
            "date": str(idx.date()) if hasattr(idx, "date") else str(idx),
            "open": num(row.get("Open")),
            "high": num(row.get("High")),
            "low": num(row.get("Low")),
            "close": num(row.get("Close")),
            "volume": num(row.get("Volume")),
        })
    return rows


def build(ticker, market):
    stock = yf.Ticker(ticker)
    info = {}
    try:
        info = stock.info or {}
    except Exception as exc:
        print(f"info warning: {exc}")

    income = stock.financials
    balance = stock.balance_sheet
    cashflow = stock.cashflow
    history = stock.history(period="5y", auto_adjust=False)
    if history is None or history.empty:
        raise RuntimeError(f"No price history returned for {ticker}")
    history = history.dropna(subset=["Close"])
    close = pd.to_numeric(history["Close"], errors="coerce").dropna()
    if len(close) < 100:
        raise RuntimeError(f"Only {len(close)} trading days returned for {ticker}")

    current = num(close.iloc[-1])
    previous = num(close.iloc[-2]) if len(close) > 1 else None
    change_pct = (current / previous - 1) * 100 if current and previous else None

    revenue = latest(income, ["Total Revenue", "Operating Revenue", "Revenue"]) or num(info.get("totalRevenue"))
    net_income = latest(income, ["Net Income", "Net Income Common Stockholders"]) or num(info.get("netIncomeToCommon"))
    operating_income = latest(income, ["Operating Income", "EBIT"]) or num(info.get("operatingIncome"))
    gross_profit = latest(income, ["Gross Profit"])
    ebitda = latest(income, ["EBITDA", "Normalized EBITDA"]) or num(info.get("ebitda"))
    operating_cf = latest(cashflow, ["Operating Cash Flow", "Total Cash From Operating Activities"]) or num(info.get("operatingCashflow"))
    capex = latest(cashflow, ["Capital Expenditure", "Capital Expenditure Reported", "Purchase Of PPE", "Purchase Of Property Plant And Equipment"])
    fcf = latest(cashflow, ["Free Cash Flow"])
    if fcf is None and operating_cf is not None and capex is not None:
        fcf = operating_cf - abs(capex)
    cash = latest(balance, ["Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents", "Cash Financial"]) or num(info.get("totalCash"))
    debt = latest(balance, ["Total Debt", "Total Debt And Capital Lease Obligation", "Long Term Debt"]) or num(info.get("totalDebt"))
    assets = latest(balance, ["Total Assets"]) or num(info.get("totalAssets"))
    equity = latest(balance, ["Stockholders Equity", "Total Stockholder Equity", "Common Stock Equity"]) or num(info.get("stockholdersEquity"))

    revenue_growth = cagr(series(income, ["Total Revenue", "Operating Revenue", "Revenue"]))
    if revenue_growth is None:
        revenue_growth = pct(info.get("revenueGrowth"))
    eps_growth = cagr(series(income, ["Diluted EPS", "Diluted EPS Continuing Operations", "Basic EPS"]))
    if eps_growth is None:
        eps_growth = pct(info.get("earningsGrowth"))

    profit_margin = pct(info.get("profitMargins"))
    if profit_margin is None and revenue and net_income is not None:
        profit_margin = net_income / revenue * 100
    roe = pct(info.get("returnOnEquity"))
    if roe is None and net_income is not None and equity:
        roe = net_income / equity * 100
    roic = pct(info.get("returnOnTotalCapital"))
    if roic is None and operating_income is not None and equity:
        tax = pct(info.get("taxRate")) or 25
        invested = equity + (debt or 0) - (cash or 0)
        if invested > 0:
            roic = operating_income * (1 - tax / 100) / invested * 100
    de = num(info.get("debtToEquity"))
    if de is not None and de > 10:
        de /= 100
    if de is None and debt is not None and equity:
        de = debt / equity

    market_cap = num(info.get("marketCap"))
    enterprise = num(info.get("enterpriseValue"))
    pe = num(info.get("trailingPE"))
    forward_pe = num(info.get("forwardPE"))
    ps = num(info.get("priceToSalesTrailing12Months"))
    pb = num(info.get("priceToBook"))
    ev_ebitda = num(info.get("enterpriseToEbitda"))
    price_fcf = market_cap / fcf if market_cap and fcf and fcf > 0 else None
    peg = pe / eps_growth if pe and eps_growth and eps_growth > 0 else None

    dividend_rate = num(info.get("dividendRate"))
    dividend_yield = None
    if dividend_rate is not None and current:
        dividend_yield = dividend_rate / current * 100
    if dividend_yield is None:
        dividend_yield = pct(info.get("dividendYield"))
    payout = pct(info.get("payoutRatio"))

    technical = {
        "price": current,
        "currentPrice": current,
        "sma20": num(close.tail(20).mean()),
        "sma50": num(close.tail(50).mean()),
        "sma200": num(close.tail(200).mean()) if len(close) >= 200 else None,
        "momentum3M": (current / close.iloc[-64] - 1) * 100 if len(close) >= 64 else None,
        "momentum6M": (current / close.iloc[-127] - 1) * 100 if len(close) >= 127 else None,
        "momentum1Y": (current / close.iloc[-252] - 1) * 100 if len(close) >= 252 else None,
        "high52Week": num(history.tail(252)["High"].max()),
        "low52Week": num(history.tail(252)["Low"].min()),
        "historyDays": len(history),
        "history": technical_rows(history),
    }

    ownership = {
        "insiderHolding": pct(info.get("heldPercentInsiders")),
        "institutionalHolding": pct(info.get("heldPercentInstitutions")),
        "promoterHolding": None,
        "promoterChange": None,
        "promoterPledge": None,
        "institutionalChange": None,
        "recentBigInvestors": [],
    }

    return {
        "ticker": ticker,
        "name": info.get("longName") or info.get("shortName") or ticker,
        "type": "Custom Stock",
        "market": market,
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "price": {"current": current, "previousClose": previous, "changePercent": change_pct},
        "priceData": {"previousClose": previous, "changePercent": change_pct},
        "fundamentals": {
            "revenue": revenue,
            "netIncome": net_income,
            "operatingIncome": operating_income,
            "grossProfit": gross_profit,
            "ebitda": ebitda,
            "operatingCashFlow": operating_cf,
            "freeCashFlow": fcf,
            "cash": cash,
            "totalDebt": debt,
            "totalAssets": assets,
            "stockholdersEquity": equity,
            "revenueGrowth5Y": revenue_growth,
            "epsGrowth5Y": eps_growth,
            "profitMargin": profit_margin,
            "roe": roe,
            "roic": roic,
            "debtToEquity": de,
            "eps": num(info.get("trailingEps")),
        },
        "valuation": {
            "marketCap": market_cap,
            "enterpriseValue": enterprise,
            "pe": pe,
            "forwardPE": forward_pe,
            "peg": peg,
            "priceToSales": ps,
            "priceToBook": pb,
            "evToEbitda": ev_ebitda,
            "priceToFcf": price_fcf,
            "beta": num(info.get("beta")),
        },
        "ownership": ownership,
        "dividend": {"yield": dividend_yield, "rate": dividend_rate, "payout": payout, "growth": None},
        "technical": technical,
        "custom": {"updatedAt": pd.Timestamp.utcnow().isoformat(), "source": "Yahoo Finance via yfinance"},
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/build_custom_stock.py TICKER MARKET")
    ticker = sys.argv[1].strip().upper()
    market = sys.argv[2].strip().title()
    if market not in {"Canada", "India"}:
        raise SystemExit("Market must be Canada or India")
    if not re.fullmatch(r"[A-Z0-9._-]{1,30}", ticker):
        raise SystemExit("Invalid ticker")

    CUSTOM_DIR.mkdir(parents=True, exist_ok=True)
    existing = list(CUSTOM_DIR.glob("*.json"))
    target = CUSTOM_DIR / f"{ticker.replace('/', '_')}.json"
    if target not in existing and len(existing) >= MAX_CUSTOM:
        raise SystemExit(f"Custom stock limit reached ({MAX_CUSTOM}). Remove an old custom file first.")

    data = build(ticker, market)
    with target.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, allow_nan=False)
    print(f"Saved {target}")


if __name__ == "__main__":
    main()
