const MFAPI_BASE = "https://api.mfapi.in";
const ALPHA_BASE = "https://www.alphavantage.co/query";
const ALPHA_MIN_INTERVAL_MS = 1200;

let lastAlphaRequestAt = 0;

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

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
  const data = await fetchAlphaJson({
    function: "SYMBOL_SEARCH",
    keywords: q,
    apikey: apiKey,
  });
  return (data?.bestMatches || []).slice(0, 8).map((item) => ({
    id: item["1. symbol"],
    kind: "stock",
    symbol: item["1. symbol"],
    name: item["2. name"],
    exchange: item["4. region"] || item["3. type"] || "Global",
    currency: item["8. currency"] || "USD",
    matchScore: normalizeNumber(item["9. matchScore"]),
    source: "alpha-vantage",
  }));
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
  };
}

async function refreshStockHolding(holding) {
  const symbol = String(holding.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error(`Missing symbol for ${holding.name || "stock holding"}`);
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
  const data = await fetchAlphaJson({
    function: "TIME_SERIES_DAILY",
    symbol,
    outputsize: "compact",
    apikey: apiKey,
  });
  const latest = readAlphaDailyPoint(data);
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
    priceLabel: "Latest close",
    refreshedAt: new Date().toISOString(),
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

  const stockCount = holdings.filter((item) => item.kind === "stock").length;
  if (stockCount > 20) {
    throw new Error("Free Alpha Vantage usage is tight. Keep stock refresh batches to 20 holdings or fewer per day.");
  }

  const refreshed = [];
  const results = [];
  for (const holding of holdings) {
    try {
      const next =
        holding.kind === "mutualFund"
          ? await refreshMutualFundHolding(holding)
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
