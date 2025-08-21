import {
	makeApiRequest,
	generateSymbol,
	parseFullSymbol,
} from './helpers.js';
import {
	subscribeOnStream,
	unsubscribeFromStream,
} from './streaming.js';

// Use a Map to store the last bar for each symbol subscription.
// This is essential for the streaming logic to update the chart correctly.
const lastBarsCache = new Map();

// Quote cache
const quoteSubscriptions = new Map();
const quotePriceCache = new Map(); 



// DatafeedConfiguration implementation
const configurationData = {
	supports_timescale_marks: true,
	supports_marks: true,
	supports_time: true,
	// Represents the resolutions for bars supported by your datafeed
	supported_resolutions: ['1', "5", "15", '60', '180', '1D', '1W', '1M'],
	// The `exchanges` arguments are used for the `searchSymbols` method if a user selects the exchange
	exchanges: [{
		value: 'Bitfinex',
		name: 'Bitfinex',
		desc: 'Bitfinex',
	},
	{
		value: 'Binance',
		name: 'Binance',
		desc: 'Binance',
	},
	{
		value: 'Kraken',
		// Filter name
		name: 'Kraken',
		// Full exchange name displayed in the filter popup
		desc: 'Kraken bitcoin exchange',
	},
	],
	// The `symbols_types` arguments are used for the `searchSymbols` method if a user selects this symbol type
	symbols_types: [
		{
		name: 'crypto',
		value: 'crypto',
	    },
	    {
		name: 'forex',
		value: 'forex',
		},
		{
		name: 'stock',
		value: 'stock',
		},
	],
};

async function getAllSymbols() {
	const data = await makeApiRequest('data/v3/all/exchanges');
	let allSymbols = [];

	for (const exchange of configurationData.exchanges) {
		if (data.Data[exchange.value]) {
			const pairs = data.Data[exchange.value].pairs;

			for (const leftPairPart of Object.keys(pairs)) {
				const symbols = pairs[leftPairPart].map(rightPairPart => {
					const symbol = generateSymbol(exchange.value, leftPairPart, rightPairPart);
					return {
						symbol: symbol.short,
						full_name: symbol.full,
						ticker: symbol.full,
						description: symbol.short,
						exchange: exchange.value,
						type: 'crypto',
					};
				});
				allSymbols = [...allSymbols, ...symbols];
			}
		}
	}
	return allSymbols;
}

