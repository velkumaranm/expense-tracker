import { useState } from "react";
import { fmtINR } from "../lib/utils";
import { useI18n } from "../lib/i18n";

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
  onClearChat,
  askLoading,
}) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const modeLabel = backendHealth?.providers?.[aiConfig.provider]
    ? aiConfig.provider === "anthropic"
      ? "Claude Proxy"
      : aiConfig.provider === "openai"
        ? "OpenAI Proxy"
        : "OpenRouter Proxy"
    : "On-device";
  const suggestedPrompts = [
    topCategories[0] ? `How do I reduce spending in ${topCategories[0].name} without being too aggressive?` : "",
    unusualTransactions.length ? "Review the unusual transactions and tell me which one matters most." : "",
    totals.income > 0 ? "Based on my current income, how much should go to spending, investing, and emergency reserves?" : "",
    "What are the next three actions that would improve my finances this month?",
  ].filter(Boolean);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("ai.title", "AI Insights")}</h1>
          <p>{t("ai.subtitle", "Personalized financial intelligence powered by your transaction graph.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!!chatMessages.length && <button className="icon-btn" onClick={onClearChat}>{t("ai.clear", "Clear Chat")}</button>}
          <button className="btn-primary" onClick={onGenerate} disabled={aiState.loading}>
            {aiState.loading ? "Analyzing…" : t("ai.refresh", "Refresh Insights")}
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("ai.topSpendBucket", "Top Spend Bucket")}</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
          <div className="sc-sub">{topCategories[0]?.name || t("ai.topSpendEmpty", "No expense data yet")}</div>
        </div>
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("dashboard.savingsRateLabel", "Savings Rate")}</div>
          <div className="sc-value" style={{ color: totals.savingsRate >= 20 ? "var(--income)" : "var(--accent)" }}>
            {totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}
          </div>
          <div className="sc-sub">{t("ai.savingsRateCardSub", "Used for savings, investment, and risk recommendations.")}</div>
        </div>
      </div>

      {aiState.error && <div className="alert-item warn" style={{ marginBottom: 12 }}><strong>AI request issue</strong><p>{aiState.error}</p></div>}

      {report ? (
        <div className="ai-layout">
          <div className="ai-main-grid">
            <div className="ai-main-col">
              <div className="section-card ai-chat-card">
                <div className="ai-chat-head">
                  <h3>{t("ai.askTitle", "Ask Finwise AI")}</h3>
                  <p className="ai-chat-sub">
                    Ask about savings, unusual spending, investing, insurance, goals, or net worth. The answer uses your live financial context.
                  </p>
                  <div className="prompt-strip">
                    {suggestedPrompts.map((prompt) => (
                      <button key={prompt} className="prompt-chip" onClick={() => setQuestion(prompt)}>
                        {prompt}
                      </button>
                    ))}
                  </div>
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
                      {t("ai.noQuestions", "No questions yet. Start with something specific like \"Where can I reduce spending next month?\" or \"Am I investing enough relative to my income?\"")}
                    </div>
                  )}
                </div>
                <div className="ai-chat-compose">
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
                      {askLoading ? "Thinking…" : t("ai.ask", "Ask")}
                    </button>
                    <span className="muted">
                      {backendHealth?.providers?.[aiConfig.provider]
                        ? `Using secured backend AI via ${modeLabel}.`
                        : "Using local reasoning because no AI provider key is configured."}
                    </span>
                  </div>
                  {!backendHealth?.providers?.[aiConfig.provider] && (
                    <p style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 6 }}>
                      Current provider <strong>{aiConfig.provider}</strong> is not configured on the backend proxy yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="ai-main-col">
              <div className="section-card">
                <h3>{t("ai.quickContext", "Quick Context")}</h3>
                <div className="stack">
                  {report.summary.map((line) => <div key={line} className="stat-line"><span>{line}</span></div>)}
                </div>
              </div>

              <div className="section-card">
                <h3>{t("ai.overview", "Overview")}</h3>
                <p style={{ marginBottom: 12 }}>{report.headline}</p>
                <div className="stack">
                  {report.summary.map((line) => <div key={line} className="stat-line"><span>{line}</span></div>)}
                </div>
              </div>

              {!!aiState.externalText && (
                <div className="section-card">
                  <h3>{t("ai.modelNotes", "Model Notes")}</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{aiState.externalText}</p>
                </div>
              )}
            </div>
          </div>

          <div className="ai-insights-grid">
            <div className="section-card">
              <h3>{t("ai.nextMoves", "Next Best Moves")}</h3>
              <div className="insight-list">
                {report.tips.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.action", "Action")}</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card">
              <h3>{t("ai.savingsOpp", "Savings Opportunities")}</h3>
              <div className="insight-list">
                {report.opportunities.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.opportunity", "Opportunity")}</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card">
              <h3>{t("ai.investGuidance", "Investment Guidance")}</h3>
              <div className="insight-list">
                {report.investmentIdeas.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.portfolioNudge", "Portfolio Nudge")}</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card">
              <h3>{t("ai.anomalyWatch", "Anomaly Watch")}</h3>
              {report.anomalies.length ? (
                <div className="insight-list">
                  {report.anomalies.map((item) => (
                    <div key={item} className="alert-item warn">
                      <strong>{t("ai.unusualSpendLabel", "Unusual Spend")}</strong>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{t("ai.noAnomalies", "No unusual transactions were flagged in the current scan.")}</p>
              )}
            </div>

            {unusualTransactions.length > 0 && (
              <div className="section-card">
                <h3>{t("ai.flaggedTx", "Flagged Transactions")}</h3>
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
          <h3>{t("ai.noInsights", "No insights yet")}</h3>
          <p>Run the analyzer to generate spending insights, anomaly detection, savings opportunities, and investment suggestions from your live data.</p>
        </div>
      )}
    </>
  );
}
