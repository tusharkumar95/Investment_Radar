import json,math
from pathlib import Path
from datetime import datetime,timezone
import yfinance as yf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data'
CANDIDATES={'Canada':['XIU.TO','XIC.TO','VCN.TO','ZCN.TO','VFV.TO','ZSP.TO','XQQ.TO','QQC.F.TO','XEF.TO','VIU.TO','XEC.TO','VEE.TO','XBB.TO','ZAG.TO','VAB.TO','XRE.TO','XEI.TO','VDY.TO','XDIV.TO','CDZ.TO','TEC.TO','HCLN.TO','HURA.TO','CEF.TO','ZLB.TO','ZLU.TO','XMV.TO','XUU.TO','XAW.TO','ZSP.U.TO'],'India':['NIFTYBEES.NS','JUNIORBEES.NS','BANKBEES.NS','ITBEES.NS','PHARMABEES.NS','CPSEETF.NS','GOLDBEES.NS','SILVERBEES.NS','MON100.NS','SETFNIF50.NS','ICICIB22.NS','HDFCNIFTY.NS','NIFTYIETF.NS','LOWVOL1.NS','MID150BEES.NS','MIDCAPETF.NS','ALPHA.NS','MOM100.NS','AUTOBEES.NS','CONSUMBEES.NS','FMCGIETF.NS','HEALTHIETF.NS','METALIETF.NS','PSUBNKBEES.NS','PVTBANIETF.NS','ITETF.NS','GILT5YBEES.NS','LIQUIDBEES.NS','MNC.NS']}
STATIC={
'NIFTY50':[('HDFCBANK','HDFC Bank Limited',9.85),('ICICIBANK','ICICI Bank Limited',9.45),('RELIANCE','Reliance Industries Limited',7.83),('BHARTIARTL','Bharti Airtel Limited',5.00),('LT','Larsen & Toubro Limited',4.30),('SBIN','State Bank of India',3.97),('INFY','Infosys Limited',3.61),('AXISBANK','Axis Bank Limited',3.39),('KOTAKBANK','Kotak Mahindra Bank Limited',2.80),('M&M','Mahindra & Mahindra Limited',2.66)],
'BANK':[('HDFCBANK','HDFC Bank Limited',17.02),('ICICIBANK','ICICI Bank Limited',14.85),('SBIN','State Bank of India',10.27),('KOTAKBANK','Kotak Mahindra Bank Limited',9.88),('AXISBANK','Axis Bank Limited',9.19),('FEDERALBNK','The Federal Bank Limited',7.15),('INDUSINDBK','IndusInd Bank Limited',5.44),('AUBANK','AU Small Finance Bank Limited',4.82),('IDFCFIRSTB','IDFC First Bank Limited',4.67),('BANKBARODA','Bank of Baroda Limited',3.47)],
'IT':[('INFY','Infosys Limited',28.86),('TCS','Tata Consultancy Services Limited',20.25),('HCLTECH','HCL Technologies Limited',11.44),('TECHM','Tech Mahindra Limited',10.52),('COFORGE','Coforge Limited',7.03),('PERSISTENT','Persistent Systems Limited',6.19),('WIPRO','Wipro Limited',5.08),('LTIM','LTIMindtree Limited',4.29),('MPHASIS','Mphasis Limited',3.27),('OFSS','Oracle Financial Services Software Limited',3.04)],
'PHARMA':[('SUNPHARMA','Sun Pharmaceutical Industries Limited',21.29),('DIVISLAB',"Divi's Laboratories Limited",10.34),('CIPLA','Cipla Limited',8.37),('TORNTPHARM','Torrent Pharmaceuticals Limited',7.59),('LAURUSLABS','Laurus Labs Limited',7.14),('DRREDDY',"Dr. Reddy's Laboratories Limited",7.07),('LUPIN','Lupin Limited',5.93),('AUROPHARMA','Aurobindo Pharma Limited',4.42),('ALKEM','Alkem Laboratories Limited',3.40),('GLENMARK','Glenmark Pharmaceuticals Limited',3.40)],
'AUTO':[('M&M','Mahindra & Mahindra Limited',23.57),('MARUTI','Maruti Suzuki India Limited',14.42),('BAJAJ-AUTO','Bajaj Auto Limited',9.91),('EICHERMOT','Eicher Motors Limited',8.38),('TVSMOTOR','TVS Motor Company Limited',7.87),('TMPV','Tata Motors Passenger Vehicles Limited',5.51),('HEROMOTOCO','Hero MotoCorp Limited',5.43),('MOTHERSON','Samvardhana Motherson International Limited',5.17),('BHARATFORG','Bharat Forge Limited',4.55),('ASHOKLEY','Ashok Leyland Limited',3.69)],
'CPSE':[('NTPC','NTPC Limited',20.05),('BEL','Bharat Electronics Limited',19.34),('POWERGRID','Power Grid Corporation of India Limited',18.76),('COALINDIA','Coal India Limited',14.46),('ONGC','Oil & Natural Gas Corporation Limited',13.73),('NHPC','NHPC Limited',4.32),('OIL','Oil India Limited',3.65),('COCHINSHIP','Cochin Shipyard Limited',1.76),('NLCINDIA','NLC India Limited',1.58),('NBCC','NBCC (India) Limited',1.43)]}
GROUPS={**{x:'NIFTY50' for x in ['NIFTYBEES.NS','SETFNIF50.NS','HDFCNIFTY.NS','NIFTYIETF.NS']},**{x:'BANK' for x in ['BANKBEES.NS']},**{x:'IT' for x in ['ITBEES.NS','ITETF.NS']},**{x:'PHARMA' for x in ['PHARMABEES.NS','HEALTHIETF.NS']},**{x:'AUTO' for x in ['AUTOBEES.NS']},**{x:'CPSE' for x in ['CPSEETF.NS']}}
def num(v):
 try:x=float(v);return x if math.isfinite(x) else None
 except:return None
