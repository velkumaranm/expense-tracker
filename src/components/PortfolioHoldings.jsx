import { useEffect, useMemo, useState } from "react";
import { refreshMarketHoldings, rescueCommodityQuotes, rescueIndianHoldingsQuotes, searchMarketInstruments } from "../lib/market";
import { convertAmount, fmtINR, fmtMoney, goalId } from "../lib/utils";
import { useI18n } from "../lib/i18n";

const emptyForm = {
  kind: "stock",
  name: "",
  symbol: "",
  quoteSymbol: "",
  currency: "INR",
  schemeCode: "",
  units: "",
  costPerUnit: "",
  account: "",
  acquiredOn: "",
  sector: "",
  monthlyContribution: "",
  targetWeight: "",
  realizedGain: "",
};

function normalizeHoldingError(message) {
  const text = String(message || "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (
    lower.includes("alphavantage") ||
    lower.includes("alpha vantage") ||
    lower.includes("please consider spreading out your free api requests") ||
    lower.includes("rate limit")
  ) {
    return "Alpha Vantage free-tier limit was hit. Wait a bit and try again.";
  }
  return text;
}

const KIND_OPTIONS = [
  { id: "stock", label: "Stock / ETF" },
  { id: "mutualFund", label: "Mutual Fund" },
  { id: "crypto", label: "Crypto" },
  { id: "commodity", label: "Commodity" },
];

function kindLabel(kind) {
  if (kind === "mutualFund") return "Mutual Fund";
  if (kind === "crypto") return "Crypto";
  if (kind === "commodity") return "Commodity";
  return "Stock";
}

function translatedKindLabel(kind, t) {
  if (kind === "mutualFund") return t("market.kindFund", "Mutual Fund");
  if (kind === "crypto") return t("market.kindCrypto", "Crypto");
  if (kind === "commodity") return t("market.kindCommodity", "Commodity");
  return t("market.kindStockShort", "Stock");
}

function searchPlaceholder(kind, t) {
  if (kind === "mutualFund") return t("market.searchFundPlaceholder", "Search fund by name, e.g. HDFC Flexi Cap");
  if (kind === "crypto") return t("market.searchCryptoPlaceholder", "Search crypto pair or coin, e.g. BTC/USD");
  if (kind === "commodity") return t("market.searchCommodityPlaceholder", "Search gold, silver, WTI, Brent...");
  return t("market.searchPlaceholder", "Search stock or type symbol like RELIANCE.BSE");
}

function symbolLabel(kind, t) {
  if (kind === "mutualFund") return t("market.schemeCode", "Scheme Code");
  if (kind === "crypto") return t("market.cryptoSymbol", "Crypto Symbol");
  if (kind === "commodity") return t("market.commoditySymbol", "Commodity Symbol");
  return t("market.stockSymbol", "Stock Symbol");
}

function symbolPlaceholder(kind) {
  if (kind === "mutualFund") return "125497";
  if (kind === "crypto") return "BTC/USD or BINANCE:BTCUSDT";
  if (kind === "commodity") return "XAU/USD, WTI, BRENT";
  return "RELIANCE.BSE or AAPL";
}

function quoteSymbolPlaceholder(kind) {
  if (kind === "crypto") return "BTCUSD, BINANCE:BTCUSDT";
  if (kind === "commodity") return "XAU/USD or WTI";
  return "INFY.NS, TCS.NS, BSE.NS";
}

const INDIAN_QUOTE_SYMBOL_ALIASES = {
  INFY: "INFY.NS",
  TCS: "TCS.NS",
  BSE: "BSE.NS",
  NSLNISP: "NSLNISP.NS",
  GOLDCASE: "GOLDCASE.NS",
  SILVERCASE: "SILVERCASE.NS",
  TTML: "TTML.NS",
};

function suggestQuoteSymbol(kind, name, symbol) {
  if (kind !== "stock") return String(symbol || "").trim().toUpperCase();
  const raw = String(symbol || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes(".") || raw.includes(":")) return raw;
  if (INDIAN_QUOTE_SYMBOL_ALIASES[raw]) return INDIAN_QUOTE_SYMBOL_ALIASES[raw];
  const title = String(name || "");
  if (/infosys/i.test(title)) return "INFY.NS";
  if (/tata consultancy/i.test(title)) return "TCS.NS";
  if (/bse limited/i.test(title)) return "BSE.NS";
  if (/nmdc steel/i.test(title)) return "NSLNISP.NS";
  if (/gold etf/i.test(title)) return "GOLDCASE.NS";
  if (/silver etf/i.test(title)) return "SILVERCASE.NS";
  if (/tata teleservices/i.test(title)) return "TTML.NS";
  return raw;
}

