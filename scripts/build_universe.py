# scripts/build_universe.py

import json
import re
import time
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

MIN_MARKET_CAP_CANADA = 500_000_000
MIN_MARKET_CAP_INDIA = 5_000_000_000

MIN_AVG_VOLUME = 25_000
MIN_HISTORY_DAYS = 250

CANADA_TARGET = 150
INDIA_TARGET = 150


def safe_float(value):
    try:
        if value is None:
            return None

        value = float(value)

        if pd.isna(value):
            return None

        return value

    except Exception:
        return None


def get_info(ticker):
    try:
        return yf.Ticker(ticker).info
    except Exception:
        return {}


def test_stock(ticker, market):

    try:

        stock = yf.Ticker(ticker)

        history = stock.history(
            period="2y",
            auto_adjust=False
        )

        if history is None or history.empty:
            return None

        history = history.dropna(
            subset=["Close"]
        )

        if len(history) < MIN_HISTORY_DAYS:
            return None

        avg_volume = safe_float(
            history["Volume"].tail(60).mean()
        )

        if avg_volume is None:
            return None

        if avg_volume < MIN_AVG_VOLUME:
            return None

        info = get_info(ticker)

        market_cap = safe_float(
            info.get("marketCap")
        )

        if market_cap is None:
            return None

        if market == "Canada":

            if market_cap < MIN_MARKET_CAP_CANADA:
                return None

        else:

            if market_cap < MIN_MARKET_CAP_INDIA:
                return None

        price = safe_float(
            history["Close"].iloc[-1]
        )

        if price is None or price <= 0:
            return None

        return {
            "ticker": ticker,
            "name": (
                info.get("longName")
                or info.get("shortName")
                or ticker
            ),
            "sector": info.get("sector") or "Unknown",
            "industry": info.get("industry") or "Unknown",
            "marketCap": market_cap,
            "avgVolume60D": round(avg_volume),
            "currency": info.get("currency"),
            "exchange": info.get("exchange"),
            "historyDays": len(history),
        }

    except Exception as e:

        print(
            f"SKIP {ticker}: {type(e).__name__}: {e}"
        )

        return None


# ---------------------------------------------------------
# CANADA
# ---------------------------------------------------------

def get_canada_candidates():

    # Broad TSX candidate universe.
    # These are used only as candidates;
    # the actual eligibility filter happens through yfinance.

    tickers = """
RY
TD
BMO
BNS
CM
NA
CWB
LB
EQB
ENB
TRP
CNQ
SU
CVE
IMO
WCP
TOU
ARX
MEG
CP
CNR
WCN
TFII
CAE
ATD
QSR
DOL
L
MG
GIL
NTR
ABX
AEM
WPM
FM
TECK.A
CCO
LUN
IVN
BAM
BN
BIP.UN
BEPC
BEP.UN
GIB.A
SHOP
CSU
OTEX
STN
IFC
MFC
SLF
GWO
FFH
POW
IGM
EMA
FTS
AQN
CU
CPX
H
SAP
WFG
WEED
GFL
KEY
PPL
IPL
EMA
MRU
EMP.A
WN
REI.UN
CAR.UN
DIR.UN
SRU.UN
CRT.UN
HR.UN
AP.UN
CHP.UN
NWH.UN
KMP.UN
BCE
T
RCI.B
QBR.B
LSPD
DOO
BB
NVEI
DSG
SHOP
DCBO
DOL
GSY
EFN
FSZ
FF
ECN
ONEX
FCR.UN
FVI
IMG
EDR
AYA
AG
ASM
SSRM
PAAS
MAG
OR
ERO
LAC
DPM
TXG
BTO
ELD
EQX
SVM
K
WFG
CIX
SLF
GWO
IFC
TSU
SAP
STLC
ATS
WSP
NWC
CJT
BYD
BDT
NFI
MFI
LNR
CAE
CHR
EXE
TRI
CSU
ENGH
PKI
PXT
FRU
PEY
VET
BTE
TVE
ARX
DML
NXE
CCO
LAC
DND
HPS.A
ENGH
MFC
FFH
IGM
POW
ONEX
FSV
TFII
STN
WCN
GFL
RUS
WSP
EIF
EIF
DIR.UN
CAR.UN
REI.UN
AP.UN
SRU.UN
HR.UN
CHP.UN
NWH.UN
BEP.UN
BIP.UN
BEPC
CPX
EMA
FTS
AQN
CU
BLX
GEI
PPL
KEY
ALA
IPL
TRP
ENB
CNQ
SU
CVE
IMO
TOU
ARX
WCP
MEG
VET
BTE
TVE
PXT
FRU
ERF
PEY
PSK
VET
SIA
WN
L
MRU
EMP.A
ATD
QSR
DOL
COST
NWC
SAP
WSP
STN
CJT
TFII
CP
CNR
BBD.B
CAE
ATS
MG
GIL
DOO
BYD
NFI
WFG
IFP
RY
TD
BMO
BNS
CM
NA
MFC
SLF
GWO
IFC
FFH
POW
IGM
EQB
LB
CWB
GSY
ECN
FSZ
ONEX
CIX
T
BCE
RCI.B
QBR.B
SHOP
CSU
OTEX
DSG
LSPD
NVEI
DCBO
BB
TRI
ENGH
LAC
WPM
AEM
ABX
NTR
TECK.B
FM
CCO
LUN
IVN
ERO
DPM
ELD
BTO
PAAS
MAG
OR
FVI
IMG
EDR
AYA
AG
ASM
SSRM
SVM
EQX
ERO
DML
NXE
WCN
GFL
WSP
TRI
CP
CNR
RY
TD
BMO
BNS
CM
NA
ENB
CNQ
SU
SHOP
CPG
TOU
CVE
BAM
BN
BIP.UN
BEPC
BEP.UN
TRP
FTS
EMA
CU
AQN
PPL
KEY
WFG
ATD
QSR
DOL
L
MRU
EMP.A
WN
BCE
T
RCI.B
RBA
RUS
STN
TFII
CJT
WSP
CSU
OTEX
GIB.A
CAE
ATS
NTR
ABX
AEM
WPM
TECK.B
CCO
LUN
FM
SHOP
CSU
BN
BAM
RY
TD
BMO
BNS
CM
NA
MFC
SLF
GWO
IFC
FFH
POW
IGM
EQB
GSY
ECN
ONEX
FSV
""".split()

    cleaned = []

    for ticker in tickers:

        ticker = ticker.strip().upper()

        if not ticker:
            continue

        ticker = ticker.replace(".", "-")

        if re.match(
            r"^[A-Z0-9-]{1,10}$",
            ticker
        ):
            cleaned.append(
                f"{ticker}.TO"
            )

    return sorted(set(cleaned))


