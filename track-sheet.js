/* Track Sheet: recommendation cohorts are immutable and shared across devices via GitHub. */
(function () {
  "use strict";
  const DAYS = [5, 10, 15, 30];
  const marketButtons = [...document.querySelectorAll("[data-market]")];
  const tabs = document.getElementById("dateTabs");
  const picker = document.getElementById("datePicker");
  const results = document.getElementById("results");
  const detail = document.getElementById("detail");
  let history = null;
  let market = "Canada";
  let date = "";
  let activeTicker = "";

  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function dayPlus(day, n) {
    const d = new Date(day + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function todayToronto() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return obj.year + "-" + obj.month + "-" + obj.day;
  }
  function formatDay(iso, short) {
    if (!iso) return "—";
    const d = new Date(iso + "T12:00:00Z");
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString("en-CA", {
      timeZone: "UTC", month: "short", day: "numeric",
      ...(short ? {} : { year: "numeric" })
    });
  }
  function money(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const symbol = market === "India" ? "₹" : "$";
    return symbol + n.toLocaleString(market === "India" ? "en-IN" : "en-CA", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function change(value, baseline) {
    if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(baseline)) || Number(baseline) <= 0) return null;
    return (Number(value) / Number(baseline) - 1) * 100;
  }
  function move(pct) {
    if (pct === null) return '<span class="flat">—</span>';
    const klass = pct > 0.005 ? "up" : pct < -0.005 ? "down" : "flat";
    return '<span class="' + klass + '">' + (pct > 0 ? "+" : "") + pct.toFixed(2) + "%</span>";
  }
  function priceSeries(stock, cohortDate) {
    const observations = history?.quotes?.[market + ":" + stock.ticker] || {};
    return Object.entries(observations)
      .filter(([d, p]) => d >= cohortDate && d <= todayToronto() &&
        d <= dayPlus(cohortDate, 40) && Number.isFinite(Number(p)) && Number(p) > 0)
      .map(([day, p]) => ({ day, price: Number(p) }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }
  function milestone(series, start, days) {
    const target = dayPlus(start, days);
    if (todayToronto() < target) return null;
    return series.find(x => x.day >= target && x.day <= dayPlus(target, 7)) || null;
  }
  function currentCohort() {
    return history?.cohorts?.find(c => c.date === date);
  }
  function setDate(next) {
    if (!history?.cohorts?.some(c => c.date === next)) return;
    date = next;
    activeTicker = "";
    render();
  }
  function setMarket(next) {
    if (next !== "Canada" && next !== "India") return;
    market = next;
    marketButtons.forEach(b => b.classList.toggle("active", b.dataset.market === market));
    activeTicker = "";
    render();
  }
  function checkpointCell(point, baseline) {
    if (!point) return '<span class="pick">Pending</span>';
    return '<strong>' + money(point.price) + '</strong><br>' + move(change(point.price, baseline)) +
      '<br><span class="muted">' + formatDay(point.day, true) + '</span>';
  }
  function render() {
    const dates = (history?.cohorts || []).map(c => c.date);
    if (!dates.length) {
      picker.innerHTML = '<option>No snapshots yet</option>';
      tabs.textContent = "";
      document.getElementById("snapshotTitle").textContent = "Waiting for first snapshot";
      document.getElementById("sourceTime").textContent = "";
      results.innerHTML = '<div class="loading">Track Sheet will begin with the next successful scheduled data capture. Dates will appear here and remain saved as the rankings change.</div>';
      detail.classList.remove("visible");
      return;
    }
    if (!dates.includes(date)) date = dates[0];
    picker.innerHTML = dates.map(d =>
      '<option value="' + esc(d) + '"' + (d === date ? " selected" : "") + '>' + formatDay(d) + '</option>'
    ).join("");
    tabs.innerHTML = dates.slice(0, 14).map(d =>
      '<button type="button" data-date="' + esc(d) + '" class="date-tab' +
      (d === date ? " active" : "") + '">' + formatDay(d, true) + '</button>'
    ).join("");
    const cohort = currentCohort();
    const group = cohort?.markets?.[market];
    document.getElementById("snapshotTitle").textContent = market + " · " + formatDay(date);
    const sourceTime = document.getElementById("sourceTime");
    const source = group?.sourceUpdatedAt && new Date(group.sourceUpdatedAt);
    sourceTime.textContent = source && !Number.isNaN(source.getTime())
      ? "Source refreshed " + source.toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET"
      : "Refresh time unavailable";
    if (!group || !Array.isArray(group.stocks)) {
      results.textContent = "This market's dated rankings are unavailable.";
      detail.classList.remove("visible");
      return;
    }
    const head = '<thead><tr><th>Original rank / stock</th><th>Radar score</th><th>Recorded price</th>' +
      DAYS.map(n => '<th>D+' + n + '</th>').join("") + '<th>Last tracked close</th></tr></thead>';
    const rows = group.stocks.map(s => {
      const series = priceSeries(s, date);
      const last = series.at(-1);
      const baseline = Number(s.recordedPrice);
      const checkpoints = DAYS.map(n => '<td>' + checkpointCell(milestone(series, date, n), baseline) + '</td>').join("");
      return '<tr><td><button class="row-button" type="button" data-ticker="' + esc(s.ticker) +
        '"><span class="ticker">#' + s.rank + ' ' + esc(s.ticker) + ' ↗</span>' +
        '<span class="stockname">' + esc(s.name) + '</span></button></td>' +
        '<td><strong>' + esc(s.score) + '/100</strong><br><span class="tag">' + esc(s.verdict) + '</span></td>' +
        '<td><strong>' + money(baseline) + '</strong></td>' + checkpoints +
        '<td>' + (last ? checkpointCell(last, baseline) : '<span class="pick">Pending</span>') + '</td></tr>';
    }).join("");
    results.className = "";
    results.innerHTML = '<div class="table-wrap"><table>' + head + '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="grid-note">Scroll the table sideways on your phone. Tap any stock to view every available daily closing price.</p>';
    if (activeTicker) renderDetail();
    else detail.classList.remove("visible");
  }
  function lineChart(series, recordedPrice, startDay, ticker) {
    const values = [{ day: startDay, price: recordedPrice }, ...series];
    if (values.length < 2) return '<p class="muted">Daily closing-price history will appear as observations arrive.</p>';
    const prices = values.map(x => x.price);
    let min = Math.min(...prices), max = Math.max(...prices);
    if (max <= min) { min *= .99; max *= 1.01; }
    const padX = 20, padY = 20, w = 620, h = 176;
    const x = i => padX + i * (w - 2 * padX) / Math.max(1, values.length - 1);
    const y = p => padY + (max - p) / (max - min) * (h - 2 * padY);
    const points = values.map((v, i) => x(i).toFixed(1) + "," + y(v.price).toFixed(1)).join(" ");
    const stroke = values.at(-1).price >= recordedPrice ? "#178256" : "#ba5151";
    return '<svg viewBox="0 0 620 176" role="img" aria-label="' + esc(ticker) + ' price change from reference price through available trading closes">' +
      '<line x1="20" y1="156" x2="600" y2="156" stroke="#e2e6ea"/>' +
      '<line x1="20" y1="20" x2="600" y2="20" stroke="#edf0f2"/>' +
      '<polyline fill="none" stroke="' + stroke + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="' + points + '"/>' +
      '<circle cx="' + x(0) + '" cy="' + y(recordedPrice) + '" r="5" fill="#17202a"/>' +
      '<circle cx="' + x(values.length - 1) + '" cy="' + y(values.at(-1).price) + '" r="5" fill="' + stroke + '"/>' +
      '</svg><div class="muted">' + formatDay(startDay) + ' reference · through ' + formatDay(values.at(-1).day) + '</div>';
  }
  function renderDetail() {
    const group = currentCohort()?.markets?.[market];
    const stock = group?.stocks?.find(s => s.ticker === activeTicker);
    if (!stock) { detail.classList.remove("visible"); return; }
    const baseline = Number(stock.recordedPrice);
    const series = priceSeries(stock, date);
    const last = series.at(-1);
    const gain = last ? change(last.price, baseline) : null;
    const rows = series.map(x =>
      '<tr><td>' + formatDay(x.day) + '</td><td>' + money(x.price) + '</td><td>' +
      move(change(x.price, baseline)) + '</td></tr>'
    ).join("");
    detail.innerHTML = '<div class="detail-head"><div><span class="eyebrow">Daily price history</span><h2>' +
      esc(stock.ticker) + ' · ' + esc(stock.name) + '</h2></div><button type="button" class="close" id="closeDetail">Close ✕</button></div>' +
      '<div class="summary">' +
      '<div class="metric"><small>Recommendation day</small><b>' + formatDay(date) + '</b></div>' +
      '<div class="metric"><small>Recorded Radar price</small><b>' + money(baseline) + '</b></div>' +
      '<div class="metric"><small>Latest available close</small><b>' + (last ? money(last.price) : "—") + '</b></div>' +
      '<div class="metric"><small>Price change</small><b>' + move(gain) + '</b></div></div>' +
      '<div class="chart">' + lineChart(series, baseline, date, stock.ticker) + '</div>' +
      '<h2>Trading-day closes</h2>' +
      '<div class="daily"><table><thead><tr><th>Session</th><th>Close</th><th>vs. recorded</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3">No confirmed closing-price observations yet.</td></tr>') +
      '</tbody></table></div>' +
      '<p class="grid-note">Price change uses the original recorded quote as its baseline. Daily observations are raw closes and may be affected by corporate actions.</p>';
    detail.classList.add("visible");
    document.getElementById("closeDetail").addEventListener("click", () => {
      activeTicker = ""; detail.classList.remove("visible");
    });
  }
  picker.addEventListener("change", e => setDate(e.target.value));
  tabs.addEventListener("click", e => {
    const button = e.target.closest("[data-date]");
    if (button) setDate(button.dataset.date);
  });
  results.addEventListener("click", e => {
    const button = e.target.closest("[data-ticker]");
    if (!button) return;
    activeTicker = button.dataset.ticker;
    renderDetail();
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  marketButtons.forEach(button => button.addEventListener("click", () => setMarket(button.dataset.market)));

  fetch("data/track_sheet.json?ts=" + Date.now(), { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("No history yet"); return r.json(); })
    .then(d => {
      if (!Array.isArray(d.cohorts) || typeof d.quotes !== "object") throw new Error("Invalid tracking file");
      history = d;
      history.cohorts.sort((a, b) => b.date.localeCompare(a.date));
      const count = history.cohorts.length;
      const failures = Array.isArray(history.quoteFailures) ? history.quoteFailures.length : 0;
      document.getElementById("status").textContent =
        count + " archived date" + (count === 1 ? "" : "s") +
        " · " + (failures ? failures + " symbols missing a recent quote" : "Price updates recorded when available");
      render();
    })
    .catch(error => {
      console.warn("Track Sheet unavailable", error);
      document.getElementById("status").textContent = "Awaiting first tracking update";
      history = { cohorts: [], quotes: {} };
      render();
    });
})();
