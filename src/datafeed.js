import {
  BINANCE_EXCHANGE,
  SUPPORTED_RESOLUTIONS,
  barStartTime,
  generateSymbol,
  getResolutionSpec,
  intervalToMilliseconds,
  makeApiRequest,
  parseFullSymbol,
} from "./helpers.js";
import { subscribeQuotesOnStream, unsubscribeQuotesFromStream } from "./quotes.js";
import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

const lastBarsCache = new Map();
const quotePriceCache = new Map();
const quoteTickerState = new Map();
const INTRADAY_MULTIPLIERS = ["1", "3", "5", "15", "30", "60", "120", "240", "360", "480", "720"];
const FILE_MARKER_URL = new URL("./assets/file.svg", import.meta.url).href;
const ALIEN_MARKER_URL = new URL("./assets/alien.svg", import.meta.url).href;

let symbolsCachePromise = null;

const configurationData = {
  supports_timescale_marks: true,
  supports_marks: true,
  supports_time: true,
  supported_resolutions: SUPPORTED_RESOLUTIONS,
  exchanges: [
    { value: BINANCE_EXCHANGE, name: BINANCE_EXCHANGE, desc: "Binance spot market" },
  ],
  symbols_types: [
    { name: "crypto", value: "crypto" },
  ],
};

// Derives a TradingView pricescale from Binance tick size metadata.
function tickSizeToPriceScale(tickSize) {
  if (!tickSize) return 100;

  const trimmed = tickSize.replace(/0+$/, "");
  if (!trimmed.includes(".")) return 1;

  return 10 ** trimmed.split(".")[1].length;
}

// Loads and caches the Binance spot symbol catalog for search and resolve requests.
async function getAllSymbols() {
  if (!symbolsCachePromise) {
    symbolsCachePromise = (async () => {
      const data = await makeApiRequest("api/v3/exchangeInfo");

      return (data.symbols ?? [])
        .filter((symbol) => symbol.status === "TRADING" && symbol.isSpotTradingAllowed !== false)
        .map((symbol) => {
          const generated = generateSymbol(
            BINANCE_EXCHANGE,
            symbol.baseAsset,
            symbol.quoteAsset,
          );
          const priceFilter = symbol.filters?.find((filter) => filter.filterType === "PRICE_FILTER");

          return {
            symbol: generated.short,
            full_name: generated.full,
            ticker: generated.full,
            description: generated.short,
            exchange: BINANCE_EXCHANGE,
            type: "crypto",
            providerSymbol: symbol.symbol,
            priceScale: tickSizeToPriceScale(priceFilter?.tickSize),
          };
        })
        .sort((left, right) => left.ticker.localeCompare(right.ticker));
    })();
  }

  return symbolsCachePromise;
}

// Finds a symbol regardless of whether the library passes short or full ticker text.
function getSymbolInfoItem(symbols, symbolName) {
  const needle = symbolName.toLowerCase();

  return symbols.find((symbol) =>
    symbol.ticker.toLowerCase() === needle ||
    symbol.full_name.toLowerCase() === needle ||
    symbol.symbol.toLowerCase() === needle
  );
}

// Pages through Binance klines until the requested time window is covered.
async function fetchKlines(symbol, interval, fromMs, toMs) {
  const intervalMs = intervalToMilliseconds(interval);
  if (!intervalMs && interval !== "1M") {
    throw new Error(`Unsupported Binance interval: ${interval}`);
  }

  const results = [];
  let cursor = fromMs;
  let requestCount = 0;
  const hardStop = 25;

  while (cursor < toMs && requestCount < hardStop) {
    const batch = await makeApiRequest("api/v3/klines", {
      symbol,
      interval,
      startTime: cursor,
      endTime: toMs,
      limit: 1000,
    });

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    results.push(...batch);

    const lastOpenTime = batch[batch.length - 1][0];
    const nextCursor = interval === "1M"
      ? new Date(lastOpenTime).setUTCMonth(new Date(lastOpenTime).getUTCMonth() + 1)
      : lastOpenTime + intervalMs;

    if (nextCursor <= cursor) {
      break;
    }

    cursor = nextCursor;
    requestCount += 1;

    if (batch.length < 1000) {
      break;
    }
  }

  const deduped = new Map();
  results.forEach((entry) => {
    deduped.set(entry[0], entry);
  });

  return [...deduped.values()].sort((left, right) => left[0] - right[0]);
}

