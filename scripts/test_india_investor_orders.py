"""Offline contracts for Indian investor following and significant order wins."""
from datetime import datetime, timedelta, timezone
import json

from build_india_investor_watch import build as investors, valid_record
from fetch_india_orders import (
  entries, parsed_amount, parse_order, seed_records, merge, ANNOUNCED, NOW,
  ALERT_FLOOR_CR, OFFICIAL, EXCLUDE
)

a={"date":"02-NOV-2026","investor":"HDFC MUTUAL FUND","symbol":"ABC",
   "company":"ABC Ltd","buyQty":10000,"sellQty":0,
   "buyValue":20000000,"sellValue":0,"source":"NSE Bulk Deals",
   "sourceUrl":"https://nsearchives.nseindia.com/content/equities/bulk.csv",
   "id":"a"}
b={**a,"date":"30-OCT-2026","buyQty":2000,"buyValue":5000000,"id":"b"}
sell={**a,"date":"29-OCT-2026","buyQty":0,"sellQty":1000,
      "buyValue":0,"sellValue":1000000,"id":"c"}
broker={**a,"investor":"BROKING SERVICES LLP","symbol":"XYZ","id":"d"}
result=investors([a,b,sell,broker])
hdfc=next(x for x in result["featured"] if x["name"]=="HDFC MUTUAL FUND")
assert hdfc["buyValueCr"]==2.5
assert hdfc["sellValueCr"]==0.1
assert hdfc["repeatBuyCompanies"]==["ABC"]
assert hdfc["observedBuyDays"]==2
assert hdfc["observedSellDays"]==1
assert all(x["name"]!="BROKING SERVICES LLP" for x in result["discovered"])
dolly=next(x for x in result["featured"] if x["name"]=="Dolly Khanna")
assert dolly["watchOnly"] and dolly["observedTransactions"]==0
assert valid_record({**a,"source":"Random news"}) is None

stamp=datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
sample=f"""<?xml version="1.0"?>
<rss><channel>
 <item><title>Larsen and Toubro Ltd - Bagging/Receiving of orders/contracts</title>
 <description>Company has secured new orders worth Rs. 1,287 crore in India</description>
 <link>https://nsearchives.nseindia.com/corporate/sample123.pdf</link>
 <pubDate>{stamp}</pubDate></item>
 <item><title>Alpha Ltd wins project tender but is declared L1 bidder worth ₹2,800 crore</title>
 <link>https://nsearchives.nseindia.com/corporate/sample234.pdf</link>
 <pubDate>{stamp}</pubDate></item>
 <item><title>Omega Company - Outcome of court order</title><link>https://nsearchives.nseindia.com/court.pdf</link></item>
 </channel></rss>"""
found=entries(sample)
assert len(found)==3
assert parsed_amount("We have secured a purchase order worth Rs 1,287 crore") == 1287
assert parsed_amount("We have received an ₹50 lakh work order") == 0.5
assert parsed_amount("We posted annual revenue of Rs 200 crore") is None
order=parse_order(found[0],"NSE corporate announcements RSS",official=True)
assert order and order["valueCr"]==1287 and order["alertEligible"]
assert order["verified"] is False and "needs review" in order["status"]
l1=parse_order(found[1],"NSE corporate announcements RSS",official=True)
assert l1 and not l1["alertEligible"] and not l1["isFinal"]
assert parse_order(found[2],"NSE corporate announcements RSS",official=True) is None
media=parse_order(found[0],"Google News — discovery",official=False)
assert media and media["verified"] is False and not media["alertEligible"]
assert len(seed_records())==2
assert all(x["verified"] for x in seed_records())
assert all(x["valueMinCr"]>=ALERT_FLOOR_CR for x in seed_records())
retained=merge([*seed_records(),order],{"orders":[]})
assert len(retained)==3
assert len({x["id"] for x in retained})==3
assert order["id"]==parse_order(found[0],"NSE announcements alternate",official=True)["id"]
stale=merge(seed_records(),{"orders":[{**order,"firstSeenAt":NOW.isoformat()}]})
assert any(x["id"]==order["id"] and x["notSeenInLatestScan"] and x["firstSeenAt"]==NOW.isoformat() for x in stale)
assert sum(x.get("alertEligible",False) for x in stale)>=2
assert sum(x.get("verified",False) for x in retained)==2
assert OFFICIAL["NSE corporate announcements RSS"].startswith("https://nsearchives.")
print("India investor tracking & verified order tracker tests: PASS")
