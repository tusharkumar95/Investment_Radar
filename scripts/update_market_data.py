# scripts/update_market_data.py

import json
import math
import time
from pathlib import Path

import pandas as pd
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


# =========================================================
# HELPERS
# =========================================================

def safe_float(value):
    try:
        if value is None:
            return None

        value = float(value)

        if math.isnan(value) or math.isinf(value):
            return None

        return value

    except Exception:
        return None


def first_valid(info, keys):
    for key in keys:
        value = safe_float(info.get(key))

        if value is not None:
            return value

    return None


def annual_values(statement, names):
    if statement is None or statement.empty:
        return []

    for name in names:

        if name not in statement.index:
            continue

        values = []

        try:
            row = statement.loc[name]

            for value in row.tolist():

                value = safe_float(value)

                if value is not None:
                    values.append(value)

        except Exception:
            continue

        if values:
            return values

    return []


def calculate_cagr(values, years):
    if len(values) < years + 1:
        return None

    latest = values[0]
    oldest = values[years]

    if latest is None or oldest is None:
        return None

    if latest <= 0 or oldest <= 0:
        return None

    try:
        return (
            ((latest / oldest) ** (1 / years)) - 1
        ) * 100

    except Exception:
        return None


def calculate_growth(statement, names, years):
    values = annual_values(
        statement,
        names
    )

    return calculate_cagr(
        values,
        years
    )


def latest_statement_value(statement, names):
    values = annual_values(
        statement,
        names
    )

    if values:
        return values[0]

    return None


def calculate_roic(
    financials,
    balance_sheet,
    info
):
    """
    Approximate ROIC:

    NOPAT / Invested Capital

    This is intentionally conservative.
    For companies where the required inputs
    are unavailable, return None.
    """

    operating_income = latest_statement_value(
        financials,
        [
            "Operating Income",
            "OperatingIncome"
        ]
    )

    if operating_income is None:
        return None

    tax_expense = latest_statement_value(
        financials,
        [
            "Tax Provision",
            "TaxProvision"
        ]
    )

    pretax_income = latest_statement_value(
        financials,
        [
            "Pretax Income",
            "PretaxIncome"
        ]
    )

    if (
        tax_expense is not None
        and pretax_income is not None
        and pretax_income > 0
    ):
        tax_rate = (
            tax_expense /
            pretax_income
        )

        tax_rate = max(
            0,
            min(
                tax_rate,
                0.35
            )
        )

    else:
        tax_rate = 0.25

    nopat = (
        operating_income *
        (1 - tax_rate)
    )

    total_debt = latest_statement_value(
        balance_sheet,
        [
            "Total Debt",
            "TotalDebt"
        ]
    )

    equity = latest_statement_value(
        balance_sheet,
        [
            "Stockholders Equity",
            "StockholdersEquity",
            "Total Equity Gross Minority Interest"
        ]
    )

    cash = latest_statement_value(
        balance_sheet,
        [
            "Cash Cash Equivalents And Short Term Investments",
            "Cash And Cash Equivalents",
            "Cash"
        ]
    )

    if total_debt is None:
        total_debt = 0

    if equity is None:
        return None

    if cash is None:
        cash = 0

    invested_capital = (
        total_debt
        + equity
        - cash
    )

    if invested_capital <= 0:
        return None

    return (
        nopat /
        invested_capital
    ) * 100


# =========================================================
# UPDATE ONE STOCK
# =========================================================

