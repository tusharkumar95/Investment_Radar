"""Contract checks: never publish a signal without a named disclosed purchase."""
from datetime import timedelta
from canada_new_try import (TODAY, normalized_purchase, entity_type, ticker_exchange,
                            company_summary, multiple_buyers, checkpoint, build_report, purchases)

day=(TODAY-timedelta(days=2)).isoformat()
trade=(TODAY-timedelta(days=3)).isoformat()
base={
    "market":"Canada", "direction":"BUY","company":"Sample Copper Corp.",
    "symbol":"SMP","exchange":"TSX","investor":"Example Capital Corporation",
    "shares":100000,"priceCAD":4.5,"valueCAD":450000,
    "disclosureDate":day,"transactionDate":trade,
    "type":"Open-market acquisition","status":"Completed",
    "sourceUrl":"https://www.newswire.ca/sample","sourceName":"Example corporate release"
}
a=normalized_purchase(base)
assert a and a["verifiedPurchase"] and a["symbol"]=="SMP.TO"
assert a["investor"]=="Example Capital Corporation"
assert a["valueCAD"]==450000
assert a["transactionDate"]==trade and a["disclosureDate"]==day
assert "Corporate" in a["buyerType"]
assert "Corporate" in entity_type("Nemesia S.à.r.l.")
assert ticker_exchange({"symbol":"V"}) is None
assert normalized_purchase({**base,"direction":"SELL"}) is None
assert normalized_purchase({**base,"direction":"UNKNOWN"}) is None
assert normalized_purchase({**base,"status":"Proposed"}) is None
assert normalized_purchase({**base,"investor":""}) is None
assert normalized_purchase({**base,"sourceUrl":""}) is None
assert normalized_purchase({**base,"disclosureDate":(TODAY+timedelta(days=1)).isoformat()}) is None

b=normalized_purchase({**base,"investor":"Another Asset Fund", "valueCAD":220000})
assert a["id"]!=b["id"]
groups=company_summary([a,b])
assert len(groups)==1 and groups[0]["distinctBuyers"]==2
assert len(multiple_buyers([a,b]))==1
assert not multiple_buyers([a,a])  # one buyer never becomes a false multiple-buyer alert
points={(TODAY-timedelta(days=8)).isoformat():10,(TODAY-timedelta(days=2)).isoformat():12}
begin=TODAY-timedelta(days=8)
assert checkpoint(points,begin,0)["price"]==10
assert checkpoint(points,begin,5)["price"]==12
assert checkpoint(points,begin,15)["price"] is None

report=build_report([a,b],quotes={})
assert report["schema"]==2
assert len(report["purchases"])==2
assert len(report["multipleBuyers"])==1
assert set(report.keys()).isdisjoint({"canadaStocks","cdrs","momentum"})
assert all("relativeVolume" not in x and "score" not in x for x in report["purchases"])
assert all(t["lane"]=="Verified ownership" and t["id"].startswith("owner:") for t in report["tracks"])
assert all(t["quoteStatus"]=="No confirmed CAD close" for t in report["tracks"])

real=purchases()
assert all(x.get("verifiedPurchase") for x in real)
assert all(x.get("sourceUrl") and x.get("investor") for x in real)
print("Canada verified-purchases-only contract: PASS",len(real),"curated transactions")
