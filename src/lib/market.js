export async function searchMarketInstruments(kind, query) {
  const url = new URL("/api/market/search", window.location.origin);
  url.searchParams.set("kind", kind);
  url.searchParams.set("q", query);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not search instruments");
  return data.results || [];
}

export async function refreshMarketHoldings(holdings) {
  const res = await fetch("/api/market/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holdings }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not refresh holdings");
  return data;
}

export async function fetchMarketFx() {
  const res = await fetch("/api/market/fx");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not fetch FX rates");
  return data;
}

const COMMODITY_RESCUE_MAP = {
  "XAU/USD": { symbol: "GC=F", currency: "USD", label: "Yahoo delayed futures" },
  "XAG/USD": { symbol: "SI=F", currency: "USD", label: "Yahoo delayed futures" },
  WTI: { symbol: "CL=F", currency: "USD", label: "Yahoo delayed futures" },
  BRENT: { symbol: "BZ=F", currency: "USD", label: "Yahoo delayed futures" },
  NATURAL_GAS: { symbol: "NG=F", currency: "USD", label: "Yahoo delayed futures" },
  COPPER: { symbol: "HG=F", currency: "USD", label: "Yahoo delayed futures" },
};

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function likelyIndianHolding(item) {
  const symbol = String(item?.quoteSymbol || item?.symbol || "").toUpperCase();
  const account = String(item?.account || "").toLowerCase();
  return (
    item?.kind === "stock" &&
    (
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
    )
  );
}

function yahooSymbolsForHolding(item) {
  const raw = String(item?.quoteSymbol || item?.symbol || "").trim().toUpperCase();
  if (!raw) return [];
  if (raw.endsWith(".NS") || raw.endsWith(".BO")) return [raw];
  if (raw.endsWith(".NSE")) return [raw.replace(".NSE", ".NS")];
  if (raw.endsWith(".BSE")) return [raw.replace(".BSE", ".BO")];
  if (raw.includes(":NSE")) return [raw.replace(":NSE", ".NS")];
  if (raw.includes(":BSE")) return [raw.replace(":BSE", ".BO")];
  if (!raw.includes(".") && !raw.includes(":")) return [`${raw}.NS`, `${raw}.BO`];
  return [raw];
}

async function fetchYahooQuotes(symbols) {
  for (const endpoint of [
    "https://query1.finance.yahoo.com/v8/finance/quote",
    "https://query1.finance.yahoo.com/v7/finance/quote",
    "https://query2.finance.yahoo.com/v8/finance/quote",
  ]) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("symbols", symbols.join(","));
      const res = await fetch(url.toString());
      const data = await res.json();
      const results = data?.quoteResponse?.result;
      if (Array.isArray(results) && results.length) return results;
    } catch {}
  }
  return [];
}

function yahooCommoditySymbol(item) {
  const raw = String(item?.symbol || item?.quoteSymbol || "").trim().toUpperCase();
  return COMMODITY_RESCUE_MAP[raw] || null;
}

export async function rescueIndianHoldingsQuotes(holdings) {
  const targets = (holdings || []).filter((item) => likelyIndianHolding(item) && item.refreshError);
  if (!targets.length) return holdings;

  const symbolMap = new Map();
  const symbols = unique(
    targets.flatMap((item) => {
      const syms = yahooSymbolsForHolding(item);
      syms.forEach((sym) => symbolMap.set(sym, item.id));
      return syms;
    })
  );
  if (!symbols.length) return holdings;

  const quotes = await fetchYahooQuotes(symbols);
  if (!quotes.length) return holdings;

  const byHoldingId = new Map();
  quotes.forEach((quote) => {
    const price = Number(quote?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    const holdingId = symbolMap.get(String(quote.symbol || "").toUpperCase());
    if (!holdingId || byHoldingId.has(holdingId)) return;
    byHoldingId.set(holdingId, quote);
  });

  return holdings.map((item) => {
    const quote = byHoldingId.get(item.id);
    if (!quote) return item;
    const currentPrice = Number(quote.regularMarketPrice || 0);
    const units = Number(item.units || 0);
    const investedValue = Number(item.investedValue || units * Number(item.costPerUnit || 0));
    const currentValue = units * currentPrice;
    const quoteDate = quote?.regularMarketTime
      ? new Date(Number(quote.regularMarketTime) * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return {
      ...item,
      quoteSymbol: quote.symbol || item.quoteSymbol || item.symbol,
      currency: item.currency || "INR",
      currentPrice,
      currentValue,
      gainLoss: currentValue - investedValue,
      priceDate: quoteDate,
      priceLabel: "Yahoo close/last",
      source: "yahoo-finance-browser",
      refreshedAt: new Date().toISOString(),
      refreshError: "",
    };
  });
}

export async function rescueCommodityQuotes(holdings) {
  const targets = (holdings || []).filter((item) => item?.kind === "commodity" && item.refreshError);
  if (!targets.length) return holdings;

  const symbolMap = new Map();
  const yahooSymbols = unique(
    targets.flatMap((item) => {
      const meta = yahooCommoditySymbol(item);
      if (!meta) return [];
      symbolMap.set(meta.symbol, item.id);
      return [meta.symbol];
    })
  );
  if (!yahooSymbols.length) return holdings;

  const quotes = await fetchYahooQuotes(yahooSymbols);
  if (!quotes.length) return holdings;

  const byHoldingId = new Map();
  quotes.forEach((quote) => {
    const price = Number(quote?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    const holdingId = symbolMap.get(String(quote.symbol || "").toUpperCase());
    if (!holdingId || byHoldingId.has(holdingId)) return;
    byHoldingId.set(holdingId, quote);
  });

  return holdings.map((item) => {
    const quote = byHoldingId.get(item.id);
    if (!quote) return item;
    const meta = yahooCommoditySymbol(item);
    const currentPrice = Number(quote.regularMarketPrice || 0);
    const units = Number(item.units || 0);
    const investedValue = Number(item.investedValue || units * Number(item.costPerUnit || 0));
    const currentValue = units * currentPrice;
    const quoteDate = quote?.regularMarketTime
      ? new Date(Number(quote.regularMarketTime) * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return {
      ...item,
      currency: meta?.currency || item.currency || "USD",
      currentPrice,
      currentValue,
      gainLoss: currentValue - investedValue,
      priceDate: quoteDate,
      priceLabel: meta?.label || "Yahoo delayed quote",
      source: "yahoo-finance-browser",
      refreshedAt: new Date().toISOString(),
      refreshError: "",
    };
  });
}
