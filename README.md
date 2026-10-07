# Investment Radar

Personal Canada + India investment research dashboard built for a mobile-first GitHub Pages workflow.

## Stable release

**Version 1.0.1 — October 2026 maintenance baseline**

### Included
- Canada and India Stock Radar
- Long-Term and Short-Term scoring views
- Quality, valuation, growth, market, ownership and confidence-aware decision engine
- Fair-value ranges, attractive-entry zones and margin-of-safety context
- Watchlist with view-aware change signals and near-entry monitoring
- Up-to-3-stock comparison
- Market-aware Portfolio analysis with CAD and INR kept separate
- ETF Radar with ETF-to-ETF holdings overlap, sector duplication and saved-portfolio overlap analysis
- Small Cap / Sky Rocket research screen with 10 Canada + 10 India operating-company selections
- Custom Analysis with saved-Radar fallback and explicit data coverage
- Home attention dashboard
- Dataset freshness/staleness indicators
- Mobile/PWA-oriented interface

## Data integrity rules
- CAD and INR portfolio values are never added together without FX conversion.
- Missing fundamental fields remain missing rather than being invented.
- Low data confidence can restrict investment verdicts.
- Stale datasets are visibly identified rather than silently treated as current.
- ETF ratings describe model fit/suitability rather than pretending to be fair-value buy signals.
- ETF overlap is reported from available holdings/sector coverage and can be a lower-bound estimate when coverage is incomplete.
- Small-cap candidates are research screens, not predictions.

## Production architecture
The frontend is static and hosted with GitHub Pages. Generated datasets are committed by GitHub Actions.

The active data-writing workflows are:
- `update-data.yml` — Canada + India prices, fundamentals, valuation, technical history and lightweight Radar payloads
- `update-etfs.yml` — ETF universe, holdings and sector exposure
- `update-smallcap.yml` — synchronized Small Cap v3 dataset
- `custom-stock.yml` — on-demand Custom Analysis data

All workflows that write generated data to `main` share one concurrency queue (`investment-radar-data-*`). This prevents the push collision that previously allowed simultaneous data jobs to fail at the final commit step.

The upstream `Investment_Universe` repository supplies the diversified Canada/India stock universe and Small Cap universe. Investment Radar no longer builds its own production stock universe locally.

## V1 cleanup completed
The stable v1 maintenance pass removed the old one-time frontend patcher, data-payload repair workflow, technical-layer repair workflow and superseded local universe builder. The main market-data workflow now runs the permanent source code directly instead of rewriting `update_market_data.py` during every refresh.

The base/V2 scoring and valuation file pairs remain intentionally. The base scoring layer provides component functions used by the V2 decision layer; the V2 valuation layer intentionally replaces the final valuation entry point. They are active dependencies, not obsolete duplicates.

## Release validation
`Investment Radar Release Check` validates the v1 baseline after relevant changes. It checks:
- mobile/PWA safeguards on all five user-facing pages
- Canada/India and Long/Short-Term wiring
- Watchlist, Compare and Portfolio integration
- Small Cap 10+10 operating-company rules
- ETF holdings and sector coverage requirements
- Custom Analysis fallbacks
- current Radar datasets
- production workflow presence and shared write-queue configuration
- absence of obsolete v1 repair/migration files
- JavaScript syntax

## Known limitations
- Free market-data sources can be delayed, incomplete or temporarily unavailable.
- Custom Analysis cannot guarantee full fundamentals for arbitrary tickers from a browser-only GitHub Pages app.
- ETF holdings and sector coverage vary by fund and can understate true overlap when source coverage is incomplete.
- Scores, fair-value ranges, targets and classifications are model outputs for research. They are not guarantees or personalized financial advice.

## Release discipline
Version 1.0.1 is the stable v1 maintenance baseline. New product features should be treated as v2 work and should preserve the v1 data-integrity and release-check rules above.