def update_stock(stock):

    ticker = stock.get("ticker")

    print(
        f"Updating {ticker}"
    )

    try:

        yf_stock = yf.Ticker(
            ticker
        )

        # -------------------------------------------------
        # PRICE HISTORY
        # -------------------------------------------------

        try:

            history = yf_stock.history(
                period="5y",
                auto_adjust=False
            )

        except Exception as e:

            print(
                f"History error {ticker}: {e}"
            )

            history = pd.DataFrame()

        if history is None or history.empty:

            print(
                f"No price history: {ticker}"
            )

            return stock

        history = history.dropna(
            subset=["Close"]
        )

        if history.empty:
            return stock

        # -------------------------------------------------
        # COMPANY INFO
        # -------------------------------------------------

        try:
            info = yf_stock.info or {}

        except Exception as e:

            print(
                f"Info error {ticker}: {e}"
            )

            info = {}

        # -------------------------------------------------
        # FINANCIAL STATEMENTS
        # -------------------------------------------------

        try:
            financials = (
                yf_stock.financials
            )

        except Exception as e:

            print(
                f"Financials error {ticker}: {e}"
            )

            financials = pd.DataFrame()

        try:
            balance_sheet = (
                yf_stock.balance_sheet
            )

        except Exception as e:

            print(
                f"Balance sheet error {ticker}: {e}"
            )

            balance_sheet = pd.DataFrame()

        try:
            cashflow = (
                yf_stock.cashflow
            )

        except Exception as e:

            print(
                f"Cash flow error {ticker}: {e}"
            )

            cashflow = pd.DataFrame()

        # -------------------------------------------------
        # PRICE DATA
        # -------------------------------------------------

        price = safe_float(
            history["Close"].iloc[-1]
        )

        high_52 = safe_float(
            history["High"].tail(252).max()
        )

        low_52 = safe_float(
            history["Low"].tail(252).min()
        )

        sma50 = safe_float(
            history["Close"]
            .rolling(50)
            .mean()
            .iloc[-1]
        )

        sma200 = safe_float(
            history["Close"]
            .rolling(200)
            .mean()
            .iloc[-1]
        )

        # -------------------------------------------------
        # MOMENTUM
        # -------------------------------------------------

        price_3m = None
        price_6m = None

        if len(history) >= 64:

            price_3m = safe_float(
                history["Close"].iloc[-64]
            )

        if len(history) >= 126:

            price_6m = safe_float(
                history["Close"].iloc[-126]
            )

        momentum_3m = None
        momentum_6m = None

        if (
            price is not None
            and price_3m is not None
            and price_3m > 0
        ):

            momentum_3m = (
                (price / price_3m) - 1
            ) * 100

        if (
            price is not None
            and price_6m is not None
            and price_6m > 0
        ):

            momentum_6m = (
                (price / price_6m) - 1
            ) * 100

        # -------------------------------------------------
        # GROWTH
        # -------------------------------------------------

        revenue_growth_3y = calculate_growth(
            financials,
            [
                "Total Revenue",
                "Operating Revenue"
            ],
            3
        )

        revenue_growth_5y = calculate_growth(
            financials,
            [
                "Total Revenue",
                "Operating Revenue"
            ],
            5
        )

        eps_growth_3y = calculate_growth(
            financials,
            [
                "Diluted EPS",
                "Basic EPS"
            ],
            3
        )

        eps_growth_5y = calculate_growth(
            financials,
            [
                "Diluted EPS",
                "Basic EPS"
            ],
            5
        )

        fcf_growth_3y = calculate_growth(
            cashflow,
            [
                "Free Cash Flow"
            ],
            3
        )

        fcf_growth_5y = calculate_growth(
            cashflow,
            [
                "Free Cash Flow"
            ],
            5
        )

        # -------------------------------------------------
        # FINANCIAL METRICS
        # -------------------------------------------------

        market_cap = safe_float(
            info.get("marketCap")
        )

        enterprise_value = safe_float(
            info.get("enterpriseValue")
        )

        fcf = first_valid(
            info,
            [
                "freeCashflow"
            ]
        )

        if fcf is None:

            operating_cashflow = first_valid(
                info,
                [
                    "operatingCashflow"
                ]
            )

            capital_expenditure = first_valid(
                info,
                [
                    "capitalExpenditures"
                ]
            )

            if (
                operating_cashflow is not None
                and capital_expenditure is not None
            ):

                fcf = (
                    operating_cashflow
                    + capital_expenditure
                )

        # -------------------------------------------------
        # VALUATION
        # -------------------------------------------------

        pe = first_valid(
            info,
            [
                "trailingPE"
            ]
        )

        forward_pe = first_valid(
            info,
            [
                "forwardPE"
            ]
        )

        peg = first_valid(
            info,
            [
                "pegRatio"
            ]
        )

        price_to_sales = first_valid(
            info,
            [
                "priceToSalesTrailing12Months"
            ]
        )

        price_to_book = first_valid(
            info,
            [
                "priceToBook"
            ]
        )

        price_to_fcf = None

        if (
            market_cap is not None
            and fcf is not None
            and fcf > 0
        ):

            price_to_fcf = (
                market_cap / fcf
            )

        # -------------------------------------------------
        # PROFITABILITY
        # -------------------------------------------------

        profit_margin = first_valid(
            info,
            [
                "profitMargins"
            ]
        )

        if profit_margin is not None:
            profit_margin *= 100

        roe = first_valid(
            info,
            [
                "returnOnEquity"
            ]
        )

        if roe is not None:
            roe *= 100

        roic = calculate_roic(
            financials,
            balance_sheet,
            info
        )

        debt_to_equity = first_valid(
            info,
            [
                "debtToEquity"
            ]
        )

        # Yahoo reports debt/equity
        # as a percentage in some cases.
        # Convert to ratio if clearly percentage.
        if (
            debt_to_equity is not None
            and debt_to_equity > 10
        ):

            debt_to_equity /= 100

        # -------------------------------------------------
        # DIVIDENDS
        # -------------------------------------------------

        dividend_yield = first_valid(
            info,
            [
                "dividendYield"
            ]
        )

        if dividend_yield is not None:
            dividend_yield *= 100

        dividend_rate = first_valid(
            info,
            [
                "dividendRate"
            ]
        )

        payout_ratio = first_valid(
            info,
            [
                "payoutRatio"
            ]
        )

        if payout_ratio is not None:
            payout_ratio *= 100

        # -------------------------------------------------
        # OWNERSHIP
        # -------------------------------------------------

        insider_ownership = first_valid(
            info,
            [
                "heldPercentInsiders"
            ]
        )

        if insider_ownership is not None:
            insider_ownership *= 100

        institutional_ownership = first_valid(
            info,
            [
                "heldPercentInstitutions"
            ]
        )

        if institutional_ownership is not None:
            institutional_ownership *= 100

        # Promoter ownership is NOT substituted
        # with insider ownership.
        #
        # We will add official Indian promoter /
        # shareholding data separately.
        promoter_holding = None
        promoter_change = None
        promoter_pledge = None

        # -------------------------------------------------
        # COMPANY INFORMATION
        # -------------------------------------------------

        name = (
            info.get("longName")
            or info.get("shortName")
            or stock.get("name")
            or ticker
        )

        sector = (
            info.get("sector")
            or stock.get("sector")
            or "Unknown"
        )

        industry = (
            info.get("industry")
            or stock.get("industry")
            or "Unknown"
        )

        currency = (
            info.get("currency")
            or stock.get("currency")
        )

        exchange = (
            info.get("exchange")
            or stock.get("exchange")
        )

        # -------------------------------------------------
        # DATA QUALITY
        # -------------------------------------------------

        has_price = (
            price is not None
        )

        has_financials = (
            financials is not None
            and not financials.empty
        )

        has_balance_sheet = (
            balance_sheet is not None
            and not balance_sheet.empty
        )

        has_cashflow = (
            cashflow is not None
            and not cashflow.empty
        )

        financial_data_count = sum(
            value is not None
            for value in [
                revenue_growth_3y,
                revenue_growth_5y,
                eps_growth_3y,
                eps_growth_5y,
                fcf,
                fcf_growth_3y,
                fcf_growth_5y,
                profit_margin,
                roe,
                roic,
                debt_to_equity,
                pe,
                forward_pe,
                peg,
                price_to_fcf,
                price_to_book
            ]
        )

        # -------------------------------------------------
        # FINAL DATA OBJECT
        # -------------------------------------------------

        data = {
            # -------------------------------------------------
            # CORE
            # -------------------------------------------------

            **stock,

            "ticker": ticker,
            "name": name,
            "sector": sector,
            "industry": industry,
            "currency": currency,
            "exchange": exchange,

            # Keep both names for compatibility
            "price": price,
            "currentPrice": price,

            "marketCap": market_cap,
            "enterpriseValue": enterprise_value,

            "high52Week": high_52,
            "low52Week": low_52,

            # -------------------------------------------------
            # TECHNICAL
            # -------------------------------------------------

            "technical": {
                "price": price,
                "currentPrice": price,
                "high52Week": high_52,
                "low52Week": low_52,
                "sma50": sma50,
                "sma200": sma200,
                "momentum3M": momentum_3m,
                "momentum6M": momentum_6m
            },

            # Keep flat technical fields too
            "sma50": sma50,
            "sma200": sma200,
            "momentum3M": momentum_3m,
            "momentum6M": momentum_6m,

            # -------------------------------------------------
            # FUNDAMENTALS
            # -------------------------------------------------

            "fundamentals": {

                "revenueGrowth3Y":
                    revenue_growth_3y,

                "revenueGrowth5Y":
                    revenue_growth_5y,

                "epsGrowth3Y":
                    eps_growth_3y,

                "epsGrowth5Y":
                    eps_growth_5y,

                "fcfGrowth3Y":
                    fcf_growth_3y,

                "fcfGrowth5Y":
                    fcf_growth_5y,

                "profitMargin":
                    profit_margin,

                "roe":
                    roe,

                "roic":
                    roic,

                "freeCashFlow":
                    fcf,

                "debtToEquity":
                    debt_to_equity
            },

            # Keep flat fundamental fields too
            "revenueGrowth3Y":
                revenue_growth_3y,

            "revenueGrowth5Y":
                revenue_growth_5y,

            "epsGrowth5Y":
                eps_growth_5y,

            "fcfGrowth5Y":
                fcf_growth_5y,

            "profitMargin":
                profit_margin,

            "roe":
                roe,

            "roic":
                roic,

            "freeCashFlow":
                fcf,

            "debtToEquity":
                debt_to_equity,

            # -------------------------------------------------
            # VALUATION
            # -------------------------------------------------

            "valuation": {

                "pe":
                    pe,

                "forwardPE":
                    forward_pe,

                "peg":
                    peg,

                "priceToFcf":
                    price_to_fcf,

                "priceToBook":
                    price_to_book,

                "priceSales":
                    price_to_sales,

                "enterpriseValue":
                    enterprise_value
            },

            # Keep flat valuation fields too
            "pe": pe,
            "forwardPE": forward_pe,
            "peg": peg,
            "priceToFcf": price_to_fcf,
            "priceToBook": price_to_book,
            "priceSales": price_to_sales,

            # -------------------------------------------------
            # OWNERSHIP
            # -------------------------------------------------

            "ownership": {

                "insiderHolding":
                    insider_ownership,

                "institutionalHolding":
                    institutional_ownership,

                "promoterHolding":
                    promoter_holding,

                "promoterChange":
                    promoter_change,

                "promoterPledge":
                    promoter_pledge
            },

            # Flat versions for compatibility
            "insiderOwnership":
                insider_ownership,

            "institutionalOwnership":
                institutional_ownership,

            # -------------------------------------------------
            # DIVIDEND
            # -------------------------------------------------

            "dividend": {

                "yield":
                    dividend_yield,

                "rate":
                    dividend_rate,

                "payout":
                    payout_ratio,

                # Historical dividend growth
                # will be added in a later data layer.
                "growth":
                    None
            },

            "dividendYield":
                dividend_yield,

            "dividendRate":
                dividend_rate,

            "payoutRatio":
                payout_ratio,

            # -------------------------------------------------
            # INVESTOR DATA
            # -------------------------------------------------

            "recentBigInvestors": [],

            # -------------------------------------------------
            # SOURCE / QUALITY
            # -------------------------------------------------

            "dataSource":
                "Yahoo Finance / yfinance",

            "dataQuality": {

                "historyDays":
                    len(history),

                "hasPrice":
                    has_price,

                "hasFinancials":
                    has_financials,

                "hasBalanceSheet":
                    has_balance_sheet,

                "hasCashFlow":
                    has_cashflow,

                "financialMetricCount":
                    financial_data_count,

                "financialDataAvailable":
                    financial_data_count > 0
            }
        }

        print(
            f"OK {ticker} | "
            f"Price={price} | "
            f"PE={pe} | "
            f"Revenue5Y={revenue_growth_5y} | "
            f"ROE={roe} | "
            f"FCF={fcf}"
        )

        return data

    except Exception as e:

        print(
            f"ERROR {ticker}: "
            f"{type(e).__name__}: {e}"
        )

        # Never destroy an otherwise valid
        # universe entry because one data source failed.
        return stock


