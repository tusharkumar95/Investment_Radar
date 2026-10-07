import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path):
    return (ROOT / path).read_text(encoding="utf-8")


def require(path, *tokens):
    body = text(path)
    missing = [token for token in tokens if token not in body]
    if missing:
        raise AssertionError(f"{path}: missing release requirement(s): {missing}")
    print(f"PASS {path}: {len(tokens)} release checks")


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
        "investmentRadarPortfolioV1",
    )


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
    for path in (
        ".github/workflows/update-data.yml",
        ".github/workflows/update-etfs.yml",
        ".github/workflows/update-smallcap.yml",
        ".github/workflows/custom-stock.yml",
    ):
        assert (ROOT / path).exists(), f"Missing workflow: {path}"
    require(".github/workflows/update-etfs.yml", "enrich_etf_sectors.py", "No sector exposure available")
    require(".github/workflows/update-smallcap.yml", "selected_count'] == 10")


def main():
    check_mobile()
    check_home_radar()
    check_portfolio()
    check_smallcap()
    check_etf()
    check_custom()
    check_data()
    check_workflows()
    print("\nINVESTMENT RADAR V1 RELEASE CHECK: PASS")


if __name__ == "__main__":
    main()
