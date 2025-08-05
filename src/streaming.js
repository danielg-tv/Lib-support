import { parseFullSymbol, apiKey } from './helpers.js';

const socket = new WebSocket(
	'wss://streamer.cryptocompare.com/v2?api_key=' + apiKey
);
// example ▼ {"TYPE":"20","MESSAGE":"STREAMERWELCOME","SERVER_UPTIME_SECONDS":1262462,"SERVER_NAME":"08","SERVER_TIME_MS":1753184197855,"CLIENT_ID":2561280,"DATA_FORMAT":"JSON","SOCKET_ID":"7zUlXfWU+zH7uX7ViDS2","SOCKETS_ACTIVE":1,"SOCKETS_REMAINING":0,"RATELIMIT_MAX_SECOND":30,"RATELIMIT_MAX_MINUTE":60,"RATELIMIT_MAX_HOUR":1200,"RATELIMIT_MAX_DAY":10000,"RATELIMIT_MAX_MONTH":20000,"RATELIMIT_REMAINING_SECOND":29,"RATELIMIT_REMAINING_MINUTE":59,"RATELIMIT_REMAINING_HOUR":1199,"RATELIMIT_REMAINING_DAY":9999,"RATELIMIT_REMAINING_MONTH":19867}


const channelToSubscription = new Map();

socket.addEventListener('open', () => {
	console.log('[socket] Connected');
});

socket.addEventListener('close', (reason) => {
	console.log('[socket] Disconnected:', reason);
});

socket.addEventListener('error', (error) => {
	console.log('[socket] Error:', error);
});
// This function calculates the start time of the bar based on the resolution
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

socket.addEventListener('message', (event) => {
	const data = JSON.parse(event.data);

	// console.log('[socket] Message:', data);

	const {
		TYPE: eventType,
		M: exchange,
		FSYM: fromSymbol,
		TSYM: toSymbol,
		TS: tradeTime, // This is a UNIX timestamp in seconds
		P: tradePrice,
		Q: tradeVolume,
	} = data;

	// We are only interested in Trade event updates
	if (parseInt(eventType) !== 0) {
		return;
	}
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

	const channelString = `0~${exchange}~${fromSymbol}~${toSymbol}`;
	const subscriptionItem = channelToSubscription.get(channelString);
	// console.log("Important: subscriptionItem", subscriptionItem.resolution);

	if (subscriptionItem === undefined) {
		return;
	}

	const lastBar = subscriptionItem.lastBar;
	// The resolution will be '1', '60', or '1D'
	const nextBarTime = getNextBarTime(lastBar.time, subscriptionItem.resolution);
	// console.log('[socket] Next bar time:', new Date(nextBarTime).toISOString());

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
	subscriptionItem.lastBar = bar;

	// Send data to every subscriber of that symbol
	subscriptionItem.handlers.forEach((handler) => handler.callback(bar));
})

export function subscribeOnStream(
	symbolInfo,
	resolution,
	onRealtimeCallback,
	subscriberUID,
    onResetCacheNeededCallback,
    lastBar
) {
	if (!symbolInfo || !symbolInfo.ticker) {
		console.error('[subscribeBars]: Invalid symbolInfo:', symbolInfo);
		return;
	}
	const parsedSymbol = parseFullSymbol(symbolInfo.ticker);
	// We subscribe to the trade channel to build bars ourselves
	const channelString = `0~${parsedSymbol.exchange}~${parsedSymbol.fromSymbol}~${parsedSymbol.toSymbol}`;
	
	const handler = {
		id: subscriberUID,
		callback: onRealtimeCallback,
	};

	let subscriptionItem = channelToSubscription.get(channelString);
	if (subscriptionItem) {
		console.log('Updating existing subscription with new resolution:', resolution);
        subscriptionItem.resolution = resolution;
        subscriptionItem.lastBar = lastBar;
		subscriptionItem.handlers.push(handler);
		return;
	}

	subscriptionItem = {
		subscriberUID,
		resolution,
        lastBar,
		handlers: [handler],
	};

	channelToSubscription.set(channelString, subscriptionItem);
	console.log('[subscribeBars]: Subscribe to streaming. Channel:', channelString);

	const subRequest = {
		action: 'SubAdd',
		subs: [channelString],
	};
	console.log('[subscribeBars]: Sending subscription request:', subRequest);
	// Only send SubAdd if the socket is open
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(subRequest));
	}
}


export function unsubscribeFromStream(subscriberUID) {
	for (const channelString of channelToSubscription.keys()) {
		const subscriptionItem = channelToSubscription.get(channelString);
		const handlerIndex = subscriptionItem.handlers.findIndex(
			(handler) => handler.id === subscriberUID
		);

		if (handlerIndex !== -1) {
			subscriptionItem.handlers.splice(handlerIndex, 1);

			if (subscriptionItem.handlers.length === 0) {
				console.log('[unsubscribeBars]: Unsubscribe from streaming. Channel:', channelString);
				const subRequest = {
					action: 'SubRemove',
					subs: [channelString],
				};
				socket.send(JSON.stringify(subRequest));
				channelToSubscription.delete(channelString);
				break;
			}
		}
	}
}