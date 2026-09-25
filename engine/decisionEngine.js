/*
 * INVESTMENT RADAR - DECISION ENGINE
 * Combines score, business quality, price, valuation zones and data confidence.
 */
(function () {
  function n(v){const x=Number(v);return Number.isFinite(x)?x:null;}
  function clamp(v){return Math.max(0,Math.min(100,n(v)??0));}
  function verdict(score){
    return score>=85?"STRONG BUY":score>=75?"BUY":score>=65?"ACCUMULATE":score>=50?"WATCH":score>=35?"WAIT":"AVOID";
  }
  function confidence(stock){
    try{
      const r=typeof window.getDataQualityReport==="function"?window.getDataQualityReport(stock):null;
      const score=n(r?.confidence?.score??r?.completeness)??0;
      return {score:clamp(score),label:r?.confidence?.label||(score>=75?"High":score>=55?"Moderate":"Low")};
    }catch(_){return {score:0,label:"Unknown"};}
  }
  function valuation(stock){
    try{return typeof window.calculateValuation==="function"?window.calculateValuation(stock):{};}catch(_){return {};}
  }
  function priceZone(stock,val){
    const p=n(stock.price??stock.currentPrice), fair=n(val.fairValue), low=n(val.fairValueLow), high=n(val.fairValueHigh), buy=n(val.buyPrice), strong=n(val.strongBuyPrice);
    if(p===null||fair===null||fair<=0)return "Unknown";
    if(strong!==null&&p<=strong)return "Exceptional";
    if(buy!==null&&p<=buy)return "Attractive";
    if(low!==null&&p<low)return "Below Fair Value";
    if(high!==null&&p<=high)return "Fair";
    if(high!==null&&p<=high*1.20)return "Expensive";
    return "Very Expensive";
  }
  function reason(stock,view,score,val,quality,price,zone,conf){
    const bits=[];
    if(view==="Long Term"){
      if(quality>=80)bits.push("high business quality");
      else if(quality>=65)bits.push("good business quality");
      else if(quality<50)bits.push("business-quality concerns");
      if(price>=80)bits.push("attractive valuation");
      else if(price<50)bits.push("a demanding valuation");
    }else{
      const t=stock.technical||{},m3=n(t.momentum3M),s50=n(t.sma50),p=n(stock.price);
      if(m3!==null)bits.push(m3>=5?"positive 3-month momentum":m3<0?"negative 3-month momentum":"flat 3-month momentum");
      if(p!==null&&s50!==null)bits.push(p>=s50?"price above its 50-day average":"price below its 50-day average");
    }
    if(zone!=="Unknown")bits.push(zone.toLowerCase()+" price zone");
    if(conf.score<55)bits.push("limited data confidence");
    const base=bits.length?bits.join(", "):"available fundamentals, valuation and market data";
    return "Based on "+base+".";
  }
  window.getRadarDecision=function(stock,view){
    const score=Math.round(clamp(view==="Short Term"&&typeof window.shortTermScore==="function"?window.shortTermScore(stock):typeof window.longTermScore==="function"?window.longTermScore(stock):50));
    const val=valuation(stock), conf=confidence(stock);
    const quality=Math.round(clamp(typeof window.radarQualityScore==="function"?window.radarQualityScore(stock):50));
    const price=Math.round(clamp(typeof window.radarPriceScore==="function"?window.radarPriceScore(stock):50));
    const zone=priceZone(stock,val);
    let action=verdict(score);
    /* Low-confidence data may support a watch decision, but not a high-conviction buy label. */
    if(conf.score<40 && (action==="STRONG BUY"||action==="BUY")) action="WATCH";
    return {score,verdict:action,qualityScore:quality,priceScore:price,priceZone:zone,confidence:conf,valuation:val,reason:reason(stock,view,score,val,quality,price,zone,conf)};
  };
})();