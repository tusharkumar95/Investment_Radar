import json
import math
import os
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf


# ============================================================
# INVESTMENT RADAR - MARKET DATA UPDATER
# ============================================================
#
# Purpose:
#   1. Load the investment universe created by build_universe.py
#   2. Download historical prices in batches
#   3. Calculate technical/market data
#   4. Retrieve fundamentals, valuation, ownership and dividend data
#   5. Save everything in the JSON structure used by the website
#
# This file is designed for GitHub Actions + GitHub Pages.
# ============================================================


DATA_FILES = {
    "Canada": "data/canada.json",
    "India": "data/india.json",
}

HISTORY_PERIOD = "5y"
BATCH_SIZE = 30

# Small pause between batches.
BATCH_SLEEP = 2

# Number of attempts for Yahoo requests.
MAX_RETRIES = 4


# ============================================================
# BASIC HELPERS
# ============================================================

def safe_float(value):
    """Convert a value to a normal Python float or None."""

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    try:
        value = float(value)

        if not math.isfinite(value):
            return None

        return value

    except Exception:
        return None


def safe_int(value):
    value = safe_float(value)

    if value is None:
        return None

    try:
        return int(value)
    except Exception:
        return None


def first_valid(*values):
    """Return the first non-None numeric value."""

    for value in values:
        value = safe_float(value)

        if value is not None:
            return value

    return None


def clean_dict(value):
    """Remove None/NaN values recursively."""

    if isinstance(value, dict):
        return {
            key: clean_dict(val)
            for key, val in value.items()
            if val is not None
        }

    if isinstance(value, list):
        return [
            clean_dict(item)
            for item in value
            if item is not None
        ]

    value_float = safe_float(value)

    if value_float is not None:
        return value_float

    return value


def sleep_backoff(attempt):
    time.sleep(2 ** attempt)


# ============================================================
# YAHOO DOWNLOAD
# ============================================================

def download_history_batch(tickers):
    """
    Download historical prices for multiple tickers at once.

    This is the major change from the old updater.
    """

    if not tickers:
        return pd.DataFrame()

    ticker_string = " ".join(tickers)

    for attempt in range(MAX_RETRIES):

        try:
            print(
                f"Downloading price history for "
                f"{len(tickers)} tickers..."
            )

            data = yf.download(
                ticker_string,
                period=HISTORY_PERIOD,
                interval="1d",
                auto_adjust=False,
                progress=False,
                threads=False,
                group_by="column",
                timeout=30,
            )

            if data is not None and not data.empty:
                print(
                    f"Successfully downloaded batch "
                    f"of {len(tickers)} tickers."
                )
                return data

            print(
                f"Empty Yahoo response "
                f"(attempt {attempt + 1}/{MAX_RETRIES})"
            )

        except Exception as exc:
            print(
                f"Yahoo batch error "
                f"(attempt {attempt + 1}/{MAX_RETRIES}): {exc}"
            )

        sleep_backoff(attempt)

    print("FAILED: price batch could not be downloaded.")
    return pd.DataFrame()


# ============================================================
# HISTORY EXTRACTION
# ============================================================

def get_ticker_history(batch_data, ticker):
    """
    Extract one ticker's historical data from a batch download.
    Handles both MultiIndex and single-ticker responses.
    """

    if batch_data is None or batch_data.empty:
        return pd.DataFrame()

    try:

        # MultiIndex columns are normally:
        # ('Close', 'SHOP.TO')
        # ('Open', 'SHOP.TO')
        #
        # Depending on yfinance version the levels may be reversed.

        if isinstance(batch_data.columns, pd.MultiIndex):

            level0 = list(batch_data.columns.get_level_values(0))
            level1 = list(batch_data.columns.get_level_values(1))

            if ticker in level1:

                result = batch_data.xs(
                    ticker,
                    axis=1,
                    level=1,
                    drop_level=True
                )

                return result.copy()

            if ticker in level0:

                result = batch_data.xs(
                    ticker,
                    axis=1,
                    level=0,
                    drop_level=True
                )

                return result.copy()

        # Single ticker / normal columns
        return batch_data.copy()

    except Exception as exc:

        print(
            f"Could not extract history for {ticker}: {exc}"
        )

        return pd.DataFrame()


