/* INVESTMENT RADAR - Technical Analysis Engine */
(function () {
    function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
    function avg(a) { const v = a.filter(x => n(x) !== null).map(Number); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : null; }
    function history(stock) {
        const h = stock?.technical?.history || stock?.history || [];
        return Array.isArray(h) ? h.map(x => ({ date:x.date, open:n(x.open), high:n(x.high), low:n(x.low), close:n(x.close), volume:n(x.volume) })).filter(x => x.close !== null) : [];
    }
    function sma(vals,len) { return vals.length >= len ? avg(vals.slice(-len)) : null; }
    function ema(vals,len) { if(vals.length<len)return null; const k=2/(len+1); let e=avg(vals.slice(0,len)); for(let i=len;i<vals.length;i++)e=vals[i]*k+e*(1-k); return e; }
    function rsi(closes,len=14) { if(closes.length<len+1)return null; let g=0,l=0; for(let i=closes.length-len;i<closes.length;i++){const d=closes[i]-closes[i-1];if(d>=0)g+=d;else l-=d;} if(l===0)return 100; return 100-(100/(1+(g/len)/(l/len))); }
    function atr(rows,len=14) { if(rows.length<len+1)return null; const tr=[]; for(let i=1;i<rows.length;i++){const r=rows[i],p=rows[i-1];if(r.high===null||r.low===null||p.close===null)continue;tr.push(Math.max(r.high-r.low,Math.abs(r.high-p.close),Math.abs(r.low-p.close)));} return tr.length>=len?avg(tr.slice(-len)):null; }
    function macd(closes) { if(closes.length<35)return {macd:null,signal:null,histogram:null}; const s=[]; for(let i=25;i<closes.length;i++){const x=closes.slice(0,i+1),a=ema(x,12),b=ema(x,26);if(a!==null&&b!==null)s.push(a-b);} const m=s.at(-1)??null,signal=s.length>=9?ema(s,9):null;return {macd:m,signal,histogram:m!==null&&signal!==null?m-signal:null}; }
    function candlePattern(rows) {
        if(rows.length<2)return {name:"Insufficient data",bias:"Neutral",confidence:0}; const a=rows.at(-1),b=rows.at(-2); if([a.open,a.high,a.low,a.close,b.open,b.close].some(x=>x===null))return {name:"Insufficient OHLC data",bias:"Neutral",confidence:0}; const body=Math.abs(a.close-a.open),range=Math.max(a.high-a.low,.000001),upper=a.high-Math.max(a.open,a.close),lower=Math.min(a.open,a.close)-a.low,bBody=Math.abs(b.close-b.open);
        if(a.close>a.open&&b.close<b.open&&a.open<=b.close&&a.close>=b.open&&body>=bBody*.9)return {name:"Bullish Engulfing",bias:"Bullish",confidence:72};
        if(a.close<a.open&&b.close>b.open&&a.open>=b.close&&a.close<=b.open&&body>=bBody*.9)return {name:"Bearish Engulfing",bias:"Bearish",confidence:72};
        if(body<=range*.18&&lower>=body*2.5&&upper<=Math.max(body*1.2,range*.15))return {name:a.close>=a.open?"Hammer / Pin Bar":"Hanging Man",bias:a.close>=a.open?"Bullish":"Bearish",confidence:62};
        if(body<=range*.18&&upper>=body*2.5&&lower<=Math.max(body*1.2,range*.15))return {name:"Shooting Star / Rejection",bias:"Bearish",confidence:62};
        if(body<=range*.1)return {name:"Doji",bias:"Neutral",confidence:45};
        if(body>=range*.75)return {name:a.close>a.open?"Bullish Marubozu":"Bearish Marubozu",bias:a.close>a.open?"Bullish":"Bearish",confidence:58};
        return {name:"No major candlestick signal",bias:"Neutral",confidence:35};
    }
    function levels(rows,current) {
        const piv=[]; for(let i=2;i<rows.length-2;i++){const r=rows[i];if(r.high!==null&&r.high>=rows[i-1].high&&r.high>=rows[i-2].high&&r.high>=rows[i+1].high&&r.high>=rows[i+2].high)piv.push(r.high);if(r.low!==null&&r.low<=rows[i-1].low&&r.low<=rows[i-2].low&&r.low<=rows[i+1].low&&r.low<=rows[i+2].low)piv.push(r.low);} const below=piv.filter(x=>x<current).sort((a,b)=>b-a),above=piv.filter(x=>x>current).sort((a,b)=>a-b),range=rows.slice(-252),hi=Math.max(...range.map(x=>x.high??-Infinity)),lo=Math.min(...range.map(x=>x.low??Infinity));if(Number.isFinite(lo))below.push(lo);if(Number.isFinite(hi))above.push(hi);const cluster=list=>{const out=[];for(const x of list){if(!out.some(y=>Math.abs(y-x)/x<.015))out.push(x);if(out.length>=3)break;}return out;};return {support:cluster(below),resistance:cluster(above)};
    }
    function analyze(stock) {
        const rows=history(stock),closes=rows.map(x=>x.close),current=n(stock?.price?.current??stock?.price??stock?.currentPrice??closes.at(-1)); if(!rows.length||current===null)return {available:false,reason:"Historical OHLC data is not available yet."};
        const sma20=sma(closes,20),sma50=sma(closes,50),sma200=sma(closes,200),r=rsi(closes),a=atr(rows),m=macd(closes),lv=levels(rows,current),candle=candlePattern(rows),vr=rows.filter(x=>x.volume!==null),vol=vr.at(-1)?.volume??null,avgVol=vr.length>=20?avg(vr.slice(-20).map(x=>x.volume)):null,volumeConfirmation=vol!==null&&avgVol!==null?(vol>=avgVol*1.25?"Strong":vol>=avgVol*.9?"Normal":"Weak"):"Unknown";
        const trend=current>sma50&&(sma200===null||sma50>sma200)?"Bullish trend":current<sma50&&sma200!==null&&sma50<sma200?"Bearish trend":"Mixed / consolidation",momentum=r===null?"Unknown":r>=70?"Overbought":r<=30?"Oversold":r>=55?"Bullish":r<=45?"Bearish":"Neutral",macdBias=m.histogram===null?"Unknown":m.histogram>0?"Bullish":"Bearish";
        const total=[trend==="Bullish trend"?2:trend==="Bearish trend"?-2:0,momentum==="Bullish"?1:momentum==="Bearish"||momentum==="Overbought"?-1:0,macdBias==="Bullish"?1:macdBias==="Bearish"?-1:0,candle.bias==="Bullish"?1:candle.bias==="Bearish"?-1:0,volumeConfirmation==="Strong"?.5:0].reduce((a,b)=>a+b,0),outlook=total>=2?"Bullish":total<=-2?"Bearish":"Neutral / mixed";
        return {available:true,current,sma20,sma50,sma200,rsi:r,atr:a,macd:m,trend,outlook,momentum,macdBias,candle,volume:{current:vol,average20:avgVol,confirmation:volumeConfirmation},support:lv.support,resistance:lv.resistance,historyDays:rows.length,score:total};
    }
    window.radarTechnicalAnalysis=analyze;
})();
