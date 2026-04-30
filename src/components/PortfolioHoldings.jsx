import { useMemo, useState } from "react";
import { refreshMarketHoldings, searchMarketInstruments } from "../lib/market";
import { fmtINR, goalId } from "../lib/utils";

const emptyForm = {
  kind: "stock",
  name: "",
  symbol: "",
  schemeCode: "",
  units: "",
  costPerUnit: "",
  account: "",
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

function searchPlaceholder(kind) {
  if (kind === "mutualFund") return "Search fund by name, e.g. HDFC Flexi Cap";
  if (kind === "crypto") return "Search crypto pair or coin, e.g. BTC/USD";
  if (kind === "commodity") return "Search gold, silver, WTI, Brent...";
  return "Search stock or type symbol like RELIANCE.BSE";
}

function symbolLabel(kind) {
  if (kind === "mutualFund") return "Scheme Code";
  if (kind === "crypto") return "Crypto Symbol";
  if (kind === "commodity") return "Commodity Symbol";
  return "Stock Symbol";
}

function symbolPlaceholder(kind) {
  if (kind === "mutualFund") return "125497";
  if (kind === "crypto") return "BTC/USD or BINANCE:BTCUSDT";
  if (kind === "commodity") return "XAU/USD, WTI, BRENT";
  return "RELIANCE.BSE or AAPL";
}

function providerCopy(kind, marketProviders) {
  if (kind === "mutualFund") {
    return "Mutual fund values use the latest NAV from a free AMFI-backed fund feed.";
  }
  if (kind === "commodity") {
    return marketProviders?.alphaVantage
      ? "Commodities use a curated free-market feed path. Gold, silver, crude, and natural gas are the most reliable first set."
      : "Add ALPHA_VANTAGE_API_KEY on the backend to refresh commodity holdings.";
  }
  if (kind === "crypto") {
    if (marketProviders?.twelveData || marketProviders?.finnhub || marketProviders?.alphaVantage) {
      return "Crypto refresh prefers the higher-free-call providers first, then falls back gracefully if one is unavailable."
    }
    return "Add TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY on the backend to search and refresh crypto prices.";
  }
  if (marketProviders?.twelveData || marketProviders?.finnhub || marketProviders?.alphaVantage) {
    return "Stocks prefer the higher-free-call providers first, then fall back to the next available feed during refresh.";
  }
  return "Add TWELVE_DATA_API_KEY, FINNHUB_API_KEY, or ALPHA_VANTAGE_API_KEY on the backend to search and refresh stock prices.";
}

function toLocalStamp(iso) {
  if (!iso) return "Not refreshed yet";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function PortfolioHoldings({
  holdings,
  setHoldings,
  snapshots,
  setSnapshots,
  marketProviders,
  showToast,
}) {
  const [form, setForm] = useState(emptyForm);
  const [searchState, setSearchState] = useState({ query: "", loading: false, error: "", results: [] });
  const [refreshing, setRefreshing] = useState(false);

  const summary = useMemo(() => {
    const totalInvested = holdings.reduce((sum, item) => sum + Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)), 0);
    const totalValue = holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
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
  }, [holdings]);

  const recentSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [snapshots]
  );

  const applyResult = (item) => {
    setForm((prev) => ({
      ...prev,
      kind: item.kind || prev.kind,
      name: item.name || prev.name,
      symbol: item.symbol || "",
      schemeCode: item.schemeCode || "",
    }));
    setSearchState((prev) => ({ ...prev, results: [] }));
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

  const addHolding = () => {
    if (!form.name || !form.units || !form.costPerUnit) return;
    if (["stock", "crypto", "commodity"].includes(form.kind) && !form.symbol) return;
    if (form.kind === "mutualFund" && !form.schemeCode) return;
    setHoldings((prev) => [
      {
        id: goalId(),
        kind: form.kind,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        schemeCode: form.schemeCode.trim(),
        units: Number(form.units),
        costPerUnit: Number(form.costPerUnit),
        account: form.account.trim(),
        currentPrice: 0,
        currentValue: 0,
        investedValue: Number(form.units) * Number(form.costPerUnit),
        gainLoss: 0,
        priceDate: "",
        refreshedAt: "",
        refreshError: "",
      },
      ...prev,
    ]);
    setForm((prev) => ({ ...emptyForm, kind: prev.kind }));
    setSearchState({ query: "", loading: false, error: "", results: [] });
    showToast("Holding added. Refresh once to fetch the latest price.");
  };

  const removeHolding = (id) => {
    setHoldings((prev) => prev.filter((item) => item.id !== id));
    showToast("Holding removed.", "warning");
  };

  const doRefresh = async () => {
    if (!holdings.length) return;
    setRefreshing(true);
    try {
      const payload = await refreshMarketHoldings(holdings);
      setHoldings(payload.holdings || []);
      const stamp = payload.summary?.lastRefreshAt || new Date().toISOString();
      const snapshotDate = stamp.slice(0, 10);
      const snapshot = {
        date: snapshotDate,
        refreshedAt: stamp,
        totalValue: Number(payload.summary?.totalValue || 0),
        totalInvested: Number(payload.summary?.totalInvested || 0),
        gainLoss: Number(payload.summary?.totalGainLoss || 0),
      };
      setSnapshots((prev) => {
        const filtered = prev.filter((item) => item.date !== snapshotDate);
        return [snapshot, ...filtered].slice(0, 30);
      });
      showToast(
        payload.summary?.failed
          ? `Prices refreshed. ${payload.summary.failed} holding${payload.summary.failed > 1 ? "s" : ""} still need attention.`
          : "Portfolio prices refreshed."
      );
    } catch (error) {
      showToast(error.message || "Could not refresh prices.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="section-card">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div>
          <h3>Market Holdings</h3>
          <p style={{ marginBottom: 0 }}>
            Track stocks and mutual funds separately from the cash-flow ledger, then refresh market values manually once per day.
          </p>
        </div>
        <div className="goal-head-actions">
          <span className="status-pill neutral">{holdings.length} holding{holdings.length === 1 ? "" : "s"}</span>
          <button className="btn-primary" disabled={!holdings.length || refreshing} onClick={doRefresh}>
            {refreshing ? "Refreshing..." : "Refresh Prices"}
          </button>
        </div>
      </div>

      <div className="mini-grid" style={{ marginBottom: 14 }}>
        <div className="mini-card">
          <div className="k">Invested Value</div>
          <div className="v">{fmtINR(summary.totalInvested)}</div>
          <div className="muted">Units multiplied by your average cost per unit.</div>
        </div>
        <div className="mini-card">
          <div className="k">Current Value</div>
          <div className="v" style={{ color: "var(--invest)" }}>{fmtINR(summary.totalValue)}</div>
          <div className="muted">Latest fetched market value from the current holdings set.</div>
        </div>
        <div className="mini-card">
          <div className="k">Unrealized P&L</div>
          <div className="v" style={{ color: summary.gainLoss >= 0 ? "var(--income)" : "var(--expense)" }}>
            {summary.gainLoss >= 0 ? "+" : "-"}{fmtINR(Math.abs(summary.gainLoss))}
          </div>
          <div className="muted">
            Last refresh: {toLocalStamp(summary.lastRefreshAt)}
          </div>
        </div>
      </div>

      <div className="portfolio-panel" style={{ marginBottom: 16 }}>
        <div className="portfolio-grid">
          <div>
            <div className="fl" style={{ marginBottom: 8 }}>Instrument Type</div>
            <div className="tab2" style={{ marginBottom: 10 }}>
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`tab2-btn ${form.kind === option.id ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, kind: option.id, symbol: "", schemeCode: "" }))}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="setting-row" style={{ alignItems: "stretch", marginBottom: 10 }}>
              <input
                className="setting-input"
                placeholder={searchPlaceholder(form.kind)}
                value={searchState.query}
                onChange={(e) => setSearchState((prev) => ({ ...prev, query: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              <button className="btn-secondary" onClick={runSearch} disabled={searchState.loading}>
                {searchState.loading ? "Searching..." : "Search"}
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
                    <span className="status-pill neutral">Use</span>
                  </button>
                ))}
              </div>
            )}

            <div className="form-grid">
              <div className="fg full">
                <label className="fl">Holding Name</label>
                <input className="fi" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Reliance Industries, HDFC Flexi Cap..." />
              </div>
              <div className="fg">
                <label className="fl">{symbolLabel(form.kind)}</label>
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
              <div className="fg">
                <label className="fl">Units</label>
                <input className="fi" type="number" value={form.units} onChange={(e) => setForm((prev) => ({ ...prev, units: e.target.value }))} placeholder="0" />
              </div>
              <div className="fg">
                <label className="fl">Average Cost / Unit</label>
                <input className="fi" type="number" value={form.costPerUnit} onChange={(e) => setForm((prev) => ({ ...prev, costPerUnit: e.target.value }))} placeholder="0" />
              </div>
              <div className="fg">
                <label className="fl">Account / Broker</label>
                <input className="fi" value={form.account} onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))} placeholder="Zerodha, Groww, Folio..." />
              </div>
              <div className="fg full">
                <button className="btn-primary" onClick={addHolding}>Add Holding</button>
              </div>
            </div>

            <div className="muted" style={{ marginTop: 10 }}>
              {providerCopy(form.kind, marketProviders)}
            </div>
          </div>

          <div>
            <div className="chart-title" style={{ marginBottom: 10 }}>Recent Portfolio Snapshots</div>
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
                      <span>Current value</span>
                      <span>{fmtINR(item.totalValue)}</span>
                    </div>
                    <div className="stat-line">
                      <span>Invested value</span>
                      <span>{fmtINR(item.totalInvested)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="portfolio-snapshot-empty">
                <p className="muted">Refresh once and Finwise will keep a small local history of your daily portfolio values.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stack">
        {holdings.length ? holdings.map((item) => (
          <div key={item.id} className="portfolio-item">
            <div className="portfolio-main">
              <div>
                <div className="tx-cat">
                  {item.name}
                  <span className="tx-badge investment">{kindLabel(item.kind)}</span>
                </div>
                <div className="tx-note">
                  {item.kind === "mutualFund" ? `Scheme ${item.schemeCode}` : item.symbol}
                  {item.account ? ` • ${item.account}` : ""}
                  {item.source ? ` • ${item.source}` : ""}
                  {item.priceDate ? ` • ${item.priceLabel || "Latest"} ${item.priceDate}` : ""}
                </div>
              </div>
              <div className="portfolio-figures">
                <div className="portfolio-number">{fmtINR(item.currentValue || 0)}</div>
                <div className="muted">{Number(item.units || 0).toLocaleString("en-IN")} units @ {fmtINR(item.currentPrice || 0)}</div>
              </div>
            </div>
            <div className="portfolio-subgrid">
              <div className="mini-stat">
                <span>Invested</span>
                <strong>{fmtINR(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0))}</strong>
              </div>
              <div className="mini-stat">
                <span>P&L</span>
                <strong style={{ color: Number(item.gainLoss || 0) >= 0 ? "var(--income)" : "var(--expense)" }}>
                  {Number(item.gainLoss || 0) >= 0 ? "+" : "-"}{fmtINR(Math.abs(Number(item.gainLoss || 0)))}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Refresh Status</span>
                <strong>{normalizeHoldingError(item.refreshError) ? "Needs attention" : item.refreshedAt ? "Updated" : "Pending"}</strong>
              </div>
              <div className="portfolio-actions">
                <button className="tx-btn del" onClick={() => removeHolding(item.id)}>Delete</button>
              </div>
            </div>
            {normalizeHoldingError(item.refreshError) && <div className="auth-error" style={{ marginTop: 10, marginBottom: 0 }}>{normalizeHoldingError(item.refreshError)}</div>}
          </div>
        )) : (
          <div className="empty-state">
            <div className="es-icon">📈</div>
            <p>Add your first stock, mutual fund, crypto, or commodity holding to start daily valuation and P&amp;L tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
}