# ============================================================
# TECHNICAL CALCULATIONS
# ============================================================

def calculate_technical(history):

    result = {
        "sma50": None,
        "sma200": None,
        "momentum3m": None,
        "momentum6m": None,
        "momentum1y": None,
        "volatility30d": None,
        "volatility90d": None,
        "drawdown52w": None,
        "high52w": None,
        "low52w": None,
        "volume": None,
        "averageVolume20d": None,
        "trend": None,
    }

    if history is None or history.empty:
        return result

    try:

        history = history.copy()

        # Normalize column names.
        history.columns = [
            str(column).lower().replace(" ", "")
            for column in history.columns
        ]

        close_column = None

        for name in ["close", "adjclose"]:

            if name in history.columns:
                close_column = name
                break

        if close_column is None:
            return result

        close = pd.to_numeric(
            history[close_column],
            errors="coerce"
        ).dropna()

        if close.empty:
            return result

        latest = safe_float(close.iloc[-1])

        if latest is None:
            return result

        # ----------------------------------------------------
        # Moving averages
        # ----------------------------------------------------

        if len(close) >= 50:
            result["sma50"] = safe_float(
                close.tail(50).mean()
            )

        if len(close) >= 200:
            result["sma200"] = safe_float(
                close.tail(200).mean()
            )

        # ----------------------------------------------------
        # Momentum
        # ----------------------------------------------------

        if len(close) >= 64:
            old = safe_float(close.iloc[-64])

            if old:
                result["momentum3m"] = (
                    latest / old - 1
                ) * 100

        if len(close) >= 127:
            old = safe_float(close.iloc[-127])

            if old:
                result["momentum6m"] = (
                    latest / old - 1
                ) * 100

        if len(close) >= 252:
            old = safe_float(close.iloc[-252])

            if old:
                result["momentum1y"] = (
                    latest / old - 1
                ) * 100

        # ----------------------------------------------------
        # Volatility
        # ----------------------------------------------------

        returns = close.pct_change().dropna()

        if len(returns) >= 30:

            result["volatility30d"] = (
                returns.tail(30).std() * np.sqrt(252) * 100
            )

        if len(returns) >= 90:

            result["volatility90d"] = (
                returns.tail(90).std() * np.sqrt(252) * 100
            )

        # ----------------------------------------------------
        # 52-week high / low
        # ----------------------------------------------------

        last_252 = close.tail(252)

        if not last_252.empty:

            high_52 = safe_float(last_252.max())
            low_52 = safe_float(last_252.min())

            result["high52w"] = high_52
            result["low52w"] = low_52

            if high_52:

                result["drawdown52w"] = (
                    (latest / high_52) - 1
                ) * 100

        # ----------------------------------------------------
        # Volume
        # ----------------------------------------------------

        if "volume" in history.columns:

            volume = pd.to_numeric(
                history["volume"],
                errors="coerce"
            ).dropna()

            if not volume.empty:

                result["volume"] = safe_float(
                    volume.iloc[-1]
                )

                result["averageVolume20d"] = safe_float(
                    volume.tail(20).mean()
                )

        # ----------------------------------------------------
        # Trend
        # ----------------------------------------------------

        sma50 = result["sma50"]
        sma200 = result["sma200"]

        if sma50 and sma200:

            if latest > sma50 > sma200:
                result["trend"] = "Strong Uptrend"

            elif latest > sma50:
                result["trend"] = "Uptrend"

            elif latest < sma50 < sma200:
                result["trend"] = "Downtrend"

            else:
                result["trend"] = "Mixed"

        elif sma50:

            if latest > sma50:
                result["trend"] = "Uptrend"
            else:
                result["trend"] = "Downtrend"

    except Exception as exc:

        print(
            f"Technical calculation error: {exc}"
        )

    return clean_dict(result)


# ============================================================
# FINANCIAL STATEMENT HELPERS
# ============================================================

