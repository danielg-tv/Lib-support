For first-time project setup, use [NEWCOMER_SETUP.md](./NEWCOMER_SETUP.md).

# TradingView Datafeed Tutorial (Binance)

This repo shows how to connect the TradingView Charting Library to a Binance spot datafeed with a tiny local news proxy.

The previous tutorial flow relied on CoinDesk/CryptoCompare endpoints. This version replaces them with:

- Historical bars: `https://api.binance.com/api/v3/klines`
- Symbol discovery: `https://api.binance.com/api/v3/exchangeInfo`
- Quotes: `https://api.binance.com/api/v3/ticker/24hr`
- Real-time bars: `wss://stream.binance.com:9443/ws`
- Crypto news: CoinDesk RSS via `/api/news/coindesk-rss`

No API key is required for the current implementation.

## What This Tutorial Covers

- `searchSymbols` and `resolveSymbol` using live Binance spot symbols
- `getBars` for minute, hour, day, week, and month data
- `subscribeBars` for real-time updates
- CoinDesk news via a same-origin RSS proxy
- Custom TradingView tickers in `Exchange:BASE/QUOTE` format
- Custom intervals such as `2`, `4`, `10`, `90`, and `180`

## Current Scope

This datafeed is intentionally Binance-only.

Why:

- The charting app stays lightweight and only adds a tiny local proxy for news.
- Binance public REST and WebSocket endpoints work without exposing credentials.
- Many multi-exchange providers now require paid access, API keys, or a backend proxy.

If you need multi-exchange routing later, the clean next step is to expand the local proxy and move provider calls there.

## File Responsibilities

### `src/helpers.js`

Shared utilities:

- Binance REST request wrapper
- TradingView ticker parsing
- resolution mapping
- bar time alignment helpers

Ticker format used by the app:

```text
Binance:BTC/USDT
```

Provider symbol format used by Binance:

```text
BTCUSDT
```

### `src/datafeed.js`

Implements the Charting Library datafeed contract:

- `onReady`
- `searchSymbols`
- `resolveSymbol`
- `getBars`
- `subscribeBars`
- `unsubscribeBars`
- `getQuotes`

This file also:

- loads Binance spot symbols from `exchangeInfo`
- paginates historical klines when the chart needs more than one `1000`-bar batch
- aggregates lower Binance intervals into custom TradingView intervals

### `src/streaming.js`

Handles WebSocket subscriptions and live bar updates.

Two streaming modes are used:

- Native Binance kline streams for intervals Binance already provides directly
- Trade stream aggregation for custom intervals such as `10m` and `180m`

This keeps the tutorial readable while still supporting the chart's custom resolution menu.

### `src/news.js`

Contains the CoinDesk RSS configuration used by the widget.

### `server.mjs`

Serves the app locally and proxies CoinDesk RSS through the same origin so the browser avoids CORS failures.

## Supported Resolutions

The repo currently exposes:

```js
[
  "1", "2", "3", "4", "5", "10", "15", "30",
  "60", "90", "120", "180", "240", "360", "480", "720",
  "1D", "3D", "1W", "1M"
]
```

How that maps to Binance:

- Raw Binance intraday intervals exposed through `intraday_multipliers`: `1`, `3`, `5`, `15`, `30`, `60`, `120`, `240`, `360`, `480`, `720`
- Extra UI resolutions rebuilt by the library from those raw intervals: `2`, `4`, `10`, `90`, `180`

In other words, `supported_resolutions` controls what the user can pick, while the `intraday_multipliers` and `daily_multipliers` fields tell the library which base intervals the provider actually gives us.

## Historical Data Flow

`getBars()` works like this:

1. Parse the TradingView ticker.
2. Convert the requested resolution into a Binance interval plan.
3. Fetch one or more `/api/v3/klines` batches with `limit=1000`.
4. Normalize Binance arrays into TradingView bar objects.
5. Aggregate when the requested interval is custom.
6. Cache the last bar for real-time continuity.

Example Binance request:

```text
https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=1000
```

Returned bars are mapped to:

```js
{
  time,
  open,
  high,
  low,
  close,
  volume,
}
```

## Real-Time Data Flow

### Native intervals

For native intervals, the feed subscribes to Binance kline streams such as:

```text
ethusdt@kline_1d
ethusdt@kline_1h
ethusdt@kline_15m
```

These streams already contain the current bar OHLCV state, so the chart can be updated directly.

### Custom intervals

For custom intervals, the feed subscribes to:

```text
ethusdt@trade
```

Then it builds the current bar locally from trade price, quantity, and trade time.

This is used for:

- `2m`
- `4m`
- `10m`
- `90m`
- `180m`

## Symbol Search

`searchSymbols()` and `resolveSymbol()` use Binance `exchangeInfo` and generate TradingView-friendly identifiers like:

```js
{
  symbol: "ETH/USDT",
  full_name: "Binance:ETH/USDT",
  ticker: "Binance:ETH/USDT",
  exchange: "Binance",
  type: "crypto"
}
```

The important detail is that `ticker` stays unique and stable.

## Quotes

`getQuotes()` now boots from Binance REST snapshots and `subscribeQuotes()` stays live with Binance WebSocket ticker streams.

That gives the quote panel:

- last price
- bid / ask
- 24h open / high / low
- 24h volume
- 24h change and change percent
- 1h rolling change and its baseline

## Notes

- This repo is aimed at Binance spot symbols only.
- The chart still uses TradingView marks and timescale marks demo data.
- News comes from CoinDesk's public RSS feed through the local `/api/news/coindesk-rss` proxy.
- If you deploy this publicly, remember Binance API availability can vary by jurisdiction and network environment.

## Local Smoke Test

After `npm install`:

```bash
npm run start
```

This starts the local static server and the CoinDesk RSS proxy on `http://127.0.0.1:3000`.

Then verify:

1. Default chart loads as `Binance:ETH/USDT`.
2. Daily candles appear.
3. Switching to `10m` still loads candles.
4. Live bars continue updating after the historical load.

## Where To Extend Next

- Add a backend proxy for multi-exchange support
- Persist symbol metadata locally for faster startup
- Replace demo marks/news with product data
- Add reconnect gap recovery with targeted historical backfill
