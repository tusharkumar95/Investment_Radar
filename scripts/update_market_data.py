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
# PURPOSE
#   Download and normalize market + financial data for the
#   Investment Radar application.
#
# IMPORTANT
#   - Values stored as percentages are actual percentages.
#       Example: 8.5 means 8.5%, NOT 0.085.
#   - Debt/equity is stored as a ratio.
#       Example: 1.8 means 1.8x.
#   - Missing data stays None.
#   - Missing data must NEVER be treated as zero.
#
# ============================================================


DATA_FILES = {
    "Canada": "data/canada.json",
    "India": "data/india.json",
}

HISTORY_PERIOD = "5y"
BATCH_SIZE = 25
MAX_RETRIES = 4
BATCH_SLEEP = 2
TICKER_SLEEP = 0.25


# ============================================================
# BASIC HELPERS
# ============================================================

def safe_float(value):
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


def first_valid(*values):
    for value in values:
        value = safe_float(value)

        if value is not None:
            return value

    return None


def clean_value(value):
    if isinstance(value, dict):
        return {
            k: clean_value(v)
            for k, v in value.items()
            if v is not None
        }

    if isinstance(value, list):
        return [
            clean_value(v)
            for v in value
            if v is not None
        ]

    number = safe_float(value)

    if number is not None:
        return number

    return value


def sleep_backoff(attempt):
    time.sleep(2 ** attempt)


def pct_from_decimal(value):
    """
    Convert a decimal percentage to actual percentage.

    0.085 -> 8.5
    8.5   -> 8.5

    Used only for fields where Yahoo supplies a decimal.
    """
    value = safe_float(value)

    if value is None:
        return None

    if -1.5 <= value <= 1.5:
        return value * 100

    return value


def ratio(value):
    """
    Keep ratios as ratios.

    Example:
      1.8 -> 1.8x
    """
    return safe_float(value)


# ============================================================
# LOAD UNIVERSE
# ============================================================

def load_market_file(path):
    if not os.path.exists(path):
        print(f"ERROR: {path} does not exist.")
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_market_file(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            clean_value(data),
            f,
            indent=2,
            ensure_ascii=False
        )


def get_stocks(data):
    stocks = data.get("stocks", [])

    if not isinstance(stocks, list):
        return []

    return stocks


def get_symbol(stock):
    for key in [
        "ticker",
        "symbol",
        "id"
    ]:
        value = stock.get(key)

        if value:
            return str(value)

    return None


# ============================================================
# PRICE HISTORY
# ============================================================

def download_history_batch(tickers):

    if not tickers:
        return pd.DataFrame()

    symbols = " ".join(tickers)

    for attempt in range(MAX_RETRIES):

        try:
            print(
                f"Downloading history for "
                f"{len(tickers)} tickers..."
            )

            data = yf.download(
                symbols,
                period=HISTORY_PERIOD,
                interval="1d",
                auto_adjust=False,
                progress=False,
                threads=False,
                group_by="column",
                timeout=30,
            )

            if data is not None and not data.empty:
                return data

        except Exception as exc:
            print(
                f"History error "
                f"{attempt + 1}/{MAX_RETRIES}: {exc}"
            )

        sleep_backoff(attempt)

    return pd.DataFrame()


def get_ticker_history(batch_data, ticker):

    if batch_data is None or batch_data.empty:
        return pd.DataFrame()

    try:

        if isinstance(
            batch_data.columns,
            pd.MultiIndex
        ):

            level0 = list(
                batch_data.columns
                .get_level_values(0)
            )

            level1 = list(
                batch_data.columns
                .get_level_values(1)
            )

            if ticker in level1:
                return batch_data.xs(
                    ticker,
                    axis=1,
                    level=1,
                    drop_level=True
                ).copy()

            if ticker in level0:
                return batch_data.xs(
                    ticker,
                    axis=1,
                    level=0,
                    drop_level=True
                ).copy()

        return batch_data.copy()

    except Exception:
        return pd.DataFrame()


