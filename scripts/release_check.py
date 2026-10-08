import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WRITER_WORKFLOWS = (
    ".github/workflows/update-data.yml",
    ".github/workflows/update-etfs.yml",
    ".github/workflows/update-smallcap.yml",
    ".github/workflows/custom-stock.yml",
)

LEGACY_FILES = (
    ".github/workflows/frontend-technical-fix.yml",
    ".github/workflows/repair-data-payload.yml",
    ".github/workflows/upgrade-frontend.yml",
    "scripts/upgrade_frontend.py",
    "scripts/build_universe.py",
)


def text(path):
    return (ROOT / path).read_text(encoding="utf-8")


def require(path, *tokens):
    body = text(path)
    missing = [token for token in tokens if token not in body]
    if missing:
        raise AssertionError(f"{path}: missing release requirement(s): {missing}")
    print(f"PASS {path}: {len(tokens)} release checks")


def forbid(path, *tokens):
    body = text(path)
    present = [token for token in tokens if token in body]
    if present:
        raise AssertionError(f"{path}: obsolete release content still present: {present}")
    print(f"PASS {path}: obsolete content absent")


def load_json(path):
    with (ROOT / path).open(encoding="utf-8") as f:
        return json.load(f)


def check_mobile():
    common = ("safe-area-inset-bottom", "overflow-x:hidden", "min-height:44px", "font-size:16px")
    for page in ("index.html", "portfolio.html", "etf.html", "smallcap.html", "custom.html"):
        require(page, *common)


def check_home_radar():
    require(
        "index.html",
        "data-market=\"Canada\"",
        "data-market=\"India\"",
        "data-view=\"Long Term\"",
        "data-view=\"Short Term\"",
        "portfolio.html",
        "etf.html",
        "smallcap.html",
        "custom.html",
        "dataFreshness",
    )
    require(
        "app.js",
        'window.selectMarket=function(market)',
        'window.selectView=function(view)',
        'radarWatchlist',
        'Investment Alerts',
        'renderCompare()',
        'compareSet',
        'hours>72',
        'getMarket("Canada")',
        'getMarket("India")',
    )


def check_portfolio():
    require(
        "portfolio.html",
        '<option value="Canada">',
        '<option value="India">',
        "CAD and INR are intentionally analyzed separately",
        "Risk & Diversification",
        "PORTFOLIO.load()",
    )
    require("engine/portfolio.js", "investmentRadarPortfolioV1", "market", "avgCost")


def check_smallcap():
    d = load_json("data/smallcap_universe.json")
    excluded = ("split corp", "split share", "closed-end", "closed end", "investment trust", "acquisition corp", "capital pool")
    for market in ("Canada", "India"):
        block = d["markets"][market]
        stocks = block.get("stocks", [])
        assert block.get("selected_count") == 10, f"{market}: selected_count is not 10"
        assert len(stocks) == 10, f"{market}: stock payload is not 10"
        for stock in stocks:
            hay = " ".join(str(stock.get(k) or "") for k in ("name", "industry", "businessFit")).lower()
            assert not any(term in hay for term in excluded), f"{market}: structured vehicle slipped through: {stock.get('ticker')}"
            assert stock.get("businessFit") == "Operating company", f"{market}: non-operating candidate: {stock.get('ticker')}"
        print(f"PASS small-cap {market}: 10 operating-company selections")
    require("engine/smallcap.js", "setMarket=function", "STALE DATA", "smallcap_universe.json")
    require("smallcap.html", "Small Cap v3", "engine/smallcap.js?v=1.0.2")


def check_etf():
    for market in ("canada", "india"):
        d = load_json(f"data/etf_{market}.json")
        etfs = d.get("etfs", [])
        assert len(etfs) >= 10, f"ETF {market}: fewer than 10 ETFs"
        assert any(e.get("holdings") for e in etfs), f"ETF {market}: no holdings coverage"
        assert any(e.get("sectors") for e in etfs), f"ETF {market}: no sector exposure coverage"
        print(f"PASS ETF {market}: {len(etfs)} ETFs with holdings and sector coverage")
    require("engine/etfRadar.js", "sharedDetails", "sectorOverlap", "portfolioOverlap", "coverageA", "coverageB")
    require("etf.html", "Common Holdings", "Sector Duplication", "Overlap with My ${esc(market)} Portfolio", "lower-bound estimate", "Holdings coverage", "Sector coverage")


def check_custom():
    require(
        "custom.html",
        "<option>Canada</option>",
        "<option>India</option>",
        "normalizeTicker",
        "detectMarket",
        "Saved Radar data",
        "Live market data unavailable",
    )


def check_data():
    for market in ("canada", "india"):
        d = load_json(f"data/{market}_radar.json")
        assert d.get("stocks"), f"{market}_radar.json has no stocks"
        print(f"PASS {market} radar data: {len(d['stocks'])} stocks")


def check_workflows():
    for path in WRITER_WORKFLOWS:
        assert (ROOT / path).exists(), f"Missing workflow: {path}"
        require(
            path,
            "group: investment-radar-data-${{ github.ref }}",
            "cancel-in-progress: false",
        )

    require(".github/workflows/update-etfs.yml", "enrich_etf_sectors.py", "No sector exposure available")
    require(".github/workflows/update-smallcap.yml", "selected_count'] == 10")
    require(
        ".github/workflows/update-data.yml",
        "data/canada_radar.json",
        "data/india_radar.json",
        "data/history_canada.json",
        "data/history_india.json",
    )
    forbid(
        ".github/workflows/update-data.yml",
        "Upgrade financial data engine",
        "Repair updater syntax before compile",
    )


def check_cleanup():
    for path in LEGACY_FILES:
        assert not (ROOT / path).exists(), f"Obsolete v1 build artifact still present: {path}"
    print(f"PASS cleanup: {len(LEGACY_FILES)} obsolete build/repair files removed")

    # These pairs look duplicated by filename but are active dependencies.
    # Base layers provide component functions; V2 layers own the final calibrated entry points.
    for path in (
        "engine/scoring.js",
        "engine/scoringV2.js",
        "engine/valuation.js",
        "engine/valuationV2.js",
    ):
        assert (ROOT / path).exists(), f"Required scoring/valuation layer missing: {path}"
    print("PASS cleanup: active base/V2 engine layers preserved")

    forbid("smallcap.html", "/* v1 mobile release overrides */", "Mobile / iPhone release polish")


def main():
    check_mobile()
    check_home_radar()
    check_portfolio()
    check_smallcap()
    check_etf()
    check_custom()
    check_data()
    check_workflows()
    check_cleanup()
    print("\nINVESTMENT RADAR V1 RELEASE CHECK: PASS")


if __name__ == "__main__":
    main()
