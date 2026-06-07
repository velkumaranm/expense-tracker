import { useState } from "react";
import { fmtINR } from "../lib/utils";
import { getCategoryLabel, localizeKnownText, useI18n } from "../lib/i18n";

export default function AIInsights({
  report = null,
  aiState = {},
  onGenerate = () => {},
  aiConfig = { provider: "openrouter" },
  backendHealth = {},
  isAdmin = false,
  topCategories = [],
  unusualTransactions = [],
  totals = { income: 0, expense: 0, investment: 0, insurance: 0, balance: 0, savingsRate: 0 },
  chatMessages = [],
  onAskQuestion = async () => {},
  onClearChat = () => {},
  askLoading = false,
}) {
  const { t, language } = useI18n();
  aiState = aiState || {};
  aiConfig = aiConfig || { provider: "openrouter" };
  backendHealth = backendHealth || {};
  const safeTopCategories = Array.isArray(topCategories) ? topCategories : [];
  const safeUnusualTransactions = Array.isArray(unusualTransactions) ? unusualTransactions : [];
  const safeChatMessages = Array.isArray(chatMessages) ? chatMessages : [];
  const safeTotals = { income: 0, expense: 0, investment: 0, insurance: 0, balance: 0, savingsRate: 0, ...(totals || {}) };
  const safeReport = report ? {
    headline: "",
    summary: [],
    tips: [],
    opportunities: [],
    investmentIdeas: [],
    anomalies: [],
    ...report,
    summary: Array.isArray(report.summary) ? report.summary : [],
    tips: Array.isArray(report.tips) ? report.tips : [],
    opportunities: Array.isArray(report.opportunities) ? report.opportunities : [],
    investmentIdeas: Array.isArray(report.investmentIdeas) ? report.investmentIdeas : [],
    anomalies: Array.isArray(report.anomalies) ? report.anomalies : [],
  } : null;
  const [question, setQuestion] = useState("");
  const externalAIReady = isAdmin
    ? backendHealth?.providers?.[aiConfig.provider]
    : backendHealth?.aiEnabled;
  const modeLabel = isAdmin && backendHealth?.providers?.[aiConfig.provider]
    ? aiConfig.provider === "anthropic"
      ? "Claude Proxy"
      : aiConfig.provider === "openai"
        ? "OpenAI Proxy"
        : "OpenRouter Proxy"
    : "On-device";
  const suggestedPrompts = [
    safeTopCategories[0] ? `${t("ai.promptReducePrefix", "How do I reduce spending in")} ${getCategoryLabel(language, safeTopCategories[0].name, safeTopCategories[0].name)} ${t("ai.promptReduceSuffix", "without being too aggressive?")}` : "",
    safeUnusualTransactions.length ? t("ai.promptReviewAnomalies", "Review the unusual transactions and tell me which one matters most.") : "",
    safeTotals.income > 0 ? t("ai.promptAllocation", "Based on my current income, how much should go to spending, investing, and emergency reserves?") : "",
    t("ai.promptNextActions", "What are the next three actions that would improve my finances this month?"),
  ].filter(Boolean);
  const takeawaySections = safeReport ? [
    {
      title: t("ai.overview", "Overview"),
      items: [safeReport.headline, ...safeReport.summary],
    },
    {
      title: t("ai.nextMoves", "Next Best Moves"),
      items: safeReport.tips,
    },
    {
      title: t("ai.savingsOpp", "Savings Opportunities"),
      items: safeReport.opportunities,
    },
    {
      title: t("ai.investGuidance", "Investment Guidance"),
      items: safeReport.investmentIdeas,
    },
    {
      title: t("ai.anomalyWatch", "Anomaly Watch"),
      items: safeReport.anomalies.length ? safeReport.anomalies : [t("ai.noAnomalies", "No unusual transactions were flagged in the current scan.")],
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter(Boolean),
    }))
    .filter((section) => section.items.length) : [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("ai.title", "AI Insights")}</h1>
          <p>{t("ai.subtitle", "Personalized financial intelligence powered by your transaction graph.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!!safeChatMessages.length && <button className="icon-btn" onClick={onClearChat}>{t("ai.clear", "Clear Chat")}</button>}
          <button className="btn-primary" onClick={onGenerate} disabled={aiState.loading}>
            {aiState.loading ? t("ai.analyzing", "Analyzing...") : t("ai.refresh", "Refresh Insights")}
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("ai.topSpendBucket", "Top Spend Bucket")}</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{safeTopCategories[0] ? fmtINR(safeTopCategories[0].value) : "—"}</div>
          <div className="sc-sub">{safeTopCategories[0] ? getCategoryLabel(language, safeTopCategories[0].name, safeTopCategories[0].name) : t("ai.topSpendEmpty", "No expense data yet")}</div>
        </div>
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("dashboard.savingsRateLabel", "Savings Rate")}</div>
          <div className="sc-value" style={{ color: safeTotals.savingsRate >= 20 ? "var(--income)" : "var(--accent)" }}>
            {safeTotals.income > 0 ? `${safeTotals.savingsRate.toFixed(1)}%` : "—"}
          </div>
          <div className="sc-sub">{t("ai.savingsRateCardSub", "Used for savings, investment, and risk recommendations.")}</div>
        </div>
      </div>

      {aiState.error && <div className="alert-item warn" style={{ marginBottom: 12 }}><strong>{t("ai.requestIssue", "AI request issue")}</strong><p>{aiState.error}</p></div>}

      {safeReport ? (
        <div className="ai-layout">
          {!!takeawaySections.length && (
            <div className="section-card ai-takeaways-card">
              <h3>{t("ai.keyTakeaways", "Key Takeaways")}</h3>
              <div className="takeaway-stack">
                {takeawaySections.map((section) => (
                  <div key={section.title} className="takeaway-row">
                    <strong>{localizeKnownText(language, section.title)}</strong>
                    <ul className="takeaway-inline-list">
                      {section.items.map((item) => (
                        <li key={item}>{localizeKnownText(language, item)}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ai-main-grid">
            <div className="ai-main-col">
              <div className="section-card ai-chat-card">
                <div className="ai-chat-head">
                  <h3>{t("ai.askTitle", "Ask Finwise AI")}</h3>
                  <p className="ai-chat-sub">
                    {t("ai.askHelp", "Ask about savings, unusual spending, investing, insurance, goals, or net worth. The answer uses your live financial context.")}
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
                  {safeChatMessages.length ? (
                    safeChatMessages.map((msg) => (
                      <div key={msg.id} className={`ai-message ${msg.role === "user" ? "user" : "assistant"}`}>
                        <div className="ai-message-meta">
                          <strong>{msg.role === "user" ? t("ai.you", "You") : "Finwise AI"}</strong>
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
                      placeholder={t("ai.questionPlaceholder", "Example: Where can I cut spending next month without hurting my goals?")}
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
                      {askLoading ? t("ai.thinking", "Thinking...") : t("ai.ask", "Ask")}
                    </button>
                    <span className="muted">
                      {externalAIReady
                        ? `${t("ai.usingBackend", "Using secured backend AI via")} ${modeLabel}.`
                        : t("ai.usingLocal", "Using local reasoning because no AI provider key is configured.")}
                    </span>
                  </div>
                  {!externalAIReady && (
                    <p style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 6 }}>
                      {isAdmin
                        ? <>{t("ai.providerNotConfiguredPrefix", "Current provider")} <strong>{aiConfig.provider}</strong> {t("ai.providerNotConfiguredSuffix", "is not configured on the backend proxy yet.")}</>
                        : t("ai.backendUnavailable", "Backend AI is unavailable right now, so Finwise is using local reasoning.")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="ai-main-col">
              <div className="section-card ai-context-card">
                <h3>{t("ai.quickContext", "Quick Context")}</h3>
                <div className="stack">
                  {safeReport.summary.map((line) => <div key={line} className="stat-line"><span>{localizeKnownText(language, line)}</span></div>)}
                </div>
              </div>

              <div className="section-card ai-overview-card">
                <h3>{t("ai.overview", "Overview")}</h3>
                <p style={{ marginBottom: 12 }}>{localizeKnownText(language, safeReport.headline)}</p>
                <div className="stack">
                  {safeReport.summary.map((line) => <div key={line} className="stat-line"><span>{localizeKnownText(language, line)}</span></div>)}
                </div>
              </div>

            </div>
          </div>

          <div className="ai-insights-grid">
            <div className="section-card ai-insight-card">
              <h3>{t("ai.nextMoves", "Next Best Moves")}</h3>
              <div className="insight-list">
                {safeReport.tips.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.action", "Action")}</strong>
                    <p>{localizeKnownText(language, item)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card ai-insight-card">
              <h3>{t("ai.savingsOpp", "Savings Opportunities")}</h3>
              <div className="insight-list">
                {safeReport.opportunities.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.opportunity", "Opportunity")}</strong>
                    <p>{localizeKnownText(language, item)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card ai-insight-card">
              <h3>{t("ai.investGuidance", "Investment Guidance")}</h3>
              <div className="insight-list">
                {safeReport.investmentIdeas.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.portfolioNudge", "Portfolio Nudge")}</strong>
                    <p>{localizeKnownText(language, item)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card ai-insight-card">
              <h3>{t("ai.anomalyWatch", "Anomaly Watch")}</h3>
              {safeReport.anomalies.length ? (
                <div className="insight-list">
                  {safeReport.anomalies.map((item) => (
                    <div key={item} className="alert-item warn">
                      <strong>{t("ai.unusualSpendLabel", "Unusual Spend")}</strong>
                      <p>{localizeKnownText(language, item)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{t("ai.noAnomalies", "No unusual transactions were flagged in the current scan.")}</p>
              )}
            </div>

            {safeUnusualTransactions.length > 0 && (
              <div className="section-card ai-insight-card">
                <h3>{t("ai.flaggedTx", "Flagged Transactions")}</h3>
                <div className="stack">
                  {safeUnusualTransactions.map((tx) => (
                    <div key={tx.id} className="table-row">
                      <div className="split-row">
                        <strong>{getCategoryLabel(language, tx.category, tx.category)}</strong>
                        <span style={{ color: "var(--expense)" }}>{fmtINR(tx.amount)}</span>
                      </div>
                      <p>{tx.date} • {tx.note || t("history.noNote", "No note")}</p>
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
          <p>{t("ai.runAnalyzerHelp", "Run the analyzer to generate spending insights, anomaly detection, savings opportunities, and investment suggestions from your live data.")}</p>
        </div>
      )}
    </>
  );
}
