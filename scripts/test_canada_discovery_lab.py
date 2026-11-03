"""Offline tests for multi-source discovery and verified investor-group accounting."""
from datetime import timedelta, datetime, timezone
from email.utils import format_datetime
import json
from canada_discovery_lab import feed_entries, build_lead, parse_sec_filings, lead_type
from canada_new_try import (TODAY, normalized_purchase, company_summary,
                            multiple_buyers, purchases, investor_watch, build_report)

def sample_rss():
    return f"""<?xml version='1.0'?>
    <rss><channel><item><title>Early Warning: Falcon Capital acquires shares</title>
    <link>https://www.globenewswire.com/news-release/sample.html</link>
    <pubDate>{format_datetime(datetime.now(timezone.utc))}</pubDate>
    </item></channel></rss>"""
entries=feed_entries(sample_rss())
assert len(entries)==1 and entries[0]["title"].startswith("Early Warning")
assert build_lead(entries[0],"GlobeNewswire")["verifiedPurchase"] is False
assert build_lead(entries[0],"GlobeNewswire")["reviewStatus"]=="Needs source verification"
assert build_lead({"title":"Asset acquisition: oil property","url":"https://newswire.ca/a","date":TODAY.isoformat(),"summary":""},"Test") is None
assert lead_type("Investment firm plans to acquire shares","")=="Outside scope — excluded"
assert parse_sec_filings(sample_rss(),"SC 13D")[0]["status"]=="Filing published — purchase not established"

corporate=json.load(open("canada-corporate-verified.json",encoding="utf-8"))
assert len(corporate["records"])>=5
assert any(r["investor"].startswith("Electrum Strategic") and r["valueCAD"]==405000 for r in corporate["records"])
normalized=[normalized_purchase(x) for x in corporate["records"] if x["symbol"]=="LAB"]
assert all(normalized)
assert len({x["id"] for x in normalized})==4
assert len({x["transactionDate"] for x in normalized})==2
assert sum(x["shares"] for x in normalized)==57202309
assert round(sum(x["valueCAD"] for x in normalized),2)==2860115.45
assert all(x["symbol"]=="LAB.V" and x["jointActors"] for x in normalized)
assert len({x["buyerGroup"] for x in normalized})==1
company=company_summary(normalized)
assert len(company)==1 and company[0]["distinctBuyers"]==2
assert company[0]["independentGroups"]==1
assert len(company[0]["repeatInvestors"])==2
assert not multiple_buyers(normalized)  # joint actors MUST NOT trigger multi-independent-buy alert

# A truly unrelated investor buying LAB would make two independent groups.
new=dict(corporate["records"][0],investor="Independent Asset Manager LP",buyerGroup=None,jointActors=False,
         transactionDate=TODAY.isoformat(),disclosureDate=TODAY.isoformat(),shares=1000,
         valueCAD=50,sourceUrl="https://www.newswire.ca/independent-source")
new_record=normalized_purchase(new)
assert new_record
assert company_summary(normalized+[new_record])[0]["independentGroups"]==2
# Use the current date for grouping tests, not a fixed 2026 filing date.
recent_group=[
    normalized_purchase({**corporate["records"][0],
                         "transactionDate":TODAY.isoformat(),"disclosureDate":TODAY.isoformat()}),
    normalized_purchase({**corporate["records"][1],
                         "transactionDate":TODAY.isoformat(),"disclosureDate":TODAY.isoformat()}),
]
assert all(recent_group)
assert not multiple_buyers(recent_group)
assert len(multiple_buyers(recent_group+[new_record]))==1

reported=build_report(normalized,quotes={})
assert len(reported["purchases"])==4
assert not reported["multipleBuyers"]
assert "investorWatch" in reported and "leads" in reported and "usFilings" in reported
assert "canadaStocks" not in reported and "cdrs" not in reported
assert all(x.get("verifiedPurchase") for x in reported["purchases"])
assert all(t.get("lane")=="Verified ownership" for t in reported["tracks"])
print("Canadian corporate disclosures & source discovery offline tests: PASS")
