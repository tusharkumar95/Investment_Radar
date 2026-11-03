"""Offline smoke tests for the independent Canadian experiment."""
from datetime import timedelta
from canada_new_try import TODAY, iso, checkpoint, momentum, owner_signal, watch_universe

u, _ = watch_universe()
assert u["NVDA.TO"]["cdr"] == "NVDA"
assert u["NVDA.TO"]["lane"] == "CAD-Hedged CDRs"
assert u["FDY.TO"]["lane"] == "Canadian Stocks"

day = (TODAY - timedelta(days=2)).isoformat()
entry = {
    "direction": "BUY", "company": "Example Canada Ltd.",
    "symbol": "EX", "exchange": "TSX", "investor": "Example investor",
    "shares": 100000, "priceCAD": 4.5, "valueCAD": 450000,
    "disclosureDate": day, "transactionDate": (TODAY - timedelta(days=3)).isoformat(),
    "sourceUrl": "https://www.newswire.ca/example",
    "status": "Completed"
}
signal = owner_signal(entry, None)
assert signal and signal["verifiedPurchase"]
assert signal["symbol"] == "EX.TO"
assert signal["investor"] == "Example investor"
assert signal["price"] is None
assert signal["signal"] == "Completed disclosed acquisition"
assert owner_signal({**entry,"direction":"SELL"}, None) is None
assert owner_signal({**entry,"status":"Proposed"}, None) is None

from_date = TODAY - timedelta(days=8)
points = {from_date.isoformat():10, (from_date+timedelta(days=6)).isoformat():12}
assert checkpoint(points, from_date, 0)["price"] == 10
assert checkpoint(points, from_date, 5)["price"] == 12
assert checkpoint(points, from_date, 15)["price"] is None

info = {"symbol":"NVDA.TO","name":"Nvidia CDR (CAD Hedged)","lane":"CAD-Hedged CDRs","cdr":"NVDA"}
quote = {"price":45,"priceDate":day,"relativeVolume":2.5,"return5d":5,"rsi14":62,"sma20":43,"sma50":41,"breakout20":True}
n = momentum(info, quote)
assert n["signal"] == "Breakout + unusual volume"
assert n["verifiedPurchase"] is False
assert n["sourceUrl"].startswith("https://cdr.cibc.com")
print("Canada New Try offline smoke tests: PASS")
