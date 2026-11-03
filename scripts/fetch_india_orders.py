"""India Order Wins: exchange RSS alerts and manually source-verified order awards.

Feeds are checked on a schedule. Official metadata is separated from amounts
actually verified against original company/exchange disclosure documents.
A tender bid, non-binding MoU, option, LOI or media headline is NEVER a
confirmed award. No fabricated size, customer, order/revenue ratio or profit.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

OUTPUT=Path("india-order-wins.json")
SEED=Path("india-order-verified.json")
NOW=datetime.now(timezone.utc)
MAX_DAYS=45
ALERT_FLOOR_CR=100
UA="InvestmentRadarOrderAlerts/1.0 (personal research; source-linked)"
OFFICIAL={
 "NSE corporate announcements RSS":"https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml",
 "NSE announcements alternate":"https://archives.nseindia.com/content/RSS/Online_announcements.xml",
 "BSE corporate announcements RSS":"https://www.bseindia.com/data/xml/announcements.xml",
}
SEARCH={
 "order awards":"(\"wins orders\" OR \"secured order\" OR \"order received\") NSE when:4d",
 "contract awards":"(\"contract awarded\" OR \"letter of award\" OR \"order worth\") BSE when:4d",
 "company filings":"\"Bagging/Receiving of orders/contracts\" when:4d",
}
ANNOUNCED=re.compile(
 r"\b(bagging.receiving of orders|award(?:ed|ing) of orders?|"
 r"receiv(?:ed|ing) (?:of )?(?:a |the )?(?:purchase |work )?orders?|"
 r"(?:wins?|won|bags?|bagged|secures?|secured|awarded|received|"
 r"signs?|signed|obtains?|obtained)\b.{0,45}\b(?:order|contract|work|project)|"
 r"letter of award|letter of acceptance|loi received)\b",re.I)
EXCLUDE=re.compile(
 r"\b(termination|terminated|cancel(?:lation|led)|withdraw(?:n|al)|"
 r"not received|no order|order of court|court order|purchase order placed by company|"
 r"order book update|order status update)\b",re.I)
NOT_FINAL=re.compile(
 r"\b(l[1i] bidder|lowest bidder|l1 status|declared l1|"
 r"bid submitted|tender invited|tender floated|"
 r"proposes?|proposal|in talks|non.binding|"
 r"expression of interest|expected to receive|subject to approval|"
 r"intends? to|letter of intent|memorandum of understanding|mou)\b",re.I)
AMOUNT_RE=re.compile(
 r"(?:(?:rs\.?|inr|₹)\s*)([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lakh|millions?|million|billions?|billion)\b|"
 r"\b([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?)\b",re.I)

def read(path,default):
 try:return json.loads(Path(path).read_text(encoding="utf-8"))
 except (OSError,ValueError):return default

def item_text(node,key):
 for el in node.iter():
  if el is node:continue
  if el.tag.rsplit("}",1)[-1].lower()==key.lower():
   if el.text and el.text.strip():return el.text.strip()
 return ""

def stripped(t):
 return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]*>"," ",str(t or "")))).strip()

def iso(dt):
 if not dt:return None
 try:
  x=parsedate_to_datetime(dt)
  if x.tzinfo is None:x=x.replace(tzinfo=timezone.utc)
  return x.astimezone(timezone.utc).isoformat()
 except (ValueError,TypeError,OverflowError):
  try:
   x=datetime.fromisoformat(str(dt).replace("Z","+00:00"))
   return (x if x.tzinfo else x.replace(tzinfo=timezone.utc)).isoformat()
  except (ValueError,TypeError):return None

def entries(raw):
 try:root=ET.fromstring(raw)
 except ET.ParseError:return []
 rows=[]
 for node in root.iter():
  if node.tag.rsplit("}",1)[-1].lower() not in ("item","entry"):continue
  title=stripped(item_text(node,"title"))
  desc=stripped(item_text(node,"description") or item_text(node,"summary") or item_text(node,"content"))
  guid=item_text(node,"guid") or item_text(node,"id")
  link=item_text(node,"link")
  if not link:
   for el in node.iter():
    if el.tag.rsplit("}",1)[-1]=="link" and el.attrib.get("href"):
     link=el.attrib["href"];break
  date=iso(item_text(node,"pubDate") or item_text(node,"published") or item_text(node,"updated") or item_text(node,"date"))
  if title:
   rows.append({"title":title[:240],"description":desc[:1000],
                "link":link or guid,"date":date,"guid":guid})
 return rows

def fetch(url,timeout=17):
 request=urllib.request.Request(url,headers={
    "User-Agent":UA,"Accept":"application/rss+xml, application/atom+xml, text/xml, application/xml, */*",
    "Referer":"https://www.nseindia.com/" if "nseindia.com" in url else "https://www.bseindia.com/"})
 with urllib.request.urlopen(request,timeout=timeout) as resp:
  return resp.read(3_800_000).decode("utf-8-sig","replace")

def parsed_amount(text):
 """Return explicit monetary value in INR crore, or None; don't invent amounts."""
 t=stripped(text)
 found=[]
 for m in AMOUNT_RE.finditer(t):
  token=m.group(1) or m.group(3)
  unit=(m.group(2) or m.group(4) or "").lower().strip(".")
  try:v=float(token.replace(",",""))
  except ValueError:continue
  if unit.startswith("lakh"):v/=100
  elif unit.startswith("million"):v/=10
  elif unit.startswith("billion"):v*=100
  elif not (unit.startswith("cr") or unit.startswith("crore")):continue
  if v<=0 or v>500_000:continue
  context=t[max(0,m.start()-130):min(len(t),m.end()+95)]
  # Prefer an explicit order size, not company revenue, unrelated funding,
  # share price, or unrelated numeric metrics.
  if re.search(r"\b(orders?|contracts?|projects?|work orders?|letter of award|award value)\b",context,re.I):
   found.append(v)
 return round(max(found),2) if found else None