def statement_value(statement, possible_names):
    """
    Find a financial statement line item using several possible
    Yahoo naming conventions.
    """

    if statement is None:
        return None

    if not isinstance(statement, pd.DataFrame):
        return None

    if statement.empty:
        return None

    for name in possible_names:

        if name in statement.index:

            try:

                row = statement.loc[name]

                if isinstance(row, pd.Series):

                    for value in row.values:

                        number = safe_float(value)

                        if number is not None:
                            return number

            except Exception:
                pass

    # Fuzzy fallback.
    for index in statement.index:

        index_text = str(index).lower()

        for name in possible_names:

            search = name.lower()

            if search in index_text:

                try:

                    row = statement.loc[index]

                    if isinstance(row, pd.Series):

                        for value in row.values:

                            number = safe_float(value)

                            if number is not None:
                                return number

                except Exception:
                    pass

    return None


def latest_two_values(statement, possible_names):

    if statement is None or statement.empty:
        return []

    for name in possible_names:

        if name in statement.index:

            try:

                row = statement.loc[name]

                if isinstance(row, pd.Series):

                    values = []

                    for value in row.values:

                        number = safe_float(value)

                        if number is not None:
                            values.append(number)

                    return values[:5]

            except Exception:
                pass

    return []


# ============================================================
# GROWTH
# ============================================================

def calculate_cagr(values, years):

    if not values:
        return None

    if len(values) < 2:
        return None

    latest = safe_float(values[0])
    oldest = safe_float(values[-1])

    if latest is None or oldest is None:
        return None

    if oldest <= 0 or latest <= 0:
        return None

    try:

        return (
            (latest / oldest) ** (1 / years) - 1
        ) * 100

    except Exception:
        return None


def calculate_growth_from_statement(
    statement,
    names,
    years=4
):

    values = latest_two_values(
        statement,
        names
    )

    if len(values) < 2:
        return None

    actual_years = min(
        years,
        len(values) - 1
    )

    if actual_years <= 0:
        return None

    latest = values[0]
    oldest = values[actual_years]

    if latest <= 0 or oldest <= 0:
        return None

    try:

        return (
            (latest / oldest)
            ** (1 / actual_years)
            - 1
        ) * 100

    except Exception:
        return None


# ============================================================
# FUNDAMENTALS
# ============================================================

def build_fundamentals(
    info,
    income_stmt,
    balance_sheet,
    cashflow
):

    revenue = statement_value(
        income_stmt,
        [
            "Total Revenue",
            "Operating Revenue",
            "Revenue"
        ]
    )

    net_income = statement_value(
        income_stmt,
        [
            "Net Income",
            "Net Income Common Stockholders",
            "Net Income Including Noncontrolling Interests"
        ]
    )

    operating_income = statement_value(
        income_stmt,
        [
            "Operating Income",
            "Operating Income As Reported"
        ]
    )

    gross_profit = statement_value(
        income_stmt,
        [
            "Gross Profit"
        ]
    )

    ebitda = statement_value(
        income_stmt,
        [
            "EBITDA",
            "Normalized EBITDA"
        ]
    )

    free_cash_flow = statement_value(
        cashflow,
        [
            "Free Cash Flow"
        ]
    )

    operating_cash_flow = statement_value(
        cashflow,
        [
            "Operating Cash Flow",
            "Total Cash From Operating Activities"
        ]
    )

    total_debt = statement_value(
        balance_sheet,
        [
            "Total Debt",
            "Long Term Debt And Capital Lease Obligation",
            "Long Term Debt"
        ]
    )

    total_assets = statement_value(
        balance_sheet,
        [
            "Total Assets"
        ]
    )

    stockholders_equity = statement_value(
        balance_sheet,
        [
            "Stockholders Equity",
            "Total Equity Gross Minority Interest",
            "Common Stock Equity"
        ]
    )

    cash = statement_value(
        balance_sheet,
        [
            "Cash Cash Equivalents And Short Term Investments",
            "Cash And Cash Equivalents",
            "Cash Financial"
        ]
    )

    revenue_growth = first_valid(
        info.get("revenueGrowth"),
        calculate_growth_from_statement(
            income_stmt,
            [
                "Total Revenue",
                "Operating Revenue",
                "Revenue"
            ]
        )
    )

    earnings_growth = first_valid(
        info.get("earningsGrowth"),
        info.get("earningsQuarterlyGrowth")
    )

    if earnings_growth is not None:
        earnings_growth *= 100

    profit_margin = first_valid(
        info.get("profitMargins")
    )

    if profit_margin is not None:
        profit_margin *= 100

    roe = first_valid(
        info.get("returnOnEquity")
    )

    if roe is not None:
        roe *= 100

    roic = None

    # Conservative ROIC calculation.
    if operating_income is not None:

        tax_rate = first_valid(
            info.get("taxRate")
        )

        if tax_rate is None:
            tax_rate = 0.25

        nopat = operating_income * (
            1 - tax_rate
        )

        debt = total_debt or 0
        equity = stockholders_equity or 0
        invested_capital = debt + equity

        if invested_capital > 0:

            roic = (
                nopat / invested_capital
            ) * 100

    debt_to_equity = first_valid(
        info.get("debtToEquity")
    )

    if debt_to_equity is not None:
        debt_to_equity /= 100

    interest_expense = statement_value(
        income_stmt,
        [
            "Interest Expense",
            "Interest Expense Non Operating"
        ]
    )

    interest_coverage = None

    if (
        operating_income is not None
        and interest_expense is not None
        and interest_expense != 0
    ):

        interest_coverage = (
            operating_income
            / abs(interest_expense)
        )

    return clean_dict({
        "revenue": revenue,
        "netIncome": net_income,
        "operatingIncome": operating_income,
        "grossProfit": gross_profit,
        "ebitda": ebitda,
        "freeCashFlow": free_cash_flow,
        "operatingCashFlow": operating_cash_flow,
        "cash": cash,
        "totalDebt": total_debt,
        "totalAssets": total_assets,
        "stockholdersEquity": stockholders_equity,
        "revenueGrowth5Y": revenue_growth,
        "epsGrowth5Y": earnings_growth,
        "profitMargin": profit_margin,
        "roe": roe,
        "roic": roic,
        "debtToEquity": debt_to_equity,
        "interestCoverage": interest_coverage,
    })


