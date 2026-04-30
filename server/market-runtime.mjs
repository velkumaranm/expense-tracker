const MFAPI_BASE = "https://api.mfapi.in";
const ALPHA_BASE = "https://www.alphavantage.co/query";
const TWELVE_BASE = "https://api.twelvedata.com";
const FINNHUB_BASE = "https://finnhub.io/api/v1";
const ALPHA_MIN_INTERVAL_MS = 1200;
const TWELVE_MIN_INTERVAL_MS = 150;
const FINNHUB_MIN_INTERVAL_MS = 1100;

let lastAlphaRequestAt = 0;
let lastTwelveRequestAt = 0;
let lastFinnhubRequestAt = 0;

const COMMODITY_LIBRARY = [
  { id: "xauusd", kind: "commodity", symbol: "XAU/USD", name: "Gold", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "fx" },
  { id: "xagusd", kind: "commodity", symbol: "XAG/USD", name: "Silver", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "fx" },
  { id: "wti", kind: "commodity", symbol: "WTI", name: "Crude Oil (WTI)", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
  { id: "brent", kind: "commodity", symbol: "BRENT", name: "Crude Oil (Brent)", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
  { id: "naturalgas", kind: "commodity", symbol: "NATURAL_GAS", name: "Natural Gas", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
  { id: "copper", kind: "commodity", symbol: "COPPER", name: "Copper", exchange: "Global", currency: "USD", source: "alpha-vantage", refreshMode: "alpha-commodity" },
];

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

function stockSymbolCandidates(symbol) {
  const raw = String(symbol || "").trim().toUpperCase();
  if (!raw) return [];
  if (raw.endsWith(".BSE")) {
    const base = raw.slice(0, -4);
    return unique([`${base}:BSE`, `${base}.BSE`, base]);
  }
  if (raw.endsWith(".NSE")) {
    const base = raw.slice(0, -4);
    return unique([`${base}:NSE`, `${base}.NSE`, base]);
  }
  return [raw];
}

function buildStockSearchError() {
  return "Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to search and refresh stock holdings.";
}

function buildCryptoSearchError() {
  return "Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to search and refresh crypto holdings.";
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
    if (!providers.twelveData && !providers.finnhub && !providers.alphaVantage) {
      throw new Error(buildCryptoSearchError());
    }
    const tries = [
      () => searchCryptoWithTwelve(q),
      () => searchAnyWithFinnhub(q, "crypto"),
      () => searchAnyWithAlpha(q, "crypto"),
    ];
    for (const run of tries) {
      try {
        const results = await run();
        if (results.length) return results;
      } catch {}
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
    source: "mfapi",
    priceLabel: "Latest NAV",
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

async function refreshStockHolding(holding) {
  const symbol = String(holding.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error(`Missing symbol for ${holding.name || "stock holding"}`);
  let latest;
  let source = "";
  let resolvedSymbol = symbol;
  const candidates = stockSymbolCandidates(symbol);
  if (process.env.TWELVE_DATA_API_KEY) {
    for (const candidate of candidates) {
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
          latest = { date: point?.datetime || "", price };
          source = "twelve-data";
          resolvedSymbol = candidate;
          break;
        }
      } catch {}
    }
  }
  if (!latest && process.env.FINNHUB_API_KEY) {
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
          break;
        }
      } catch {}
    }
  }
  if (!latest) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) throw new Error("Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to refresh stock holdings.");
    const data = await fetchAlphaJson({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "compact",
      apikey: apiKey,
    });
    latest = readAlphaDailyPoint(data);
    source = "alpha-vantage";
  }
  const units = normalizeNumber(holding.units);
  const investedValue = units * normalizeNumber(holding.costPerUnit);
  const currentValue = units * latest.price;
  return {
    ...holding,
    symbol: resolvedSymbol,
    currentPrice: latest.price,
    priceDate: latest.date,
    currentValue,
    investedValue,
    gainLoss: currentValue - investedValue,
    source,
    priceLabel: source === "finnhub" ? "Latest quote" : "Latest close",
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

async function refreshCryptoHolding(holding) {
  const symbol = String(holding.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error(`Missing symbol for ${holding.name || "crypto holding"}`);
  let latest;
  let source = "";
  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      const data = await fetchTwelveJson("/time_series", {
        symbol,
        interval: "1day",
        outputsize: 1,
        apikey: process.env.TWELVE_DATA_API_KEY,
      });
      const point = Array.isArray(data?.values) ? data.values[0] : null;
      const price = normalizeNumber(point?.close);
      if (price) {
        latest = { date: point?.datetime || "", price };
        source = "twelve-data";
      }
    } catch {}
  }
  if (!latest && process.env.FINNHUB_API_KEY) {
    try {
      const data = await fetchFinnhubJson("/quote", {
        symbol,
        token: process.env.FINNHUB_API_KEY,
      });
      const price = normalizeNumber(data?.c);
      if (price) {
        latest = { date: new Date().toISOString().slice(0, 10), price };
        source = "finnhub";
      }
    } catch {}
  }
  if (!latest && process.env.ALPHA_VANTAGE_API_KEY) {
    const data = await fetchAlphaJson({
      function: "DIGITAL_CURRENCY_DAILY",
      symbol: symbol.split("/")[0],
      market: symbol.split("/")[1] || "USD",
      apikey: process.env.ALPHA_VANTAGE_API_KEY,
    });
    const series = data?.["Time Series (Digital Currency Daily)"];
    if (series && typeof series === "object") {
      const [date] = Object.keys(series).sort((a, b) => new Date(b) - new Date(a));
      const point = series?.[date];
      const market = symbol.split("/")[1] || "USD";
      const price = normalizeNumber(point?.[`4b. close (${market})`] || point?.["4a. close (USD)"]);
      if (date && price) {
        latest = { date, price };
        source = "alpha-vantage";
      }
    }
  }
  if (!latest) {
    throw new Error("Configure TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY to refresh crypto holdings.");
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
    source,
    priceLabel: source === "finnhub" ? "Latest quote" : "Latest close",
    refreshedAt: new Date().toISOString(),
    refreshError: "",
  };
}

async function refreshCommodityHolding(holding) {
  const symbol = String(holding.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error(`Missing symbol for ${holding.name || "commodity holding"}`);
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY is required to refresh commodity holdings.");
  }
  let latest = null;
  let priceLabel = "Latest close";
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
    source: "alpha-vantage",
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
      refreshed.push({
        ...holding,
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
