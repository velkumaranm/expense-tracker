import { fmtINR } from "../lib/utils";

import { useState } from "react";

export default function AIInsights({
  report,
  aiState,
  onGenerate,
  aiConfig,
  backendHealth,
  topCategories,
  unusualTransactions,
  totals,
  chatMessages,
  onAskQuestion,
  askLoading,
}) {
  const [question, setQuestion] = useState("");
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
        <div className="ai-layout">
          <div className="ai-chat-shell">
            <div className="section-card ai-chat-card">
              <div className="ai-chat-head">
                <h3>Ask Finwise AI</h3>
                <p className="ai-chat-sub">
                  Ask about savings, unusual spending, investing, insurance, goals, or net worth. The answer uses your live financial context.
                </p>
              </div>
              <div className="ai-chat-body">
                {chatMessages.length ? (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`ai-message ${msg.role === "user" ? "user" : "assistant"}`}>
                      <div className="ai-message-meta">
                        <strong>{msg.role === "user" ? "You" : "Finwise AI"}</strong>
                        <span>{msg.mode}</span>
                      </div>
                      <div className="ai-bubble">{msg.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="ai-chat-empty">
                    No questions yet. Start with something specific like "Where can I reduce spending next month?" or "Am I investing enough relative to my income?"
                  </div>
                )}
              </div>
            </div>

            <div className="ai-side-stack">
              <div className="section-card ai-ask-card">
                <h3>New Question</h3>
                <div className="fg">
                  <textarea
                    placeholder="Example: Where can I cut spending next month without hurting my goals?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </div>
                <div className="ai-ask-actions">
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      if (!question.trim()) return;
                      await onAskQuestion(question.trim());
                      setQuestion("");
                    }}
                    disabled={askLoading}
                  >
                    {askLoading ? "Thinking…" : "Ask"}
                  </button>
                  <span className="muted">
                    {backendHealth?.providers?.[aiConfig.provider]
                      ? "Using backend AI proxy."
                      : "No provider key configured, so answers fall back to local reasoning."}
                  </span>
                </div>
                {!backendHealth?.providers?.[aiConfig.provider] && (
                  <p style={{ fontSize: 11.5, color: "var(--accent)" }}>
                    Current provider <strong>{aiConfig.provider}</strong> is not configured on the backend proxy yet.
                  </p>
                )}
              </div>

              <div className="section-card">
                <h3>Quick Context</h3>
                <div className="stack">
                  {report.summary.map((line) => <div key={line} className="stat-line"><span>{line}</span></div>)}
                </div>
              </div>

              {!!aiState.externalText && (
                <div className="section-card">
                  <h3>Model Notes</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{aiState.externalText}</p>
                </div>
              )}
            </div>
          </div>

          <div className="ai-insights-grid">
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