// Converts raw Binance kline arrays into TradingView bar objects.
function normalizeKlines(klines) {
  return klines.map((entry) => ({
    time: entry[0],
    open: parseFloat(entry[1]),
    high: parseFloat(entry[2]),
    low: parseFloat(entry[3]),
    close: parseFloat(entry[4]),
    volume: parseFloat(entry[5]),
  }));
}

// Rebuilds higher custom resolutions from the raw interval bars we fetched.
function aggregateBars(rawBars, resolution) {
  const aggregated = [];

  rawBars.forEach((bar) => {
    const bucketTime = barStartTime(bar.time, resolution);
    const current = aggregated[aggregated.length - 1];

    if (current && current.time === bucketTime) {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume;
      return;
    }

    aggregated.push({
      time: bucketTime,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    });
  });

  return aggregated;
}

// Normalizes single-object and array responses into a consistent array shape.
function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

// Translates Binance day and hour ticker payloads into TradingView quote fields.
function buildQuoteFromState(symbol, state, fallbackQuote = null) {
  const dayTicker = state?.dayTicker ?? null;
  const hourTicker = state?.hourTicker ?? null;

  const price = dayTicker
    ? parseFloat(dayTicker.lastPrice ?? dayTicker.c)
    : fallbackQuote?.price ?? 0;
  const bid = dayTicker
    ? parseFloat(dayTicker.bidPrice ?? dayTicker.b)
    : fallbackQuote?.bid ?? price;
  const ask = dayTicker
    ? parseFloat(dayTicker.askPrice ?? dayTicker.a)
    : fallbackQuote?.ask ?? price;

  return {
    price,
    lp: price,
    ask,
    bid,
    spread: ask - bid,
    open_price: dayTicker
      ? parseFloat(dayTicker.openPrice ?? dayTicker.o)
      : fallbackQuote?.open_price ?? price,
    high_price: dayTicker
      ? parseFloat(dayTicker.highPrice ?? dayTicker.h)
      : fallbackQuote?.high_price ?? price,
    low_price: dayTicker
      ? parseFloat(dayTicker.lowPrice ?? dayTicker.l)
      : fallbackQuote?.low_price ?? price,
    prev_close_price: dayTicker
      ? parseFloat(dayTicker.prevClosePrice ?? dayTicker.x ?? dayTicker.openPrice ?? dayTicker.o)
      : fallbackQuote?.prev_close_price ?? price,
    volume: dayTicker
      ? parseFloat(dayTicker.volume ?? dayTicker.v)
      : fallbackQuote?.volume ?? 0,
    ch: dayTicker
      ? parseFloat(dayTicker.priceChange ?? dayTicker.p ?? 0)
      : fallbackQuote?.ch ?? 0,
    chp: dayTicker
      ? parseFloat(dayTicker.priceChangePercent ?? dayTicker.P ?? 0)
      : fallbackQuote?.chp ?? 0,
    rtc: hourTicker
      ? parseFloat(hourTicker.openPrice ?? hourTicker.o)
      : fallbackQuote?.rtc ?? price,
    rtc_time: Math.floor(
      ((hourTicker?.closeTime ?? hourTicker?.C ?? dayTicker?.closeTime ?? dayTicker?.C ?? Date.now())) / 1000,
    ),
    rch: hourTicker
      ? parseFloat(hourTicker.priceChange ?? hourTicker.p ?? 0)
      : fallbackQuote?.rch ?? 0,
    rchp: hourTicker
      ? parseFloat(hourTicker.priceChangePercent ?? hourTicker.P ?? 0)
      : fallbackQuote?.rchp ?? 0,
    original_name: symbol,
    short_name: symbol,
  };
}