function normalizeStockSelection(item) {
  const kind = item?.kind || "stock";
  const rawSymbol = String(item?.symbol || "").trim().toUpperCase();
  const rawExchange = String(item?.exchange || "").trim().toUpperCase();
  if (kind !== "stock" || !rawSymbol) {
    return {
      symbol: rawSymbol,
      quoteSymbol:
        kind === "crypto"
          ? String(item?.quoteSymbol || rawSymbol || "").trim()
          : String(item?.quoteSymbol || rawSymbol || "").trim().toUpperCase(),
    };
  }
  if (rawSymbol.includes(".") || rawSymbol.includes(":") || rawSymbol.includes("=") || rawSymbol.includes("/")) {
    return {
      symbol: rawSymbol,
      quoteSymbol: String(item?.quoteSymbol || rawSymbol).trim().toUpperCase(),
    };
  }
  const exchangeLooksNse =
    rawExchange.includes("NSE") ||
    rawExchange.includes("NATIONAL STOCK EXCHANGE") ||
    rawExchange.includes("INDIA");
  const exchangeLooksBse =
    rawExchange.includes("BSE") ||
    rawExchange.includes("BOMBAY STOCK EXCHANGE");
  if (exchangeLooksNse) {
    const symbol = `${rawSymbol}.NS`;
    return { symbol, quoteSymbol: symbol };
  }
  if (exchangeLooksBse) {
    const symbol = `${rawSymbol}.BO`;
    return { symbol, quoteSymbol: symbol };
  }
  const suggested = suggestQuoteSymbol(kind, item?.name || "", rawSymbol);
  return {
    symbol: rawSymbol,
    quoteSymbol: String(item?.quoteSymbol || suggested || rawSymbol).trim().toUpperCase(),
  };
}

function toLocalStamp(iso, t) {
  if (!iso) return t("market.notRefreshedYet", "Not refreshed yet");
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function getDisplayPrice(item) {
  const live = Number(item.currentPrice || 0);
  if (live > 0) return fmtINR(live);
  const cost = Number(item.costPerUnit || 0);
  if (cost > 0) return `${fmtINR(cost)} avg`;
  return "Pending refresh";
}

function getDisplayValue(item) {
  const value = Number(item.currentValue || 0);
  if (value > 0) return fmtINR(value);
  const invested = Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0));
  return invested > 0 ? fmtINR(invested) : fmtINR(0);
}

function getAverageCost(item) {
  const cost = Number(item.costPerUnit || 0);
  if (cost > 0) return fmtINR(cost);
  const units = Number(item.units || 0);
  const invested = Number(item.investedValue || 0);
  return units > 0 && invested > 0 ? fmtINR(invested / units) : fmtINR(0);
}

function isIndianHolding(item) {
  const symbol = String(item?.quoteSymbol || item?.symbol || "").toUpperCase();
  const account = String(item?.account || "").toLowerCase();
  const source = String(item?.source || "").toLowerCase();
  return (
    item?.kind === "mutualFund" ||
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
    source.includes("nse-official-eod") ||
    source.includes("mfapi")
  );
}

function isGlobalQuoteHolding(item) {
  const symbol = String(item?.quoteSymbol || item?.symbol || "").toUpperCase();
  const source = String(item?.source || "").toLowerCase();
  const account = String(item?.account || "").toLowerCase();
  return (
    !isIndianHolding(item) &&
    (
      source.includes("twelve-data") ||
      source.includes("finnhub") ||
      source.includes("alpha-vantage") ||
      source.includes("alpaca") ||
      source.includes("yahoo-finance") ||
      account.includes("alpaca") ||
      account.includes("ibkr") ||
      account.includes("interactive brokers") ||
      account.includes("robinhood") ||
      account.includes("etrade") ||
      account.includes("charles schwab") ||
      account.includes("fidelity") ||
      /^[A-Z0-9.-]+$/.test(symbol)
    )
  );
}