# =========================================================
# LOAD UNIVERSE
# =========================================================

def load_universe(filename):

    path = DATA_DIR / filename

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


# =========================================================
# UPDATE MARKET
# =========================================================

def update_market(
    universe_filename,
    output_filename,
    market
):

    universe = load_universe(
        universe_filename
    )

    stocks = universe.get(
        "stocks",
        []
    )

    updated = []

    print()
    print("=" * 60)
    print(
        f"UPDATING {market.upper()}"
    )
    print(
        f"Stocks: {len(stocks)}"
    )
    print("=" * 60)

    for number, stock in enumerate(
        stocks,
        start=1
    ):

        print(
            f"\n[{number}/{len(stocks)}]"
        )

        updated_stock = update_stock(
            stock
        )

        updated.append(
            updated_stock
        )

        time.sleep(0.25)

    output = {

        "market": market,

        "lastUpdated":
            pd.Timestamp.utcnow().isoformat(),

        "universeSize":
            len(updated),

        "stocks":
            updated
    }

    output_path = (
        DATA_DIR /
        output_filename
    )

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            output,
            file,
            indent=2,
            ensure_ascii=False
        )

    print()
    print("=" * 60)
    print(
        f"FINISHED {market.upper()}"
    )
    print(
        f"Saved: {output_path}"
    )
    print(
        f"Stocks: {len(updated)}"
    )
    print("=" * 60)


# =========================================================
# MAIN
# =========================================================

def main():

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    update_market(
        "canada_universe.json",
        "canada.json",
        "Canada"
    )

    update_market(
        "india_universe.json",
        "india.json",
        "India"
    )


if __name__ == "__main__":
    main()