// Fetches the initial REST snapshots that seed quotes before websocket updates arrive.
async function fetchQuoteSnapshots(symbols) {
  const parsedSymbols = symbols
    .map((symbol) => ({ symbol, parsed: parseFullSymbol(symbol) }))
    .filter((entry) => entry.parsed);

  if (parsedSymbols.length === 0) {
    return [];
  }

  const providerSymbols = parsedSymbols.map((entry) => entry.parsed.symbol);
  const symbolsParam = JSON.stringify(providerSymbols);

  const [dayData, hourData] = await Promise.all([
    makeApiRequest("api/v3/ticker/24hr", { symbols: symbolsParam }),
    makeApiRequest("api/v3/ticker", { symbols: symbolsParam, windowSize: "1h" }),
  ]);

  const dayMap = new Map(asArray(dayData).map((item) => [item.symbol, item]));
  const hourMap = new Map(asArray(hourData).map((item) => [item.symbol, item]));

  return parsedSymbols.map(({ symbol, parsed }) => {
    const state = {
      dayTicker: dayMap.get(parsed.symbol) ?? null,
      hourTicker: hourMap.get(parsed.symbol) ?? null,
    };

    quoteTickerState.set(symbol, state);

    return {
      symbol,
      quote: buildQuoteFromState(symbol, state, quotePriceCache.get(symbol) ?? null),
    };
  });
}

