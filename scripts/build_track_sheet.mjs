/*
 * Keep a dated copy of each market's top five Short Term rankings.
 * Uses the same browser scoring files as the main Radar; no second scoring model.
 */
import fs from "node:fs";
import vm from "node:vm";

const FILE = "data/track_sheet.json";
const MARKETS = ["Canada", "India"];
const engineFiles = [
  "engine/scoring.js", "engine/dataQuality.js", "engine/psychology.js",
  "engine/valuation.js", "engine/valuationV2.js", "engine/scoringV2.js",
  "engine/decisionEngine.js"
];
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of engineFiles) {
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file, timeout: 3000 });
}
if (typeof sandbox.getRadarDecision !== "function") {
  throw new Error("Radar short-term decision engine unavailable");
}

function marketDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day;
}
function numeric(x) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function stockForRadar(s) {
  const f = s.fundamentals || {};
  const v = s.valuation || {};
  const o = s.ownership || {};
  const d = s.dividend || {};
  const t = s.technical || {};
  const p = s.price && typeof s.price === "object" ? s.price : {};
  const price = numeric(s.currentPrice ?? (typeof s.price === "object" ? p.current : s.price) ?? t.currentPrice);
  return {
    ...s,
    name: s.name || s.shortName || s.longName || s.companyName || s.ticker || s.symbol,
    ticker: s.ticker || s.symbol || "",
    price, currentPrice: price,
    fundamentals: f,
    valuation: { ...v, peg: v.peg ?? (numeric(v.pe) > 0 && numeric(f.epsGrowth5Y) > 0 ? numeric(v.pe) / numeric(f.epsGrowth5Y) : null) },
    ownership: {
      ...o, insiderHolding: o.insiderHolding ?? o.insiderOwnership,
      institutionalHolding: o.institutionalHolding ?? o.institutionalOwnership,
      promoterHolding: o.promoterHolding ?? o.promoterOwnership,
      promoterPledge: o.promoterPledge ?? null,
      promoterChange: o.promoterChange ?? o.promoterTrend
    },
    dividend: { ...d, payout: d.payout ?? d.payoutRatio, growth: d.growth ?? d.dividendGrowth },
    technical: {
      ...t, momentum3M: t.momentum3M ?? t.momentum3m,
      momentum6M: t.momentum6M ?? t.momentum6m,
      momentum1Y: t.momentum1Y ?? t.momentum1y,
      sma50: t.sma50, sma200: t.sma200,
      high52Week: t.high52Week ?? t.high52w,
      low52Week: t.low52Week ?? t.low52w
    }
  };
}
function readJSON(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch (e) {
    if (fs.existsSync(path)) throw e;
    return fallback;
  }
}
const data = readJSON(FILE, { schema: 1, updatedAt: null, cohorts: [], quotes: {} });
if (!Array.isArray(data.cohorts) || typeof data.quotes !== "object" || !data.quotes) {
  throw new Error("Invalid existing tracking history; refusing to overwrite");
}
const day = process.env.TRACK_DATE || marketDay();
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad track date");
const weekend = [0, 6].includes(new Date(day + "T12:00:00Z").getUTCDay());
if (!weekend) {
  let cohort = data.cohorts.find(c => c.date === day);
  // A saved cohort is immutable. Re-running must never silently change its picks or baseline price.
  if (!cohort) {
    cohort = { date: day, markets: {} };
    for (const market of MARKETS) {
      const source = readJSON("data/" + market.toLowerCase() + "_radar.json", null);
      if (!source || !Array.isArray(source.stocks)) throw new Error("Missing " + market + " Radar data");
      const sourceUpdatedAt = source.lastUpdated || source.updatedAt || source.generated_at_utc;
      const stamp = Date.parse(sourceUpdatedAt || "");
      if (!Number.isFinite(stamp) || (Date.now() - stamp) > 72 * 3600000 || stamp > Date.now() + 3600000) {
        throw new Error("Refusing to snapshot stale or undated " + market + " rankings");
      }
      const ranked = source.stocks.map((raw, index) => {
        const s = stockForRadar(raw);
        const d = sandbox.getRadarDecision(s, "Short Term");
        return { s, d, index };
      }).filter(x => x.s.ticker && x.s.price !== null && x.s.price > 0 && Number.isFinite(Number(x.d?.score)))
        .sort((a, b) => b.d.score - a.d.score || a.index - b.index)
        .slice(0, 5);
      if (ranked.length !== 5) throw new Error("Expected five priced " + market + " stocks, got " + ranked.length);
      cohort.markets[market] = {
        sourceUpdatedAt,
        stocks: ranked.map((x, idx) => ({
          rank: idx + 1, ticker: x.s.ticker, name: x.s.name,
          score: x.d.score, verdict: x.d.verdict, priceZone: x.d.priceZone,
          currency: market === "India" ? "INR" : "CAD",
          recordedPrice: x.s.price,
          recordedAt: sourceUpdatedAt
        }))
      };
    }
    data.cohorts.push(cohort);
    data.cohorts.sort((a, b) => b.date.localeCompare(a.date));
    console.log("Saved original top five for Canada + India on " + day);
  } else {
    console.log("Preserving existing unmodified picks for " + day);
  }
} else {
  console.log("Weekend; no new recommendation cohort");
}
data.schema = 1;
data.updatedAt = new Date().toISOString();
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