function holdingCurrency(item) {
  const explicit = String(item?.currency || "").toUpperCase();
  if (item?.kind === "mutualFund") return "INR";
  if (isIndianHolding(item)) return "INR";
  if (explicit === "USD") return "USD";
  if (explicit === "INR" && isGlobalQuoteHolding(item)) return "USD";
  if (explicit && explicit !== "INR") return explicit;
  if (!item?.kind || item?.kind === "stock" || item?.kind === "crypto" || item?.kind === "commodity") return "USD";
  return explicit || "INR";
}

function defaultCurrencyForDraft(form) {
  if (form?.kind === "mutualFund") return "INR";
  const quote = String(form?.quoteSymbol || form?.symbol || "").toUpperCase();
  const account = String(form?.account || "").toLowerCase();
  const looksIndian =
    quote.includes(".NS") ||
    quote.includes(".BO") ||
    quote.includes(".NSE") ||
    quote.includes(".BSE") ||
    quote.includes(":NSE") ||
    quote.includes(":BSE") ||
    account.includes("zerodha") ||
    account.includes("groww") ||
    account.includes("upstox") ||
    account.includes("angel") ||
    account.includes("indmoney");
  return looksIndian ? "INR" : "USD";
}

function displayAmount(amount, fromCurrency, viewCurrency, fx) {
  const source = String(fromCurrency || "INR").toUpperCase();
  const view = String(viewCurrency || "INR").toUpperCase();
  const converted = convertAmount(amount, source, view, fx);
  return fmtMoney(converted, view);
}

function displayAmountBoth(amount, fromCurrency, fx) {
  const source = String(fromCurrency || "INR").toUpperCase();
  const primary = fmtMoney(amount, source);
  const secondaryCurrency = source === "INR" ? "USD" : "INR";
  const converted = convertAmount(amount, source, secondaryCurrency, fx);
  return `${primary} (${fmtMoney(converted, secondaryCurrency)})`;
}

