/* INVESTMENT RADAR - Technical outlook + six-month target UI */
(function () {
    function money(v) { const n=Number(v); return Number.isFinite(n)?n.toFixed(2):"—"; }
    function pct(v) { const n=Number(v); return Number.isFinite(n)?`${n>=0?"+":""}${n.toFixed(1)}%`:"—"; }
    function add(stock) {
        const detail=document.getElementById("detailView");
        if(!detail||detail.style.display==="none"||!stock||detail.querySelector(".radar-technical-outlook")) return;
        const ta=typeof window.radarTechnicalAnalysis==='function'?window.radarTechnicalAnalysis(stock):null;
        const pt=typeof window.radarPriceTarget==='function'?window.radarPriceTarget(stock):null;
        if(!ta?.available) return;
        const s=(ta.support||[]).slice(0,2).map(money).join(" / ")||"—",r=(ta.resistance||[]).slice(0,2).map(money).join(" / ")||"—";
        const section=document.createElement("section"); section.className="detail-section radar-technical-outlook";
        section.innerHTML=`<div class="section-title">Technical Outlook & 6-Month Target</div><div class="metric-grid"><div class="metric"><span class="metric-label">Technical Outlook</span><span class="metric-value">${ta.outlook}</span></div><div class="metric"><span class="metric-label">Trend</span><span class="metric-value">${ta.trend||"—"}</span></div><div class="metric"><span class="metric-label">RSI (14)</span><span class="metric-value">${money(ta.rsi)}</span></div><div class="metric"><span class="metric-label">MACD</span><span class="metric-value">${ta.macdBias}</span></div><div class="metric"><span class="metric-label">Candlestick</span><span class="metric-value">${ta.candle?.name||"—"}</span></div><div class="metric"><span class="metric-label">Volume Confirmation</span><span class="metric-value">${ta.volume?.confirmation||"—"}</span></div><div class="metric"><span class="metric-label">Support Zones</span><span class="metric-value">${s}</span></div><div class="metric"><span class="metric-label">Resistance Zones</span><span class="metric-value">${r}</span></div>${pt?.available?`<div class="metric"><span class="metric-label">6-Month Base Target</span><span class="metric-value">${money(pt.baseTarget)} (${pct(pt.upside)})</span></div><div class="metric"><span class="metric-label">Bear Case</span><span class="metric-value">${money(pt.bearTarget)}</span></div><div class="metric"><span class="metric-label">Bull Case</span><span class="metric-value">${money(pt.bullTarget)}</span></div><div class="metric"><span class="metric-label">Target Confidence</span><span class="metric-value">${pt.confidence}% · ${pt.confidenceLabel}</span></div><div class="metric"><span class="metric-label">Technical Target</span><span class="metric-value">${money(pt.technicalTarget)}</span></div><div class="metric"><span class="metric-label">Invalidation</span><span class="metric-value">${money(pt.invalidation)}</span></div>`:""}</div><p class="investment-thesis" style="margin-top:14px;"><strong>How to read it:</strong> ${pt?.available?`The base target blends fundamental fair value with chart structure. It is a model estimate, not a guarantee. ${pt.conditions.join(" ")}`:"Technical history is available, but the target model needs more data."}</p>`;
        const breakdown=detail.querySelector(".radar-score-breakdown"); if(breakdown) breakdown.after(section); else detail.appendChild(section);
    }
    window.refreshRadarTechnicalDetail=add;
    const wrap=window.openInvestmentByTicker;
    if(typeof wrap==='function') window.openInvestmentByTicker=function(ticker){wrap(ticker);const stock=(marketData[currentMarket]?.stocks||[]).find(x=>x.ticker===ticker);setTimeout(()=>add(stock),150);};
})();
