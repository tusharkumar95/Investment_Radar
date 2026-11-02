"""Offline contract tests for secondary Canadian insider imports."""
import sys
from pathlib import Path
from datetime import timedelta
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_canada_insiders import normalize, NOW
recent = (NOW - timedelta(days=2)).date().isoformat()
trade = (NOW - timedelta(days=3)).date().isoformat()
future = (NOW + timedelta(days=1)).date().isoformat()

base = {
    "country": "CA", "date": trade, "filed": recent,
    "ticker": "FDY", "issuer": "Faraday Copper Corp.",
    "insider": "Example Director", "role": "Director", "direction": "BUY",
    "shares": 1000, "price": 4.5, "value": 4500,
    "url": "https://marketclerk.com/stock/ca/FDY/insider-trading"
}
row = normalize(base)
assert row is not None
assert row["verified"] is False
assert row["currency"] == "UNSPECIFIED"
assert row["valueCAD"] is None
assert row["disclosureDate"] == recent
assert row["transactionDate"] == trade

def changed(**kwargs):
    return {**base, **kwargs}

assert normalize(changed(country="US")) is None
assert normalize(changed(direction="GRANT")) is None
assert normalize(changed(url="https://phishing.example/stock")) is None
assert normalize(changed(date=future, filed=recent)) is None
assert normalize(changed(shares=-100)) is None
assert normalize(changed(currency="CAD"))["valueCAD"] == 4500
assert normalize(changed(currency="USD"))["valueCAD"] is None
assert normalize(changed(currency="USD"))["currency"] == "USD"
assert normalize(base)["id"] == normalize(base)["id"]
print("Canadian secondary feed normalization: OK")
