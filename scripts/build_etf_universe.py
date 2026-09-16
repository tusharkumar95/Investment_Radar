import json
import math
from io import StringIO
from pathlib import Path
from datetime import datetime, timezone
import requests
import pandas as pd
import yfinance as yf
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"data"
CANDIDATES={"Canada":["XIU.TO","XIC.TO","VCN.TO","ZCN.TO","VFV.TO","ZSP.TO","XQQ.TO","QQC.F.TO","XEF.TO","VIU.TO","XEC.TO","VEE.TO","XBB.TO","ZAG.TO","VAB.TO","XRE.TO","XEI.TO","VDY.TO","XDIV.TO","CDZ.TO","TEC.TO","HCLN.TO","HURA.TO","CEF.TO","ZLB.TO","ZLU.TO","XMV.TO","XUU.TO","XAW.TO","ZSP.U.TO"],"India":["NIFTYBEES.NS","JUNIORBEES.NS","BANKBEES.NS","ITBEES.NS","PHARMABEES.NS","CPSEETF.NS","GOLDBEES.NS","SILVERBEES.NS","MON100.NS","SETFNIF50.NS","ICICIB22.NS","HDFCNIFTY.NS","NIFTYIETF.NS","LOWVOL1.NS","MID150BEES.NS","MIDCAPETF.NS","ALPHA.NS","MOM100.NS","AUTOBEES.NS","CONSUMBEES.NS","FMCGIETF.NS","HEALTHIETF.NS","METALIETF.NS","PSUBNKBEES.NS","PVTBANIETF.NS","ITETF.NS","GILT5YBEES.NS","LIQUIDBEES.NS","MNC.NS"]}
def num(v):
 try:
  x=float(v); return x if math.isfinite(x) else None
 except: return None
def pct(v):
 x=num(v); return None if x is None else x*100 if abs(x)<=1 else x
def safe_info(t):
 try:return yf.Ticker(t).info or {}
 except:return {}
def yahoo_holdings(t):
 try:
  fund=yf.Ticker(t).funds_data
  for frame in (getattr(fund,"top_holdings",None),getattr(fund,"equity_holdings",None)):
   if frame is None or getattr(frame,"empty",True):continue
   out=[]
   for symbol,row in frame.iterrows():
    symbol=str(symbol).strip().upper()
    if not symbol or symbol in {"NAN","NONE"}:continue
    weight=None
    for key in ("Holding Percent","holdingPercent","Weight","weight"):
     weight=pct(row.get(key)) if hasattr(row,"get") else None
     if weight is not None:break
    out.append({"symbol":symbol,"weight":weight})
   if out:return out[:25]
 except Exception as e:print(f"Yahoo holdings unavailable for {t}: {e}")
 return []
def web_holdings(t):
 if not t.endswith(".NS"):return []
 code=t[:-3]; url=f"https://stockanalysis.com/quote/nse/{code}/holdings/"
 try:
  r=requests.get(url,headers={"User-Agent":"Mozilla/5.0 InvestmentRadar/1.0"},timeout=20); r.raise_for_status()
  for df in pd.read_html(StringIO(r.text)):
   cols={str(c).lower():c for c in df.columns}; sc=next((c for k,c in cols.items() if "symbol" in k),None); wc=next((c for k,c in cols.items() if "weight" in k or "%" in k),None)
   if sc is None or wc is None:continue
   out=[]
   for _,row in df.iterrows():
    s=str(row.get(sc) or "").strip().upper().replace("NSE:","")
    if not s or s in {"N/A","NAN","NONE"} or "REPO" in s or "CASH" in s:continue
    w=pct(row.get(wc))
    if w is not None:out.append({"symbol":s+".NS","weight":w})
   if out:print(f"Web holdings: {t} -> {len(out)} holdings");return out[:25]
 except Exception as e:print(f"Web holdings unavailable for {t}: {e}")
 return []
def holdings(t):
 h=yahoo_holdings(t); return h if h else web_holdings(t)
def load_company_names():
 names={}
 for f in ("canada.json","india.json"):
  try:
   d=json.loads((OUT/f).read_text(encoding="utf-8"))
   for s in d.get("stocks",[]):
    t=str(s.get("ticker") or "").upper()
    if t and s.get("name"):names[t]=s["name"]
  except:pass
 return names
def holding_name(symbol,names):
 s=str(symbol or "").upper().strip(); c=[s]
 if s.startswith("NSE:"):c.append(s[4:]+".NS")
 if ":" in s:c.append(s.split(":",1)[0]+".TO")
 if not s.endswith((".NS",".TO")):c += [s+".NS",s+".TO"]
 for x in c:
  if x in names:return names[x]
 return s
def enrich(items,names):return [{"ticker":holding_name(x.get("symbol"),names),"symbol":x.get("symbol"),"weight":x.get("weight")} for x in items]
def build_market(market):
 rows=[]; names=load_company_names()
 for t in CANDIDATES[market]:
  info=safe_info(t); price=num(info.get("regularMarketPrice") or info.get("currentPrice"))
  if price is None:
   try:price=num(yf.Ticker(t).fast_info.get("last_price"))
   except:price=None
  if price is None:continue
  expense=num(info.get("annualReportExpenseRatio")); expense=expense/100 if expense is not None and expense>1 else expense
  h=holdings(t)
  rows.append({"ticker":t,"name":info.get("longName") or info.get("shortName") or t,"market":market,"category":info.get("category") or info.get("fundFamily") or "ETF","currency":info.get("currency") or ("CAD" if market=="Canada" else "INR"),"price":price,"aum":num(info.get("totalAssets")),"expenseRatio":expense,"yield":pct(info.get("yield") or info.get("trailingAnnualDividendYield")),"threeYearReturn":pct(info.get("threeYearAverageReturn")),"fiveYearReturn":pct(info.get("fiveYearAverageReturn")),"beta3Y":num(info.get("beta3Year")),"inception":info.get("fundInceptionDate"),"issuer":info.get("fundFamily") or info.get("issuer") or "","holdings":enrich(h,names)})
  print(f"{market}: {t} -> OK ({len(h)} holdings)")
 rows.sort(key=lambda x:(x.get("aum") or 0),reverse=True);return rows
def main():
 OUT.mkdir(exist_ok=True)
 for market,file in (("Canada","etf_canada.json"),("India","etf_india.json")):
  rows=build_market(market);(OUT/file).write_text(json.dumps({"market":market,"updatedAt":datetime.now(timezone.utc).isoformat(),"count":len(rows),"etfs":rows},indent=2,ensure_ascii=False),encoding="utf-8");print(f"Saved {file}: {len(rows)} ETFs")
if __name__=="__main__":main()
