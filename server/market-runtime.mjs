const MFAPI_BASE = "https://api.mfapi.in";
const ALPHA_BASE = "https://www.alphavantage.co/query";
const TWELVE_BASE = "https://api.twelvedata.com";
const FINNHUB_BASE = "https://finnhub.io/api/v1";
const NSE_ARCHIVE_BASE = "https://nsearchives.nseindia.com/products/content";
const YAHOO_ENDPOINTS = [
  "https://query1.finance.yahoo.com/v7/finance/quote",
  "https://query2.finance.yahoo.com/v8/finance/quote",
];
const COINGECKO_SIMPLE = "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_SEARCH = "https://api.coingecko.com/api/v3/search";
const ALPHA_MIN_INTERVAL_MS = 1200;
const TWELVE_MIN_INTERVAL_MS = 150;
const FINNHUB_MIN_INTERVAL_MS = 1100;
const STOCK_QUOTE_MAX_AGE_DAYS = 10;
const CRYPTO_QUOTE_MAX_AGE_DAYS = 5;

let lastAlphaRequestAt = 0;
let lastTwelveRequestAt = 0;
let lastFinnhubRequestAt = 0;
const nseEodCache = new Map();

const COMMODITY_LIBRARY = [
  { id: "xauusd", kind: "commodity", symbol: "XAU/USD", name: "Gold", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "fx" },
  { id: "xagusd", kind: "commodity", symbol: "XAG/USD", name: "Silver", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "fx" },
  { id: "wti", kind: "commodity", symbol: "WTI", name: "Crude Oil (WTI)", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
  { id: "brent", kind: "commodity", symbol: "BRENT", name: "Crude Oil (Brent)", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
  { id: "naturalgas", kind: "commodity", symbol: "NATURAL_GAS", name: "Natural Gas", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
  { id: "copper", kind: "commodity", symbol: "COPPER", name: "Copper", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
];

const INDIAN_SYMBOL_ALIASES = {
  INFY: "INFY.NS",
  TCS: "TCS.NS",
  BSE: "BSE.NS",
  NSLNISP: "NSLNISP.NS",
  GOLDCASE: "GOLDCASE.NS",
  SILVERCASE: "SILVERCASE.NS",
  TTML: "TTML.NS",
};

const INDIAN_NAME_ALIASES = [
  [/infosys/i, "INFY.NS"],
  [/tata consultancy/i, "TCS.NS"],
  [/bse limited/i, "BSE.NS"],
  [/nmdc steel/i, "NSLNISP.NS"],
  [/gold etf/i, "GOLDCASE.NS"],
  [/silver etf/i, "SILVERCASE.NS"],
  [/tata teleservices/i, "TTML.NS"],
];

const CRYPTO_ID_ALIASES = {
  BTC: "bitcoin",
  XBT: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  XRP: "ripple",
  SOL: "solana",
  MATIC: "matic-network",
  DOGE: "dogecoin",
  ADA: "cardano",
  DOT: "polkadot",
  TRX: "tron",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  LTC: "litecoin",
};

const COMMODITY_YAHOO_SYMBOLS = {
  "XAU/USD": { symbol: "GC=F", currency: "USD", priceLabel: "Yahoo delayed futures" },
  "XAG/USD": { symbol: "SI=F", currency: "USD", priceLabel: "Yahoo delayed futures" },
  WTI: { symbol: "CL=F", currency: "USD", priceLabel: "Yahoo delayed futures" },
  BRENT: { symbol: "BZ=F", currency: "USD", priceLabel: "Yahoo delayed futures" },
  NATURAL_GAS: { symbol: "NG=F", currency: "USD", priceLabel: "Yahoo delayed futures" },
  COPPER: { symbol: "HG=F", currency: "USD", priceLabel: "Yahoo delayed futures" },
};

function toUrl(path, params = {}) {
  const url = new URL(path);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, value);
  });
  return url;
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMarketError(message) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  if (lower.includes("twelve data and finnhub did not return")) {
    return text;
  }
  if (
    lower.includes("alphavantage") ||
    lower.includes("alpha vantage") ||
    lower.includes("please consider spreading out your free api requests") ||
    lower.includes("rate limit")
  ) {
    return "Alpha Vantage free-tier limit was hit. Wait a bit and try again.";
  }
  if (
    lower.includes("twelve data") ||
    lower.includes("twelvedata") ||
    lower.includes("credits") ||
    lower.includes("api credits") ||
    lower.includes("too many requests")
  ) {
    return "Twelve Data free-tier limit was hit. Wait a bit and try again.";
  }
  if (
    lower.includes("finnhub") ||
    lower.includes("limit reached") ||
    lower.includes("rate limit exceeded")
  ) {
    return "Finnhub free-tier limit was hit. Wait a bit and try again.";
  }
  return text || "Refresh failed";
}

function normalizeFallbackFailure(failures = []) {
  const joined = failures.map((item) => String(item || "")).join(" | ").toLowerCase();
  if (joined.includes("alpha vantage free-tier limit")) {
    return "Twelve Data and Finnhub did not return a usable fresh quote, and the Alpha Vantage fallback hit its free-tier limit.";
  }
  if (joined.includes("stale quote")) {
    return "No provider returned a fresh market quote for this symbol right now.";
  }
  return "No provider returned a usable market quote for this symbol.";
}

function parseMarketDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFreshEnough(value, maxAgeDays) {
  const parsed = parseMarketDate(value);
  if (!parsed) return false;
  return Date.now() - parsed.getTime() <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function ensureFreshQuote(date, source, maxAgeDays) {
  if (!isFreshEnough(date, maxAgeDays)) {
    throw new Error(`${source} returned a stale quote.`);
  }
}

function readAlphaDailyPoint(payload) {
  const series = payload?.["Time Series (Daily)"];
  if (!series || typeof series !== "object") {
    const message = payload?.Note || payload?.Information || payload?.["Error Message"];
    throw new Error(message || "Alpha Vantage did not return a daily price series.");
  }
  const [date] = Object.keys(series).sort((a, b) => new Date(b) - new Date(a));
  const point = series?.[date];
  const price = normalizeNumber(point?.["4. close"]);
  if (!date || !price) throw new Error("Latest stock close price is unavailable.");
  return { date, price };
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed with ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Finwise/1.0",
      "accept": "text/csv,text/plain,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed with ${res.status}`);
  }
  return res.text();
}

async function fetchCoinGeckoSimple(id, vsCurrencies = ["usd", "inr"]) {
  const url = toUrl(COINGECKO_SIMPLE, {
    ids: id,
    vs_currencies: vsCurrencies.join(","),
    include_last_updated_at: "true",
  });
  return fetchJson(url);
}

async function wait(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAlphaJson(params) {
  const elapsed = Date.now() - lastAlphaRequestAt;
  if (elapsed < ALPHA_MIN_INTERVAL_MS) {
    await wait(ALPHA_MIN_INTERVAL_MS - elapsed);
  }
  lastAlphaRequestAt = Date.now();
  const data = await fetchJson(toUrl(ALPHA_BASE, params));
  const throttleMessage = data?.Note || data?.Information || "";
  if (typeof throttleMessage === "string" && throttleMessage.toLowerCase().includes("please consider spreading out your api requests")) {
    throw new Error(normalizeMarketError(throttleMessage));
  }
  return data;
}

async function fetchTwelveJson(path, params) {
  const elapsed = Date.now() - lastTwelveRequestAt;
  if (elapsed < TWELVE_MIN_INTERVAL_MS) {
    await wait(TWELVE_MIN_INTERVAL_MS - elapsed);
  }
  lastTwelveRequestAt = Date.now();
  const data = await fetchJson(toUrl(`${TWELVE_BASE}${path}`, params));
  if (data?.status === "error") {
    throw new Error(normalizeMarketError(data?.message || "Twelve Data request failed"));
  }
  return data;
}

async function fetchFinnhubJson(path, params) {
  const elapsed = Date.now() - lastFinnhubRequestAt;
  if (elapsed < FINNHUB_MIN_INTERVAL_MS) {
    await wait(FINNHUB_MIN_INTERVAL_MS - elapsed);
  }
  lastFinnhubRequestAt = Date.now();
  const data = await fetchJson(toUrl(`${FINNHUB_BASE}${path}`, params));
  if (data?.error) {
    throw new Error(normalizeMarketError(data.error));
  }
  return data;
}

async function fetchYahooQuotes(symbols) {
  const joined = Array.isArray(symbols) ? symbols.join(",") : String(symbols || "");
  for (const endpoint of YAHOO_ENDPOINTS) {
    try {
      const url = toUrl(endpoint, { symbols: joined });
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 Finwise/1.0",
          accept: "application/json,text/plain,*/*",
        },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) continue;
      const results = data?.quoteResponse?.result;
      if (Array.isArray(results) && results.length) return results;
    } catch {}
  }
  return [];
}

