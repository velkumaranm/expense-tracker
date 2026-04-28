import { fmtINR } from "../lib/utils";

export default function AIInsights({
  report,
  aiState,
  onGenerate,
  aiConfig,
  backendHealth,
  topCategories,
  unusualTransactions,
  totals,
}) {
  const modeLabel = backendHealth?.providers?.[aiConfig.provider]
    ? aiConfig.provider === "anthropic"
      ? "Claude Proxy"
      : "Free Model Proxy"
    : "On-device";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Insights</h1>
          <p>Personalized financial intelligence powered by your transaction graph.</p>
        </div>
        <button className="btn-primary" onClick={onGenerate} disabled={aiState.loading}>
          {aiState.loading ? "Analyzing…" : "Refresh Insights"}
        </button>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-4">
          <div className="sc-label">AI Mode</div>
          <div className="sc-value" style={{ fontSize: 20 }}>{modeLabel}</div>
          <div className="sc-sub">
            {backendHealth?.providers?.[aiConfig.provider]
              ? "Inference runs through the local backend proxy. Browser never holds provider keys."
              : "Using local heuristic insights because no backend provider key is configured."}
          </div>
        </div>
        <div className="summary-card summary-span-4">
          <div className="sc-label">Top Spend Bucket</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
          <div className="sc-sub">{topCategories[0]?.name || "No expense data yet"}</div>
        </div>
        <div className="summary-card summary-span-4">
          <div className="sc-label">Savings Rate</div>
          <div className="sc-value" style={{ color: totals.savingsRate >= 20 ? "var(--income)" : "var(--accent)" }}>
            {totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}
          </div>
          <div className="sc-sub">Used for savings, investment, and risk recommendations.</div>
        </div>
      </div>

      {aiState.error && <div className="alert-item warn" style={{ marginBottom: 12 }}><strong>AI request issue</strong><p>{aiState.error}</p></div>}

      {report ? (
        <div className="two-col">
          <div className="stack">
            <div className="section-card">
              <h3>Overview</h3>
              <p style={{ marginBottom: 12 }}>{report.headline}</p>
              <div className="stack">
                {report.summary.map((line) => <div key={line} className="stat-line"><span>{line}</span></div>)}
              </div>
            </div>

            <div className="section-card">
              <h3>Savings Opportunities</h3>
              <div className="insight-list">
                {report.opportunities.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>Opportunity</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card">
              <h3>Next Best Moves</h3>
              <div className="insight-list">
                {report.tips.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>Action</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="section-card">
              <h3>Anomaly Watch</h3>
              {report.anomalies.length ? (
                <div className="insight-list">
                  {report.anomalies.map((item) => (
                    <div key={item} className="alert-item warn">
                      <strong>Unusual Spend</strong>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No unusual transactions were flagged in the current scan.</p>
              )}
            </div>

            <div className="section-card">
              <h3>Investment Guidance</h3>
              <div className="insight-list">
                {report.investmentIdeas.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>Portfolio Nudge</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {!!aiState.externalText && (
              <div className="section-card">
                <h3>Model Notes</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{aiState.externalText}</p>
              </div>
            )}

            {unusualTransactions.length > 0 && (
              <div className="section-card">
                <h3>Flagged Transactions</h3>
                <div className="stack">
                  {unusualTransactions.map((t) => (
                    <div key={t.id} className="table-row">
                      <div className="split-row">
                        <strong>{t.category}</strong>
                        <span style={{ color: "var(--expense)" }}>{fmtINR(t.amount)}</span>
                      </div>
                      <p>{t.date} • {t.note || "No note"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="section-card">
          <h3>No insights yet</h3>
          <p>Run the analyzer to generate spending insights, anomaly detection, savings opportunities, and investment suggestions from your live data.</p>
        </div>
      )}
    </>
  );
}