# ============================================================
# TECHNICAL DATA
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

        history.columns = [
            str(c).lower().replace(" ", "")
            for c in history.columns
        ]

        close_col = None

        for name in [
            "close",
            "adjclose"
        ]:
            if name in history.columns:
                close_col = name
                break

        if close_col is None:
            return result

        close = pd.to_numeric(
            history[close_col],
            errors="coerce"
        ).dropna()

        if close.empty:
            return result

        latest = safe_float(close.iloc[-1])

        if latest is None:
            return result

        if len(close) >= 50:
            result["sma50"] = safe_float(
                close.tail(50).mean()
            )

        if len(close) >= 200:
            result["sma200"] = safe_float(
                close.tail(200).mean()
            )

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

        returns = close.pct_change().dropna()

        if len(returns) >= 30:
            result["volatility30d"] = (
                returns.tail(30).std()
                * np.sqrt(252)
                * 100
            )

        if len(returns) >= 90:
            result["volatility90d"] = (
                returns.tail(90).std()
                * np.sqrt(252)
                * 100
            )

        last_252 = close.tail(252)

        if not last_252.empty:

            high = safe_float(last_252.max())
            low = safe_float(last_252.min())

            result["high52w"] = high
            result["low52w"] = low

            if high:
                result["drawdown52w"] = (
                    latest / high - 1
                ) * 100

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
        print(f"Technical error: {exc}")

    return clean_value(result)


# ============================================================
# STATEMENT HELPERS
# ============================================================

def get_statement(ticker, statement_name):

    try:

        if statement_name == "income":
            statement = ticker.get_income_stmt(
                freq="yearly"
            )

        elif statement_name == "balance":
            statement = ticker.get_balance_sheet(
                freq="yearly"
            )

        elif statement_name == "cashflow":
            statement = ticker.get_cash_flow(
                freq="yearly"
            )

        else:
            return pd.DataFrame()

        if statement is None:
            return pd.DataFrame()

        return statement

    except Exception:
        return pd.DataFrame()


def statement_row(statement, names):

    if statement is None:
        return None

    if not isinstance(statement, pd.DataFrame):
        return None

    if statement.empty:
        return None

    # Exact matches first.
    for name in names:

        if name in statement.index:

            try:
                row = statement.loc[name]

                if isinstance(row, pd.Series):
                    return row

            except Exception:
                pass

    # Fuzzy match.
    lowered = {
        str(index).lower(): index
        for index in statement.index
    }

    for name in names:

        search = name.lower()

        for index_lower, original in lowered.items():

            if search == index_lower:
                try:
                    return statement.loc[original]
                except Exception:
                    pass

    for name in names:

        search = name.lower()

        for index_lower, original in lowered.items():

            if search in index_lower:

                try:
                    return statement.loc[original]
                except Exception:
                    pass

    return None


def statement_latest(statement, names):

    row = statement_row(
        statement,
        names
    )

    if row is None:
        return None

    try:

        # Sort dates newest -> oldest where possible.
        if isinstance(row.index, pd.DatetimeIndex):
            row = row.sort_index(
                ascending=False
            )

        for value in row.values:

            number = safe_float(value)

            if number is not None:
                return number

    except Exception:
        pass

    return None


def statement_series(statement, names):

    row = statement_row(
        statement,
        names
    )

    if row is None:
        return []

    values = []

    try:

        if isinstance(row.index, pd.DatetimeIndex):
            row = row.sort_index(
                ascending=False
            )

        for value in row.values:

            number = safe_float(value)

            if number is not None:
                values.append(number)

    except Exception:
        return []

    return values


# ============================================================
# CAGR
# ============================================================

def calculate_cagr_from_series(values):

    if len(values) < 2:
        return None

    latest = values[0]

    # Use the oldest available positive value.
    oldest = None
    periods = None

    for index in range(
        len(values) - 1,
        0,
        -1
    ):

        candidate = values[index]

        if (
            candidate is not None
            and candidate > 0
        ):
            oldest = candidate
            periods = index
            break

    if latest is None:
        return None

    if latest <= 0:
        return None

    if oldest is None:
        return None

    if periods is None or periods <= 0:
        return None

    try:
        return (
            (latest / oldest)
            ** (1 / periods)
            - 1
        ) * 100

    except Exception:
        return None