async function fetchYahooChartQuote(symbol) {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const url = toUrl(endpoint, { range: "5d", interval: "1d" });
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Finwise/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Yahoo chart request failed with ${res.status}`);
  }
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  for (let i = closes.length - 1; i >= 0; i -= 1) {
    const price = normalizeNumber(closes[i]);
    const timestamp = timestamps[i];
    if (price > 0 && timestamp) {
      return {
        price,
        date: new Date(Number(timestamp) * 1000).toISOString().slice(0, 10),
      };
    }
  }
  throw new Error("Yahoo chart did not return a usable close.");
}

function normalizeCryptoId(symbol, name = "") {
  const original = String(symbol || "").trim();
  const originalLower = original.toLowerCase();
  if (originalLower.startsWith("coingecko:")) {
    return originalLower.replace("coingecko:", "").trim();
  }
  if (/^[a-z0-9-]+$/.test(originalLower) && originalLower.includes("-")) {
    return originalLower;
  }
  const upper = original.toUpperCase();
  const base = upper.includes("/")
    ? upper.split("/")[0]
    : upper.includes(":")
      ? upper.split(":").pop().replace(/USDT$|USD$|INR$/i, "")
      : upper.replace(/USDT$|USD$|INR$/i, "");
  if (CRYPTO_ID_ALIASES[base]) return CRYPTO_ID_ALIASES[base];
  const title = String(name || "").toLowerCase();
  for (const [ticker, id] of Object.entries(CRYPTO_ID_ALIASES)) {
    if (title.includes(id.replace(/-/g, " ")) || title.includes(ticker.toLowerCase())) {
      return id;
    }
  }
  return "";
}

function providerAvailability() {
  return {
    alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
    twelveData: Boolean(process.env.TWELVE_DATA_API_KEY),
    finnhub: Boolean(process.env.FINNHUB_API_KEY),
  };
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function parseCsvRow(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out.map((value) => value.replace(/^"(.*)"$/, "$1").trim());
}

function formatArchiveDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

function recentBusinessDates(limit = 7) {
  const dates = [];
  const cursor = new Date();
  for (let i = 0; dates.length < limit && i < 12; i += 1) {
    const next = new Date(cursor);
    next.setDate(cursor.getDate() - i);
    const day = next.getDay();
    if (day !== 0 && day !== 6) dates.push(next);
  }
  return dates;
}

async function loadNseEodForDate(date) {
  const stamp = formatArchiveDate(date);
  if (nseEodCache.has(stamp)) return nseEodCache.get(stamp);
  const fileUrl = `${NSE_ARCHIVE_BASE}/sec_bhavdata_full_${stamp}.csv`;
  const csv = await fetchText(fileUrl);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("Official NSE EOD file was empty.");
  const header = parseCsvRow(lines[0]);
  const symbolIdx = header.findIndex((item) => item.toUpperCase() === "SYMBOL");
  const closeIdx = header.findIndex((item) => item.toUpperCase() === "CLOSE_PRICE");
  const dateIdx = header.findIndex((item) => item.toUpperCase() === "DATE1");
  if (symbolIdx < 0 || closeIdx < 0) throw new Error("Official NSE EOD file format changed.");
  const rows = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseCsvRow(line);
    const symbol = String(cells[symbolIdx] || "").trim().toUpperCase();
    const closePrice = normalizeNumber(cells[closeIdx]);
    const priceDate = String(cells[dateIdx] || "").trim();
    if (!symbol || !closePrice) continue;
    rows.set(symbol, { price: closePrice, date: priceDate });
  }
  nseEodCache.set(stamp, rows);
  return rows;
}

async function fetchOfficialNseClose(symbol) {
  const baseSymbol = String(symbol || "").trim().toUpperCase().replace(/(\.NS|:NSE|\.NSE)$/i, "");
  if (!baseSymbol) throw new Error("Missing NSE symbol.");
  const failures = [];
  for (const date of recentBusinessDates(7)) {
    try {
      const rows = await loadNseEodForDate(date);
      const hit = rows.get(baseSymbol);
      if (hit?.price) {
        return {
          date: hit.date || date.toISOString().slice(0, 10),
          price: hit.price,
        };
      }
    } catch (error) {
      failures.push(error.message || "Official NSE EOD fetch failed");
    }
  }
  throw new Error(failures.length ? "Official NSE daily close was not available for this symbol." : "Official NSE daily close was not available for this symbol.");
}

function stockSymbolCandidates(symbol) {
  const raw = String(symbol || "").trim().toUpperCase();
  if (!raw) return [];
  if (raw.includes(":NSE")) {
    const base = raw.replace(":NSE", "");
    return unique([`${base}.NS`, `${base}:NSE`, `${base}.NSE`, base]);
  }
  if (raw.includes(":BSE")) {
    const base = raw.replace(":BSE", "");
    return unique([`${base}.BO`, `${base}:BSE`, `${base}.BSE`, base]);
  }
  if (raw.endsWith(".BSE")) {
    const base = raw.slice(0, -4);
    return unique([`${base}.BO`, `${base}:BSE`, `${base}.BSE`, base]);
  }
  if (raw.endsWith(".NSE")) {
    const base = raw.slice(0, -4);
    return unique([`${base}.NS`, `${base}:NSE`, `${base}.NSE`, base]);
  }
  if (raw.endsWith(".NS") || raw.endsWith(".BO")) {
    const base = raw.slice(0, -3);
    return raw.endsWith(".NS")
      ? unique([raw, `${base}:NSE`, `${base}.NSE`, base])
      : unique([raw, `${base}:BSE`, `${base}.BSE`, base]);
  }
  if (!raw.includes(":") && !raw.includes(".") && /^[A-Z0-9-]+$/.test(raw)) {
    return unique([`${raw}.NS`, `${raw}:NSE`, `${raw}.NSE`, `${raw}.BO`, `${raw}:BSE`, `${raw}.BSE`, raw]);
  }
  return [raw];
}

function canonicalIndianSymbol(holding) {
  const raw = String(holding?.quoteSymbol || holding?.symbol || "").trim().toUpperCase();
  if (INDIAN_SYMBOL_ALIASES[raw]) return INDIAN_SYMBOL_ALIASES[raw];
  const name = String(holding?.name || "");
  for (const [pattern, symbol] of INDIAN_NAME_ALIASES) {
    if (pattern.test(name)) return symbol;
  }
  return "";
}

function isLikelyIndianHolding(holding) {
  const symbol = String(holding?.quoteSymbol || holding?.symbol || "").toUpperCase();
  const account = String(holding?.account || "").toLowerCase();
  return (
    symbol.includes(".NS") ||
    symbol.includes(".BO") ||
    symbol.includes(".NSE") ||
    symbol.includes(".BSE") ||
    symbol.includes(":NSE") ||
    symbol.includes(":BSE") ||
    account.includes("zerodha") ||
    account.includes("groww") ||
    account.includes("upstox") ||
    account.includes("angel") ||
    account.includes("indmoney")
  );
}

function buildStockSearchError() {
  return "Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to search and refresh stock holdings.";
}

function buildCryptoSearchError() {
  return "Crypto search is unavailable right now. Try a coin name or ticker again in a moment.";
}

async function searchStocksWithTwelve(q) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return [];
  const data = await fetchTwelveJson("/symbol_search", {
    symbol: q,
    outputsize: 8,
    apikey: apiKey,
  });
  return (Array.isArray(data?.data) ? data.data : [])
    .filter((item) => ["Common Stock", "ETF", "ETP"].includes(item.instrument_type) || item.currency || item.exchange)
    .slice(0, 8)
    .map((item) => ({
      id: item.symbol,
      kind: "stock",
      symbol: item.symbol,
      name: item.instrument_name || item.symbol,
      exchange: item.exchange || item.country || "Global",
      currency: item.currency || "USD",
      source: "twelve-data",
    }));
}

async function searchCryptoWithTwelve(q) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return [];
  const data = await fetchTwelveJson("/symbol_search", {
    symbol: q,
    outputsize: 8,
    apikey: apiKey,
  });
  return (Array.isArray(data?.data) ? data.data : [])
    .filter((item) => item.instrument_type === "Cryptocurrency" || String(item.exchange || "").toLowerCase().includes("crypto"))
    .slice(0, 8)
    .map((item) => ({
      id: item.symbol,
      kind: "crypto",
      symbol: item.symbol,
      name: item.instrument_name || item.symbol,
      exchange: item.exchange || "Crypto",
      currency: item.currency || "USD",
      source: "twelve-data",
    }));
}

async function searchCryptoWithCoinGecko(q) {
  const data = await fetchJson(toUrl(COINGECKO_SEARCH, { query: q }));
  const coins = Array.isArray(data?.coins) ? data.coins : [];
  return coins
    .slice()
    .sort((a, b) => {
      const rankA = Number(a?.market_cap_rank || Number.MAX_SAFE_INTEGER);
      const rankB = Number(b?.market_cap_rank || Number.MAX_SAFE_INTEGER);
      return rankA - rankB;
    })
    .slice(0, 20)
    .map((coin) => {
      const ticker = String(coin?.symbol || "").trim().toUpperCase();
      const id = String(coin?.id || "").trim().toLowerCase();
      return {
        id: `coingecko:${id}`,
        kind: "crypto",
        symbol: ticker ? `${ticker}/USD` : id,
        quoteSymbol: `coingecko:${id}`,
        name: coin?.name || ticker || id,
        exchange: coin?.market_cap_rank ? `CoinGecko rank #${coin.market_cap_rank}` : "CoinGecko",
        currency: "USD",
        source: "coingecko",
      };
    })
    .filter((item) => item.quoteSymbol !== "coingecko:");
}

