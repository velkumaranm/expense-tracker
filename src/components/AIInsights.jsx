import { useState } from "react";
import { fmtINR } from "../lib/utils";
import { getCategoryLabel, localizeKnownText, useI18n } from "../lib/i18n";

function parseModelSections(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\*\*/g, "").replace(/#+\s*/g, "").trim())
    .filter(Boolean)
    .filter((line) => !/^personal finance analysis/i.test(line))
    .filter((line) => !/^here'?s an analysis/i.test(line));

  const sections = [];
  let current = { title: "Summary", items: [] };

  const pushCurrent = () => {
    if (current.items.length) sections.push(current);
  };

  for (const line of lines) {
    if (/^[|].*[|]$/.test(line) || /^[-|:\s]+$/.test(line)) continue;
    if (/^(overview|risks?|opportunities|recommendations|cash flow|balance sheet|commitments|watch|next steps?)[:-]?$/i.test(line)) {
      pushCurrent();
      current = { title: line.replace(/[:-]+$/, "").trim(), items: [] };
      continue;
    }
    const cleaned = line.replace(/^[-*•]\s*/, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length < 3) continue;
    if (/^(item|amount|comment)$/i.test(cleaned)) continue;
    current.items.push(cleaned);
  }

  pushCurrent();
  return sections
    .map((section) => ({
      title: section.title,
      items: section.items,
    }))
    .filter((section) => section.items.length);
}

export default function AIInsights({
  report,
  aiState,
  onGenerate,
  aiConfig,
  backendHealth,
  isAdmin,
  topCategories,
  unusualTransactions,
  totals,
  chatMessages,
  onAskQuestion,
  onClearChat,
  askLoading,
}) {
  const { t, language } = useI18n();
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
    topCategories[0] ? `${t("ai.promptReducePrefix", "How do I reduce spending in")} ${getCategoryLabel(language, topCategories[0].name, topCategories[0].name)} ${t("ai.promptReduceSuffix", "without being too aggressive?")}` : "",
    unusualTransactions.length ? t("ai.promptReviewAnomalies", "Review the unusual transactions and tell me which one matters most.") : "",
    totals.income > 0 ? t("ai.promptAllocation", "Based on my current income, how much should go to spending, investing, and emergency reserves?") : "",
    t("ai.promptNextActions", "What are the next three actions that would improve my finances this month?"),
  ].filter(Boolean);
  const modelSections = aiState.language === language ? parseModelSections(aiState.externalText) : [];

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
            {aiState.loading ? t("ai.analyzing", "Analyzing...") : t("ai.refresh", "Refresh Insights")}
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("ai.topSpendBucket", "Top Spend Bucket")}</div>
          <div className="sc-value" style={{ color: "var(--expense)" }}>{topCategories[0] ? fmtINR(topCategories[0].value) : "—"}</div>
          <div className="sc-sub">{topCategories[0] ? getCategoryLabel(language, topCategories[0].name, topCategories[0].name) : t("ai.topSpendEmpty", "No expense data yet")}</div>
        </div>
        <div className="summary-card summary-span-6">
          <div className="sc-label">{t("dashboard.savingsRateLabel", "Savings Rate")}</div>
          <div className="sc-value" style={{ color: totals.savingsRate >= 20 ? "var(--income)" : "var(--accent)" }}>
            {totals.income > 0 ? `${totals.savingsRate.toFixed(1)}%` : "—"}
          </div>
          <div className="sc-sub">{t("ai.savingsRateCardSub", "Used for savings, investment, and risk recommendations.")}</div>
        </div>
      </div>

      {aiState.error && <div className="alert-item warn" style={{ marginBottom: 12 }}><strong>{t("ai.requestIssue", "AI request issue")}</strong><p>{aiState.error}</p></div>}

      {report ? (
        <div className="ai-layout">
          {!!modelSections.length && (
            <div className="section-card ai-takeaways-card">
              <h3>{t("ai.keyTakeaways", "Key Takeaways")}</h3>
              <div className="takeaway-stack">
                {modelSections.map((section) => (
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
                  {chatMessages.length ? (
                    chatMessages.map((msg) => (
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
                  {report.summary.map((line) => <div key={line} className="stat-line"><span>{localizeKnownText(language, line)}</span></div>)}
                </div>
              </div>

              <div className="section-card ai-overview-card">
                <h3>{t("ai.overview", "Overview")}</h3>
                <p style={{ marginBottom: 12 }}>{localizeKnownText(language, report.headline)}</p>
                <div className="stack">
                  {report.summary.map((line) => <div key={line} className="stat-line"><span>{localizeKnownText(language, line)}</span></div>)}
                </div>
              </div>

            </div>
          </div>

          <div className="ai-insights-grid">
            <div className="section-card ai-insight-card">
              <h3>{t("ai.nextMoves", "Next Best Moves")}</h3>
              <div className="insight-list">
                {report.tips.map((item) => (
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
                {report.opportunities.map((item) => (
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
                {report.investmentIdeas.map((item) => (
                  <div key={item} className="insight-item">
                    <strong>{t("ai.portfolioNudge", "Portfolio Nudge")}</strong>
                    <p>{localizeKnownText(language, item)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-card ai-insight-card">
              <h3>{t("ai.anomalyWatch", "Anomaly Watch")}</h3>
              {report.anomalies.length ? (
                <div className="insight-list">
                  {report.anomalies.map((item) => (
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

            {unusualTransactions.length > 0 && (
              <div className="section-card ai-insight-card">
                <h3>{t("ai.flaggedTx", "Flagged Transactions")}</h3>
                <div className="stack">
                  {unusualTransactions.map((tx) => (
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