def canonical_url(url):
 try:
  p=urllib.parse.urlparse(url)
  if p.scheme not in ("http","https") or not p.netloc:return ""
  return urllib.parse.urlunparse((p.scheme,p.netloc.lower(),p.path.rstrip("/"),"","",""))
 except (ValueError,TypeError):return ""

def parse_order(item,source,official=False):
 title=item.get("title") or ""
 desc=item.get("description") or ""
 text=stripped(title+" "+desc)
 if EXCLUDE.search(text):return None
 if not ANNOUNCED.search(text):return None
 timestamp=item.get("date")
 try:
  dt=datetime.fromisoformat(timestamp) if timestamp else None
  if dt and (NOW-dt.astimezone(timezone.utc)).days>MAX_DAYS:return None
 except (ValueError,TypeError):dt=None
 pending=bool(NOT_FINAL.search(text))
 url=canonical_url(item.get("link") or "")
 if not url:return None
 # RSS titles are often just issuer names; can't invent ticker/exact client.
 company=title.split(" - ")[0][:110].strip()
 source_class="official-exchange" if official else "media-discovery"
 amount=parsed_amount(text)
 day=(dt.date().isoformat() if dt else None)
 rid="order:"+hashlib.sha256((source+"|"+url).encode()).hexdigest()[:22]
 status="Bid / non-final announcement — not a won order" if pending else (
    "Exchange order announcement — attachment needs review" if official else
    "Media lead — verify with exchange filing")
 qualified=bool(official and not pending and amount is not None and amount>=ALERT_FLOOR_CR)
 return {
  "id":rid,"company":company,"symbol":None,"title":title[:240],
  "summary":desc[:350],"customer":None,"contractType":"Not independently classified",
  "announcedAt":timestamp,"announcementDate":day,
  "valueCr":amount,"valueMinCr":amount,"valueMaxCr":amount,
  "currency":"INR" if amount is not None else None,"valueStatus":"Exchange feed text; original attachment not yet reviewed" if amount is not None else "Not disclosed in feed",
  "source":source,"sourceUrl":url,"sourceClass":source_class,
  "verified":False,"status":status,"isFinal":not pending,
  "significance":"Value >= ₹100 crore in official announcement" if qualified else "Not independently assessed",
  "alertEligible":qualified,
  "notes":"Source text must be checked against original PDF before treating value as confirmed; this record is NOT a manually verified award.",
 }

def seed_records():
 out=[]
 for r in read(SEED,{}).get("records",[]):
  if r.get("verified") is not True or not r.get("company") or not r.get("sourceUrl"):continue
  if r.get("orderStatus")!="Awarded / secured":continue
  lo=r.get("valueMinCr")
  hi=r.get("valueMaxCr")
  if not isinstance(lo,(int,float)) or lo<0:continue
  if hi is not None and hi<lo:continue
  row=dict(r)
  row["id"]="verified:"+hashlib.sha256((str(r["sourceUrl"])+"|"+str(r.get("symbol"))).encode()).hexdigest()[:22]
  row["status"]="Verified original company/exchange disclosure"
  row["sourceClass"]="original-exchange-filing"
  row["valueCr"]=lo if hi is None or hi==lo else None
  row["valueStatus"]="Exact" if hi==lo else "Company order-size category — bounded range"
  row["alertEligible"]=lo>=ALERT_FLOOR_CR
  row["isFinal"]=True
  out.append(row)
 return out