def pct(v):
 x=num(v);return None if x is None else x*100 if abs(x)<=1 else x
def info(t):
 try:return yf.Ticker(t).info or {}
 except:return {}
def yahoo_holdings(t):
 try:
  f=yf.Ticker(t).funds_data
  for frame in (getattr(f,'top_holdings',None),getattr(f,'equity_holdings',None)):
   if frame is None or getattr(frame,'empty',True):continue
   out=[]
   for s,row in frame.iterrows():
    s=str(s).strip().upper();w=None
    for k in ('Holding Percent','holdingPercent','Weight','weight'):
     w=pct(row.get(k)) if hasattr(row,'get') else None
     if w is not None:break
    if s and s not in {'NAN','NONE'}:out.append({'symbol':s,'weight':w})
   if out:return out[:25]
 except Exception as e:print(f'Yahoo holdings unavailable for {t}: {e}')
 return []
def static_holdings(t):
 key=GROUPS.get(t)
 if not key:return []
 return [{'symbol':s+'.NS','ticker':name,'weight':w} for s,name,w in STATIC[key]]
def holdings(t):
 h=yahoo_holdings(t)
 return h if h else static_holdings(t)
def names():
 d={}
 for f in ('canada.json','india.json'):
  try:
   x=json.loads((OUT/f).read_text(encoding='utf-8'))
   for s in x.get('stocks',[]):
    if s.get('ticker') and s.get('name'):d[str(s['ticker']).upper()]=s['name']
  except:pass
 return d
def build(market):
 ns=names();rows=[]
 for t in CANDIDATES[market]:
  i=info(t);price=num(i.get('regularMarketPrice') or i.get('currentPrice'))
  if price is None:
   try:price=num(yf.Ticker(t).fast_info.get('last_price'))
   except:price=None
  if price is None:continue
  er=num(i.get('annualReportExpenseRatio'));er=er/100 if er is not None and er>1 else er
  hs=holdings(t)
  for h in hs:
   if not h.get('ticker'):h['ticker']=ns.get(h.get('symbol','').upper(),h.get('symbol'))
  rows.append({'ticker':t,'name':i.get('longName') or i.get('shortName') or t,'market':market,'category':i.get('category') or i.get('fundFamily') or 'ETF','currency':i.get('currency') or ('CAD' if market=='Canada' else 'INR'),'price':price,'aum':num(i.get('totalAssets')),'expenseRatio':er,'yield':pct(i.get('yield') or i.get('trailingAnnualDividendYield')),'threeYearReturn':pct(i.get('threeYearAverageReturn')),'fiveYearReturn':pct(i.get('fiveYearAverageReturn')),'beta3Y':num(i.get('beta3Year')),'inception':i.get('fundInceptionDate'),'issuer':i.get('fundFamily') or i.get('issuer') or '','holdings':hs})
  print(f'{market}: {t} -> {len(hs)} holdings')
 rows.sort(key=lambda x:(x.get('aum') or 0),reverse=True);return rows
def main():
 OUT.mkdir(exist_ok=True)
 for m,f in [('Canada','etf_canada.json'),('India','etf_india.json')]:
  r=build(m);(OUT/f).write_text(json.dumps({'market':m,'updatedAt':datetime.now(timezone.utc).isoformat(),'count':len(r),'etfs':r},indent=2,ensure_ascii=False),encoding='utf-8')
if __name__=='__main__':main()