async function searchAnyWithFinnhub(q, kind) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  const data = await fetchFinnhubJson("/search", { q, token: apiKey });
  const bucket = Array.isArray(data?.result) ? data.result : [];
  return bucket
    .filter((item) => {
      const text = `${item.type || ""} ${item.symbol || ""} ${item.description || ""}`.toLowerCase();
      return kind === "crypto"
        ? text.includes("crypto") || text.includes("coin") || text.includes("binance") || text.includes("kraken")
        : !text.includes("crypto");
    })
    .slice(0, 8)
    .map((item) => ({
      id: item.symbol,
      kind,
      symbol: item.symbol,
      name: item.description || item.symbol,
      exchange: item.type || "Global",
      currency: "USD",
      source: "finnhub",
    }));
}

async function searchAnyWithAlpha(q, kind) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];
  const data = await fetchAlphaJson({
    function: "SYMBOL_SEARCH",
    keywords: q,
    apikey: apiKey,
  });
  return (data?.bestMatches || [])
    .filter((item) => {
      const type = String(item["3. type"] || "").toLowerCase();
      return kind === "crypto" ? type.includes("crypto") : !type.includes("crypto");
    })
    .slice(0, 8)
    .map((item) => ({
      id: item["1. symbol"],
      kind,
      symbol: item["1. symbol"],
      name: item["2. name"],
      exchange: item["4. region"] || item["3. type"] || "Global",
      currency: item["8. currency"] || "USD",
      matchScore: normalizeNumber(item["9. matchScore"]),
      source: "alpha-vantage",
    }));
}

