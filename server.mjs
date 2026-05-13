import http from "node:http";
import process from "node:process";
import handler from "serve-handler";

const COINDESK_RSS_URL = "https://www.coindesk.com/arc/outboundfeeds/rss/";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const NEWS_CACHE_TTL_MS = 60_000;

let cachedNewsResponse = null;

// Reuses the last RSS payload for a short window to avoid needless upstream fetches.
function isFreshCache(entry) {
  return entry && Date.now() - entry.updatedAt < NEWS_CACHE_TTL_MS;
}

// Fetches the latest CoinDesk RSS XML and keeps a short-lived in-memory cache.
async function fetchCoinDeskRss() {
  if (isFreshCache(cachedNewsResponse)) {
    return cachedNewsResponse;
  }

  const response = await fetch(COINDESK_RSS_URL, {
    headers: {
      "user-agent": "tv-charting-library-tutorial/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`CoinDesk RSS request failed with HTTP ${response.status}`);
  }

  cachedNewsResponse = {
    body: await response.text(),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    updatedAt: Date.now(),
  };

  return cachedNewsResponse;
}

// Writes the response headers TradingView needs to treat the proxy as an RSS feed.
function writeNewsHeaders(response, payload) {
  response.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=60");

  if (payload.etag) {
    response.setHeader("ETag", payload.etag);
  }

  if (payload.lastModified) {
    response.setHeader("Last-Modified", payload.lastModified);
  }
}

// Disables browser caching for local static assets so TradingView upgrades do not reuse stale chunks.
function writeStaticHeaders(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
}

// Serves the CoinDesk RSS feed from the app origin so the browser never hits CORS issues.
async function handleCoinDeskNews(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  try {
    const payload = await fetchCoinDeskRss();
    writeNewsHeaders(response, payload);
    response.writeHead(200);

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(payload.body);
  } catch (error) {
    console.error("[news proxy] Error:", error);
    response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unable to load CoinDesk RSS feed.");
  }
}

// Routes RSS proxy requests first and lets serve-handler manage every static asset.
async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`}`);

  if (url.pathname === "/api/news/coindesk-rss") {
    await handleCoinDeskNews(request, response);
    return;
  }

  if (url.pathname === "/") {
    request.url = "/index.html";
  }

  writeStaticHeaders(response);

  await handler(request, response, {
    public: ".",
    cleanUrls: false,
    directoryListing: false,
  });
}

const port = Number.parseInt(process.argv[2] ?? "", 10) || DEFAULT_PORT;
const host = process.argv[3] ?? DEFAULT_HOST;

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("[server] Unhandled error:", error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal Server Error");
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