# ============================================================
# VALUATION
# ============================================================

def build_valuation(info):

    return clean_dict({

        "pe": first_valid(
            info.get("trailingPE")
        ),

        "forwardPE": first_valid(
            info.get("forwardPE")
        ),

        "peg": first_valid(
            info.get("pegRatio")
        ),

        "priceToSales": first_valid(
            info.get("priceToSalesTrailing12Months")
        ),

        "priceToBook": first_valid(
            info.get("priceToBook")
        ),

        "enterpriseToEbitda": first_valid(
            info.get("enterpriseToEbitda")
        ),

        "enterpriseToRevenue": first_valid(
            info.get("enterpriseToRevenue")
        ),

        "marketCap": first_valid(
            info.get("marketCap")
        ),

        "enterpriseValue": first_valid(
            info.get("enterpriseValue")
        ),

        "trailingEps": first_valid(
            info.get("trailingEps")
        ),

        "forwardEps": first_valid(
            info.get("forwardEps")
        ),

        "bookValue": first_valid(
            info.get("bookValue")
        ),

        "beta": first_valid(
            info.get("beta")
        ),

        "52WeekChange": (
            safe_float(info.get("52WeekChange")) * 100
            if safe_float(info.get("52WeekChange")) is not None
            else None
        ),
    })


# ============================================================
# OWNERSHIP
# ============================================================

def build_ownership(info):

    insider = first_valid(
        info.get("heldPercentInsiders")
    )

    institutional = first_valid(
        info.get("heldPercentInstitutions")
    )

    if insider is not None:
        insider *= 100

    if institutional is not None:
        institutional *= 100

    return clean_dict({

        "insiderOwnership": insider,

        "institutionalOwnership": institutional,

        # Promoter ownership is deliberately left empty here.
        # Yahoo does not reliably provide Indian promoter data.
        # We will add NSE/BSE promoter/shareholding data separately.
        "promoterOwnership": None,

        "promoterTrend": None,

        "promoterPledge": None,

        "recentBigInvestors": [],
    })


# ============================================================
# DIVIDEND
# ============================================================

def build_dividend(info):

    dividend_yield = first_valid(
        info.get("dividendYield")
    )

    if dividend_yield is not None:
        dividend_yield *= 100

    payout_ratio = first_valid(
        info.get("payoutRatio")
    )

    if payout_ratio is not None:
        payout_ratio *= 100

    return clean_dict({

        "yield": dividend_yield,

        "rate": first_valid(
            info.get("dividendRate")
        ),

        "payoutRatio": payout_ratio,

        "fiveYearAvgYield": first_valid(
            info.get("fiveYearAvgDividendYield")
        ),
    })