function searchCommodityLibrary(q) {
  const needle = q.toLowerCase();
  return COMMODITY_LIBRARY.filter((item) => `${item.name} ${item.symbol}`.toLowerCase().includes(needle)).slice(0, 8);
}

export async function searchMarketInstruments(kind, query) {
  const q = (query || "").trim();
  if (!q) return [];

  if (kind === "mutualFund") {
    const url = toUrl(`${MFAPI_BASE}/mf/search`, { q });
    const data = await fetchJson(url);
    return (Array.isArray(data) ? data : []).slice(0, 8).map((item) => ({
      id: String(item.schemeCode),
      kind: "mutualFund",
      name: item.schemeName,
      schemeCode: String(item.schemeCode),
      symbol: "",
      exchange: "AMFI",
      currency: "INR",
      source: "mfapi",
    }));
  }

  if (kind === "commodity") {
    return searchCommodityLibrary(q);
  }

  const providers = providerAvailability();
  if (kind === "crypto") {
    const tries = [
      () => searchCryptoWithCoinGecko(q),
      () => searchCryptoWithTwelve(q),
      () => searchAnyWithFinnhub(q, "crypto"),
      () => searchAnyWithAlpha(q, "crypto"),
    ];
    const failures = [];
    for (const run of tries) {
      try {
        const results = await run();
        if (results.length) return results;
      } catch (error) {
        failures.push(error?.message || "Search provider failed");
      }
    }
    if (!providers.twelveData && !providers.finnhub && !providers.alphaVantage && failures.length) {
      throw new Error(buildCryptoSearchError());
    }
    return [];
  }

  if (!providers.twelveData && !providers.finnhub && !providers.alphaVantage) {
    throw new Error(buildStockSearchError());
  }
  const tries = [
    () => searchStocksWithTwelve(q),
    () => searchAnyWithFinnhub(q, "stock"),
    () => searchAnyWithAlpha(q, "stock"),
  ];
  for (const run of tries) {
    try {
      const results = await run();
      if (results.length) return results;
    } catch {}
  }
  return [];
}

