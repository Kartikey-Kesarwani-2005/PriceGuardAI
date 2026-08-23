# PriceGuard AI

**Know the Price. Know the Moment.**

PriceGuard is a price-intelligence platform that watches 160+ products across Amazon, Flipkart and Croma — scraping through **Bright Data Scraper Studio** and managed pipelines, validating every extraction, and **auto-repairing broken scrapers** with Studio's AI heal API. Every number in the UI carries its own verification time: you always know whether a price is live, recovered, or the last known good value.

---

## The Problem

The same product sells at three different prices across three stores — and those prices move daily. Manually checking is hopeless; naive scrapers break every time a site changes its markup; and most trackers show numbers without telling you how fresh or trustworthy they are.

PriceGuard answers three questions for any product:

1. **What is the price right now — and can I trust it?**
2. **Is this a good moment to buy?** (Deal Score + Buy/Wait verdict)
3. **When should I be alerted?** (target prices, drop detection)

## Features

### Tracking engine

- **Multi-store tracking** — Amazon, Flipkart, Croma with per-store routing
- **Self-healing scrapers** — failed validations trigger Scraper Studio's `scraper heal`; Bright Data's AI rewrites broken selectors against the same collector ID
- **Stale-safe fallback** — if everything fails, last known good data is served explicitly flagged `stale` instead of wrong data
- **Credential slot chain** — CLI stored login first, then a pool of API keys; exhausted keys rotate mid-scrape, deactivated accounts are detected (`Customer is not active`) and skipped permanently
- **Per-account collector registries** — each key's account keeps its own collectors (`data/collectors-kN.json`); stale cross-account IDs are auto-removed and retried on the next account
- **Real health metrics** — attempts, successes, failures, heals and success rates tracked per product in `data/cache.json`. Nothing hardcoded.
- **Target price alerts & stock monitoring**, price history with 7d/30d/90d/1y views

### Intelligence layer (client-side, deterministic)

- **Deal Score (0–100)** — explainable score from five transparent buckets: target fit (35), vs typical price (30), MRP discount (20), availability (10), freshness (5). Rendered as an animated radial ring.
- **Buy / Wait verdicts** — Buy now · Good deal · Wait, each with a data-backed reason ("23% below 30-day average")
- **Best Opportunity card** — the single strongest deal of the day, dominant on the dashboard, with drop-vs-average and a direct buy link
- **Buy at store CTAs** — live-tracked products deep-link to the verified listing; others open a store search for the exact model

### Experience layer — "The Ledger" design system

