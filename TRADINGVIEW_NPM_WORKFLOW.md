# TradingView npm workflow

This project uses two sources on purpose:

- `npm install` provides the packaged TradingView library files.
- `third_party/tradingview/broker-sample` provides the broker demo runtime that `CustomBroker` extends.

Why this split exists:

- The private `trading_platform` repository contains more folders than the npm-installed package exposes.
- `broker-sample` is intentionally sample code, so we keep the runtime file we depend on in this repo.
- That lets upgrades stay simple without rewriting our broker implementation.

## First-time setup

```bash
npm install
npm run start
```

What happens during install:

- npm downloads `tradingview/trading_platform` at the version pinned in `package.json`
- `postinstall` runs `npm run tv:sync`
- `tv:sync` copies the packaged library assets into `vendor/tradingview`

The app then loads:

- `vendor/tradingview/charting_library/...` from npm
- `third_party/tradingview/broker-sample/dist/bundle.js` from this repo

## Upgrade to a new TradingView version

Example:

```bash
npm run tv:use-version -- 31.2.0
npm install
npm run start
```

After upgrading:

1. Open the app locally.
2. Hard refresh the browser once so old TradingView chunk hashes are dropped.
3. Verify charts and trading still work.
4. Check `TradingView.version()` in the browser console.

If you see `ChunkLoadError` or a missing `trading-account-manager.*.js` file, the browser is still trying to use cached assets from the previous version.

## When to update broker-sample manually

Only do this if the new TradingView release changes behavior you care about in `Brokers.BrokerDemo`.

Then:

1. Download or clone the matching `trading_platform` release.
2. Copy `broker-sample/dist/bundle.js` into `third_party/tradingview/broker-sample/dist/bundle.js`.
3. Test the app and commit the update.

If nothing changed for your broker flow, you can leave the checked-in broker sample as-is.
