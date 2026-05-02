import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { averageHoldingYears, cagr, convertAmount, fmtINR, fmtPct, goalId, xirr } from "../lib/utils";
import { useI18n } from "../lib/i18n";
import PortfolioHoldings from "./PortfolioHoldings";

const WEALTH_COLORS = ["#34D399", "#818CF8", "#C8A96E", "#F87171"];
const ASSET_TEMPLATES = [
  { name: "Emergency Fund", type: "Cash", value: "150000" },
  { name: "Family Gold", type: "Gold", value: "250000" },
  { name: "Retirement Corpus", type: "Retirement", value: "500000" },
];
const LIABILITY_TEMPLATES = [
  { name: "Credit Card Balance", type: "Credit Card", value: "25000" },
  { name: "Home Loan", type: "Mortgage", value: "3000000" },
  { name: "Vehicle Loan", type: "Loan", value: "450000" },
];

export default function NetWorthTracker({
  assets,
  setAssets,
  liabilities,
  setLiabilities,
  holdings,
  setHoldings,
  snapshots,
  setSnapshots,
  marketProviders,
  marketDisplayCurrency,
  setMarketDisplayCurrency,
  marketFx,
  portfolioInvestedValue,
  portfolioGainLoss,
  investmentTransactions,
  showToast,
  trackedCash,
  trackedInvestments,
  netWorth,
}) {
  const { t } = useI18n();
  const [assetForm, setAssetForm] = useState({ name: "", type: "Cash", value: "" });
  const [liabilityForm, setLiabilityForm] = useState({ name: "", type: "Loan", value: "" });
  const holdingCurrency = (item) =>
    String(item?.currency || (String(item?.quoteSymbol || item?.symbol || "").toUpperCase().includes(".NS") ? "INR" : "USD")).toUpperCase();
  const toInr = (amount, item) => convertAmount(amount, holdingCurrency(item), "INR", marketFx);

  const addAsset = () => {
    if (!assetForm.name || !assetForm.value) return;
    setAssets((prev) => [{ id: goalId(), ...assetForm, value: Number(assetForm.value) }, ...prev]);
    setAssetForm({ name: "", type: "Cash", value: "" });
  };
  const addLiability = () => {
    if (!liabilityForm.name || !liabilityForm.value) return;
    setLiabilities((prev) => [{ id: goalId(), ...liabilityForm, value: Number(liabilityForm.value) }, ...prev]);
    setLiabilityForm({ name: "", type: "Loan", value: "" });
  };

  const removeAsset = (id) => setAssets((prev) => prev.filter((item) => item.id !== id));
  const removeLiability = (id) => setLiabilities((prev) => prev.filter((item) => item.id !== id));

  const assetTotal = assets.reduce((s, x) => s + Number(x.value || 0), 0);
  const liabilityTotal = liabilities.reduce((s, x) => s + Number(x.value || 0), 0);
  const liquidAssets = Math.max(trackedCash, 0) + assets.filter((item) => ["Cash", "Retirement"].includes(item.type)).reduce((s, x) => s + Number(x.value || 0), 0);
  const debtRatio = netWorth > 0 ? liabilityTotal / (trackedCash + trackedInvestments + assetTotal || 1) : liabilityTotal > 0 ? 1 : 0;
  const wealthMix = useMemo(
    () => [
      { name: "Tracked Cash", value: Math.max(trackedCash, 0) },
      { name: "Tracked Investments", value: Math.max(trackedInvestments, 0) },
      { name: "Manual Assets", value: assetTotal },
      { name: "Liabilities", value: liabilityTotal },
    ].filter((item) => item.value > 0),
    [trackedCash, trackedInvestments, assetTotal, liabilityTotal]
  );
  const allocationByKind = useMemo(() => {
    const grouped = {};
    holdings.forEach((item) => {
      const label =
        item.kind === "mutualFund"
          ? "Mutual Funds"
          : item.kind === "crypto"
            ? "Crypto"
            : item.kind === "commodity"
              ? "Commodities"
              : "Stocks / ETFs";
      grouped[label] = (grouped[label] || 0) + toInr(Number(item.currentValue || item.investedValue || 0), item);
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [holdings, marketFx]);
  const allocationByRegion = useMemo(() => {
    const grouped = {};
    holdings.forEach((item) => {
      const symbol = String(item.quoteSymbol || item.symbol || "").toUpperCase();
      const label = symbol.includes(".NS") || symbol.includes(".BSE") || symbol.includes(".BO") || symbol.includes(".NSE") ? "India" : "Global / US";
      grouped[label] = (grouped[label] || 0) + toInr(Number(item.currentValue || item.investedValue || 0), item);
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [holdings, marketFx]);
  const xirrEstimate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const flows = holdings
      .map((item) => {
        const date = item.acquiredOn || item.refreshedAt?.slice(0, 10) || today;
        const invested = toInr(Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)), item);
        return invested > 0 ? { amount: -invested, date } : null;
      })
      .filter(Boolean);
    const currentValue = holdings.reduce((sum, item) => sum + toInr(Number(item.currentValue || item.investedValue || 0), item), 0);
    if (currentValue > 0) flows.push({ amount: currentValue, date: today });
    return xirr(flows);
  }, [holdings, marketFx]);
  const cagrEstimate = useMemo(() => {
    const years = averageHoldingYears(holdings);
    const currentValue = holdings.reduce((sum, item) => sum + toInr(Number(item.currentValue || item.investedValue || 0), item), 0);
    const investedValue = holdings.reduce((sum, item) => sum + toInr(Number(item.investedValue || Number(item.units || 0) * Number(item.costPerUnit || 0)), item), 0);
    return cagr(investedValue, currentValue, years);
  }, [holdings, marketFx]);
  const sectorSplit = useMemo(() => {
    const grouped = {};
    holdings.forEach((item) => {
      const label = item.sector || (item.kind === "mutualFund" ? "Funds" : item.kind === "crypto" ? "Crypto" : item.kind === "commodity" ? "Commodities" : "Unclassified");
      grouped[label] = (grouped[label] || 0) + toInr(Number(item.currentValue || item.investedValue || 0), item);
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [holdings, marketFx]);
  const monthlySip = useMemo(() => holdings.reduce((sum, item) => sum + toInr(Number(item.monthlyContribution || 0), item), 0), [holdings, marketFx]);
  const realizedGains = useMemo(() => holdings.reduce((sum, item) => sum + toInr(Number(item.realizedGain || 0), item), 0), [holdings, marketFx]);
  const rebalanceHints = useMemo(() => {
    const total = allocationByKind.reduce((sum, item) => sum + item.value, 0);
    const hints = [];
    if (total > 0) {
      const dominant = allocationByKind[0];
      if (dominant && dominant.value / total > 0.7) {
        hints.push(`${dominant.name} is more than 70% of the tracked portfolio. Diversification could improve resilience.`);
      }
    }
    const targetDriven = holdings
      .filter((item) => Number(item.targetWeight || 0) > 0)
      .map((item) => {
        const actual = total > 0 ? (toInr(Number(item.currentValue || item.investedValue || 0), item) / total) * 100 : 0;
        const gap = actual - Number(item.targetWeight || 0);
        return { name: item.name, gap };
      })
      .filter((item) => Math.abs(item.gap) >= 5)
      .slice(0, 3);
    targetDriven.forEach((item) => {
      hints.push(`${item.name} is ${item.gap > 0 ? "above" : "below"} target weight by ${Math.abs(item.gap).toFixed(1)}%.`);
    });
    return hints;
  }, [allocationByKind, holdings, marketFx]);
  const recurringInvestmentRatio = investmentTransactions.length
    ? holdings.length / Math.max(investmentTransactions.length, 1)
    : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("wealth.title", "Net Worth")}</h1>
          <p>{t("wealth.subtitle", "Bring together tracked cash flow, investment buildup, manual assets, and liabilities.")}</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("wealth.cashReserve", "Tracked Cash Reserve")}</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(trackedCash)}</div>
          <div className="sc-sub">Income minus expenses, insurance, and investment outflow.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("wealth.trackedInvestments", "Tracked Investments")}</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(trackedInvestments)}</div>
          <div className="sc-sub">Non-market investments plus live-valued market holdings.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("wealth.liquidityBuffer", "Liquidity Buffer")}</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(liquidAssets)}</div>
          <div className="sc-sub">Cash-like assets available without liquidating long-term holdings.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">{t("wealth.netWorthLabel", "Net Worth")}</div>
          <div className="sc-value" style={{ color: netWorth >= 0 ? "var(--income)" : "var(--expense)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">All tracked assets minus liabilities.</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-span-5">
          <div className="chart-title">{t("wealth.wealthMix", "Wealth Mix")}</div>
          {wealthMix.length ? (
            <div className="pie-row">
              <div style={{ width: 180, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={wealthMix} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2}>
                      {wealthMix.map((_, i) => <Cell key={i} fill={WEALTH_COLORS[i % WEALTH_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => fmtINR(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pie-legend">
                {wealthMix.map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: WEALTH_COLORS[i % WEALTH_COLORS.length] }} />
                    <span>{item.name}</span>
                    <span className="pie-legend-val">{fmtINR(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p>No wealth components recorded yet.</p>}
        </div>

        <div className="chart-card chart-span-7">
          <div className="chart-title">{t("wealth.riskDiagnostics", "Risk & Balance Sheet Diagnostics")}</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">{t("wealth.manualAssets", "Manual Assets")}</div>
              <div className="v">{fmtINR(assetTotal)}</div>
              <div className="muted">Property, gold, retirement, and other self-entered assets.</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("wealth.liabilities", "Liabilities")}</div>
              <div className="v" style={{ color: "var(--expense)" }}>{fmtINR(liabilityTotal)}</div>
              <div className="muted">Loans, cards, tax dues, and other obligations.</div>
            </div>
            <div className="mini-card">
              <div className="k">{t("wealth.debtRatio", "Debt Ratio")}</div>
              <div className="v" style={{ color: debtRatio > 0.45 ? "var(--expense)" : "var(--accent)" }}>
                {(debtRatio * 100).toFixed(0)}%
              </div>
              <div className="muted">Liabilities as a share of total asset base.</div>
            </div>
          </div>
          <div className="insight-list" style={{ marginTop: 14 }}>
            <div className="insight-item">
              <strong>Balance sheet read</strong>
              <p>
                {liabilityTotal > assetTotal + trackedCash + trackedInvestments
                  ? "Liabilities are outweighing asset buildup. Prioritize debt reduction before adding new risk."
                  : "Assets are still ahead of liabilities. The next premium move is improving liquidity and diversification quality."}
              </p>
            </div>
            <div className="insight-item">
              <strong>Liquidity note</strong>
              <p>
                {liquidAssets > liabilityTotal
                  ? "Liquid reserves are healthy relative to debt, which gives you flexibility during shocks."
                  : "Liquidity is thinner than total obligations. Building accessible cash should stay near the top of the plan."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <PortfolioHoldings
        holdings={holdings}
        setHoldings={setHoldings}
        snapshots={snapshots}
        setSnapshots={setSnapshots}
        marketProviders={marketProviders}
        marketDisplayCurrency={marketDisplayCurrency}
        setMarketDisplayCurrency={setMarketDisplayCurrency}
        marketFx={marketFx}
        showToast={showToast}
      />

      <div className="charts-grid" style={{ marginTop: 16 }}>
        <div className="chart-card chart-span-4">
          <div className="chart-title">Portfolio Return Signal</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">Invested base</div>
              <div className="v">{fmtINR(portfolioInvestedValue)}</div>
              <div className="muted">Capital currently committed to tracked market holdings.</div>
            </div>
            <div className="mini-card">
              <div className="k">Unrealized return</div>
              <div className="v" style={{ color: portfolioGainLoss >= 0 ? "var(--income)" : "var(--expense)" }}>
                {portfolioGainLoss >= 0 ? "+" : "-"}{fmtINR(Math.abs(portfolioGainLoss))}
              </div>
              <div className="muted">Current mark-to-market difference versus invested cost.</div>
            </div>
            <div className="mini-card">
              <div className="k">XIRR-style estimate</div>
              <div className="v" style={{ color: (xirrEstimate || 0) >= 0 ? "var(--invest)" : "var(--expense)" }}>
                {xirrEstimate == null ? "Need more dates" : fmtPct(xirrEstimate)}
              </div>
              <div className="muted">Estimated annualized return based on current holding dates and values.</div>
            </div>
            <div className="mini-card">
              <div className="k">CAGR estimate</div>
              <div className="v" style={{ color: (cagrEstimate || 0) >= 0 ? "var(--invest)" : "var(--expense)" }}>
                {cagrEstimate == null ? "Need more history" : fmtPct(cagrEstimate)}
              </div>
              <div className="muted">Compounded annual growth estimate from invested base and holding age.</div>
            </div>
            <div className="mini-card">
              <div className="k">Monthly SIP flow</div>
              <div className="v">{fmtINR(monthlySip)}</div>
              <div className="muted">Recurring contributions explicitly mapped to holdings.</div>
            </div>
            <div className="mini-card">
              <div className="k">Realized gains</div>
              <div className="v" style={{ color: realizedGains >= 0 ? "var(--income)" : "var(--expense)" }}>{fmtINR(realizedGains)}</div>
              <div className="muted">Closed-profit notes tracked alongside the live book.</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">Allocation By Asset Class</div>
          {allocationByKind.length ? (
            <div className="pie-row">
              <div style={{ width: 170, height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationByKind} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={68} paddingAngle={2}>
                      {allocationByKind.map((_, i) => <Cell key={i} fill={WEALTH_COLORS[i % WEALTH_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => fmtINR(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pie-legend">
                {allocationByKind.map((item, i) => (
                  <div key={item.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: WEALTH_COLORS[i % WEALTH_COLORS.length] }} />
                    <span>{item.name}</span>
                    <span className="pie-legend-val">{fmtINR(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p>No market holdings added yet.</p>}
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">Allocation By Geography</div>
          <div className="mini-grid">
            {allocationByRegion.length ? allocationByRegion.map((item) => (
              <div key={item.name} className="mini-card">
                <div className="k">{item.name}</div>
                <div className="v">{fmtINR(item.value)}</div>
                <div className="muted">
                  {trackedInvestments > 0 ? `${((item.value / Math.max(trackedInvestments, 1)) * 100).toFixed(1)}% of tracked investments.` : "No tracked investment base yet."}
                </div>
              </div>
            )) : (
              <div className="mini-card">
                <div className="k">Portfolio breadth</div>
                <div className="v">—</div>
                <div className="muted">Add Indian or global holdings to compare regional exposure.</div>
              </div>
            )}
            <div className="mini-card">
              <div className="k">Tracking depth</div>
              <div className="v">{holdings.length}</div>
              <div className="muted">{investmentTransactions.length ? `${(recurringInvestmentRatio * 100).toFixed(0)}% of investment transactions are mirrored by tracked holdings.` : "No investment transactions have been recorded yet."}</div>
            </div>
          </div>
        </div>

        <div className="chart-card chart-span-4">
          <div className="chart-title">Sector Split</div>
          <div className="mini-grid">
            {sectorSplit.length ? sectorSplit.map((item) => (
              <div key={item.name} className="mini-card">
                <div className="k">{item.name}</div>
                <div className="v">{fmtINR(item.value)}</div>
                <div className="muted">Tracked sector concentration snapshot.</div>
              </div>
            )) : (
              <div className="mini-card">
                <div className="k">Sectors</div>
                <div className="v">—</div>
                <div className="muted">Add sectors in holdings to compare concentration across themes.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section-card" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <h3>Rebalance Hints</h3>
            <p style={{ marginBottom: 0 }}>Soft guidance based on concentration and any target weights you saved per holding.</p>
          </div>
        </div>
        <div className="stack">
          {rebalanceHints.length ? rebalanceHints.map((hint) => (
            <div key={hint} className="insight-item">
              <strong>Portfolio note</strong>
              <p>{hint}</p>
            </div>
          )) : (
            <div className="insight-item">
              <strong>Balanced enough for now</strong>
              <p>No major concentration or target-weight drift is standing out from the tracked holdings set.</p>
            </div>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="form-card">
            <div style={{ marginBottom: 14 }}>
              <label className="fl" style={{ marginBottom: 8, display: "block" }}>Starter Assets</label>
              <div className="filter-strip" style={{ marginBottom: 0 }}>
                {ASSET_TEMPLATES.map((template) => (
                  <button key={template.name} className="filter-chip" onClick={() => setAssetForm(template)}>
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <div className="fg full">
                <label className="fl">Add Asset</label>
                <input className="fi" placeholder="Emergency fund, bank FD, gold, property..." value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Type</label>
                <select className="fs" value={assetForm.type} onChange={(e) => setAssetForm((f) => ({ ...f, type: e.target.value }))}>
                  {["Cash", "Property", "Gold", "Vehicle", "Retirement", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Value</label>
                <input className="fi" type="number" value={assetForm.value} onChange={(e) => setAssetForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="fg full">
                <button className="btn-primary" onClick={addAsset}>{t("wealth.addAsset", "Add Asset")}</button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>{t("wealth.assetsTitle", "Assets")}</h3>
            <div className="stack">
              {assets.length ? assets.map((item) => (
                <div key={item.id} className="net-item">
                  <div className="split-row">
                    <strong>{item.name}</strong>
                    <span style={{ color: "var(--income)" }}>{fmtINR(item.value)}</span>
                  </div>
                  <div className="split-row">
                    <p>{item.type}</p>
                    <button className="tx-btn del" onClick={() => removeAsset(item.id)}>{t("common.delete", "Delete")}</button>
                  </div>
                </div>
              )) : <p>{t("wealth.noAssets", "No manual assets added yet.")}</p>}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="form-card">
            <div style={{ marginBottom: 14 }}>
              <label className="fl" style={{ marginBottom: 8, display: "block" }}>Starter Liabilities</label>
              <div className="filter-strip" style={{ marginBottom: 0 }}>
                {LIABILITY_TEMPLATES.map((template) => (
                  <button key={template.name} className="filter-chip" onClick={() => setLiabilityForm(template)}>
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <div className="fg full">
                <label className="fl">{t("wealth.addLiability", "Add Liability")}</label>
                <input className="fi" placeholder="Home loan, personal loan, credit card balance..." value={liabilityForm.name} onChange={(e) => setLiabilityForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Type</label>
                <select className="fs" value={liabilityForm.type} onChange={(e) => setLiabilityForm((f) => ({ ...f, type: e.target.value }))}>
                  {["Loan", "Credit Card", "Mortgage", "Tax Due", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Value</label>
                <input className="fi" type="number" value={liabilityForm.value} onChange={(e) => setLiabilityForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="fg full">
                <button className="btn-primary" onClick={addLiability}>{t("wealth.addLiability", "Add Liability")}</button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>{t("wealth.liabilities", "Liabilities")}</h3>
            <div className="stack">
              {liabilities.length ? liabilities.map((item) => (
                <div key={item.id} className="net-item">
                  <div className="split-row">
                    <strong>{item.name}</strong>
                    <span style={{ color: "var(--expense)" }}>{fmtINR(item.value)}</span>
                  </div>
                  <div className="split-row">
                    <p>{item.type}</p>
                    <button className="tx-btn del" onClick={() => removeLiability(item.id)}>{t("common.delete", "Delete")}</button>
                  </div>
                </div>
              )) : <p>{t("wealth.noLiabilities", "No liabilities added yet.")}</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