# ============================================================
# FUNDAMENTALS
# ============================================================

def build_fundamentals(
    info,
    income,
    balance,
    cashflow
):

    revenue = first_valid(
        statement_latest(
            income,
            [
                "Total Revenue",
                "Operating Revenue",
                "Revenue"
            ]
        ),
        info.get("totalRevenue")
    )

    net_income = first_valid(
        statement_latest(
            income,
            [
                "Net Income",
                "Net Income Common Stockholders",
                "Net Income Including Noncontrolling Interests"
            ]
        ),
        info.get("netIncomeToCommon")
    )

    operating_income = first_valid(
        statement_latest(
            income,
            [
                "Operating Income",
                "Operating Income As Reported"
            ]
        ),
        info.get("operatingIncome")
    )

    gross_profit = first_valid(
        statement_latest(
            income,
            [
                "Gross Profit"
            ]
        ),
        info.get("grossProfits")
    )

    ebitda = first_valid(
        statement_latest(
            income,
            [
                "EBITDA",
                "Normalized EBITDA"
            ]
        ),
        info.get("ebitda")
    )

    free_cash_flow = first_valid(
        statement_latest(
            cashflow,
            [
                "Free Cash Flow"
            ]
        ),
        info.get("freeCashflow")
    )

    operating_cash_flow = first_valid(
        statement_latest(
            cashflow,
            [
                "Operating Cash Flow",
                "Total Cash From Operating Activities",
                "Total Cash From Operating Activities Continuing Operations"
            ]
        ),
        info.get("operatingCashflow")
    )

    cash = first_valid(
        statement_latest(
            balance,
            [
                "Cash Cash Equivalents And Short Term Investments",
                "Cash And Cash Equivalents",
                "Cash Financial",
                "Cash Equivalents"
            ]
        ),
        info.get("totalCash")
    )

    total_debt = first_valid(
        statement_latest(
            balance,
            [
                "Total Debt",
                "Total Debt And Capital Lease Obligation",
                "Long Term Debt And Capital Lease Obligation",
                "Long Term Debt"
            ]
        ),
        info.get("totalDebt")
    )

    total_assets = first_valid(
        statement_latest(
            balance,
            [
                "Total Assets"
            ]
        ),
        info.get("totalAssets")
    )

    equity = first_valid(
        statement_latest(
            balance,
            [
                "Stockholders Equity",
                "Total Stockholder Equity",
                "Total Equity Gross Minority Interest",
                "Common Stock Equity"
            ]
        ),
        info.get("stockholdersEquity")
    )

    # --------------------------------------------------------
    # EPS
    # --------------------------------------------------------

    eps = first_valid(
        info.get("trailingEps"),
        statement_latest(
            income,
            [
                "Diluted EPS",
                "Basic EPS"
            ]
        )
    )

    # --------------------------------------------------------
    # Revenue growth
    # --------------------------------------------------------

    revenue_growth = pct_from_decimal(
        info.get("revenueGrowth")
    )

    if revenue_growth is None:

        revenue_growth = calculate_cagr_from_series(
            statement_series(
                income,
                [
                    "Total Revenue",
                    "Operating Revenue",
                    "Revenue"
                ]
            )
        )

    # --------------------------------------------------------
    # EPS growth
    # --------------------------------------------------------

    eps_growth = calculate_cagr_from_series(
        statement_series(
            income,
            [
                "Diluted EPS",
                "Basic EPS"
            ]
        )
    )

    # Yahoo's growth estimate is used only as fallback.
    if eps_growth is None:

        yahoo_growth = info.get(
            "earningsGrowth"
        )

        if yahoo_growth is not None:
            eps_growth = pct_from_decimal(
                yahoo_growth
            )

    # --------------------------------------------------------
    # Margins
    # --------------------------------------------------------

    profit_margin = pct_from_decimal(
        info.get("profitMargins")
    )

    if profit_margin is None:
        if revenue and net_income:
            profit_margin = (
                net_income / revenue
            ) * 100

    operating_margin = pct_from_decimal(
        info.get("operatingMargins")
    )

    if operating_margin is None:
        if revenue and operating_income:
            operating_margin = (
                operating_income / revenue
            ) * 100

    gross_margin = pct_from_decimal(
        info.get("grossMargins")
    )

    if gross_margin is None:
        if revenue and gross_profit:
            gross_margin = (
                gross_profit / revenue
            ) * 100

    # --------------------------------------------------------
    # ROE
    # --------------------------------------------------------

    roe = pct_from_decimal(
        info.get("returnOnEquity")
    )

    if roe is None:

        if net_income and equity:
            roe = (
                net_income / equity
            ) * 100

    # --------------------------------------------------------
    # ROIC
    # --------------------------------------------------------
    #
    # Approximation:
    #   NOPAT / invested capital
    #
    # This is explicitly calculated rather than pretending
    # Yahoo has supplied an audited ROIC value.
    # --------------------------------------------------------

    roic = None

    if operating_income:

        tax_rate = pct_from_decimal(
            info.get("taxRate")
        )

        if tax_rate is None:
            tax_rate = 25.0

        nopat = operating_income * (
            1 - tax_rate / 100
        )

        invested_capital = None

        if equity is not None:

            invested_capital = equity

            if total_debt is not None:
                invested_capital += total_debt

            if cash is not None:
                invested_capital -= cash

        if (
            invested_capital is not None
            and invested_capital > 0
        ):
            roic = (
                nopat
                / invested_capital
            ) * 100

    # --------------------------------------------------------
    # Debt / Equity
    # --------------------------------------------------------

    debt_to_equity = ratio(
        info.get("debtToEquity")
    )

    if debt_to_equity is None:

        if (
            total_debt is not None
            and equity is not None
            and equity != 0
        ):
            debt_to_equity = (
                total_debt / equity
            )

    # --------------------------------------------------------
    # Interest coverage
    # --------------------------------------------------------

    interest_expense = statement_latest(
        income,
        [
            "Interest Expense",
            "Interest Expense Non Operating"
        ]
    )

    interest_coverage = None

    if (
        operating_income is not None
        and interest_expense is not None
    ):

        interest_expense = abs(
            interest_expense
        )

        if interest_expense > 0:

            interest_coverage = (
                operating_income
                / interest_expense
            )

    return clean_value({

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

        "stockholdersEquity": equity,

        "revenueGrowth5Y": revenue_growth,

        "epsGrowth5Y": eps_growth,

        "profitMargin": profit_margin,

        "operatingMargin": operating_margin,

        "grossMargin": gross_margin,

        "eps": eps,

        "roe": roe,

        "roic": roic,

        "debtToEquity": debt_to_equity,

        "interestCoverage": interest_coverage,

    })