- Editorial serif hero (Fraunces) with tabular-numeral pricing (IBM Plex Mono) on warm paper tones with deep-pine accents
- **Trust labels everywhere** — "Verified 42 sec ago", "Last verified 2h ago", "Recovered automatically"
- **Meaningful loading states** — rotating human phrases ("Comparing stores…", "Verifying price data…") instead of skeletons
- **Store ledger** — typographic store comparison ranked by average discount
- **PRICE MONITOR strip** — live per-store health: Healthy / Recovered automatically / Attention
- **Clickable stat cards**, keyboard-accessible, each jumping to the page behind its number
- Fully responsive (audited at 1280–1536px laptop and 390/768px mobile widths), WCAG-AA contrast tokens, focus-visible rings, reduced-motion support

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              Frontend (vanilla JS)          │
                        │  Dashboard · Products · Compare · Alerts    │
                        │  Watchlist · Insights · Details · Settings  │
                        │  + Intel scoring · PGWatch · PGAlerts       │
                        └──────────────────┬──────────────────────────┘
                                           │ /api/*
                        ┌──────────────────▼──────────────────────────┐
                        │            Express server (server.js)       │
                        │  routes/products.js                         │
                        │  mode · refresh · settings · health         │
                        └──────────────────┬──────────────────────────┘
                                           │
              ┌────────────────────────────▼───────────────────────────┐
              │                    lib/healer.js                       │
              │   run → validate → retry → HEAL → re-run → stale-safe  │
              └───────────────┬───────────────────────┬────────────────┘
                              │                       │
        ┌─────────────────────▼───────┐   ┌───────────▼──────────────────┐
        │      lib/scraperEngine.js   │   │   data/cache.json (v2)       │
        │  credential slots chain     │   │  products · stats · settings │
        │  store routing + validation │   │  + price history snapshots   │
        └──────┬──────────┬───────────┘   └──────────────────────────────┘
               │          │
     ┌─────────▼──┐ ┌─────▼─────┐ ┌──────────────┐
     │  Amazon    │ │ Flipkart  │ │   Croma      │
     │ managed    │ │ Scraper   │ │  Scraper     │
     │ pipeline:  │ │ Studio    │ │  Studio      │
     │ amazon_    │ │ collector │ │  collector   │
     │ product_   │ │ (AI-built)│ │  (AI-built)  │
     │ search     │ └─────┬─────┘ └──────┬───────┘
     └─────┬──────┘       └──────────────┘
           ▼    Bright Data CLI (bdata)
     proxies · CAPTCHA solving · JS rendering · unblocking
```

## Credential Chain (account-level resilience)

```
slot 0: bdata CLI stored login          ← preferred, no key management
slot 1: BRIGHTDATA_API_KEYS[0]
slot 2: BRIGHTDATA_API_KEYS[1] ...
```

- A failing slot rotates to the next **mid-scrape**
- Deactivated/expired accounts are detected by their error signature and **permanently skipped** for the process lifetime; the chain rewinds to the first healthy slot
- Collector registries are per-slot: if a collector ID doesn't exist under the active account, it is removed and the next account's registry is tried

## How the Scrapers Work

| Store | Method | Why |
|-------|--------|-----|
| Amazon | Managed pipeline `amazon_product_search` via `bdata pipelines` | Structured dataset out of the box |
| Flipkart | **Scraper Studio** custom collector via `bdata scraper run` | No pre-built pipeline — the AI Agent builds and owns the scraper |
| Croma | **Scraper Studio** custom collector via `bdata scraper run` | Same as above |

### The Self-Healing Loop

Websites change constantly. PriceGuard treats extraction failures as first-class signals and repairs scrapers automatically:

```
 1. RUN        bdata pipelines / bdata scraper run
       │
 2. VALIDATE   schema checks on extracted JSON:
       │       • record with valid price exists?
       │       • price > 0 and plausible vs target?
       │       • title matches requested product? (token overlap scoring)
       ▼
 3. RETRY      transient failures get one automatic retry
       │
 4. HEAL       if validation still fails on a Studio collector:
       │       bdata scraper heal <collector_id> "<failure reason>" --auto-approve
       │       → Bright Data AI rewrites the broken selectors,
       │         same collector_id, non-destructive on failure
       ▼
 5. RE-RUN     verify the healed scraper produces valid data
       │
 6. FALLBACK   serve last known good data flagged stale:true
```

The loop is visualised as the RUN → VALIDATE → RETRY → HEAL → RE-RUN → VERIFIED pipeline on the Insights page, and surfaced per-product through trust labels.

> **How to read the health numbers:** a success rate below 100% is expected and honest — e-commerce pages change constantly, so some extractions legitimately fail validation. Every failure logs its exact reason, the `heals` counter shows where Studio's AI rewrote selectors, and `stale` flags mark last-known-good fallbacks. Wrong data never reaches the UI.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla HTML/CSS/JS — no framework, no build step
- **Scraping:** Bright Data CLI (`@brightdata/cli`) — managed pipelines + Scraper Studio collectors with AI self-healing
- **Testing:** Node built-in test runner (`node --test`), plus headless-Chrome overflow and UX/a11y audits

## Project Structure

```
PriceGuardAI/
├── public/
│   ├── css/style.css           # "Ledger" design system + components + responsive
│   ├── js/
│   │   ├── api.js              # API client, Intel scoring, PGWatch/PGAlerts storage
│   │   ├── app.js              # Shell behaviour: sidebar, profile, search shortcuts
│   │   ├── components/layout.js# Shared shell: sidebar, header, loadphrase helper
│   │   └── pages/              # dashboard, products, watchlist, alerts,
│   │                           # scrapers (Insights), product-details, settings
│   ├── index.html              # Hero search, stats, Best Opportunity, monitor strip
│   ├── products.html           # Products + compare selection
│   ├── product-details.html    # History chart with LOW/AVG/TARGET markers, buy CTA
│   ├── alerts.html             # Server alerts + device-local target alerts
│   ├── watchlist.html          # Starred products with movement since starring
│   ├── scrapers.html           # Insights: market pulse, best deals, heal pipeline,
│   │                           #  store reliability, advanced scraper monitors
│   └── settings.html           # Demo mode, monitoring interval, PIN lock
├── lib/
│   ├── scraperEngine.js        # Credential slots, CLI execution, JSON parsing,
│   │                           #  validation, collector registries
│   └── healer.js               # Retry + self-healing orchestration, health stats
├── routes/products.js          # API routes, caching, price history snapshots
├── scripts/
│   ├── setup-scrapers.js       # One-time: creates Studio collectors via AI Agent
│   └── collect-keys.js         # Gathers API keys from `bdata login` sessions
├── data/
│   ├── cache.json              # Product cache v2 + health stats + history
│   └── collectors.json         # Studio collector IDs (managed per key account)
├── server.js                   # Express entry point
├── .overflow_audit.js          # Headless horizontal-overflow audit (dev tool)
├── .ux_audit.js                # Headless UX/a11y audit (dev tool)
└── package.json
```

## Quick Start

```bash
git clone <repository-url>
cd PriceGuardAI
npm install
cp .env.example .env          # add your Bright Data API key(s)
npm start                     # http://localhost:3000
```

The app boots in **Demo mode** (sample data, instant load). Go live via **Settings → Demo mode OFF**.

## Configuration

Keys load natively via Node `--env-file-if-exists` — no OS-specific shell needed:

```env
# comma-separated pool; rotation across accounts is automatic
BRIGHTDATA_API_KEYS=key1,key2,key3
```

Collecting keys from multiple free-tier accounts:

```bash
npx -p @brightdata/cli bdata login      # browser opens; log in with that account
node scripts/collect-keys.js add        # saves key to data/bd-keys.txt (gitignored)
node scripts/collect-keys.js            # list keys + ready-to-paste pool string
```

Create the Studio collectors (one-time per account; the AI Agent builds both scrapers, ~15–20 min):

```bash
npm run setup:scrapers        # uses key #1 -> data/collectors.json
npm run setup:scrapers -- k2  # key #2's account -> data/collectors-k2.json
```

Inspect/edit each collector in the [Studio dashboard](https://brightdata.com/cp/scrapers) at the printed `view_url`.

## Demo Walkthrough (2 minutes)

1. **Dashboard** — instant overview: Best Opportunity card with Deal Score ring and "↓ N% below average", clickable stat cards, PRICE MONITOR strip showing per-store health.
2. **Go live** — Settings → Demo mode OFF, then Refresh. Watch real prices land (Amazon within seconds).
3. **Product details** — history chart with CURRENT / AVG / LOW / TARGET markers, Deal Score factors, Buy-at-store CTA, target alert with savings preview.
4. **Insights** (`scrapers.html`) — market pulse, best deals ranked by Deal Score, and the **heal pipeline**: RUN → VALIDATE → RETRY → HEAL → RE-RUN → VERIFIED.
5. **Show resilience** — Advanced monitors list real success rates, heal counts and stale flags. Point at `data/cache.json`: every failure is logged with its reason (*"extracted price ₹439 is implausibly low vs target ₹55,000"*).
6. **Trust story** — hover any price: "Verified 42 sec ago" vs "Recovered automatically" vs "Stale feed". The UI never shows unverified data as fact.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | All monitored products with live prices + health stats |
| GET | `/api/products/:id` | Specific product |
| GET | `/api/products/:id/history?range=7d\|30d\|90d\|1y` | Price history + summary |
| GET | `/api/alerts` | Active alerts (price drops, stock, errors, stale data) |
| GET | `/api/health` | Aggregate scraper health per store |
| GET/POST | `/api/mode` | Get/toggle demo vs live mode |
| GET/POST | `/api/settings` | Monitoring interval |
| POST | `/api/refresh` | Trigger manual live refresh |
| GET | `/api/categories` | Category → product map |
| GET | `/api/compare?ids=a,b` | Compare products in a category |

## Structured Output

Raw listing from the Flipkart Scraper Studio collector:

```json
{
  "product_title": "Google Pixel 8 (128 GB)",
  "current_price": { "value": 55999, "currency": "INR", "symbol": "₹" },
  "original_price": { "value": 75999, "currency": "INR", "symbol": "₹" },
  "rating": 4.4,
  "review_count": 3421,
  "product_url": "https://www.flipkart.com/google-pixel-8/p/itm..."
}
```

Normalized and enriched before it reaches the dashboard:

```json
{
  "id": "pixel-8",
  "name": "Google Pixel 8 (128GB)",
  "store": "Flipkart",
  "price": 55999,
  "originalPrice": 75999,
  "availability": "In Stock",
  "lastChecked": "2026-08-21T14:19:53Z",
  "_source": "live",
  "stats": { "attempts": 1, "successes": 1, "failures": 0, "heals": 0, "successRate": 100 }
}
```

`_source` values: `live` (fresh scrape) · `live-healed` (after auto-repair) · `stale` (last known good) · `demo` (sample data).

## Screenshots

![Dashboard](docs/screenshots/dashboard.png)
![Products](docs/screenshots/products.png)
![Scraper Health](docs/screenshots/scraper-health.png)
![Alerts](docs/screenshots/alerts.png)

> Screenshots predate the current "Ledger" light theme — re-capture before submitting if visuals matter for judging.

## Device-Local Data

Two lightweight layers live in `localStorage` so the app works without accounts:

| Key | Purpose |
|-----|---------|
| `pg_watchlist` | Starred product IDs |
| `pg_watch_meta` | Star timestamp + captured price ("movement since starring") |
| `pg_alerts` | Target-price alerts |

All displayed prices, trends and scores come only from `/api/products` and tracked history — nothing is fabricated client-side.

## License

ISC