# ============================================================
# PRICE
# ============================================================

def build_price(history, info):

    current = None

    if history is not None and not history.empty:

        try:

            history.columns = [
                str(column).lower().replace(" ", "")
                for column in history.columns
            ]

            if "close" in history.columns:

                close = pd.to_numeric(
                    history["close"],
                    errors="coerce"
                ).dropna()

                if not close.empty:
                    current = safe_float(
                        close.iloc[-1]
                    )

        except Exception:
            pass

    if current is None:

        current = first_valid(
            info.get("currentPrice"),
            info.get("regularMarketPrice"),
            info.get("previousClose")
        )

    technical = calculate_technical(
        history
    )

    return clean_dict({

        "current": current,

        "previousClose": first_valid(
            info.get("previousClose"),
            info.get("regularMarketPreviousClose")
        ),

        "high52w": technical.get("high52w"),

        "low52w": technical.get("low52w"),

        "currency": info.get(
            "currency"
        ),

        "exchange": info.get(
            "exchange"
        ),
    })


# ============================================================
# ONE STOCK - FUNDAMENTAL REQUEST
# ============================================================

def fetch_fundamental_data(ticker):

    for attempt in range(MAX_RETRIES):

        try:

            yf_stock = yf.Ticker(ticker)

            # ------------------------------------------------
            # Basic company information
            # ------------------------------------------------

            try:
                info = yf_stock.get_info()
            except Exception:
                info = {}

            if not isinstance(info, dict):
                info = {}

            # ------------------------------------------------
            # Financial statements
            # ------------------------------------------------

            try:
                income_stmt = yf_stock.get_income_stmt(
                    freq="yearly"
                )
            except Exception as exc:
                print(
                    f"{ticker}: income statement unavailable: {exc}"
                )
                income_stmt = pd.DataFrame()

            try:
                balance_sheet = yf_stock.get_balance_sheet(
                    freq="yearly"
                )
            except Exception as exc:
                print(
                    f"{ticker}: balance sheet unavailable: {exc}"
                )
                balance_sheet = pd.DataFrame()

            try:
                cashflow = yf_stock.get_cash_flow(
                    freq="yearly"
                )
            except Exception as exc:
                print(
                    f"{ticker}: cash flow unavailable: {exc}"
                )
                cashflow = pd.DataFrame()

            fundamentals = build_fundamentals(
                info,
                income_stmt,
                balance_sheet,
                cashflow
            )

            valuation = build_valuation(
                info
            )

            ownership = build_ownership(
                info
            )

            dividend = build_dividend(
                info
            )

            return {
                "info": info,
                "fundamentals": fundamentals,
                "valuation": valuation,
                "ownership": ownership,
                "dividend": dividend,
            }

        except Exception as exc:

            print(
                f"{ticker}: fundamental request failed "
                f"(attempt {attempt + 1}/{MAX_RETRIES}): {exc}"
            )

            sleep_backoff(attempt)

    return {
        "info": {},
        "fundamentals": {},
        "valuation": {},
        "ownership": {},
        "dividend": {},
    }


# ============================================================
# DATA QUALITY
# ============================================================

