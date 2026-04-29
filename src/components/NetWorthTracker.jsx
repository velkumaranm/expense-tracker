import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { fmtINR, goalId } from "../lib/utils";

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
  trackedCash,
  trackedInvestments,
  netWorth,
}) {
  const [assetForm, setAssetForm] = useState({ name: "", type: "Cash", value: "" });
  const [liabilityForm, setLiabilityForm] = useState({ name: "", type: "Loan", value: "" });

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

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Net Worth</h1>
          <p>Bring together tracked cash flow, investment buildup, manual assets, and liabilities.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Cash Reserve</div>
          <div className="sc-value" style={{ color: "var(--income)" }}>{fmtINR(trackedCash)}</div>
          <div className="sc-sub">Income minus expenses, insurance, and investment outflow.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Investments</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(trackedInvestments)}</div>
          <div className="sc-sub">Capital deployed through the transaction ledger.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Liquidity Buffer</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(liquidAssets)}</div>
          <div className="sc-sub">Cash-like assets available without liquidating long-term holdings.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Net Worth</div>
          <div className="sc-value" style={{ color: netWorth >= 0 ? "var(--income)" : "var(--expense)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">All tracked assets minus liabilities.</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-span-5">
          <div className="chart-title">Wealth Mix</div>
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
          <div className="chart-title">Risk & Balance Sheet Diagnostics</div>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="k">Manual Assets</div>
              <div className="v">{fmtINR(assetTotal)}</div>
              <div className="muted">Property, gold, retirement, and other self-entered assets.</div>
            </div>
            <div className="mini-card">
              <div className="k">Liabilities</div>
              <div className="v" style={{ color: "var(--expense)" }}>{fmtINR(liabilityTotal)}</div>
              <div className="muted">Loans, cards, tax dues, and other obligations.</div>
            </div>
            <div className="mini-card">
              <div className="k">Debt Ratio</div>
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
                <button className="btn-primary" onClick={addAsset}>Add Asset</button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>Assets</h3>
            <div className="stack">
              {assets.length ? assets.map((item) => (
                <div key={item.id} className="net-item">
                  <div className="split-row">
                    <strong>{item.name}</strong>
                    <span style={{ color: "var(--income)" }}>{fmtINR(item.value)}</span>
                  </div>
                  <div className="split-row">
                    <p>{item.type}</p>
                    <button className="tx-btn del" onClick={() => removeAsset(item.id)}>Delete</button>
                  </div>
                </div>
              )) : <p>No manual assets added yet.</p>}
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
                <label className="fl">Add Liability</label>
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
                <button className="btn-primary" onClick={addLiability}>Add Liability</button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>Liabilities</h3>
            <div className="stack">
              {liabilities.length ? liabilities.map((item) => (
                <div key={item.id} className="net-item">
                  <div className="split-row">
                    <strong>{item.name}</strong>
                    <span style={{ color: "var(--expense)" }}>{fmtINR(item.value)}</span>
                  </div>
                  <div className="split-row">
                    <p>{item.type}</p>
                    <button className="tx-btn del" onClick={() => removeLiability(item.id)}>Delete</button>
                  </div>
                </div>
              )) : <p>No liabilities added yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
