# Newcomer setup

This project is easy to start once your GitHub SSH access to TradingView is already working.

## You need

- VS Code
- Node.js and npm
- a GitHub SSH key
- access to `tradingview/trading_platform`

## Start the project

```bash
git clone <this-project>
cd <this-project>
npm install
npm run start
```

Then open:

`http://localhost:3000`

## How this project is organized

- `src/` contains the app code.
- `vendor/tradingview/charting_library/` is generated from the npm install.
- `third_party/tradingview/broker-sample/` is not kept in the repo but it's required because the app extends `Brokers.BrokerDemo`. You should add bundle.js to this directory.

```bash
cd <this-project>
mkdir third_party/tradingview/broker-sample/dist
cp path_to_bundle.js third_party/tradingview/broker-sample/dist
```

That means the project intentionally uses:

- npm for the official packaged library assets
- a checked-in broker sample runtime for the broker base class

## Updating TradingView later

```bash
npm run tv:use-version -- 31.2.0
npm install
npm run start
```

Then hard refresh the browser once so TradingView does not reuse stale chunk files from the previous version.

If a future release also needs a newer broker sample, update the checked-in file from the matching `trading_platform` release and test again.