export default function PortfolioHoldings({
  holdings,
  setHoldings,
  snapshots,
  setSnapshots,
  marketProviders,
  marketDisplayCurrency,
  setMarketDisplayCurrency,
  marketFx,
  showToast,
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(emptyForm);
  const [searchState, setSearchState] = useState({ query: "", loading: false, error: "", results: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const largePortfolio = holdings.length >= 20;
  const holdingsSignature = useMemo(
    () =>
      JSON.stringify(
        [...holdings]
          .map((item) => ({
            id: item.id,
            kind: item.kind,
            symbol: item.symbol || "",
            schemeCode: item.schemeCode || "",
            quoteSymbol: item.quoteSymbol || "",
            units: Number(item.units || 0),
            costPerUnit: Number(item.costPerUnit || 0),
          }))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      ),
    [holdings]
  );

  const summary = useMemo(() => {
    const totalInvested = holdings.reduce(
      (sum, item) =>
        sum +
        convertAmount(
          Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)),
          holdingCurrency(item),
          marketDisplayCurrency === "USD" ? "USD" : "INR",
          marketFx
        ),
      0
    );
    const totalValue = holdings.reduce(
      (sum, item) =>
        sum +
        convertAmount(
          Number(item.currentValue || 0),
          holdingCurrency(item),
          marketDisplayCurrency === "USD" ? "USD" : "INR",
          marketFx
        ),
      0
    );
    const lastRefreshAt = holdings
      .map((item) => item.refreshedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || "";
    const errors = holdings.filter((item) => item.refreshError).length;
    return {
      totalInvested,
      totalValue,
      gainLoss: totalValue - totalInvested,
      lastRefreshAt,
      errors,
    };
  }, [holdings, marketDisplayCurrency, marketFx]);

  const recentSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [snapshots]
  );

  useEffect(() => {
    setSnapshots((prev) => {
      const filtered = (prev || []).filter((item) => item.signature && item.signature === holdingsSignature);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [holdingsSignature, setSnapshots]);

  const formatHoldingAmount = (amount, item) => {
    const sourceCurrency = holdingCurrency(item);
    if (marketDisplayCurrency === "BOTH") {
      return displayAmountBoth(amount, sourceCurrency, marketFx);
    }
    return displayAmount(amount, sourceCurrency, marketDisplayCurrency, marketFx);
  };

  const formatHoldingPrice = (amount, item) => {
    const sourceCurrency = holdingCurrency(item);
    if (marketDisplayCurrency === "BOTH") {
      return displayAmountBoth(amount, sourceCurrency, marketFx);
    }
    return displayAmount(amount, sourceCurrency, marketDisplayCurrency, marketFx);
  };

  const applyResult = (item) => {
    const normalizedSelection = normalizeStockSelection(item);
    setForm((prev) => ({
      ...prev,
      kind: item.kind || prev.kind,
      name: item.name || prev.name,
      symbol: normalizedSelection.symbol || "",
      quoteSymbol:
        normalizedSelection.quoteSymbol ||
        suggestQuoteSymbol(item.kind || prev.kind, item.name || prev.name, item.symbol || "") ||
        "",
      currency: item.currency || defaultCurrencyForDraft({
        kind: item.kind || prev.kind,
        symbol: normalizedSelection.symbol || "",
        quoteSymbol:
          normalizedSelection.quoteSymbol ||
          suggestQuoteSymbol(item.kind || prev.kind, item.name || prev.name, item.symbol || "") ||
          "",
        account: item.account || "",
      }),
      schemeCode: item.schemeCode || "",
    }));
    setSearchState((prev) => ({ ...prev, results: [] }));
  };

  const beginEdit = (item) => {
    setEditingId(item.id);
    setForm({
      kind: item.kind || "stock",
      name: item.name || "",
      symbol: item.symbol || "",
      quoteSymbol: item.quoteSymbol || suggestQuoteSymbol(item.kind || "stock", item.name || "", item.symbol || "") || "",
      currency: item.currency || defaultCurrencyForDraft({
        kind: item.kind || "stock",
        symbol: item.symbol || "",
        quoteSymbol: item.quoteSymbol || suggestQuoteSymbol(item.kind || "stock", item.name || "", item.symbol || "") || "",
        account: item.account || "",
      }),
      schemeCode: item.schemeCode || "",
      units: String(item.units ?? ""),
      costPerUnit: String(item.costPerUnit ?? ""),
      account: item.account || "",
      acquiredOn: item.acquiredOn || "",
      sector: item.sector || "",
      monthlyContribution: String(item.monthlyContribution ?? ""),
      targetWeight: String(item.targetWeight ?? ""),
      realizedGain: String(item.realizedGain ?? ""),
    });
    setSearchState({ query: "", loading: false, error: "", results: [] });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(emptyForm);
    setSearchState({ query: "", loading: false, error: "", results: [] });
  };

  const runSearch = async () => {
    const query = searchState.query.trim();
    if (!query) return;
    setSearchState((prev) => ({ ...prev, loading: true, error: "", results: [] }));
    try {
      const results = await searchMarketInstruments(form.kind, query);
      setSearchState((prev) => ({ ...prev, loading: false, results }));
    } catch (error) {
      setSearchState((prev) => ({ ...prev, loading: false, error: error.message || "Search failed", results: [] }));
    }
  };

  const saveHolding = () => {
    if (!form.name || !form.units || !form.costPerUnit) return;
    if (["stock", "crypto", "commodity"].includes(form.kind) && !form.symbol) return;
    if (form.kind === "mutualFund" && !form.schemeCode) return;
    const resolvedQuoteSymbol =
      form.kind === "crypto"
        ? form.quoteSymbol.trim() || suggestQuoteSymbol(form.kind, form.name, form.symbol)
        : form.quoteSymbol.trim().toUpperCase() || suggestQuoteSymbol(form.kind, form.name, form.symbol);
    const normalized = {
      kind: form.kind,
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      quoteSymbol: resolvedQuoteSymbol,
      currency: defaultCurrencyForDraft({
        ...form,
        quoteSymbol: resolvedQuoteSymbol,
      }),
      schemeCode: form.schemeCode.trim(),
      units: Number(form.units),
      costPerUnit: Number(form.costPerUnit),
      account: form.account.trim(),
      acquiredOn: form.acquiredOn || new Date().toISOString().slice(0, 10),
      sector: form.sector.trim(),
      monthlyContribution: Number(form.monthlyContribution || 0),
      targetWeight: Number(form.targetWeight || 0),
      realizedGain: Number(form.realizedGain || 0),
      investedValue: Number(form.units) * Number(form.costPerUnit),
    };

    if (editingId) {
      setHoldings((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...normalized,
                gainLoss: Number(item.currentValue || 0) - normalized.investedValue,
                refreshError: "",
              }
            : item
        )
      );
      setSnapshots([]);
      showToast(t("market.updatedToast", "Holding updated. Refresh once if you want a fresh market quote."));
    } else {
      setHoldings((prev) => [
        {
          id: goalId(),
          ...normalized,
          currentPrice: 0,
          currentValue: 0,
          gainLoss: 0,
          priceDate: "",
          refreshedAt: "",
          refreshError: "",
          priceLabel: "",
          source: "",
          acquiredOn: normalized.acquiredOn,
        },
        ...prev,
      ]);
      setSnapshots([]);
      showToast(t("market.addedToast", "Holding added. Refresh once to fetch the latest price."));
    }

    setEditingId("");
    setForm((prev) => ({ ...emptyForm, kind: prev.kind }));
    setSearchState({ query: "", loading: false, error: "", results: [] });
  };

  const removeHolding = (id) => {
    setHoldings((prev) => prev.filter((item) => item.id !== id));
    setSnapshots([]);
    showToast(t("market.removedToast", "Holding removed. Snapshot history cleared so it can rebuild from your current portfolio."), "warning");
  };

  const doRefresh = async () => {
    if (!holdings.length) return;
    setRefreshing(true);
    try {
      const hydratedPayload = await refreshMarketHoldings(
        holdings.map((item) => ({
          ...item,
          quoteSymbol: item.quoteSymbol || suggestQuoteSymbol(item.kind, item.name, item.symbol),
        }))
      );
      const withIndianRescue = await rescueIndianHoldingsQuotes(hydratedPayload.holdings || []);
      const rescuedHoldings = await rescueCommodityQuotes(withIndianRescue);
      setHoldings(rescuedHoldings);
      const stamp = hydratedPayload.summary?.lastRefreshAt || new Date().toISOString();
      const snapshotDate = stamp.slice(0, 10);
      const totalValue = rescuedHoldings.reduce(
        (sum, item) => sum + convertAmount(Number(item.currentValue || 0), holdingCurrency(item), "INR", marketFx),
        0
      );
      const totalInvested = rescuedHoldings.reduce(
        (sum, item) =>
          sum + convertAmount(
            Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)),
            holdingCurrency(item),
            "INR",
            marketFx
          ),
        0
      );
      const failedCount = rescuedHoldings.filter((item) => item.refreshError).length;
      const snapshot = {
        date: snapshotDate,
        refreshedAt: stamp,
        totalValue,
        totalInvested,
        gainLoss: totalValue - totalInvested,
        signature: holdingsSignature,
      };
      setSnapshots((prev) => {
        const filtered = prev.filter((item) => item.date !== snapshotDate);
        return [snapshot, ...filtered].slice(0, 30);
      });
      showToast(
        failedCount
          ? `${t("market.refreshedWithAttention", "Prices refreshed.")} ${failedCount} ${failedCount > 1 ? t("market.holdingPlural", "holdings") : t("market.holdingSingular", "holding")} ${t("market.needAttentionSuffix", "still need attention.")}`
          : t("market.refreshedToast", "Portfolio prices refreshed.")
      );
    } catch (error) {
      showToast(error.message || t("market.refreshFailed", "Could not refresh prices."), "error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="section-card">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div>
          <h3>{t("market.title", "Market Holdings")}</h3>
          <p style={{ marginBottom: 0 }}>
            {t("market.subtitle", "Track market holdings separately from the cash-flow ledger, then refresh quotes whenever you need.")}
          </p>
        </div>
        <div className="goal-head-actions">
          <div className="tab2" style={{ minWidth: 220 }}>
            {["INR", "USD", "BOTH"].map((option) => (
              <button
                key={option}
                className={`tab2-btn ${marketDisplayCurrency === option ? "active" : ""}`}
                onClick={() => setMarketDisplayCurrency(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <span className="status-pill neutral">{holdings.length} {holdings.length === 1 ? t("market.holdingSingular", "holding") : t("market.holdingPlural", "holdings")}</span>
          <button className="btn-primary" disabled={!holdings.length || refreshing} onClick={doRefresh}>
            {refreshing ? t("market.refreshing", "Refreshing...") : t("market.refresh", "Refresh Prices")}
          </button>
        </div>
      </div>

      {holdings.length ? (
        <div className="muted" style={{ marginBottom: 12, textAlign: "left" }}>
          {refreshing
            ? `${t("market.refreshingCountPrefix", "Refreshing")} ${holdings.length} ${holdings.length === 1 ? t("market.holdingSingular", "holding") : t("market.holdingPlural", "holdings")} ${t("market.refreshingCountSuffix", "now. Large batches can take a little longer.")}`
            : largePortfolio
              ? `${t("market.largePortfolioPrefix", "This portfolio has")} ${holdings.length} ${t("market.largePortfolioSuffix", "holdings. The list has its own scroll area.")}`
              : t("market.refreshHint", "Refresh quotes whenever you need.")}
        </div>
      ) : null}

      <div className="mini-grid" style={{ marginBottom: 14 }}>
        <div className="mini-card">
          <div className="k">{t("market.investedValue", "Invested Value")}</div>
          <div className="v">{marketDisplayCurrency === "BOTH" ? `${fmtMoney(summary.totalInvested, "INR")} (${fmtMoney(convertAmount(summary.totalInvested, "INR", "USD", marketFx), "USD")})` : fmtMoney(summary.totalInvested, marketDisplayCurrency)}</div>
          <div className="muted">{t("market.unitsMultipliedSub", "Units multiplied by your average cost per unit.")}</div>
        </div>
        <div className="mini-card">
          <div className="k">{t("market.currentValue", "Current Value")}</div>
          <div className="v" style={{ color: "var(--invest)" }}>{marketDisplayCurrency === "BOTH" ? `${fmtMoney(summary.totalValue, "INR")} (${fmtMoney(convertAmount(summary.totalValue, "INR", "USD", marketFx), "USD")})` : fmtMoney(summary.totalValue, marketDisplayCurrency)}</div>
          <div className="muted">{t("market.latestValueSub", "Latest fetched market value from the current holdings set.")}</div>
        </div>
        <div className="mini-card">
          <div className="k">{t("market.unrealized", "Unrealized P&L")}</div>
          <div className="v" style={{ color: summary.gainLoss >= 0 ? "var(--income)" : "var(--expense)" }}>
            {summary.gainLoss >= 0 ? "+" : "-"}{marketDisplayCurrency === "BOTH" ? `${fmtMoney(Math.abs(summary.gainLoss), "INR")} (${fmtMoney(convertAmount(Math.abs(summary.gainLoss), "INR", "USD", marketFx), "USD")})` : fmtMoney(Math.abs(summary.gainLoss), marketDisplayCurrency)}
          </div>
          <div className="muted">
            {t("market.lastRefresh", "Last refresh")}: {toLocalStamp(summary.lastRefreshAt, t)}
          </div>
        </div>
      </div>

      <div className="portfolio-panel" style={{ marginBottom: 16 }}>
        <div className="portfolio-grid">
          <div>
            <div className="fl" style={{ marginBottom: 8 }}>{t("market.instrumentType", "Instrument Type")}</div>
            <div className="tab2" style={{ marginBottom: 10 }}>
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`tab2-btn ${form.kind === option.id ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, kind: option.id, symbol: "", schemeCode: "" }))}
                >
                  {t(`market.kind.${option.id}`, option.label)}
                </button>
              ))}
            </div>

            <div className="setting-row" style={{ alignItems: "stretch", marginBottom: 10 }}>
              <input
                className="setting-input"
                placeholder={searchPlaceholder(form.kind, t)}
                value={searchState.query}
                onChange={(e) => setSearchState((prev) => ({ ...prev, query: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              <button className="btn-secondary" onClick={runSearch} disabled={searchState.loading}>
                {searchState.loading ? t("market.searching", "Searching...") : t("common.search", "Search")}
              </button>
            </div>

            {searchState.error && <div className="auth-error" style={{ marginBottom: 10 }}>{searchState.error}</div>}

            {!!searchState.results.length && (
              <div className="stack" style={{ marginBottom: 12 }}>
                {searchState.results.map((item) => (
                  <button key={item.id} className="portfolio-result" onClick={() => applyResult(item)}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.symbol || item.schemeCode} {item.exchange ? `• ${item.exchange}` : ""}</p>
                    </div>
                    <span className="status-pill neutral">{t("common.use", "Use")}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="form-grid">
              <div className="fg full">
                <label className="fl">{t("market.holdingName", "Holding Name")}</label>
                <input className="fi" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Reliance Industries, HDFC Flexi Cap..." />
              </div>
              <div className="fg">
                <label className="fl">{symbolLabel(form.kind, t)}</label>
                <input
                  className="fi"
                  value={form.kind === "mutualFund" ? form.schemeCode : form.symbol}
                  onChange={(e) =>
                    setForm((prev) =>
                      form.kind === "mutualFund"
                        ? { ...prev, schemeCode: e.target.value }
                        : { ...prev, symbol: e.target.value }
                    )
                  }
                  placeholder={symbolPlaceholder(form.kind)}
                />
              </div>
              {form.kind !== "mutualFund" ? (
                <div className="fg">
                  <label className="fl">{t("market.quoteOverride", "Quote Symbol Override")}</label>
                  <input
                    className="fi"
                    value={form.quoteSymbol}
                    onChange={(e) => setForm((prev) => ({ ...prev, quoteSymbol: e.target.value }))}
                    placeholder={quoteSymbolPlaceholder(form.kind)}
                  />
                </div>
              ) : null}
              <div className="fg">
                <label className="fl">{t("market.units", "Units")}</label>
                <input className="fi" type="number" value={form.units} onChange={(e) => setForm((prev) => ({ ...prev, units: e.target.value }))} placeholder="0" />
              </div>
              <div className="fg">
                <label className="fl">{t("market.avgCost", "Average Cost / Unit")}</label>
                <input className="fi" type="number" value={form.costPerUnit} onChange={(e) => setForm((prev) => ({ ...prev, costPerUnit: e.target.value }))} placeholder="0" />
              </div>
              <div className="fg">
                <label className="fl">{t("market.account", "Account / Broker")}</label>
                <input className="fi" value={form.account} onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))} placeholder="Zerodha, Groww, Folio..." />
              </div>
              <div className="fg">
                <label className="fl">{t("market.acquiredOn", "Acquired On")}</label>
                <input className="fi" type="date" value={form.acquiredOn} onChange={(e) => setForm((prev) => ({ ...prev, acquiredOn: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">{t("market.sectorTheme", "Sector / Theme")}</label>
                <input className="fi" value={form.sector} onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))} placeholder="IT, Banking, Energy, ETF..." />
              </div>
              <div className="fg">
                <label className="fl">{t("market.monthlySipContribution", "Monthly SIP / Contribution")}</label>
                <input className="fi" type="number" value={form.monthlyContribution} onChange={(e) => setForm((prev) => ({ ...prev, monthlyContribution: e.target.value }))} placeholder="0" />
              </div>
              <div className="fg">
                <label className="fl">{t("market.targetWeight", "Target Weight %")}</label>
                <input className="fi" type="number" value={form.targetWeight} onChange={(e) => setForm((prev) => ({ ...prev, targetWeight: e.target.value }))} placeholder="20" />
              </div>
              <div className="fg">
                <label className="fl">{t("market.realizedGain", "Realized Gain")}</label>
                <input className="fi" type="number" value={form.realizedGain} onChange={(e) => setForm((prev) => ({ ...prev, realizedGain: e.target.value }))} placeholder="0" />
              </div>
              <div className="fg full">
                <div className="setting-row" style={{ alignItems: "stretch" }}>
                  <button className="btn-primary" onClick={saveHolding}>
                    {editingId ? t("market.saveChanges", "Save Changes") : t("market.addHolding", "Add Holding")}
                  </button>
                  {editingId ? (
                    <button className="btn-secondary" onClick={cancelEdit}>{t("common.cancel", "Cancel")}</button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="portfolio-side-stack">
            <div className="chart-title" style={{ marginBottom: 10 }}>{t("market.recentSnapshots", "Recent Portfolio Snapshots")}</div>
            {recentSnapshots.length ? (
              <div className="portfolio-snapshot-grid">
                {recentSnapshots.map((item) => (
                  <div key={item.date} className="net-item">
                    <div className="split-row">
                      <strong>{item.date}</strong>
                      <span style={{ color: item.gainLoss >= 0 ? "var(--income)" : "var(--expense)" }}>
                        {item.gainLoss >= 0 ? "+" : "-"}{fmtINR(Math.abs(item.gainLoss))}
                      </span>
                    </div>
                    <div className="stat-line">
                      <span>{t("market.currentValueLower", "Current value")}</span>
                      <span>{fmtINR(item.totalValue)}</span>
                    </div>
                    <div className="stat-line">
                      <span>{t("market.investedValueLower", "Invested value")}</span>
                      <span>{fmtINR(item.totalInvested)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="portfolio-snapshot-empty">
                <p className="muted">{t("market.refreshHistoryHelp", "Refresh once and Finwise will keep a small local history of your daily portfolio values.")}</p>
              </div>
            )}

            <div className="chart-title" style={{ marginTop: 16, marginBottom: 10 }}>
              {t("market.currentHoldings", "Current Holdings")}
            </div>
            <div className={`portfolio-holdings-scroll ${holdings.length ? "stack" : ""}`}>
              {holdings.length ? holdings.map((item) => (
                <div key={item.id} className="portfolio-item">
                  <div className="portfolio-main">
                    <div>
                      <div className="tx-cat">
                        {item.name}
                        <span className="tx-badge investment">{translatedKindLabel(item.kind, t)}</span>
                      </div>
                      <div className="tx-note">
                        {item.kind === "mutualFund" ? `Scheme ${item.schemeCode}` : item.symbol}
                        {item.quoteSymbol && item.quoteSymbol !== item.symbol ? ` • quote ${item.quoteSymbol}` : ""}
                        {item.account ? ` • ${item.account}` : ""}
                        {item.source ? ` • ${item.source}` : ""}
                        {item.priceDate ? ` • ${item.priceLabel || t("market.latest", "Latest")} ${item.priceDate}` : ""}
                      </div>
                      {item.sector ? <div className="muted" style={{ marginTop: 4 }}>{item.sector}</div> : null}
                    </div>
                    <div className="portfolio-figures">
                      <div className="portfolio-number">{formatHoldingAmount(Number(item.currentValue || item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)), item)}</div>
                      <div className="muted">
                        {Number(item.units || 0).toLocaleString("en-IN")} {t("market.unitsLower", "units")}
                        {" • "}{t("market.avgCostShort", "Avg cost")} {formatHoldingPrice(Number(item.costPerUnit || 0), item)}
                        {Number(item.currentPrice || 0) > 0 ? ` • ${t("market.live", "Live")} ${formatHoldingPrice(Number(item.currentPrice || 0), item)}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="portfolio-subgrid">
                    <div className="mini-stat">
                      <span>{t("market.invested", "Invested")}</span>
                      <strong>{formatHoldingAmount(Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)), item)}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>{t("market.pnl", "P&L")}</span>
                      <strong style={{ color: Number(item.gainLoss || 0) >= 0 ? "var(--income)" : "var(--expense)" }}>
                        {Number(item.gainLoss || 0) >= 0 ? "+" : "-"}{formatHoldingAmount(Math.abs(Number(item.gainLoss || 0)), item)}
                      </strong>
                    </div>
                    <div className="mini-stat">
                      <span>{t("market.refreshStatus", "Refresh Status")}</span>
                      <strong>
                        {normalizeHoldingError(item.refreshError)
                          ? Number(item.currentPrice || 0) > 0
                            ? t("market.usingLastClose", "Using last close")
                            : t("market.needsAttention", "Needs attention")
                          : item.refreshedAt
                            ? t("common.updated", "Updated")
                            : t("common.pending", "Pending")}
                      </strong>
                    </div>
                    <div className="mini-stat">
                      <span>{t("market.sipRealized", "SIP / Realized")}</span>
                      <strong>{Number(item.monthlyContribution || 0) > 0 ? formatHoldingPrice(Number(item.monthlyContribution || 0), item) : "—"}</strong>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {Number(item.realizedGain || 0)
                          ? `${t("market.realized", "Realized")} ${formatHoldingPrice(Number(item.realizedGain || 0), item)}`
                          : t("market.noRealizedNote", "No realized-gain note yet.")}
                      </div>
                    </div>
                    <div className="portfolio-actions">
                      <div className="setting-row" style={{ justifyContent: "flex-end" }}>
                        <button className="tx-btn edit" onClick={() => beginEdit(item)}>{t("common.edit", "Edit")}</button>
                        <button className="tx-btn del" onClick={() => removeHolding(item.id)}>{t("common.delete", "Delete")}</button>
                      </div>
                    </div>
                  </div>
                  {normalizeHoldingError(item.refreshError) && <div className="auth-error" style={{ marginTop: 10, marginBottom: 0 }}>{normalizeHoldingError(item.refreshError)}</div>}
                </div>
              )) : (
                <div className="empty-state portfolio-holdings-empty">
                  <div className="es-icon">📈</div>
                  <p>{t("market.noHoldings", "Add your first stock, mutual fund, crypto, or commodity holding to start daily valuation and P&L tracking.")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