def merge(rows,previous):
 old={r["id"]:r for r in previous.get("orders",[]) if r.get("id")}
 records={}
 for row in rows:
  if row["id"] in records:continue
  prior=old.get(row["id"])
  if prior:
   row["firstSeenAt"]=prior.get("firstSeenAt") or NOW.isoformat()
  else:row["firstSeenAt"]=NOW.isoformat()
  records[row["id"]]=row
 # Keep verified original records even when they disappear from the RSS.
 for rid,prior in old.items():
  if rid not in records and prior.get("verified"):
   records[rid]=prior
 # Latest 45 days; keep exact source time; don't invent day for date-less RSS.
 cutoff=(NOW-timedelta(days=MAX_DAYS)).date()
 filtered=[]
 for r in records.values():
  day=r.get("announcementDate")
  if day:
   try:
    if datetime.fromisoformat(day).date()<cutoff:continue
   except ValueError:continue
  else:
   seen=r.get("firstSeenAt")
   try:
    if datetime.fromisoformat(seen).date()<cutoff:continue
   except (ValueError,TypeError):continue
  filtered.append(r)
 return sorted(filtered,key=lambda x:(x.get("announcedAt") or x.get("announcementDate") or "",x["id"]),reverse=True)[:220]

def collect():
 previous=read(OUTPUT,{})
 sources=[]
 fresh=seed_records()
 for name,url in OFFICIAL.items():
  try:
   items=entries(fetch(url))
   got=0
   for row in items:
    result=parse_order(row,name,official=True)
    if result:
     fresh.append(result);got+=1
   sources.append({"name":name,"url":url,"ok":True,"items":len(items),"orderMentions":got})
  except Exception as exc:
   sources.append({"name":name,"url":url,"ok":False,"error":str(exc)[:160]})
 # Google discovery is for independent verification; NEVER auto-alert.
 for name,q in SEARCH.items():
  link="https://news.google.com/rss/search?"+urllib.parse.urlencode({
    "q":q,"hl":"en-IN","gl":"IN","ceid":"IN:en"})
  try:
   items=entries(fetch(link))
   got=0
   for row in items:
    result=parse_order(row,"Google News — "+name,official=False)
    if result:fresh.append(result);got+=1
   sources.append({"name":"News search: "+name,"url":link,"ok":True,"items":len(items),"orderMentions":got})
  except Exception as exc:
   sources.append({"name":"News search: "+name,"url":link,"ok":False,"error":str(exc)[:160]})
 orders=merge(fresh,previous)
 # Never consider an unverified media report a confirmed award.
 alerts=[r for r in orders if r.get("alertEligible") and r.get("isFinal") and
         (r.get("verified") or r.get("sourceClass")=="official-exchange")]
 alerts.sort(key=lambda x:(x.get("announcedAt") or x.get("announcementDate") or "",x["id"]),reverse=True)
 doc=[r for r in orders if r.get("verified")]
 exchange=[r for r in orders if not r.get("verified") and r.get("sourceClass")=="official-exchange"]
 leads=[r for r in orders if r.get("sourceClass")=="media-discovery"]
 report={
  "schema":1,"updated":NOW.isoformat(),"market":"India",
  "thresholdCr":ALERT_FLOOR_CR,
  "policy":"Only documented awards qualify as verified. Exchange RSS order metadata may carry a reported value but must be checked against the attachment. Media headlines and non-final bids/LOIs never trigger alerts. Refresh delay and feed availability apply.",
  "orders":orders,"alerts":alerts,"verifiedOrders":doc,"exchangeNotices":exchange,
  "researchLeads":leads,"sourceHealth":sources,
  "status":{"orders":len(orders),"verified":len(doc),"exchangeNotices":len(exchange),
            "researchLeads":len(leads),"significantAlerts":len(alerts),
            "sourcesAvailable":sum(1 for x in sources if x["ok"]),"sourcesChecked":len(sources),
            "latestAnnouncementDate":max((r.get("announcementDate") or "" for r in orders),default=None)},
  "sources":{"NSE":OFFICIAL["NSE corporate announcements RSS"],"BSE":OFFICIAL["BSE corporate announcements RSS"]},
 }
 OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("India order awards:",report["status"])

if __name__=="__main__":collect()
