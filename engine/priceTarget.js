/* INVESTMENT RADAR - Six-month price target engine */
(function () {
    function n(v){const x=Number(v);return Number.isFinite(x)?x:null;}
    function round(v){return v===null?null:Math.round(v*100)/100;}
    function price(stock){return n(stock?.price?.current??stock?.price??stock?.currentPrice);}
    function target(stock){
        const p=price(stock),ta=typeof window.radarTechnicalAnalysis==='function'?window.radarTechnicalAnalysis(stock):null,v=stock?.analysis||(typeof window.calculateValuation==='function'?window.calculateValuation(stock):null)||{};
        if(p===null)return {available:false,reason:"Current price unavailable."};
        if(!ta?.available)return {available:false,reason:"Technical history is not available yet."};
        const fair=n(v.fairValue),atr=n(ta.atr),supports=ta.support||[],resistances=ta.resistance||[],nearestR=resistances.find(x=>x>p)??null,secondR=resistances.filter(x=>x>p)[1]??null,nearestS=supports.find(x=>x<p)??null;
        const technicalTarget=nearestR??(atr!==null?p+atr*4:null)??p*1.08;
        let base=fair!==null?fair*.60+technicalTarget*.40:technicalTarget;
        if(ta.outlook==="Bearish")base=Math.min(base,p+Math.max(atr||p*.04,p*.03)*2);
        const bear=nearestS!==null?nearestS:Math.max(p-(atr||p*.04)*2,p*.80),bull=secondR!==null?secondR:(fair!==null?Math.max(fair,technicalTarget)+(atr||p*.04)*1.5:p+(atr||p*.04)*6),baseTarget=Math.max(bear,Math.min(bull,base));
        const confidence=Math.min(90,(ta.historyDays>=200?40:25)+(ta.outlook!=="Neutral / mixed"?15:5)+(ta.volume.confirmation==="Strong"?10:0)+(ta.candle.confidence>=60?10:0)+(nearestR!==null?10:0)+(fair!==null?15:0));
        const invalidation=nearestS!==null?nearestS-(atr||p*.02)*.5:p-(atr||p*.04)*1.5;
        return {available:true,horizon:"6 months",currentPrice:round(p),technicalTarget:round(technicalTarget),baseTarget:round(baseTarget),bearTarget:round(Math.max(p*.65,bear)),bullTarget:round(Math.min(p*1.35,bull)),support:nearestS?round(nearestS):null,resistance:nearestR?round(nearestR):null,invalidation:round(invalidation),upside:round((baseTarget/p-1)*100),fairValue:fair?round(fair):null,fairValueUpside:fair?round((fair/p-1)*100):null,confidence,confidenceLabel:confidence>=75?"High":confidence>=55?"Moderate":"Low",outlook:ta.outlook,conditions:[nearestR?`A decisive move above ${round(nearestR)} would strengthen the bullish case.`:"A breakout above the recent range is needed for upside confirmation.",ta.volume.confirmation==="Strong"?"Breakout volume is supportive.":"Volume confirmation is not yet strong; treat upside cautiously.",`The forecast is invalidated by a sustained move below ${round(invalidation)}.`]};
    }
    window.radarPriceTarget=target;
})();