# ============================================================
# VALUATION
# ============================================================

def build_valuation(info):

    return clean_value({

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

        "evToEbitda": first_valid(
            info.get("enterpriseToEbitda")
        ),

        "evToRevenue": first_valid(
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

        "fiftyTwoWeekChange": pct_from_decimal(
            info.get("52WeekChange")
        ),

    })


# ============================================================
# OWNERSHIP
# ============================================================

def build_ownership(ticker, info, market):

    insider = pct_from_decimal(
        info.get("heldPercentInsiders")
    )

    institutional = pct_from_decimal(
        info.get("heldPercentInstitutions")
    )

    result = {
        "insiderOwnership": insider,
        "institutionalOwnership": institutional,
        "promoterOwnership": None,
        "promoterPledge": None,
        "promoterTrend": None,
        "recentBigInvestors": [],
    }

    # --------------------------------------------------------
    # Major holders
    # --------------------------------------------------------

    try:

        holders = ticker.major_holders

        if holders is not None and not holders.empty:

            for _, row in holders.iterrows():

                text = " ".join(
                    str(x).lower()
                    for x in row.tolist()
                )

                value = None

                for item in row.tolist():

                    number = safe_float(item)

                    if number is not None:
                        value = number
                        break

                if value is None:
                    continue

                if (
                    "insider" in text
                    and insider is None
                ):
                    result["insiderOwnership"] = (
                        pct_from_decimal(value)
                    )

                if (
                    "institution" in text
                    and institutional is None
                ):
                    result["institutionalOwnership"] = (
                        pct_from_decimal(value)
                    )

    except Exception:
        pass

    # --------------------------------------------------------
    # Institutional holders
    # --------------------------------------------------------

    try:

        holders = ticker.institutional_holders

        if (
            holders is not None
            and not holders.empty
        ):

            investors = []

            for _, row in holders.head(10).iterrows():

                row_dict = {}

                for key, value in row.items():

                    if pd.isna(value):
                        continue

                    row_dict[str(key)] = (
                        clean_value(value)
                    )

                if row_dict:
                    investors.append(row_dict)

            result[
                "recentBigInvestors"
            ] = investors

    except Exception:
        pass

    return clean_value(result)


# ============================================================
# DIVIDEND
# ============================================================

def build_dividend(ticker, info):

    dividend_rate = first_valid(
        info.get("dividendRate")
    )

    dividend_yield = info.get(
        "dividendYield"
    )

    dividend_yield = pct_from_decimal(
        dividend_yield
    )

    # Yahoo sometimes gives dividendRate but
    # dividendYield is unavailable.
    if (
        dividend_yield is None
        and dividend_rate is not None
    ):

        price = first_valid(
            info.get("currentPrice"),
            info.get("regularMarketPrice")
        )

        if price and price > 0:
            dividend_yield = (
                dividend_rate / price
            ) * 100

    payout = pct_from_decimal(
        info.get("payoutRatio")
    )

    five_year_avg = pct_from_decimal(
        info.get("fiveYearAvgDividendYield")
    )

    return clean_value({

        "yield": dividend_yield,

        "rate": dividend_rate,

        "payoutRatio": payout,

        "fiveYearAverageYield": five_year_avg,

    })


# ============================================================
# PRICE
# ============================================================

def build_price(info, history):

    current = first_valid(
        info.get("currentPrice"),
        info.get("regularMarketPrice")
    )

    previous_close = first_valid(
        info.get("previousClose"),
        info.get("regularMarketPreviousClose")
    )

    change_percent = None

    if (
        current is not None
        and previous_close is not None
        and previous_close != 0
    ):
        change_percent = (
            current / previous_close - 1
        ) * 100

    if current is None and history is not None:

        try:

            close = history["Close"]

            if isinstance(close, pd.Series):
                current = safe_float(
                    close.dropna().iloc[-1]
                )

        except Exception:
            pass

    return clean_value({

        "current": current,

        "previousClose": previous_close,

        "changePercent": change_percent,

        "currency": info.get(
            "currency"
        ),

        "exchange": info.get(
            "exchange"
        ),

    })


# ============================================================
# DATA QUALITY
# ============================================================

def calculate_data_quality(stock):

    checks = {

        "price":
            stock.get("price", {})
            .get("current") is not None,

        "revenue":
            stock.get("fundamentals", {})
            .get("revenue") is not None,

        "revenueGrowth":
            stock.get("fundamentals", {})
            .get("revenueGrowth5Y") is not None,

        "eps":
            stock.get("fundamentals", {})
            .get("eps") is not None,

        "epsGrowth":
            stock.get("fundamentals", {})
            .get("epsGrowth5Y") is not None,

        "profitMargin":
            stock.get("fundamentals", {})
            .get("profitMargin") is not None,

        "roe":
            stock.get("fundamentals", {})
            .get("roe") is not None,

        "roic":
            stock.get("fundamentals", {})
            .get("roic") is not None,

        "freeCashFlow":
            stock.get("fundamentals", {})
            .get("freeCashFlow") is not None,

        "debtToEquity":
            stock.get("fundamentals", {})
            .get("debtToEquity") is not None,

        "pe":
            stock.get("valuation", {})
            .get("pe") is not None,

        "forwardPE":
            stock.get("valuation", {})
            .get("forwardPE") is not None,

        "peg":
            stock.get("valuation", {})
            .get("peg") is not None,

        "institutionalOwnership":
            stock.get("ownership", {})
            .get("institutionalOwnership") is not None,

        "dividendYield":
            stock.get("dividend", {})
            .get("yield") is not None,

    }

    available = sum(
        1 for value in checks.values()
        if value
    )

    total = len(checks)

    quality = (
        available / total * 100
        if total
        else 0
    )

    return {
        "score": round(
            quality,
            1
        ),
        "available": available,
        "total": total,
        "fields": checks,
    }


# ============================================================
# MARKET SUMMARY
# ============================================================

def build_summary(stocks):

    total = len(stocks)

    metric_names = [

        "revenue",
        "revenueGrowth",
        "eps",
        "epsGrowth",
        "profitMargin",
        "roe",
        "roic",
        "freeCashFlow",
        "debtToEquity",
        "pe",
        "forwardPE",
        "peg",
        "institutionalOwnership",
        "dividendYield",

    ]

    counts = {}

    for metric in metric_names:
        counts[metric] = 0

    quality_scores = []

    for stock in stocks:

        quality = stock.get(
            "dataQuality",
            {}
        )

        score = safe_float(
            quality.get("score")
        )

        if score is not None:
            quality_scores.append(score)

        fields = quality.get(
            "fields",
            {}
        )

        for metric in metric_names:

            if fields.get(metric):
                counts[metric] += 1

    average_quality = (
        sum(quality_scores)
        / len(quality_scores)
        if quality_scores
        else 0
    )

    return {

        "stocks": total,

        "averageQuality": round(
            average_quality,
            1
        ),

        "coverage": {
            metric: {
                "count": counts[metric],
                "percent": round(
                    counts[metric]
                    / total
                    * 100,
                    1
                ) if total else 0
            }
            for metric in metric_names
        },

        "updatedAt": datetime.now(
            timezone.utc
        ).isoformat(),

    }


# ============================================================
# PROCESS ONE STOCK
# ============================================================

def process_stock(
    stock,
    history,
    market
):

    ticker_symbol = get_symbol(stock)

    if not ticker_symbol:
        return stock

    print(
        f"Processing {market}: "
        f"{ticker_symbol}"
    )

    try:

        ticker = yf.Ticker(
            ticker_symbol
        )

        info = {}

        try:
            info = ticker.info or {}
        except Exception as exc:
            print(
                f"  info unavailable: {exc}"
            )

        income = get_statement(
            ticker,
            "income"
        )

        balance = get_statement(
            ticker,
            "balance"
        )

        cashflow = get_statement(
            ticker,
            "cashflow"
        )

        fundamentals = build_fundamentals(
            info,
            income,
            balance,
            cashflow
        )

        valuation = build_valuation(
            info
        )

        ownership = build_ownership(
            ticker,
            info,
            market
        )

        dividend = build_dividend(
            ticker,
            info
        )

        price = build_price(
            info,
            history
        )

        technical = calculate_technical(
            history
        )

        # ----------------------------------------------------
        # Preserve existing stock metadata.
        # ----------------------------------------------------

        stock["price"] = price
        stock["fundamentals"] = fundamentals
        stock["valuation"] = valuation
        stock["ownership"] = ownership
        stock["dividend"] = dividend
        stock["technical"] = technical

        # ----------------------------------------------------
        # Flat compatibility fields.
        # Existing frontend/engine code may use these.
        # ----------------------------------------------------

        stock["currentPrice"] = price.get(
            "current"
        )

        stock["currency"] = price.get(
            "currency"
        )

        stock["pe"] = valuation.get(
            "pe"
        )

        stock["forwardPE"] = valuation.get(
            "forwardPE"
        )

        stock["marketCap"] = valuation.get(
            "marketCap"
        )

        stock["roe"] = fundamentals.get(
            "roe"
        )

        stock["roic"] = fundamentals.get(
            "roic"
        )

        stock["revenueGrowth5Y"] = (
            fundamentals.get(
                "revenueGrowth5Y"
            )
        )

        stock["epsGrowth5Y"] = (
            fundamentals.get(
                "epsGrowth5Y"
            )
        )

        stock["freeCashFlow"] = (
            fundamentals.get(
                "freeCashFlow"
            )
        )

        stock["debtToEquity"] = (
            fundamentals.get(
                "debtToEquity"
            )
        )

        stock["dataQuality"] = (
            calculate_data_quality(
                stock
            )
        )

        return stock

    except Exception as exc:

        print(
            f"ERROR processing "
            f"{ticker_symbol}: {exc}"
        )

        # Keep existing data rather than
        # destroying good previous data.
        stock["dataQuality"] = (
            calculate_data_quality(
                stock
            )
        )

        return stock


# ============================================================
# PROCESS MARKET
# ============================================================

def process_market(
    market,
    path
):

    print("")
    print("=" * 70)
    print(f"PROCESSING {market.upper()}")
    print("=" * 70)

    data = load_market_file(path)

    if data is None:
        return

    stocks = get_stocks(data)

    print(
        f"Universe contains "
        f"{len(stocks)} stocks."
    )

    tickers = [
        get_symbol(stock)
        for stock in stocks
    ]

    tickers = [
        ticker
        for ticker in tickers
        if ticker
    ]

    all_history = {}

    # --------------------------------------------------------
    # Batch price download
    # --------------------------------------------------------

    for start in range(
        0,
        len(tickers),
        BATCH_SIZE
    ):

        batch = tickers[
            start:start + BATCH_SIZE
        ]

        print(
            f"\nPrice batch "
            f"{start + 1}-"
            f"{min(start + BATCH_SIZE, len(tickers))}"
        )

        batch_data = (
            download_history_batch(
                batch
            )
        )

        for ticker in batch:

            all_history[ticker] = (
                get_ticker_history(
                    batch_data,
                    ticker
                )
            )

        time.sleep(
            BATCH_SLEEP
        )

    # --------------------------------------------------------
    # Fundamentals
    # --------------------------------------------------------

    updated_stocks = []

    for index, stock in enumerate(
        stocks,
        start=1
    ):

        ticker = get_symbol(stock)

        print(
            f"\n[{index}/{len(stocks)}]"
        )

        history = (
            all_history.get(
                ticker,
                pd.DataFrame()
            )
        )

        updated = process_stock(
            stock,
            history,
            market
        )

        updated_stocks.append(
            updated
        )

        time.sleep(
            TICKER_SLEEP
        )

    data["stocks"] = updated_stocks

    data["dataSummary"] = (
        build_summary(
            updated_stocks
        )
    )

    data["lastUpdated"] = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    save_market_file(
        path,
        data
    )

    # --------------------------------------------------------
    # Console audit
    # --------------------------------------------------------

    summary = data["dataSummary"]

    print("")
    print("=" * 70)
    print(
        f"DATA QUALITY - {market}"
    )
    print("=" * 70)

    print(
        f"Stocks: {summary['stocks']}"
    )

    print(
        f"Average quality: "
        f"{summary['averageQuality']}%"
    )

    for metric, values in (
        summary["coverage"].items()
    ):

        print(
            f"{metric}: "
            f"{values['count']}/"
            f"{summary['stocks']} "
            f"({values['percent']}%)"
        )

    print(
        f"\nSaved {path}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("")
    print("=" * 70)
    print("INVESTMENT RADAR DATA UPDATE")
    print("=" * 70)

    for market, path in DATA_FILES.items():

        try:
            process_market(
                market,
                path
            )

        except Exception as exc:

            print(
                f"\nFATAL ERROR in "
                f"{market}: {exc}"
            )

    print("")
    print("=" * 70)
    print("UPDATE COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
