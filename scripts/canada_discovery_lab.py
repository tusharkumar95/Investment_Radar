"""Public disclosure discovery for the *separate* Canada New Try experiment.

This discovers leads, NOT proven investments. A matching headline never
becomes a BUY; only independently reviewed original transaction documents
enter the verified ledger. Do not scrape SEDAR+ or bypass publisher controls.

Sources: GlobeNewswire RSS, Google News RSS pointing at established
press-release publishers, Canada NewsWire public listing, and SEC's
public EDGAR Atom filings feed. Each failure is shown in health status.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

OUT=Path("canada-new-try-leads.json")
NOW=datetime.now(timezone.utc)
DAYS=35
UA="InvestmentRadar disclosure research (https://github.com/tusharkumar95/Investment_Radar)"
TRUSTED_DOMAINS=("globenewswire.com","newswire.ca","newsfilecorp.com","accesswire.com","businesswire.com","sedarplus.ca","sec.gov")
PUBLISHER_FEEDS=[
    ("GlobeNewswire / Major Shareholders",
     "https://www.globenewswire.com/RssFeed/subjectcode/59-Major%20Shareholder%20Announcements/feedTitle/GlobeNewswire%20-%20Major%20Shareholder%20Announcements"),
    ("GlobeNewswire / Insider Buy-Sell",
     "https://www.globenewswire.com/RssFeed/subjectcode/22-Insider%2027s%20Buy%202fSell/feedTitle/GlobeNewswire%20-%20Insider%20s%20Buy%2C%20Sell"),
    ("GlobeNewswire / Public Companies",
     "https://www.globenewswire.com/RssFeed/orgclass/1/feedTitle/GlobeNewswire%20-%20News%20about%20Public%20Companies"),
]
SEARCH_QUERIES=[
    '"early warning" "acquired" "shares" (TSX OR TSXV) when:14d',
    '"early warning" "acquires shares" site:globenewswire.com when:30d',
    '"share acquisition" "acquiror" site:newsfilecorp.com when:30d',
    '"institutional investor" "shares" "private placement" "closed" TSXV when:14d',
    '"early warning report" "completed" site:newswire.ca when:14d',
    '"Sprott" "acquired shares" "TSXV" when:30d',
    '"Fairfax" "acquires shares" "TSX" when:30d',
    '"Altius" "acquired shares" when:30d',
    '"Brookfield" "share acquisition" when:30d',
    '"Matachewan" "McChip" "Labrador Gold" when:30d',
]
SEC_FORMS=("SC 13D","SC 13G","13F-HR")
INTEREST=re.compile(
    # Equity/security ownership, not acquisition of a business, property, or asset.
    r"early.warning|major.shareholder|insider.buy|13f|13d|13g|"
    r"(?:acquir\\w*|purchas\\w*|subscrib\\w*).{0,85}(?:shares|units|securities|equity|stock|stake)|"
    r"(?:shares|units|securities|equity|stock|stake).{0,85}(?:acquir\\w*|purchas\\w*|subscrib\\w*)|"
    r"private.placement|strategic.equity.investment|share.acquisition|"
    r"investment in .{0,65}(?:shares|equity|common.stock)|"
    r"(?:raises?|closes?).{0,55}(?:equity|financing|placement)", re.I)
CLOSED=re.compile(r"\b(closed|closing|completed|acquired|purchased|subscribed)\b",re.I)
NON_INVESTMENT=re.compile(r"\b(class action|securities litigation|share buyback|buyback|repurchases own shares|"
                          r"asset acquisition|acquires mining property|debt facility)\b",re.I)

def fetch(url, timeout=13, size=750000):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8"})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read(size).decode("utf-8","replace")

def feed_date(v):
    if not v:return None
    try:
        dt=parsedate_to_datetime(str(v))
        if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
        return dt.date().isoformat()
    except (ValueError,TypeError,OverflowError):
        try:return datetime.fromisoformat(str(v).replace("Z","+00:00")).date().isoformat()
        except (ValueError,TypeError):return None

def element_text(node,name):
    for tag in (name,"{http://www.w3.org/2005/Atom}"+name):
        item=node.find(tag)
        if item is not None and item.text:return item.text.strip()
    return ""

def feed_entries(raw):
    try:root=ET.fromstring(raw)
    except ET.ParseError:return []
    out=[]
    for node in list(root.iter()):
        if node.tag.rsplit("}",1)[-1] not in ("item","entry"):continue
        title=html.unescape(re.sub(r"<[^>]+>","",element_text(node,"title")))
        url=element_text(node,"link")
        if not url:
            for child in node:
                if child.tag.rsplit("}",1)[-1]=="link" and child.attrib.get("href"):
                    url=child.attrib["href"];break
        day=feed_date(element_text(node,"pubDate") or element_text(node,"published") or element_text(node,"updated"))
        summary=element_text(node,"description") or element_text(node,"summary")
        summary=html.unescape(re.sub(r"<[^>]+>"," ",summary))[:450]
        if title and url:out.append({"title":title[:260],"url":url,"date":day,"summary":summary})
    return out

class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.href=None;self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a":self.href=dict(attrs).get("href");self.text=[]
    def handle_data(self,text):
        if self.href is not None:self.text.append(text)
    def handle_endtag(self,tag):
        if tag=="a" and self.href:
            self.links.append((self.href," ".join(self.text).strip()))
            self.href=None;self.text=[]

def cnw_listing_entries(raw):
    p=AnchorParser();p.feed(raw)
    entries=[]
    for href,title in p.links:
        link=urllib.parse.urljoin("https://www.newswire.ca",html.unescape(href))
        if urllib.parse.urlparse(link).hostname not in ("newswire.ca","www.newswire.ca"):continue
        if not re.search(r"^/news-releases/.+\.html$",urllib.parse.urlparse(link).path):continue
        if title:
            m=re.search(r"\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},\\s+20\\d{2}\\b",title,re.I)
            try: article_day=datetime.strptime(m.group(0).replace(".",""),"%b %d, %Y").date().isoformat() if m else None
            except ValueError:article_day=None
            entries.append({"title":title[:260],"url":link,"date":article_day,"summary":""})
    return entries

def in_window(day):
    if day is None:return True  # preserve as candidate with date unknown, not a verified trade
    try:age=(NOW.date()-datetime.fromisoformat(day).date()).days
    except ValueError:return False
    return -1<=age<=DAYS

def lead_type(title,summary):
    text=title+" "+summary
    if NON_INVESTMENT.search(title):return "Outside scope — excluded"
    # Announced takeovers/mergers are generally agreements, not completed
    # investment purchases by a reporting fund or corporation.
    if re.search(r"\\b(to be acquired|agreement to acquire|to acquire|merger agreement|tender offer)\\b",title,re.I):
        return "Outside scope — excluded"
    if not INTEREST.search(text):return None
    if re.search(r"\b(announces?|plans?|intends?|proposes?|subject to|expected to)\b",title,re.I) and not CLOSED.search(title):
        return "Potential / incomplete — verify status"
    if re.search(r"early.warning|major.shareholder|acquir(?:ed|es)|purchas(?:ed|es)|shareholder",title,re.I):
        return "Ownership disclosure — review source"
    return "Possible capital investment — review source"

def canonical_url(url):
    p=urllib.parse.urlparse(url)
    if p.scheme not in ("https","http") or not p.netloc:return None
    return urllib.parse.urlunparse((p.scheme,p.netloc.lower(),p.path.rstrip("/"),"","",""))

def build_lead(item,source):
    kind=lead_type(item["title"],item.get("summary",""))
    if not kind or kind.startswith("Outside scope") or not in_window(item.get("date")):return None
    url=canonical_url(item["url"])
    if not url:return None
    key="lead:"+hashlib.sha1(url.encode()).hexdigest()[:18]
    return {"id":key,"title":item["title"],"date":item.get("date"),
            "url":url,"discoveredVia":source,"type":kind,
            "reviewStatus":"Needs source verification",
            "verifiedPurchase":False,"summary":item.get("summary","")[:300]}

def parse_sec_filings(raw,form):
    entries=feed_entries(raw)
    results=[]
    for row in entries[:45]:
        title=row["title"]
        # SEC filings are signals of *documents*, not completed investment trades.
        url=canonical_url(row["url"])
        if not url:continue
        results.append({
            "id":"sec:"+hashlib.sha1(url.encode()).hexdigest()[:18],
            "title":title, "date":row.get("date"),
            "url":url,"form":form,"status":"Filing published — purchase not established",
            "notes":"13D/13G describe beneficial ownership; 13F is delayed quarter-end holdings. Neither proves a same-day buy or a Canadian CDR purchase."
        })
    return results

def refresh():
    old={}
    if OUT.exists():
        try:old=json.loads(OUT.read_text(encoding="utf-8"))
        except (ValueError,OSError):pass
    # Reclassify previously cached headlines on EVERY refresh; otherwise old
    # irrelevant asset-acquisition stories would remain in the queue forever.
    leads={}
    for oldrow in old.get("leads",[]):
        if oldrow.get("reviewStatus")!="Needs source verification":continue
        candidate=build_lead({"title":oldrow.get("title",""),"url":oldrow.get("url",""),
                              "date":oldrow.get("date"),"summary":oldrow.get("summary","")},
                             oldrow.get("discoveredVia","Previously discovered"))
        if candidate:leads[candidate["id"]]=candidate
    filings={f["id"]:f for f in old.get("usFilings",[]) if in_window(f.get("date"))}
    source_health=[]
    for name,url in PUBLISHER_FEEDS:
        try:
            rows=feed_entries(fetch(url))
            matched=0
            for row in rows:
                v=build_lead(row,name)
                if v:
                    leads[v["id"]]=v;matched+=1
            source_health.append({"name":name,"ok":True,"items":len(rows),"relevant":matched})
        except Exception as e:
            source_health.append({"name":name,"ok":False,"error":str(e)[:130]})
        time.sleep(.25)
    for q in SEARCH_QUERIES:
        url="https://news.google.com/rss/search?"+urllib.parse.urlencode({"q":q,"hl":"en-CA","gl":"CA","ceid":"CA:en"})
        try:
            rows=feed_entries(fetch(url))
            matched=0
            for row in rows:
                v=build_lead(row,"Google News discovery — "+q[:70])
                if v:
                    leads[v["id"]]=v;matched+=1
            source_health.append({"name":"News search: "+q[:55],"ok":True,"items":len(rows),"relevant":matched})
        except Exception as e:
            source_health.append({"name":"News search: "+q[:55],"ok":False,"error":str(e)[:130]})
        time.sleep(.20)
    for label,listing in [
        ("Canada NewsWire / Acquisitions",
         "https://www.newswire.ca/news-releases/financial-services-latest-news/acquisitions-mergers-and-takeovers-list/?page=1&pagesize=100"),
        ("Canada NewsWire / Private placements",
         "https://www.newswire.ca/news-releases/financial-services-latest-news/private-placement-list/?page=1&pagesize=100"),
    ]:
        try:
            rows=cnw_listing_entries(fetch(listing))
            n=0
            for row in rows:
                v=build_lead(row,label)
                if v:leads[v["id"]]=v;n+=1
            source_health.append({"name":label,"ok":True,"items":len(rows),"relevant":n})
        except Exception as e:
            source_health.append({"name":label,"ok":False,"error":str(e)[:130]})
    # SEC EDGAR is separate from Canadian investment confirmations.
    for form in SEC_FORMS:
        url="https://www.sec.gov/cgi-bin/browse-edgar?"+urllib.parse.urlencode({
            "action":"getcurrent","type":form,"owner":"include","count":"40","output":"atom"})
        try:
            rows=parse_sec_filings(fetch(url),form)
            for f in rows:filings[f["id"]]=f
            source_health.append({"name":"SEC EDGAR "+form,"ok":True,"items":len(rows)})
        except Exception as e:
            source_health.append({"name":"SEC EDGAR "+form,"ok":False,"error":str(e)[:130]})
        time.sleep(.4)
    def recent(items,attr):
        return sorted(items,key=lambda x:(x.get(attr) or "",x["id"]),reverse=True)
    output={"schema":1,"updated":NOW.isoformat(),
            "policy":"All leads are unverified. No headline, RSS item or SEC filing becomes a BUY without original transaction verification. SEDAR+ is not scraped.",
            "leads":recent(leads.values(),"date")[:240],
            "usFilings":recent(filings.values(),"date")[:120],
            "sourceHealth":source_health,
            "status":{"sources":len(source_health),"available":sum(x["ok"] for x in source_health),
                      "leadCount":len(leads),"usFilingCount":len(filings),
                      "needsReview":len(leads)},
            "officialSources":[
                {"name":"SEDI — Canadian insider filings","url":"https://www.sedi.ca/","access":"manual / permitted access only"},
                {"name":"SEDAR+ — early warning and monthly reports","url":"https://www.sedarplus.ca/","access":"manual / permitted access only"},
                {"name":"SEC EDGAR — U.S. filings","url":"https://www.sec.gov/edgar/search/","access":"RSS, filer reports; not purchase-by-date"},
            ]}
    OUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Disclosure discovery:",output["status"])

if __name__=="__main__":
    refresh()
