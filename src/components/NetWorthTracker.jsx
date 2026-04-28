import { useState } from "react";
import { fmtINR, goalId } from "../lib/utils";

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

  const assetTotal = assets.reduce((s, x) => s + Number(x.value || 0), 0);

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
          <div className="sc-sub">Income - expenses - insurance - investments.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Tracked Investments</div>
          <div className="sc-value" style={{ color: "var(--invest)" }}>{fmtINR(trackedInvestments)}</div>
          <div className="sc-sub">Total capital deployed via transaction log.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Manual Assets</div>
          <div className="sc-value" style={{ color: "var(--accent)" }}>{fmtINR(assetTotal)}</div>
          <div className="sc-sub">Property, cash accounts, gold, and other holdings.</div>
        </div>
        <div className="summary-card summary-span-3">
          <div className="sc-label">Net Worth</div>
          <div className="sc-value" style={{ color: netWorth >= 0 ? "var(--income)" : "var(--expense)" }}>{fmtINR(netWorth)}</div>
          <div className="sc-sub">All tracked assets minus liabilities.</div>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="form-card">
            <div className="form-grid">
              <div className="fg full">
                <label className="fl">Add Asset</label>
                <input className="fi" placeholder="Emergency fund, bank FD, gold, property…" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
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
                  <p>{item.type}</p>
                </div>
              )) : <p>No manual assets added yet.</p>}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="form-card">
            <div className="form-grid">
              <div className="fg full">
                <label className="fl">Add Liability</label>
                <input className="fi" placeholder="Home loan, personal loan, credit card balance…" value={liabilityForm.name} onChange={(e) => setLiabilityForm((f) => ({ ...f, name: e.target.value }))} />
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
                  <p>{item.type}</p>
                </div>
              )) : <p>No liabilities added yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
