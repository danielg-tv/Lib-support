This tutorial demonstrates how to create a datafeed for the Charting Library using the CryptoCompare API. It addresses common issues found in other examples and provides a more robust implementation.

### Issues with Older Implementations
*   `resolveSymbol` does not always resolve symbols correctly.
*   `searchSymbols` does not properly filter by symbol type.
*   The `ticker` property in `getAllSymbols` is often misconfigured. This version corrects it to use the full, unique symbol name (e.g., `Bitfinex:BTC/USD`).

### Prerequisites
1.  Sign up for a CryptoCompare/Coindesk minAPI account to get a free API key: [https://www.cryptocompare.com/coins/guides/how-to-use-our-api/](https://www.cryptocompare.com/coins/guides/how-to-use-our-api/)
2.  You can test the REST API calls we'll use for historical data in a tool like Postman or directly in your browser. For example:
    `https://min-api.cryptocompare.com/data/v2/histominute?fsym=ETH&tsym=USDT&limit=10&e=Binance&api_key={YOUR_API_KEY}`

**Note:** While CryptoCompare offers server-side aggregation (the `aggregate` parameter), we will let the Charting Library handle bar aggregation for maximum flexibility.

### WebSocket Connection for Real-Time Data

To get real-time data, we will connect to the CryptoCompare WebSocket API.

*   **WebSocket URL:** `wss://streamer.cryptocompare.com/v2?api_key={YOUR_API_KEY}`

Your subscription and unsubscription messages should be JSON objects, like so:

*   **Subscribe:**
    ```json
    {
        "action": "SubAdd",
        "subs": ["0~Coinbase~ETH~USD"]
    }
    ```
*   **Unsubscribe:**
    ```json
    {
        "action": "SubRemove",
        "subs": ["0~Coinbase~ETH~USD"]
    }
    ```

***Note:*** In this tutorial, for live bar streaming, we connect to the **trade channel (`0`)** and build the OHLCV bars ourselves in the `streaming.js` file. This is great for demonstration, but for a production environment, you should connect directly to the **OHLCV Candles channel (`24`)** – I am planning to update next version of my datafeedAPI to that.

You can experiment with the socket connection and inspect the raw messages:
https://developers.coindesk.com/documentation/legacy-websockets/Trade

Currently, we use P, Q, and TS for building bars.

Setup Widget...etc


### Implementing the Datafeed

#### `datafeed.js`

**1. Configuration Data (`configurationData`)**
Pass your supported exchanges, symbol types, and resolutions here. The new implementation supports intraday resolutions.

```javascript
const configurationData = {
    supports_timescale_marks: true,
    supports_marks: true,
    supports_time: true,
    supported_resolutions: ['1', "5", "15", '60', '180', '1D', '1W', '1M'],
    // ... other configuration symbols_types ; supported resolutions.
};
```

**2. `getAllSymbols()`**
We fetch the full list of symbols from the `data/v3/all/exchanges` endpoint. It's crucial to map the API response to the object structure the Charting Library expects. Pay close attention to the `ticker` property, which must be a unique identifier for the symbol.

```javascript
// Inside getAllSymbols map function
return {
    symbol: symbol.short, // e.g., "BTC/USD"
    full_name: symbol.full, // e.g., "Bitfinex:BTC/USD"
    ticker: symbol.full, // Unique ticker for the library
    description: symbol.short,
    exchange: exchange.value,
    type: 'crypto',
};
```

**3. `searchSymbols()`**
This function now correctly filters the symbols obtained from `getAllSymbols`. The filter logic checks against the user's input, the selected exchange, and the symbol type, using the `ticker` for the primary search.

If you were to log data returned by getAllSymbols()
```javascript
// const symbols = await getAllSymbols();
// console.log(symbols)
		// outputs structure:
		// description: "ZK/USDT"
		// exchange : "Bitfinex"
		// full_name : "Bitfinex:ZK/USDT"
        // ticker: "Bitfinex:ZK/USDT"
		// symbol : "ZK/USDT"
		// type : "crypto"
};
```

**4. `resolveSymbol()`**
This method finds the symbol details using the unique `ticker`. We've added `intraday_multipliers` and `daily_multipliers` to tell the library which base resolutions our datafeed provides (`1`, `60`, `1D`). The library will automatically aggregate data for other resolutions (e.g., it will build 5-minute bars from the 1-minute data we provide).

```javascript
// Inside resolveSymbol
const symbolInfo = {
    // ...
    ticker: symbolItem.ticker,
    // ...
    has_intraday: true,
    intraday_multipliers: ["1", "60"], // Base resolutions for intraday
    has_daily: true,
    daily_multipliers: ["1"], // Base resolution for daily
    // ...
};
```

**5. `getBars()`**
This is a major improvement. Instead of only fetching daily data, this function now determines the correct API endpoint based on the `resolution` requested by the library. This ensures we always request the most appropriate base data (minute, hour, or day).

```javascript
// Inside getBars
let endpoint;
if (resolution === '1D') {
    endpoint = 'histoday';
} else if (resolution === '60') {
    endpoint = 'histohour';
} else if (resolution === '1') {
    endpoint = 'histominute';
}
// ...
const data = await makeApiRequest(`data/v2/${endpoint}?${query}`);
```We also pass the volume data (`bar.volumefrom`) to the library.
```
Cryptocomapre/coindesk minAPI allows making REST API calls to minute/hour/daily data and socket streaming is only for those intervals as well. 
As mentioned before they offer to aggregate historical data on their end but we can't use it, so we will let library handle aggregation.

We can also pass volume to bar data. volume: bar.volume
subsequently we are updating endpoint when calling makeApiRequest:
const data = await makeApiRequest(`data/v2/${endpoint}?${query}`);

***Note:*** Instead of full name start using ticker.


**6. `subscribeBars()`**
When subscribing to real-time updates, we now use the `ticker` to identify the symbol and pass the most recent bar from our historical data (`lastBarsCache`) to the streaming module. This ensures a seamless transition from historical to real-time data without gaps or overlaps.

#### `streaming.js`
The streaming logic has been reworked to handle multiple resolutions.
example message:
```javascript
// example ▼ {"TYPE":"20","MESSAGE":"STREAMERWELCOME","SERVER_UPTIME_SECONDS":1262462,"SERVER_NAME":"08","SERVER_TIME_MS":1753184197855,"CLIENT_ID":2561280,"DATA_FORMAT":"JSON","SOCKET_ID":"7zUlXfWU+zH7uX7ViDS2","SOCKETS_ACTIVE":1,"SOCKETS_REMAINING":0,"RATELIMIT_MAX_SECOND":30,"RATELIMIT_MAX_MINUTE":60,"RATELIMIT_MAX_HOUR":1200,"RATELIMIT_MAX_DAY":10000,"RATELIMIT_MAX_MONTH":20000,"RATELIMIT_REMAINING_SECOND":29,"RATELIMIT_REMAINING_MINUTE":59,"RATELIMIT_REMAINING_HOUR":1199,"RATELIMIT_REMAINING_DAY":9999,"RATELIMIT_REMAINING_MONTH":19867}
```

The `socket.addEventListener('message', ...)` function now processes incoming trade data and updates the bar for the *current* resolution of the chart (be it 1-minute, 60-minute, or daily). Since trade price updates are happening per tick, it's not ideal to build bars from this channel, but for the sake of tutorial we can use it.

The new `getNextBarTime(barTime, resolution)` function can be considered extra work, but it's a failsafe if something goes wrong. It accurately calculates the timestamp for the next bar based on the current bar's time and resolution.
```javascript
function getNextBarTime(barTime, resolution) {
	// console.log("resolution", resolution);
	// logged resolution is 1 always or 60 or 1D
	const date = new Date(barTime); // unix for 16:10
	// We are using UTC time
    const interval = parseInt(resolution); // This will be 1, 60, or NaN

    if (resolution === '1D') {
        date.setUTCDate(date.getUTCDate() + 1);
        date.setUTCHours(0, 0, 0, 0);
    } else if (!isNaN(interval)) { // Handles '1' and '60' (minutes)
        // Add the interval to the current bar's time
        date.setUTCMinutes(date.getUTCMinutes() + interval);
    }
	return date.getTime();
}
```
For socket parameters, let's add Q as well for tradeVolume

```javascript
const {
		TYPE: eventType,
		M: exchange,
		FSYM: fromSymbol,
		TSYM: toSymbol,
		TS: tradeTime, // This is a UNIX timestamp in seconds
		P: tradePrice,
		Q: tradeVolume,
	} = data;

```

```javascript

	// example TYPE:"0"
	// M:"Coinbase"
	// FSYM:"BTC"
	// TSYM:"USD"
	// F:"1"
	// ID:"852793745"
	// TS:1753190418
	// Q:0.34637342
	// P:119283.1
	// TOTAL:41316.495295202
	// RTS:1753190418
	// CCSEQ:852777369
	// TSNS:654000000
	// RTSNS:708000000
```

Let's rename lastDailybar to lastBar because we are not only working with daily bars anymore:

```javascript
 const lastBar = subscriptionItem.lastBar;
    	const nextBarTime = getNextBarTime(lastBar.time, subscriptionItem.resolution);
    let bar;
	// If the trade time is greater than or equal to the next bar's start time, create a new bar
	if (tradeTime * 1000 >= nextBarTime) {
		bar = {
			time: nextBarTime,
			open: tradePrice,
			high: tradePrice,
			low: tradePrice,
			close: tradePrice,
			volume: tradeVolume,
		};
		// console.log('[socket] Generate new bar', bar);
	} else {
		// Otherwise, update the last bar
		bar = {
			...lastBar,
			high: Math.max(lastBar.high, tradePrice),
			low: Math.min(lastBar.low, tradePrice),
			close: tradePrice,
			volume: (lastBar.volume || 0) + tradeVolume,
		};
		 // console.log('[socket] Update latest bar', bar);
	}
```
Currently, we generate high/low/volume values from trades, which is not ideal for production.


`subscribeOnStream()`

it's continuation of susbcribeBars(), helper so to say.
change full_name to ticker. let's keep library requirements in mind. we don't use full_name anymore

  ```javascript
    if (subscriptionItem) {
		console.log('Updating existing subscription with new resolution:', resolution);
        subscriptionItem.resolution = resolution;
        subscriptionItem.lastBar = lastBar;
		subscriptionItem.handlers.push(handler);
		return;
	}
```

it was a mistake to only have handlers pushed before.


#### `helpers.js`
The `generateSymbol` function creates both a short symbol name (e.g., `BTC/USD`) and a full name that we use as the unique `ticker` (e.g., `Bitfinex:BTC/USD`). This is a simple way to create unique identifiers when the API doesn't provide them directly. P.S. We are faking ticker because API doesn't provide it – by adding {exchange} before {short}.

```javascript
export function generateSymbol(exchange, fromSymbol, toSymbol) {
	const short = `${fromSymbol}/${toSymbol}`;
	return {
		short,
		full: `${exchange}:${short}`,
	};
}
```
There's a lot of room to improve, for example changing searchSymbol, currently you need to set default symbol with exchange for resolve symbol to work ...

