For first-time setup, start with [NEWCOMER_SETUP.md](./NEWCOMER_SETUP.md). For TradingView version upgrades, use [TRADINGVIEW_NPM_WORKFLOW.md](./TRADINGVIEW_NPM_WORKFLOW.md).

# TP Crypto Review Guide

This project embeds the TradingView Charting Library, backs it with a Binance spot datafeed, streams live quotes and candles from Binance WebSockets, and proxies CoinDesk RSS news through a small local Node server.

The goal of this README is to make code review fast: what the project does, what files are app-owned, how to run it, and what to verify before approval.

## Reviewer Quick Take

- Product shape: local TradingView integration demo for crypto charts and trading UI experiments
- Frontend: plain browser JavaScript loaded from `index.html`
- Local backend: `server.mjs` for static hosting and RSS proxying
- Market data source: Binance public REST + WebSocket APIs
- News source: CoinDesk RSS through `/api/news/coindesk-rss`
- Auth required at runtime: none for Binance or CoinDesk
- Auth required for install: GitHub SSH access to `tradingview/trading_platform`
- Persistence: browser `localStorage` only

## What Reviewers Should Focus On

App-owned files:

- `src/main.js`: widget bootstrap, broker wiring, save/load adapter, widget options
- `src/datafeed.js`: TradingView datafeed implementation, symbol search/resolve, history, quotes
- `src/streaming.js`: live bar subscriptions and reconnect behavior
- `src/quotes.js`: quote subscriptions for 24h and 1h ticker data
- `src/helpers.js`: symbol parsing, resolution mapping, bar time helpers, Binance REST wrapper
- `src/news.js`: CoinDesk RSS feed configuration for the widget
- `src/theme.js`: custom toolbar styling and theme helpers
- `server.mjs`: local static server and same-origin news proxy
- `scripts/*.mjs`: TradingView asset sync and version bump helpers
- `index.html`: script loading order and runtime entrypoint
- `package.json`: pinned TradingView package version and lifecycle scripts

Usually not useful to review unless intentionally updated:

- `node_modules/`: install output
- `vendor/tradingview/`: generated from `npm install` by `npm run tv:sync`
- `third_party/tradingview/broker-sample/dist/bundle.js`: external TradingView sample runtime used by `Brokers.BrokerDemo`

## Local Run

Prerequisites:

- Node.js and npm
- GitHub SSH access to `tradingview/trading_platform`
- A matching `broker-sample/dist/bundle.js` if `third_party/tradingview/broker-sample/dist/bundle.js` is missing locally

Install and start:

```bash
npm install
npm run start
```

Open:

`http://127.0.0.1:3000`

If the broker sample bundle is missing, create the folder and copy the matching runtime file before starting:

```bash
mkdir -p third_party/tradingview/broker-sample/dist
cp path_to_bundle.js third_party/tradingview/broker-sample/dist/bundle.js
```

## Approval Checklist

Use this as the quickest smoke test before approving:

1. The app opens at `http://127.0.0.1:3000`.
2. The default chart loads as `Binance:ETH/USDT`.
3. Daily candles load without `getBars` errors.
4. Switching to a custom interval such as `10m` still renders candles.
5. Live candles keep updating after historical data finishes loading.
6. Symbol search resolves Binance spot pairs in `Binance:BASE/QUOTE` form.
7. The quote panel shows last price, bid/ask, 24h stats, and 1h rolling change.
8. The news panel loads CoinDesk stories through `/api/news/coindesk-rss`.

## Architecture Map

Boot sequence:

1. `index.html` loads TradingView library assets from `vendor/tradingview/charting_library/`.
2. `index.html` loads the broker sample runtime from `third_party/tradingview/broker-sample/dist/bundle.js`.
3. `src/main.js` creates the TradingView widget and passes in the custom datafeed, broker, theme, and save/load adapter.

Core data paths:

- Symbol search and resolve: Binance `exchangeInfo`
- Historical bars: Binance `/api/v3/klines`
- Live bars: Binance kline streams for native intervals, trade stream aggregation for custom intervals
- Quotes: Binance REST snapshot bootstrap plus shared 24h and 1h WebSocket ticker streams
- News: CoinDesk RSS proxied by `server.mjs`

## Supported Resolutions

The widget exposes:

```js
[
  "1", "2", "3", "4", "5", "10", "15", "30",
  "60", "90", "120", "180", "240", "360", "480", "720",
  "1D", "3D", "1W", "1M"
]
```

Native Binance-backed intervals:

- `1`, `3`, `5`, `15`, `30`, `60`, `120`, `240`, `360`, `480`, `720`, `1D`, `3D`, `1W`, `1M`

Custom intervals rebuilt locally from lower-level Binance data:

- `2`, `4`, `10`, `90`, `180`

## Datafeed Notes

Ticker format used by the app:

```text
Binance:BTC/USDT
```

Provider symbol format used by Binance:

```text
BTCUSDT
```

`src/datafeed.js` is the main review hotspot because it:

- implements `onReady`, `searchSymbols`, `resolveSymbol`, `getBars`, `subscribeBars`, `unsubscribeBars`, and `getQuotes`
- pages Binance history in `1000`-bar batches
- aggregates lower-resolution bars into custom TradingView intervals
- caches the last bar so live updates continue cleanly after history loads

## Dependency Boundaries

Runtime dependencies:

- Historical bars: `https://api.binance.com/api/v3/klines`
- Symbol discovery: `https://api.binance.com/api/v3/exchangeInfo`
- Quotes: `https://api.binance.com/api/v3/ticker/24hr`
- Real-time streams: `wss://stream.binance.com:9443/ws`
- News: CoinDesk RSS via `/api/news/coindesk-rss`

This project is intentionally Binance-only. That keeps the integration lightweight and avoids API-key handling, but it also means a future multi-exchange version should route provider traffic through a backend layer instead of growing the browser client further.

## Known Constraints

- The project uses public Binance endpoints, so availability can vary by jurisdiction or network environment.
- News is read-only RSS data proxied through the local server.
- TradingView chart marks and timescale marks are still demo data.
- Saved charts, templates, and drawings are stored in browser `localStorage`, not a backend.

## Extending Later

Clean next steps if the project grows:

- add a backend proxy for multi-exchange support
- persist symbol metadata locally for faster startup
- replace demo marks/news with product data
- add reconnect gap recovery with targeted historical backfill