export default {
  // Publishes the datafeed capabilities TradingView uses during startup.
  onReady(callback) {
    console.log("[onReady]");
    setTimeout(() => callback(configurationData));
  },

  // Returns search matches from the cached Binance spot symbol catalog.
  async searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
    console.log("[searchSymbols]", userInput, exchange, symbolType);

    const symbols = await getAllSymbols();
    const query = userInput.trim().toLowerCase();

    const filtered = symbols.filter((symbol) => {
      const matchesExchange = !exchange || symbol.exchange === exchange;
      const matchesType = !symbolType || symbol.type === symbolType;
      const matchesQuery = !query ||
        symbol.ticker.toLowerCase().includes(query) ||
        symbol.symbol.toLowerCase().includes(query);

      return matchesExchange && matchesType && matchesQuery;
    });

    onResultReadyCallback(filtered.slice(0, 200));
  },

  // Resolves a TradingView ticker into the symbol metadata needed to load a chart.
  async resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
    console.log("[resolveSymbol]", symbolName);

    try {
      const symbols = await getAllSymbols();
      const symbolItem = getSymbolInfoItem(symbols, symbolName);

      if (!symbolItem) {
        console.warn("[resolveSymbol] Cannot resolve:", symbolName);
        onResolveErrorCallback("unknown_symbol");
        return;
      }

      onSymbolResolvedCallback({
        ticker: symbolItem.ticker,
        name: symbolItem.symbol,
        description: symbolItem.description,
        type: symbolItem.type,
        exchange: symbolItem.exchange,
        listed_exchange: symbolItem.exchange,
        session: "24x7",
        logo_urls: [],
        timezone: "Etc/UTC",
        minmov: 1,
        pricescale: symbolItem.priceScale,
        format: "price",
        has_intraday: true,
        intraday_multipliers: INTRADAY_MULTIPLIERS,
        has_daily: true,
        daily_multipliers: ["1", "3"],
        has_weekly_and_monthly: true,
        visible_plots_set: "ohlcv",
        supported_resolutions: configurationData.supported_resolutions,
        data_status: "streaming",
      });

      console.log("[resolveSymbol] Resolved:", symbolName);
    } catch (error) {
      console.error("[resolveSymbol] Error:", error);
      onResolveErrorCallback("unknown_symbol");
    }
  },

  // Fetches historical bars and rebuilds custom resolutions when needed.
  async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
    const { from, to, firstDataRequest } = periodParams;
    console.log(
      "[getBars]",
      symbolInfo.ticker,
      resolution,
      new Date(from * 1000).toISOString(),
      "→",
      new Date(to * 1000).toISOString(),
    );

    const parsed = parseFullSymbol(symbolInfo.ticker);
    if (!parsed) {
      onErrorCallback("Cannot parse symbol ticker");
      return;
    }

    const spec = getResolutionSpec(resolution);
    if (!spec) {
      onErrorCallback(`Unsupported resolution: ${resolution}`);
      return;
    }

    const fromMs = barStartTime(from * 1000, resolution);
    const toMs = to * 1000;

    try {
      const rawKlines = await fetchKlines(parsed.symbol, spec.interval, fromMs, toMs);
      if (rawKlines.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      const baseBars = normalizeKlines(rawKlines);
      const resolvedBars = spec.aggregate === 1
        ? baseBars
        : aggregateBars(baseBars, resolution);

      const bars = resolvedBars.filter((bar) => bar.time >= from * 1000 && bar.time < to * 1000);

      if (bars.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      if (firstDataRequest) {
        lastBarsCache.set(symbolInfo.ticker, { ...bars[bars.length - 1] });
      }

      console.log(`[getBars] Returned ${bars.length} bar(s)`);
      onHistoryCallback(bars, { noData: false });
    } catch (error) {
      console.error("[getBars] Error:", error);
      onErrorCallback(error);
    }
  },

  // Starts the realtime stream for the active chart symbol and resolution.
  subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
    console.log("[subscribeBars]", subscriberUID, "@", resolution);

    subscribeOnStream(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscriberUID,
      onResetCacheNeededCallback,
      lastBarsCache.get(symbolInfo.ticker) ?? null,
    );
  },

  // Stops the realtime bar stream when TradingView releases a subscriber.
  unsubscribeBars(subscriberUID) {
    console.log("[unsubscribeBars]", subscriberUID);
    unsubscribeFromStream(subscriberUID);
  },

  // Supplies example chart markers for the tutorial overlay APIs.
  getMarks(symbolInfo, from, to, onDataCallback, resolution) {
    const time = Date.now() / 1000;
    const ONE_DAY_SEC = 86_400;

    onDataCallback([
      {
        id: 1,
        time: to,
        borderWidth: 0,
        text: ["wallet address, 1m within, buy txs:1, buy total: 123123, avr price: 123123"],
        imageUrl: FILE_MARKER_URL,
      },
      { id: 2, time: time - ONE_DAY_SEC * 5, color: "green", label: "S", labelFontColor: "green", minSize: 10, text: ["Second marker"] },
      { id: 3, time: time - ONE_DAY_SEC * 4, color: "blue", label: "T", labelFontColor: "blue", minSize: 9, text: ["Third marker"] },
      { id: 4, time: time - ONE_DAY_SEC, color: "purple", label: "F", labelFontColor: "purple", minSize: 20, text: ["Fourth marker"] },
      { id: 5, time: time - ONE_DAY_SEC * 2, color: "orange", label: "O", labelFontColor: "orange", minSize: 21, text: ["Fifth marker"] },
    ]);
  },

  // Supplies example timescale markers for the tutorial overlay APIs.
  getTimescaleMarks(symbolInfo, from, to, onDataCallback, resolution) {
    const now = Date.now() / 1000;
    const ONE_DAY_SEC = 86_400;

    function fmt(sec) {
      const d = new Date(sec * 1000);
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yy = String(d.getUTCFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    }

    onDataCallback(
      Array.from({ length: 15 }, (_, i) => {
        const idx = i + 1;
        const t = now - ONE_DAY_SEC * idx;
        return {
          id: `tsm${idx}`,
          time: t,
          color: idx % 2 === 0 ? "#FFAA00" : "#089981",
          label: idx === 1 ? "A" : "B",
          labelFontColor: "#FFFFFF",
          imageUrl: ALIEN_MARKER_URL,
          tooltip: [fmt(t), "**Bitcoin logo**", "_Note_: Short-term volatility", "Source: Exchange data"],
        };
      }),
    );
  },

  // Returns a current quote snapshot for the requested symbol list.
  async getQuotes(symbols, onDataCallback, onErrorCallback) {
    try {
      const snapshots = await fetchQuoteSnapshots(symbols);

      const result = snapshots
        .map(({ symbol, quote }) => {
          if (!quote) return null;

          quotePriceCache.set(symbol, quote);
          return { n: symbol, s: "ok", v: quote };
        })
        .filter(Boolean);

      setTimeout(() => onDataCallback(result), 10);
    } catch (error) {
      console.error("[getQuotes] Error:", error);
      if (onErrorCallback) onErrorCallback(error);
    }
  },

  // Seeds quotes from REST once and then keeps them live with websocket ticker streams.
  subscribeQuotes(symbols, fastSymbols, onRealtimeCallback, listenerGUID) {
    const trackedSymbols = [...new Set([...symbols, ...fastSymbols])];
    fetchQuoteSnapshots(trackedSymbols)
      .then((snapshots) => {
        const initialQuotes = snapshots
          .map(({ symbol, quote }) => {
            if (!quote) return null;

            quotePriceCache.set(symbol, quote);
            return { s: "ok", n: symbol, v: quote };
          })
          .filter(Boolean);

        if (initialQuotes.length > 0) {
          onRealtimeCallback(initialQuotes);
        }
      })
      .catch((error) => {
        console.error("[subscribeQuotes] Bootstrap error:", error);
      });

    subscribeQuotesOnStream(trackedSymbols, listenerGUID, ({ symbol, type, payload }) => {
      const currentState = quoteTickerState.get(symbol) ?? { dayTicker: null, hourTicker: null };

      if (type === "day") {
        currentState.dayTicker = payload;
      } else if (type === "hour") {
        currentState.hourTicker = payload;
      }

      quoteTickerState.set(symbol, currentState);

      const quote = buildQuoteFromState(symbol, currentState, quotePriceCache.get(symbol) ?? null);
      quotePriceCache.set(symbol, quote);
      onRealtimeCallback([{ s: "ok", n: symbol, v: quote }]);
    });
  },

  // Tears down quote listeners that are no longer needed by the widget.
  unsubscribeQuotes(listenerGUID) {
    unsubscribeQuotesFromStream(listenerGUID);
    console.log("[unsubscribeQuotes] Stopped:", listenerGUID);
  },

  // temporary depth subscription
     subscribeDepth(symbol, callback) {
      const subscriptionUniqueId = this._createDepthSubscription(
        'https://myserver.com',
        symbol,
        callback
      );
      return subscriptionUniqueId;
    },

    unsubscribeDepth(listenerID) {
      this._removeDepthSubscription(listenerID);
    },

    _createDepthSubscription(server, symbol, callback) {
      // Create an uniqueID
      const uniqueId = Math.round(Math.random() * 10000000).toString(36);
      const latestPrice = 2378.6;

      // Mocked data, using setInterval to fake data updates
      const intervalId = setInterval(() => {
        const data = {
          snapshot: true,
          bids: generateDOMData(
            latestPrice + 0.05,
            latestPrice + 10,
            0.01,
            10000
          ),
          asks: generateDOMData(
            latestPrice - 0.05,
            latestPrice - 10,
            -0.01,
            10000
          )
        };
        callback(data);
      }, 1000);
      this._depthSubscriptions[uniqueId] = intervalId;
      return uniqueId;
    },

    _removeDepthSubscription(listenerID) {
      const intervalId = this._depthSubscriptions[listenerID];
      clearInterval(intervalId);
    }
};
  function generateDOMData(start, end, step, amount) {
    const answer = [];
    const steps = Math.abs((end - start) / step);

    let count = 0;
    for (let i = start; step < 0 ? i >= end : i <= end; i += step) {
      count += 1;
      answer.push({
        price: i,
        volume: (0.8 + 0.1 * Math.random()) * amount * ((steps - count) / steps)
      });
    }
    return answer;
  };