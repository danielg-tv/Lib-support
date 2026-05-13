# Newcomer setup

This project is straightforward to start once your GitHub SSH access to TradingView is already working.

## You need

- Node.js and npm
- a GitHub SSH key
- access to `tradingview/trading_platform`
- a copy of `broker-sample/dist/bundle.js` if it is not already present locally

## Start the project

```bash
git clone <this-project>
cd <this-project>
npm install
npm run start
```

Then open:

`http://127.0.0.1:3000`

If `third_party/tradingview/broker-sample/dist/bundle.js` is missing, create the folder and copy in the matching TradingView sample runtime before starting:

```bash
mkdir -p third_party/tradingview/broker-sample/dist
cp path_to_bundle.js third_party/tradingview/broker-sample/dist/bundle.js
```

## How this project is organized

- `src/` contains the app-owned code reviewers should focus on.
- `vendor/tradingview/charting_library/` is generated from the npm install.
- `third_party/tradingview/broker-sample/dist/bundle.js` is an external TradingView sample runtime loaded by `index.html`.
- `server.mjs` serves the app locally and proxies CoinDesk RSS to avoid browser CORS issues.
- `scripts/` contains small maintenance helpers for TradingView version bumps and asset sync.

In practice, the project uses:

- npm for the packaged TradingView charting library assets
- a separate broker sample runtime for the `Brokers.BrokerDemo` base class

## Updating TradingView later

```bash
npm run tv:use-version -- 31.2.0
npm install
npm run start
```

Then hard refresh the browser once so TradingView does not reuse stale chunk files from the previous version.

If a future release also needs a newer broker sample, copy the matching `broker-sample/dist/bundle.js` into `third_party/tradingview/broker-sample/dist/bundle.js` and test again.