def calculate_data_quality(
    price,
    fundamentals,
    valuation,
    technical,
    ownership,
    dividend
):

    price_fields = [
        "current",
        "previousClose",
        "high52w",
        "low52w",
    ]

    fundamental_fields = [
        "revenue",
        "netIncome",
        "freeCashFlow",
        "roe",
        "roic",
        "debtToEquity",
    ]

    valuation_fields = [
        "pe",
        "forwardPE",
        "priceToSales",
        "priceToBook",
        "enterpriseToEbitda",
    ]

    technical_fields = [
        "sma50",
        "sma200",
        "momentum3m",
        "momentum6m",
        "volatility30d",
    ]

    def completeness(data, fields):

        if not isinstance(data, dict):
            return 0

        available = 0

        for field in fields:

            if data.get(field) is not None:
                available += 1

        if not fields:
            return 0

        return round(
            available / len(fields) * 100,
            1
        )

    scores = {

        "price": completeness(
            price,
            price_fields
        ),

        "fundamentals": completeness(
            fundamentals,
            fundamental_fields
        ),

        "valuation": completeness(
            valuation,
            valuation_fields
        ),

        "technical": completeness(
            technical,
            technical_fields
        ),

        "ownership": completeness(
            ownership,
            [
                "insiderOwnership",
                "institutionalOwnership",
            ]
        ),

        "dividend": completeness(
            dividend,
            [
                "yield",
                "rate",
                "payoutRatio",
            ]
        ),
    }

    overall = round(
        sum(scores.values()) / len(scores),
        1
    )

    return {
        "overall": overall,
        "sections": scores,
        "status": (
            "Good"
            if overall >= 70
            else "Partial"
            if overall >= 40
            else "Poor"
        ),
        "updatedAt": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# ============================================================
# UPDATE STOCK
# ============================================================

def update_stock(
    stock,
    history,
    ticker
):

    original = dict(stock)

    try:

        fundamental_data = fetch_fundamental_data(
            ticker
        )

        info = fundamental_data["info"]

        fundamentals = fundamental_data[
            "fundamentals"
        ]

        valuation = fundamental_data[
            "valuation"
        ]

        ownership = fundamental_data[
            "ownership"
        ]

        dividend = fundamental_data[
            "dividend"
        ]

        price = build_price(
            history,
            info
        )

        technical = calculate_technical(
            history
        )

        # ----------------------------------------------------
        # Preserve useful existing universe metadata.
        # ----------------------------------------------------

        result = dict(original)

        # ----------------------------------------------------
        # Nested structures expected by app.js/scoring.js
        # ----------------------------------------------------

        result["price"] = price

        result["fundamentals"] = fundamentals

        result["valuation"] = valuation

        result["technical"] = technical

        result["ownership"] = ownership

        result["dividend"] = dividend

        # ----------------------------------------------------
        # Basic company information
        # ----------------------------------------------------

        result["companyName"] = (
            info.get("longName")
            or info.get("shortName")
            or result.get("companyName")
            or result.get("name")
            or ticker
        )

        result["sector"] = (
            info.get("sector")
            or result.get("sector")
        )

        result["industry"] = (
            info.get("industry")
            or result.get("industry")
        )

        result["country"] = (
            info.get("country")
            or result.get("country")
        )

        result["website"] = (
            info.get("website")
            or result.get("website")
        )

        # ----------------------------------------------------
        # Flat compatibility fields
        # ----------------------------------------------------

        current_price = price.get(
            "current"
        )

        result["currentPrice"] = current_price

        result["pe"] = valuation.get(
            "pe"
        )

        result["forwardPE"] = valuation.get(
            "forwardPE"
        )

        result["peg"] = valuation.get(
            "peg"
        )

        result["roe"] = fundamentals.get(
            "roe"
        )

        result["roic"] = fundamentals.get(
            "roic"
        )

        result["debtToEquity"] = fundamentals.get(
            "debtToEquity"
        )

        result["revenueGrowth5Y"] = fundamentals.get(
            "revenueGrowth5Y"
        )

        result["epsGrowth5Y"] = fundamentals.get(
            "epsGrowth5Y"
        )

        result["freeCashFlow"] = fundamentals.get(
            "freeCashFlow"
        )

        # ----------------------------------------------------
        # Data quality
        # ----------------------------------------------------

        result["dataQuality"] = calculate_data_quality(
            price,
            fundamentals,
            valuation,
            technical,
            ownership,
            dividend
        )

        return clean_dict(result)

    except Exception as exc:

        print(
            f"{ticker}: update error: {exc}"
        )

        # IMPORTANT:
        # Keep the stock but explicitly mark the update as failed.
        result = dict(original)

        result["dataQuality"] = {
            "overall": 0,
            "status": "Failed",
            "error": str(exc),
            "updatedAt": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        return result


# ============================================================
# TICKER NORMALIZATION
# ============================================================

def get_ticker(stock):

    possible_fields = [
        "ticker",
        "symbol",
        "code",
    ]

    for field in possible_fields:

        value = stock.get(field)

        if value:

            value = str(value).strip()

            if value:
                return value

    return None


# ============================================================
# UPDATE ONE MARKET
# ============================================================

def update_market(market, filepath):

    print("")
    print("=" * 70)
    print(f"UPDATING {market.upper()}")
    print("=" * 70)

    if not os.path.exists(filepath):

        print(
            f"ERROR: {filepath} does not exist."
        )

        return

    with open(
        filepath,
        "r",
        encoding="utf-8"
    ) as file:

        data = json.load(file)

    stocks = data.get(
        "stocks",
        []
    )

    if not stocks:

        print(
            f"ERROR: {filepath} contains no stocks."
        )

        return

    print(
        f"Universe contains {len(stocks)} stocks."
    )

    # --------------------------------------------------------
    # Collect tickers.
    # --------------------------------------------------------

    ticker_map = {}

    for stock in stocks:

        ticker = get_ticker(stock)

        if ticker:
            ticker_map[ticker] = stock

    tickers = list(
        ticker_map.keys()
    )

    print(
        f"Found {len(tickers)} unique tickers."
    )

    # --------------------------------------------------------
    # Batch download price history.
    # --------------------------------------------------------

    histories = {}

    for start in range(
        0,
        len(tickers),
        BATCH_SIZE
    ):

        batch_tickers = tickers[
            start:start + BATCH_SIZE
        ]

        print("")
        print(
            f"Price batch "
            f"{start + 1}-{start + len(batch_tickers)} "
            f"of {len(tickers)}"
        )

        batch_data = download_history_batch(
            batch_tickers
        )

        for ticker in batch_tickers:

            histories[ticker] = get_ticker_history(
                batch_data,
                ticker
            )

        if (
            start + BATCH_SIZE
            < len(tickers)
        ):

            time.sleep(
                BATCH_SLEEP
            )

    # --------------------------------------------------------
    # Update stocks.
    # --------------------------------------------------------

    updated_stocks = []

    price_success = 0
    fundamental_success = 0
    valuation_success = 0
    technical_success = 0

    for index, stock in enumerate(stocks):

        ticker = get_ticker(stock)

        if not ticker:

            print(
                f"Skipping stock #{index + 1}: "
                f"no ticker field."
            )

            updated_stocks.append(
                stock
            )

            continue

        print("")
        print(
            f"[{index + 1}/{len(stocks)}] "
            f"Updating {ticker}"
        )

        history = histories.get(
            ticker,
            pd.DataFrame()
        )

        if (
            history is not None
            and not history.empty
        ):
            price_success += 1

        updated = update_stock(
            stock,
            history,
            ticker
        )

        if updated.get(
            "fundamentals"
        ):
            fundamental_success += 1

        if updated.get(
            "valuation"
        ):
            valuation_success += 1

        if updated.get(
            "technical"
        ):
            technical_success += 1

        updated_stocks.append(
            updated
        )

        # Small pause between fundamental requests.
        time.sleep(0.5)

    # --------------------------------------------------------
    # Save.
    # --------------------------------------------------------

    data["stocks"] = updated_stocks

    data["lastUpdated"] = datetime.now(
        timezone.utc
    ).isoformat()

    data["dataSource"] = (
        "Yahoo Finance via yfinance"
    )

    with open(
        filepath,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            clean_dict(data),
            file,
            indent=2,
            ensure_ascii=False
        )

    print("")
    print("-" * 70)
    print(f"{market.upper()} UPDATE COMPLETE")
    print("-" * 70)

    print(
        f"Stocks:             {len(stocks)}"
    )

    print(
        f"Price history:      {price_success}"
    )

    print(
        f"Fundamentals:       {fundamental_success}"
    )

    print(
        f"Valuation:          {valuation_success}"
    )

    print(
        f"Technical:          {technical_success}"
    )

    print("-" * 70)


# ============================================================
# MAIN
# ============================================================

def main():

    print("")
    print("=" * 70)
    print("INVESTMENT RADAR DATA UPDATE")
    print("=" * 70)

    print(
        f"Started: "
        f"{datetime.now(timezone.utc).isoformat()}"
    )

    for market, filepath in DATA_FILES.items():

        try:

            update_market(
                market,
                filepath
            )

        except Exception as exc:

            print("")
            print(
                f"ERROR updating {market}: {exc}"
            )

    print("")
    print("=" * 70)
    print("ALL MARKET UPDATES FINISHED")
    print("=" * 70)


if __name__ == "__main__":
    main()