# ---------------------------------------------------------
# INDIA
# ---------------------------------------------------------

def get_india_candidates():

    urls = [
        "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
        "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
    ]

    session = requests.Session()

    session.headers.update(
        HEADERS
    )

    # Establish NSE session first
    try:

        session.get(
            "https://www.nseindia.com/",
            timeout=30
        )

    except Exception:
        pass

    response = None

    for url in urls:

        try:

            r = session.get(
                url,
                timeout=30
            )

            if r.ok and len(r.content) > 1000:

                response = r

                break

        except Exception as e:

            print(
                f"NSE download failed: {e}"
            )

    if response is None:

        raise RuntimeError(
            "Could not download NSE equity security list"
        )

    df = pd.read_csv(
        response.content
    )

    symbol_column = None

    for column in df.columns:

        if (
            str(column)
            .strip()
            .upper()
            == "SYMBOL"
        ):

            symbol_column = column

            break

    if symbol_column is None:

        raise RuntimeError(
            "NSE SYMBOL column not found"
        )

    candidates = []

    for symbol in df[symbol_column].dropna():

        symbol = (
            str(symbol)
            .strip()
            .upper()
        )

        if not re.match(
            r"^[A-Z0-9&-]+$",
            symbol
        ):
            continue

        candidates.append(
            f"{symbol}.NS"
        )

    return sorted(
        set(candidates)
    )


# ---------------------------------------------------------
# RANKING
# ---------------------------------------------------------

def rank_stocks(stocks):

    return sorted(
        stocks,
        key=lambda x: (
            x.get("marketCap") or 0,
            x.get("avgVolume60D") or 0
        ),
        reverse=True
    )


# ---------------------------------------------------------
# BUILD
# ---------------------------------------------------------

def build_market(
    candidates,
    market,
    target
):

    results = []

    print()
    print("=" * 60)
    print(
        f"BUILDING {market.upper()} UNIVERSE"
    )
    print(
        f"Candidates: {len(candidates)}"
    )
    print("=" * 60)

    for number, ticker in enumerate(
        candidates,
        start=1
    ):

        print(
            f"[{number}/{len(candidates)}] {ticker}"
        )

        result = test_stock(
            ticker,
            market
        )

        if result:

            results.append(
                result
            )

        time.sleep(0.10)

    results = rank_stocks(
        results
    )

    return results[:target]


# ---------------------------------------------------------
# SAVE
# ---------------------------------------------------------

def save_universe(
    filename,
    market,
    stocks
):

    output = {
        "market": market,
        "lastUpdated": pd.Timestamp.utcnow().isoformat(),
        "universeSize": len(stocks),
        "stocks": stocks
    }

    path = DATA_DIR / filename

    with open(
        path,
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
    print(
        f"Saved {path}"
    )

    print(
        f"Stocks: {len(stocks)}"
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    print(
        "Building Canada candidates..."
    )

    canada_candidates = (
        get_canada_candidates()
    )

    print(
        f"Canada candidates: "
        f"{len(canada_candidates)}"
    )

    print(
        "Building India candidates..."
    )

    india_candidates = (
        get_india_candidates()
    )

    print(
        f"India candidates: "
        f"{len(india_candidates)}"
    )

    canada = build_market(
        canada_candidates,
        "Canada",
        CANADA_TARGET
    )

    india = build_market(
        india_candidates,
        "India",
        INDIA_TARGET
    )

    if len(canada) < 50:

        raise RuntimeError(
            f"Canada universe too small: "
            f"{len(canada)}"
        )

    if len(india) < 50:

        raise RuntimeError(
            f"India universe too small: "
            f"{len(india)}"
        )

    save_universe(
        "canada_universe.json",
        "Canada",
        canada
    )

    save_universe(
        "india_universe.json",
        "India",
        india
    )


if __name__ == "__main__":

    main()