async function refreshMutualFundHolding(holding) {
  const schemeCode = String(holding.schemeCode || "").trim();
  if (!schemeCode) throw new Error(`Missing scheme code for ${holding.name || "mutual fund holding"}`);
  const url = toUrl(`${MFAPI_BASE}/mf/${encodeURIComponent(schemeCode)}/latest`);
  const data = await fetchJson(url);
  const navPoint = data?.data?.[0];
  const nav = normalizeNumber(navPoint?.nav);
  if (!nav) throw new Error(`Latest NAV unavailable for ${holding.name || schemeCode}`);
  const units = normalizeNumber(holding.units);
  const investedValue = units * normalizeNumber(holding.costPerUnit);
  const currentValue = units * nav;
  return {
    ...holding,
    currentPrice: nav,
    priceDate: navPoint?.date || "",
    currentValue,
    investedValue,
    gainLoss: currentValue - investedValue,
    currency: "INR",
    source: "mfapi",
    priceLabel: "Latest NAV",
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

async function refreshStockHolding(holding) {
  const symbol = String(holding.quoteSymbol || holding.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error(`Missing symbol for ${holding.name || "stock holding"}`);
  let latest;
  let source = "";
  let resolvedSymbol = canonicalIndianSymbol(holding) || symbol;
  const candidates = unique([
    ...stockSymbolCandidates(resolvedSymbol),
    ...stockSymbolCandidates(symbol),
  ]);
  const likelyIndian = isLikelyIndianHolding(holding);
  const nonRawCandidates = candidates.filter((candidate) => candidate !== symbol || candidate.includes(".") || candidate.includes(":"));
  const failures = [];
  if (likelyIndian && candidates.some((candidate) => candidate.endsWith(".NS") || candidate.includes(":NSE") || candidate.endsWith(".NSE"))) {
    try {
      const officialSymbol =
        candidates.find((candidate) => candidate.endsWith(".NS")) ||
        candidates.find((candidate) => candidate.includes(":NSE")) ||
        candidates.find((candidate) => candidate.endsWith(".NSE")) ||
        resolvedSymbol;
      latest = await fetchOfficialNseClose(officialSymbol);
      source = "nse-official-eod";
      resolvedSymbol = officialSymbol;
    } catch (error) {
      failures.push(error.message || "Official NSE EOD failed");
    }
  }
  if (!latest && process.env.TWELVE_DATA_API_KEY) {
    let twelveResolved = false;
    for (const candidate of likelyIndian ? nonRawCandidates : candidates) {
      try {
        const data = await fetchTwelveJson("/time_series", {
          symbol: candidate,
          interval: "1day",
          outputsize: 1,
          apikey: process.env.TWELVE_DATA_API_KEY,
        });
        const point = Array.isArray(data?.values) ? data.values[0] : null;
        const price = normalizeNumber(point?.close);
        if (price) {
          ensureFreshQuote(point?.datetime, "Twelve Data", STOCK_QUOTE_MAX_AGE_DAYS);
          latest = { date: point?.datetime || "", price };
          source = "twelve-data";
          resolvedSymbol = candidate;
          twelveResolved = true;
          break;
        }
      } catch (error) {
        failures.push(error.message || "Twelve Data failed");
      }
    }
    if (!twelveResolved && !latest) failures.push("Twelve Data did not return a usable quote.");
  }
  if (!latest && likelyIndian) {
    const yahooSymbols = unique(candidates.flatMap((candidate) => stockSymbolCandidates(candidate)).filter((candidate) => candidate.endsWith(".NS") || candidate.endsWith(".BO")));
    try {
      const quotes = await fetchYahooQuotes(yahooSymbols);
      const usable = Array.isArray(quotes)
        ? quotes.find((quote) => Number.isFinite(Number(quote?.regularMarketPrice)) && Number(quote?.regularMarketPrice) > 0)
        : null;
      if (usable) {
        const quoteDate = usable?.regularMarketTime ? new Date(Number(usable.regularMarketTime) * 1000).toISOString() : new Date().toISOString();
        ensureFreshQuote(quoteDate, "Yahoo Finance", STOCK_QUOTE_MAX_AGE_DAYS);
        latest = { date: quoteDate.slice(0, 10), price: Number(usable.regularMarketPrice) };
        source = "yahoo-finance";
        resolvedSymbol = usable.symbol || resolvedSymbol;
      } else {
        failures.push("Yahoo Finance did not return a usable quote.");
      }
    } catch (error) {
      failures.push(error.message || "Yahoo Finance failed");
    }
  }
  if (!latest && process.env.FINNHUB_API_KEY && !likelyIndian) {
    let finnhubResolved = false;
    for (const candidate of candidates) {
      try {
        const data = await fetchFinnhubJson("/quote", {
          symbol: candidate,
          token: process.env.FINNHUB_API_KEY,
        });
        const price = normalizeNumber(data?.c);
        if (price) {
          latest = { date: new Date().toISOString().slice(0, 10), price };
          source = "finnhub";
          resolvedSymbol = candidate;
          finnhubResolved = true;
          break;
        }
      } catch (error) {
        failures.push(error.message || "Finnhub failed");
      }
    }
    if (!finnhubResolved && !latest) failures.push("Finnhub did not return a usable quote.");
  }
  if (!latest && !likelyIndian) {
    const yahooSymbols = unique(candidates.flatMap((candidate) => stockSymbolCandidates(candidate)).filter((candidate) => candidate.endsWith(".NS") || candidate.endsWith(".BO")));
    try {
      const quotes = await fetchYahooQuotes(yahooSymbols);
      const usable = Array.isArray(quotes)
        ? quotes.find((quote) => Number.isFinite(Number(quote?.regularMarketPrice)) && Number(quote?.regularMarketPrice) > 0)
        : null;
      if (usable) {
        const quoteDate = usable?.regularMarketTime ? new Date(Number(usable.regularMarketTime) * 1000).toISOString() : new Date().toISOString();
        ensureFreshQuote(quoteDate, "Yahoo Finance", STOCK_QUOTE_MAX_AGE_DAYS);
        latest = { date: quoteDate.slice(0, 10), price: Number(usable.regularMarketPrice) };
        source = "yahoo-finance";
        resolvedSymbol = usable.symbol || resolvedSymbol;
      } else {
        failures.push("Yahoo Finance did not return a usable quote.");
      }
    } catch (error) {
      failures.push(error.message || "Yahoo Finance failed");
    }
  }
  if (!latest) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) throw new Error("Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to refresh stock holdings.");
    try {
      const data = await fetchAlphaJson({
        function: "TIME_SERIES_DAILY",
        symbol,
        outputsize: "compact",
        apikey: apiKey,
      });
      latest = readAlphaDailyPoint(data);
      ensureFreshQuote(latest.date, "Alpha Vantage", STOCK_QUOTE_MAX_AGE_DAYS);
      source = "alpha-vantage";
    } catch (error) {
      failures.push(error.message || "Alpha Vantage failed");
    }
  }
  if (!latest) {
    throw new Error(normalizeFallbackFailure(failures));
  }
  const units = normalizeNumber(holding.units);
  const investedValue = units * normalizeNumber(holding.costPerUnit);
  const currentValue = units * latest.price;
  return {
    ...holding,
    quoteSymbol: resolvedSymbol,
    currentPrice: latest.price,
    priceDate: latest.date,
    currentValue,
    investedValue,
    gainLoss: currentValue - investedValue,
    currency: likelyIndian ? "INR" : (holding.currency || "USD"),
    source,
    priceLabel: source === "finnhub" ? "Latest quote" : source === "nse-official-eod" ? "Official NSE close" : "Latest close",
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

async function refreshCryptoHolding(holding) {
  const lookupSymbol = String(holding.quoteSymbol || holding.symbol || "").trim();
  const normalizedLookup = lookupSymbol.toUpperCase();
  const displaySymbol = String(holding.symbol || lookupSymbol || "").trim().toUpperCase();
  if (!lookupSymbol) throw new Error(`Missing symbol for ${holding.name || "crypto holding"}`);
  let latest;
  let source = "";
  const failures = [];
  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      const data = await fetchTwelveJson("/time_series", {
        symbol: normalizedLookup,
        interval: "1day",
        outputsize: 1,
        apikey: process.env.TWELVE_DATA_API_KEY,
      });
      const point = Array.isArray(data?.values) ? data.values[0] : null;
      const price = normalizeNumber(point?.close);
      if (price) {
        ensureFreshQuote(point?.datetime, "Twelve Data", CRYPTO_QUOTE_MAX_AGE_DAYS);
        latest = { date: point?.datetime || "", price };
        source = "twelve-data";
      }
    } catch (error) {
      failures.push(error.message || "Twelve Data failed");
    }
  }
  if (!latest && process.env.FINNHUB_API_KEY) {
    try {
      const data = await fetchFinnhubJson("/quote", {
        symbol: normalizedLookup,
        token: process.env.FINNHUB_API_KEY,
      });
      const price = normalizeNumber(data?.c);
      if (price) {
        latest = { date: new Date().toISOString().slice(0, 10), price };
        source = "finnhub";
      }
    } catch (error) {
      failures.push(error.message || "Finnhub failed");
    }
  }
  if (!latest && process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      const data = await fetchAlphaJson({
        function: "DIGITAL_CURRENCY_DAILY",
        symbol: normalizedLookup.split("/")[0],
        market: normalizedLookup.split("/")[1] || "USD",
        apikey: process.env.ALPHA_VANTAGE_API_KEY,
      });
      const series = data?.["Time Series (Digital Currency Daily)"];
      if (series && typeof series === "object") {
        const [date] = Object.keys(series).sort((a, b) => new Date(b) - new Date(a));
        const point = series?.[date];
        const market = normalizedLookup.split("/")[1] || "USD";
        const price = normalizeNumber(point?.[`4b. close (${market})`] || point?.["4a. close (USD)"]);
        if (date && price) {
          ensureFreshQuote(date, "Alpha Vantage", CRYPTO_QUOTE_MAX_AGE_DAYS);
          latest = { date, price };
          source = "alpha-vantage";
        }
      }
    } catch (error) {
      failures.push(error.message || "Alpha Vantage failed");
    }
  }
  if (!latest) {
    try {
      const coinId = normalizeCryptoId(lookupSymbol, holding?.name);
      if (coinId) {
        const data = await fetchCoinGeckoSimple(coinId, ["usd", "inr"]);
        const point = data?.[coinId];
        const market = displaySymbol.includes("/INR") || normalizedLookup.includes("/INR") ? "INR" : "USD";
        const price = normalizeNumber(market === "INR" ? point?.inr : point?.usd);
        const updatedAt = point?.last_updated_at
          ? new Date(Number(point.last_updated_at) * 1000).toISOString()
          : new Date().toISOString();
        if (price) {
          latest = { date: updatedAt.slice(0, 10), price };
          source = "coingecko";
        }
      }
    } catch (error) {
      failures.push(error.message || "CoinGecko failed");
    }
  }
  if (!latest) {
    throw new Error(process.env.TWELVE_DATA_API_KEY || process.env.FINNHUB_API_KEY || process.env.ALPHA_VANTAGE_API_KEY ? normalizeFallbackFailure(failures) : "Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to refresh crypto holdings.");
  }
  const units = normalizeNumber(holding.units);
  const investedValue = units * normalizeNumber(holding.costPerUnit);
  const currentValue = units * latest.price;
  return {
    ...holding,
    symbol: displaySymbol || normalizedLookup,
    quoteSymbol: holding.quoteSymbol || lookupSymbol,
    currentPrice: latest.price,
    priceDate: latest.date,
    currentValue,
    investedValue,
    gainLoss: currentValue - investedValue,
    currency: displaySymbol.includes("/INR") || normalizedLookup.includes("/INR") ? "INR" : "USD",
    source,
    priceLabel: source === "finnhub" ? "Latest quote" : source === "coingecko" ? "CoinGecko spot" : "Latest close",
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

async function refreshCommodityHolding(holding) {
  const symbol = String(holding.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error(`Missing symbol for ${holding.name || "commodity holding"}`);
  let latest = null;
  let priceLabel = "Latest close";
  let source = "";
  const failures = [];
  if (process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      if (symbol === "XAU/USD" || symbol === "XAG/USD") {
        const [fromCurrency, toCurrency] = symbol.split("/");
        const data = await fetchAlphaJson({
          function: "CURRENCY_EXCHANGE_RATE",
          from_currency: fromCurrency,
          to_currency: toCurrency,
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        });
        const quote = data?.["Realtime Currency Exchange Rate"];
        const price = normalizeNumber(quote?.["5. Exchange Rate"]);
        const date = quote?.["6. Last Refreshed"] || new Date().toISOString();
        if (!price) throw new Error(`Latest commodity price unavailable for ${holding.name || symbol}`);
        latest = { date, price };
        priceLabel = "Latest FX-derived spot";
        source = "alpha-vantage";
      } else {
        const data = await fetchAlphaJson({
          function: symbol,
          interval: "daily",
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        });
        const rows = Array.isArray(data?.data) ? data.data : [];
        const point = rows[0];
        const price = normalizeNumber(point?.value);
        if (!price) throw new Error(`Latest commodity price unavailable for ${holding.name || symbol}`);
        latest = { date: point?.date || "", price };
        priceLabel = "Latest commodity print";
        source = "alpha-vantage";
      }
    } catch (error) {
      failures.push(error.message || "Alpha Vantage failed");
    }
  }
  if (!latest) {
    try {
      const yahooMeta = COMMODITY_YAHOO_SYMBOLS[symbol];
      if (yahooMeta) {
        const quotes = await fetchYahooQuotes([yahooMeta.symbol]);
        const usable = Array.isArray(quotes)
          ? quotes.find((quote) => Number.isFinite(Number(quote?.regularMarketPrice)) && Number(quote?.regularMarketPrice) > 0)
          : null;
        if (!usable) throw new Error(`Yahoo did not return a commodity quote for ${symbol}`);
        const quoteDate = usable?.regularMarketTime
          ? new Date(Number(usable.regularMarketTime) * 1000).toISOString()
          : new Date().toISOString();
        latest = { date: quoteDate.slice(0, 10), price: Number(usable.regularMarketPrice) };
        priceLabel = yahooMeta.priceLabel;
        source = "yahoo-finance";
      }
    } catch (error) {
      failures.push(error.message || "Yahoo Finance failed");
    }
  }
  if (!latest) {
    try {
      const yahooMeta = COMMODITY_YAHOO_SYMBOLS[symbol];
      if (yahooMeta) {
        const chart = await fetchYahooChartQuote(yahooMeta.symbol);
        if (!chart?.price) throw new Error(`Yahoo chart did not return a commodity close for ${symbol}`);
        latest = { date: chart.date, price: chart.price };
        priceLabel = "Yahoo delayed close";
        source = "yahoo-finance-chart";
      }
    } catch (error) {
      failures.push(error.message || "Yahoo Finance chart failed");
    }
  }
  if (!latest) {
    if (!process.env.ALPHA_VANTAGE_API_KEY && !COMMODITY_YAHOO_SYMBOLS[symbol]) {
      throw new Error("No commodity provider is configured for this symbol yet.");
    }
    throw new Error(normalizeFallbackFailure(failures));
  }
  const units = normalizeNumber(holding.units);
  const investedValue = units * normalizeNumber(holding.costPerUnit);
  const currentValue = units * latest.price;
  return {
    ...holding,
    symbol,
    currentPrice: latest.price,
    priceDate: latest.date,
    currentValue,
    investedValue,
    gainLoss: currentValue - investedValue,
    currency: "USD",
    source,
    priceLabel,
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

export async function refreshMarketHoldings(holdings = []) {
  if (!Array.isArray(holdings) || !holdings.length) {
    return {
      holdings: [],
      summary: {
        totalValue: 0,
        totalInvested: 0,
        totalGainLoss: 0,
        lastRefreshAt: "",
      },
      results: [],
    };
  }

  const providers = providerAvailability();
  const stockLikeCount = holdings.filter((item) => ["stock", "crypto"].includes(item.kind)).length;
  if (!providers.twelveData && !providers.finnhub && stockLikeCount > 20) {
    throw new Error("Free Alpha Vantage usage is tight. Keep stock refresh batches to 20 holdings or fewer per day.");
  }

  const refreshed = [];
  const results = [];
  for (const holding of holdings) {
    try {
      const next =
        holding.kind === "mutualFund"
          ? await refreshMutualFundHolding(holding)
          : holding.kind === "crypto"
            ? await refreshCryptoHolding(holding)
            : holding.kind === "commodity"
              ? await refreshCommodityHolding(holding)
              : await refreshStockHolding(holding);
      refreshed.push(next);
      results.push({ id: holding.id, ok: true, name: next.name || next.symbol, priceDate: next.priceDate });
    } catch (error) {
      const units = normalizeNumber(holding.units);
      const investedValue = normalizeNumber(holding.investedValue || units * normalizeNumber(holding.costPerUnit));
      const preservedCurrentValue = normalizeNumber(holding.currentValue);
      const preservedCurrentPrice = normalizeNumber(holding.currentPrice);
      const nextCurrentValue = preservedCurrentValue || 0;
      refreshed.push({
        ...holding,
        quoteSymbol: canonicalIndianSymbol(holding) || holding.quoteSymbol || holding.symbol || "",
        currency: holding.currency || (isLikelyIndianHolding(holding) ? "INR" : "USD"),
        currentPrice: preservedCurrentPrice,
        currentValue: nextCurrentValue,
        investedValue,
        gainLoss: nextCurrentValue - investedValue,
        priceDate: holding.priceDate || "",
        priceLabel: holding.priceLabel || (preservedCurrentPrice > 0 ? "Last known close" : ""),
        source: holding.source || "",
        refreshError: normalizeMarketError(error.message),
        refreshedAt: new Date().toISOString(),
      });
      results.push({ id: holding.id, ok: false, name: holding.name || holding.symbol, error: normalizeMarketError(error.message) });
    }
  }

  const totalValue = refreshed.reduce((sum, item) => sum + normalizeNumber(item.currentValue), 0);
  const totalInvested = refreshed.reduce((sum, item) => sum + normalizeNumber(item.investedValue || normalizeNumber(item.units) * normalizeNumber(item.costPerUnit)), 0);
  return {
    holdings: refreshed,
    summary: {
      totalValue,
      totalInvested,
      totalGainLoss: totalValue - totalInvested,
      lastRefreshAt: new Date().toISOString(),
      successful: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
    },
    results,
  };
}

export async function fetchUsdInrFx() {
  if (process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      const data = await fetchAlphaJson({
        function: "CURRENCY_EXCHANGE_RATE",
        from_currency: "USD",
        to_currency: "INR",
        apikey: process.env.ALPHA_VANTAGE_API_KEY,
      });
      const quote = data?.["Realtime Currency Exchange Rate"];
      const rate = normalizeNumber(quote?.["5. Exchange Rate"]);
      if (rate) {
        return {
          base: "USD",
          quote: "INR",
          rate,
          asOf: quote?.["6. Last Refreshed"] || new Date().toISOString(),
          source: "alpha-vantage",
        };
      }
    } catch {}
  }
  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      const data = await fetchTwelveJson("/exchange_rate", {
        symbol: "USD/INR",
        apikey: process.env.TWELVE_DATA_API_KEY,
      });
      const rate = normalizeNumber(data?.rate);
      if (rate) {
        return {
          base: "USD",
          quote: "INR",
          rate,
          asOf: data?.timestamp ? new Date(Number(data.timestamp) * 1000).toISOString() : new Date().toISOString(),
          source: "twelve-data",
        };
      }
    } catch {}
  }
  return {
    base: "USD",
    quote: "INR",
    rate: 83,
    asOf: "",
    source: "fallback",
  };
}