export default {
	onReady: (callback) => {
		console.log('[onReady]: Method call');
		setTimeout(() => callback(configurationData));
	},

	searchSymbols: async (
		userInput,
		exchange,
		symbolType,
		onResultReadyCallback,
	) => {
		console.log('[searchSymbols]: Method call');
		const symbols = await getAllSymbols();
		// console.log(symbols)
		// outputs structure:
		// description: 	"ZK/USDT"
		// exchange : "Bitfinex"
		// full_name : "Bitfinex:ZK/USDT"
		// ticker: "Bitfinex:ZK/USDT"
		// symbol : "ZK/USDT"
		// type : "crypto"
		const newSymbols = symbols.filter(symbol => {
			const isExchangeValid = exchange === '' || symbol.exchange === exchange;
			const isTypeValid = !symbolType || symbol.type === symbolType;

			const isFullSymbolContainsInput = symbol.ticker
				.toLowerCase()
				.indexOf(userInput.toLowerCase()) !== -1;
			return isExchangeValid && isTypeValid && isFullSymbolContainsInput;
		});
		onResultReadyCallback(newSymbols);
	},

	resolveSymbol: async (
		symbolName,
		onSymbolResolvedCallback,
		onResolveErrorCallback,
		extension
	) => {
		console.log('[resolveSymbol]: Method call', symbolName);
		const symbols = await getAllSymbols();
		const symbolItem = symbols.find(({
			ticker,
		}) => ticker.toLowerCase() === symbolName.toLowerCase());
		if (!symbolItem) {
			console.log('[resolveSymbol]: Cannot resolve symbol', symbolName);
			onResolveErrorCallback("unknown_symbol"); // for ghost icon
			return;
		}
		// Symbol information object
		const symbolInfo = {
			ticker: symbolItem.ticker,
			name: symbolItem.symbol,
			description: symbolItem.description,
			type: symbolItem.type,
			exchange: symbolItem.exchange,
			listed_exchange: symbolItem.exchange,
			session: '24x7',
			// session_display: '0900-1600',
			logo_urls:[],
			timezone: 'Etc/UTC',
			minmov: 1,
			pricescale: 1000,
			has_intraday: true,
			intraday_multipliers: ["1", "60"],
			has_daily: true,
			daily_multipliers: ["1"],
			visible_plots_set: "ohlcv",
			supported_resolutions: configurationData.supported_resolutions,
			volume_precision: 2,
			data_status: 'streaming',
		};
		console.log('[resolveSymbol]: Symbol resolved', symbolName);
		onSymbolResolvedCallback(symbolInfo);
	},

	getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
		const { from, to, firstDataRequest } = periodParams;
		console.log('[getBars]: Method call', symbolInfo, resolution, from, to);
		const parsedSymbol = parseFullSymbol(symbolInfo.ticker);

		let endpoint;
		// Determine the correct endpoint based on the base resolution requested by the library
		if (resolution === '1D') {
			endpoint = 'histoday';
		} else if (resolution === '60') {
			endpoint = 'histohour';
		} else if (resolution === '1') {
			endpoint = 'histominute';
		} else {
			onErrorCallback(`Invalid resolution: ${resolution}`);
			return;
		}

		const urlParameters = {
			e: parsedSymbol.exchange,
			fsym: parsedSymbol.fromSymbol,
			tsym: parsedSymbol.toSymbol,
			toTs: to,
			limit: 1000,
		};
	    // example of historical OHLC 5 minute data request: 
		// https://min-api.cryptocompare.com/data/v2/histominute?fsym=ETH&tsym=USDT&limit=10&e=Binance&aggregate=5&api_key="API_KEY"
		const query = Object.keys(urlParameters)
			.map(name => `${name}=${encodeURIComponent(urlParameters[name])}`)
			.join('&');

		try {
			const data = await makeApiRequest(`data/v2/${endpoint}?${query}`);
			if ((data.Response && data.Response === 'Error') || !data.Data || !data.Data.Data || data.Data.Data.length === 0) {
				onHistoryCallback([], { noData: true });
				return;
			}

			let bars = [];
			data.Data.Data.forEach(bar => {
				if (bar.time >= from && bar.time < to) {
					bars.push({
						time: bar.time * 1000,
						low: bar.low,
						high: bar.high,
						open: bar.open,
						close: bar.close,
						volume: bar.volumefrom,
					});
				}
			});

			if (firstDataRequest) {
				lastBarsCache.set(symbolInfo.ticker, { ...bars[bars.length - 1] });
			}
			console.log(`[getBars]: returned ${bars.length} bar(s)`);
			onHistoryCallback(bars, { noData: false });
		} catch (error) {
			console.log('[getBars]: Get error', error);
			onErrorCallback(error);
		}
	},



	subscribeBars: (
			symbolInfo,
			resolution,
			onRealtimeCallback,
			subscriberUID,
			onResetCacheNeededCallback
		) => {
			console.log('[subscribeBars]: Method call with subscriberUID:', subscriberUID);
			subscribeOnStream(
				symbolInfo,
				resolution,
				onRealtimeCallback,
				subscriberUID,
				onResetCacheNeededCallback,
				// Pass the last bar from cache if available
				lastBarsCache.get(symbolInfo.ticker)
			);
		},

	unsubscribeBars: (subscriberUID) => {
		console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
		unsubscribeFromStream(subscriberUID);
	},

	getMarks: function(symbolInfo, from, to, onDataCallback, resolution) {
		console.log("=====getMarks running", from, to, from + 75600);
		const time = Date.now() / 1000;
		const marks = [
			{
				id: 1,
				time: to,
				color: 'red',
				text: ['wallet address, 1m within, buy txs:1, buy total: 123123, buy amount: 123123, avr price: 123123'],
				label: 'M',
				labelFontColor: 'blue',
				minSize: 25
			},
			{
				id: 2,
				time: to,
				color: 'green',
				text: ['Second marker'],
				label: 'S',
				labelFontColor: 'green',
				minSize: 10
			},
			{
				id: 3,
				time: time, 
				color: 'blue',
				text: ['Third marker'],
				label: 'T',
				labelFontColor: 'blue',
				minSize: 15
			},
			{
				id: 4,
				time: time,
				color: 'purple',
				text: ['Fourth marker'],
				label: 'F',
				labelFontColor: 'purple',
				minSize: 20
			},
			{
				id: 5,
				time: time,
				color: 'orange',
				text: ['Fifth marker'],
				label: 'O',
				labelFontColor: 'orange',
				minSize: 30
			}
		];
		onDataCallback(marks);
	},

	getTimescaleMarks: function(symbolInfo, from, to, onDataCallback, resolution) {
		const time = Date.now() / 1000;
		const time_marks = [
			{
				id: 'tsm1',
				time: time,
				color: "#089981",
				label: "A",
				labelFontColor: "#FFFFFF",
				// tooltip: ["South African Flag"]
			},
			{
				id: 'tsm2',
				time: time,
				color: "#FFAA00",
				label: "B",
				labelFontColor: "#FFFFFF",
				// tooltip: ["Bitcoin logo"]
			}
		];
		onDataCallback(time_marks);
	},

	// TP ONLY
	getQuotes: async function (symbols, onDataCallback, onErrorCallback) {
		try {
			const fromSymbols = new Set();
			const toSymbols = new Set();
			const parsedSymbols = {};

			for (const symbol of symbols) {
				const parsed = parseFullSymbol(symbol);
				if (parsed) {
					fromSymbols.add(parsed.fromSymbol);
					toSymbols.add(parsed.toSymbol);
					parsedSymbols[symbol] = parsed;
				}
			}

			if (fromSymbols.size === 0) {
				setTimeout(() => onDataCallback([]), 0);
				return;
			}

			const fsyms = [...fromSymbols].join(',');
			const tsyms = [...toSymbols].join(',');
			const pricesData = await makeApiRequest(`data/pricemultifull?fsyms=${fsyms}&tsyms=${tsyms}`);

			const data = symbols.map(symbol => {
				const parsed = parsedSymbols[symbol];
				if (
					parsed &&
					pricesData.RAW &&
					pricesData.RAW[parsed.fromSymbol] &&
					pricesData.RAW[parsed.fromSymbol][parsed.toSymbol]
				) {
					const priceInfo = pricesData.RAW[parsed.fromSymbol][parsed.toSymbol];
					const price = priceInfo.PRICE;
					const spread = parseFloat((0.1 - Math.random() * 0.01).toFixed(3));
					const ask = parseFloat((price + spread / 2).toFixed(3));
					const bid = parseFloat((price - spread / 2).toFixed(3));

					const quote = {
						price: price, // Store base price for simulation
						lp: price,
						ask: ask,
						bid: bid,
						spread: spread,
						open_price: priceInfo.OPENDAY,
						high_price: priceInfo.HIGHDAY,
						low_price: priceInfo.LOWDAY,
						prev_close_price: priceInfo.OPEN24HOUR,
						volume: priceInfo.VOLUME24HOURTO,
						ch: priceInfo.CHANGE24HOUR,
						chp: priceInfo.CHANGEPCT24HOUR,
						rtc: priceInfo.PRICE + (priceInfo.CHANGEHOUR || 0),
						rtc_time: priceInfo.LASTUPDATE,
						rch: priceInfo.CHANGEHOUR,
						rchp: priceInfo.CHANGEPCTHOUR,
						original_name: symbol,
						short_name: symbol,
					};

					quotePriceCache.set(symbol, quote);

					return {
						n: symbol,
						s: 'ok',
						v: quote,
					};
				}
				return { n: symbol, s: 'error', v: {} };
			}).filter(item => item.s === 'ok');

			setTimeout(() => onDataCallback(data), 10);
		} catch (err) {
			if (onErrorCallback) onErrorCallback(err);
		}
	},

	subscribeQuotes: function (symbols, fastSymbols, onRealtimeCallback, listenerGUID) {
		const allSymbols = [...new Set([...symbols, ...fastSymbols])];

		const intervalId = setInterval(() => {
			const quotes = allSymbols.map(symbol => {
				const lastQuote = quotePriceCache.get(symbol);
				if (!lastQuote) return null;

				// Base from cache
				const price = lastQuote.price;
				const spread = lastQuote.spread || 0.1;

				// Simulate small movement
				const lp = parseFloat((price + (Math.random() - 0.5) * spread).toFixed(3));
				const ask = parseFloat((lp + spread / 2).toFixed(3));
				const bid = parseFloat((lp - spread / 2).toFixed(3));
				const prev_close_price = lastQuote.prev_close_price;

				const high_price = Math.max(lastQuote.high_price, lp);
				const low_price = Math.min(lastQuote.low_price, lp);
				const volume = parseFloat((lastQuote.volume + Math.random() * 10).toFixed(3));
				const ch = parseFloat((lp - prev_close_price).toFixed(3));
				const chp = prev_close_price !== 0
					? parseFloat(((ch / prev_close_price) * 100).toFixed(3))
					: 0;

				// Simulate real-time change fields
				const rtc = lp;
				const rtc_time = Date.now();
				const rch = parseFloat((rtc - (lastQuote.rtc || price)).toFixed(3));
				const rchp = lastQuote.rtc !== 0 ? parseFloat(((rch / lastQuote.rtc) * 100).toFixed(3)) : 0;

				const updatedQuote = {
					...lastQuote, // Carry over static fields like open_price
					price: lp, // Update the base price for the next tick
					lp, ask, bid, high_price, low_price,
					volume, ch, chp, rtc, rtc_time, rch, rchp,
				};

				quotePriceCache.set(symbol, updatedQuote);

				return {
					s: 'ok',
					n: symbol,
					v: updatedQuote,
				};
			}).filter(Boolean);

			if (quotes.length > 0) onRealtimeCallback(quotes);
		}, 1500);

		quoteSubscriptions.set(listenerGUID, intervalId);
	},

	unsubscribeQuotes: function(listenerGUID) {
		const intervalId = quoteSubscriptions.get(listenerGUID);
		if (intervalId) {
			clearInterval(intervalId);
			quoteSubscriptions.delete(listenerGUID);
			console.log('[unsubscribeQuotes]: Stopped polling for', listenerGUID);
		}
	},
};