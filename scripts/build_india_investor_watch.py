"""India Follow Investors: disclosed NSE bulk/block participant transactions.

No price-volume proxies. Output is OBSERVED deal behavior, not a complete
portfolio, personal investing advice, or a verified long-term strategy.
Source is the already collected official NSE trade disclosures; do not
change the India Moves collector.
"""
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SOURCE=Path("moves-history.json")
DEST=Path("investor-watch-india.json")
NOW=datetime.now(timezone.utc).isoformat()
# Publicly recognizable investors and institutions to FOLLOW, not to label
# as recent buyers without matching official reported transactions.
FOLLOW=[
 {"name":"Rekha Jhunjhunwala","aliases":["REKHA JHUNJHUNWALA"],"category":"Public-market investor"},
 {"name":"Dolly Khanna","aliases":["DOLLY KHANNA"],"category":"Public-market investor"},
 {"name":"Ashish Kacholia","aliases":["ASHISH KACHOLIA"],"category":"Public-market investor"},
 {"name":"Mukul Agrawal","aliases":["MUKUL AGRAWAL","MUKUL MAHAVIR AGRAWAL"],"category":"Public-market investor"},
 {"name":"Vijay Kedia","aliases":["VIJAY KEDIA","VIJAY KISHANLAL KEDIA"],"category":"Public-market investor"},
 {"name":"Madhusudan Kela","aliases":["MADHUSUDAN KELA"],"category":"Public-market investor"},
 {"name":"Nemish Shah","aliases":["NEMISH SHAH"],"category":"Public-market investor"},
 {"name":"Porinju Veliyath","aliases":["PORINJU VELIYATH"],"category":"Public-market investor"},
 {"name":"HDFC Mutual Fund","aliases":["HDFC MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"SBI Mutual Fund","aliases":["SBI MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"ICICI Prudential Mutual Fund","aliases":["ICICI PRUDENTIAL MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"Nippon India Mutual Fund","aliases":["NIPPON INDIA MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"Kotak Mutual Fund","aliases":["KOTAK MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"Franklin Templeton Mutual Fund","aliases":["FRANKLIN TEMPLETON MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"Invesco Mutual Fund","aliases":["INVESCO MUTUAL FUND"],"category":"Mutual fund"},
 {"name":"Abakkus Investment","aliases":["ABAKKUS"],"category":"Investment manager / fund"},
 {"name":"Carnelian Asset Management","aliases":["CARNELIAN ASSET MANAGEMENT"],"category":"Investment manager / fund"},
 {"name":"Goldman Sachs India Equity Portfolio","aliases":["GOLDMAN SACHS INDIA EQUITY PORTFOLIO"],"category":"Investment fund"},
 {"name":"Smallcap World Fund","aliases":["SMALLCAP WORLD FUND"],"category":"Investment fund"},
 {"name":"Morgan Stanley Asia","aliases":["MORGAN STANLEY ASIA"],"category":"Institutional investor"},
]
INTERMEDIARY=re.compile(r"\b(BROKING|BROKERAGE|STOCK BROK|ARBITRAGE|HFT|MARKET MAK|TRADING FINANCIAL|FINTRADE)\b",re.I)
FUND=re.compile(r"\b(MUTUAL FUND|INVESTMENT FUND|ASSET MANAGEMENT|CAPITAL|AIF|FUND|INSURANCE|HOLDINGS)\b",re.I)
CRORE=10_000_000

def canonical(s):
 return re.sub(r"\s+"," ",str(s or "").strip()).upper()

def date_iso(s):
 try:return datetime.strptime(str(s).strip().upper(),"%d-%b-%Y").date().isoformat()
 except (ValueError,TypeError):
  try:return datetime.fromisoformat(str(s)[:10]).date().isoformat()
  except (ValueError,TypeError):return None

def valid_record(raw):
 n=canonical(raw.get("investor"))
 sym=canonical(raw.get("symbol"))
 day=date_iso(raw.get("date"))
 if not all((n,sym,day)):return None
 if not str(raw.get("source","")).startswith("NSE "):return None
 bq=max(0,int(raw.get("buyQty") or 0))
 sq=max(0,int(raw.get("sellQty") or 0))
 bv=max(0,float(raw.get("buyValue") or 0))
 sv=max(0,float(raw.get("sellValue") or 0))
 if not (bq or sq):return None
 return {
   "date":day,"name":n,"symbol":sym,"company":str(raw.get("company") or sym),
   "buyQty":bq,"sellQty":sq,"buyValueINR":round(bv,2),
   "sellValueINR":round(sv,2),"netShares":bq-sq,
   "netValueINR":round(bv-sv,2),"avgBuyPrice":raw.get("avgBuyPrice"),
   "source":raw.get("source"),"sourceUrl":raw.get("sourceUrl"),
   "dealId":raw.get("id") or hashlib.sha1(f"{day}|{n}|{sym}".encode()).hexdigest()[:16]
 }

def category(name):
 if INTERMEDIARY.search(name):return "Market intermediary / trading firm"
 if FUND.search(name):return "Institution / fund / investment entity (name-based)"
 if re.search(r"\b(BANK|SECURITIES|FINANCIAL MARKETS)\b",name,re.I):
  return "Financial institution (may intermediate trades)"
 return "Named investor / company"

def build(rows):
 clean={}
 for raw in rows:
  r=valid_record(raw)
  if r:clean[r["dealId"]]=r
 records=list(clean.values())
 names=defaultdict(list)
 for r in records:names[r["name"]].append(r)
 profiles={}
 for name,items in names.items():
  items.sort(key=lambda x:(x["date"],x["symbol"]),reverse=True)
  stocks=defaultdict(list)
  for item in items:stocks[item["symbol"]].append(item)
  bought=round(sum(x["buyValueINR"] for x in items)/CRORE,2)
  sold=round(sum(x["sellValueINR"] for x in items)/CRORE,2)
  buy_days=len({(x["date"],x["symbol"]) for x in items if x["buyQty"]>0})
  sell_days=len({(x["date"],x["symbol"]) for x in items if x["sellQty"]>0})
  repeat=[symbol for symbol,sides in stocks.items() if len({x["date"] for x in sides if x["buyQty"]>0})>=2]
  top=sorted(stocks.items(),key=lambda kv:sum(x["buyValueINR"] for x in kv[1]),reverse=True)
  symbols=[{"symbol":sym,"company":a[0]["company"],"buyValueCr":round(sum(x["buyValueINR"] for x in a)/CRORE,2),
            "sellValueCr":round(sum(x["sellValueINR"] for x in a)/CRORE,2),
            "netShares":sum(x["netShares"] for x in a),
            "buyDays":len({x["date"] for x in a if x["buyQty"]>0}),
            "sellDays":len({x["date"] for x in a if x["sellQty"]>0})} for sym,a in top]
  profile={
   "id":"investor:"+hashlib.sha1(name.encode()).hexdigest()[:16],
   "name":name,"type":category(name),"observedTransactions":len(items),
   "observedBuyDays":buy_days,"observedSellDays":sell_days,
   "buyValueCr":bought,"sellValueCr":sold,
   "netDisclosedValueCr":round(bought-sold,2),
   "latestDisclosure":items[0]["date"],
   "uniqueCompanies":len(stocks),"repeatBuyCompanies":repeat,
   "tradeRecords":items[:75],"companies":symbols[:30],
   "observations":{
     "repeatPurchases":bool(repeat),
     "buyAndSellObserved":bool(buy_days and sell_days),
     "multipleCompanies":len(stocks)>=3,
     "noObservedBuys":buy_days==0,
   },
   "interpretation":"Observed NSE bulk/block disclosures only. This is NOT a full holdings statement or a verified long-term investment strategy.",
  }
  profiles[name]=profile
 featured=[]
 assigned=set()
 for follower in FOLLOW:
  aliases=[canonical(a) for a in follower["aliases"]]
  hits=[p for name,p in profiles.items() if any(
    name==a or (a in name and (a.startswith("ABAKKUS") or a.startswith("CARNELIAN") or
                             a.startswith("GOLDMAN") or a.startswith("SMALLCAP") or a.startswith("MORGAN")))
    for a in aliases)]
  if not hits:
   featured.append({"name":follower["name"],"type":follower["category"],
      "watchOnly":True,"status":"Monitored — no qualifying NSE bulk/block deal in retained history",
      "observedTransactions":0,"buyValueCr":0,"sellValueCr":0,"netDisclosedValueCr":0,
      "observedBuyDays":0,"observedSellDays":0,"latestDisclosure":None,
      "uniqueCompanies":0,"repeatBuyCompanies":[],"companies":[],"tradeRecords":[],
      "interpretation":"No matching bulk/block disclosure does not establish that this investor holds or has not purchased a stock."})
  else:
   # If several legal fund entities share a name, retain individual deal records
   # and disclose aliases rather than claiming they are one beneficial owner.
   for p in hits:
    if p["id"] not in assigned:
     featured.append({**p,"displayName":follower["name"],"watchOnly":False,
                      "status":"Exchange-disclosed transactions observed"})
     assigned.add(p["id"])
 discovered=[p for p in profiles.values() if p["id"] not in assigned and
             p["observedBuyDays"] and not INTERMEDIARY.search(p["name"])]
 discovered.sort(key=lambda x:(x["netDisclosedValueCr"],x["observedBuyDays"]),reverse=True)
 return {
  "schema":1,"updated":NOW,
  "source":"NSE official bulk and block trade disclosure records already archived in Investment Radar",
  "sourceLink":"https://www.nseindia.com/report-detail/display-bulk-and-block-deals",
  "scope":"NSE reported bulk/block participant names only; not all trades, not quarterly holdings",
  "coverage":{"earliest":min((x["date"] for x in records),default=None),
              "latest":max((x["date"] for x in records),default=None),
              "trades":len(records),"investors":len(profiles)},
  "featured":featured,"discovered":discovered[:55],
  "notes":"Name matches are case-insensitive, with explicit aliases. Intermediaries excluded from discovered-conviction ranking. Profiles explain observed transaction patterns without implying motives or full portfolio strategy."
 }

def main():
 src=json.loads(SOURCE.read_text(encoding="utf-8"))
 report=build(src.get("records",[]))
 DEST.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("India investor watch:",report["coverage"],"featured",len(report["featured"]),"discovered",len(report["discovered"]))

if __name__=="__main__":main()
