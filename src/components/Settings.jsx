import { useState } from "react";
import { SUPPORTED_LANGUAGES, useI18n } from "../lib/i18n";

export default function Settings({
  budget,
  budgetInput,
  setBudgetInput,
  onSaveBudget,
  darkMode,
  setDarkMode,
  user,
  logout,
  aiConfig,
  setAiConfig,
  notificationsEnabled,
  setNotificationsEnabled,
  backendHealth,
  onSendVerificationEmail,
  onSendPasswordReset,
  onChangeEmail,
  language,
  setLanguage,
}) {
  const { t } = useI18n();
  const [nextEmail, setNextEmail] = useState(user?.email || "");
  const [accountState, setAccountState] = useState({ loading: "", error: "", ok: "" });

  const runAccountAction = async (loadingKey, action, successMessage) => {
    setAccountState({ loading: loadingKey, error: "", ok: "" });
    try {
      await action();
      setAccountState({ loading: "", error: "", ok: successMessage });
    } catch (e) {
      setAccountState({
        loading: "",
        error: e?.message?.replace("Firebase: ", "") || "Request failed.",
        ok: "",
      });
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("settings.title", "Settings")}</h1>
          <p>{t("settings.subtitle", "Appearance, budgets, AI configuration, and account preferences.")}</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.language", "Language")}</h3>
        <p>{t("settings.languageHelp", "Choose the language used for the app shell and key screens.")}</p>
        <div className="setting-row">
          <select className="fs" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {SUPPORTED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.appearance", "Appearance")}</h3>
        <p>Switch between dark and light mode. Your preference is saved automatically.</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{darkMode ? t("theme.dark", "Dark theme") : t("theme.light", "Light theme")}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setDarkMode((v) => !v)}>
            <div className={`tt-track ${darkMode ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.budget", "Monthly Budget")}</h3>
        <p>Budget warnings are used by the dashboard and smart notifications system.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly limit..." value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {!!budget && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text3)" }}>Current: <span style={{ color: "var(--accent)", fontWeight: 600 }}>₹{Number(budget).toLocaleString("en-IN")}</span></div>}
      </div>

      <div className="settings-section">
        <h3>{t("settings.notifications", "Smart Notifications")}</h3>
        <p>Warn about budget overruns, low savings, and unusual transactions.</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{notificationsEnabled ? t("common.enabled", "Enabled") : t("common.disabled", "Disabled")}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setNotificationsEnabled((v) => !v)}>
            <div className={`tt-track ${notificationsEnabled ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.ai", "AI Proxy Configuration")}</h3>
        <p>
          Provider keys now live only on the backend proxy. OpenRouter free is the default recommendation for everyday use, while OpenAI and Anthropic are available if you want premium models.
        </p>
        <div className="form-grid">
          <div className="fg">
            <label className="fl">Provider</label>
            <select className="fs" value={aiConfig.provider} onChange={(e) => setAiConfig((s) => ({ ...s, provider: e.target.value }))}>
              <option value="openrouter">OpenRouter Free Model</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Model</label>
            <input
              className="fi"
              placeholder={
                aiConfig.provider === "openrouter"
                  ? "openrouter/free"
                  : aiConfig.provider === "openai"
                    ? "gpt-4.1-mini"
                    : "claude-3-5-haiku-latest"
              }
              value={aiConfig.model}
              onChange={(e) => setAiConfig((s) => ({ ...s, model: e.target.value }))}
            />
          </div>
          <div className="fg full">
            <label className="fl">Free Model</label>
            <input className="fi" placeholder="openrouter/free" value={aiConfig.freeModel} onChange={(e) => setAiConfig((s) => ({ ...s, freeModel: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--text3)", lineHeight: 1.7 }}>
          Anthropic key: <strong style={{ color: backendHealth?.providers?.anthropic ? "var(--income)" : "var(--expense)" }}>{backendHealth?.providers?.anthropic ? "configured" : "missing"}</strong><br />
          OpenAI key: <strong style={{ color: backendHealth?.providers?.openai ? "var(--income)" : "var(--expense)" }}>{backendHealth?.providers?.openai ? "configured" : "missing"}</strong><br />
          OpenRouter key: <strong style={{ color: backendHealth?.providers?.openrouter ? "var(--income)" : "var(--expense)" }}>{backendHealth?.providers?.openrouter ? "configured" : "missing"}</strong><br />
          Proxy URL: <strong style={{ color: "var(--text)" }}>{backendHealth?.proxyUrl || "http://127.0.0.1:8787"}</strong>
        </div>
        {backendHealth?.warnings?.likelyOpenAIKeyStoredAsOpenRouter && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--accent)", lineHeight: 1.6 }}>
            It looks like an OpenAI-style key may be stored under <code>OPENROUTER_API_KEY</code>. Move it to <code>OPENAI_API_KEY</code> for the cleanest setup.
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>{t("settings.market", "Market Data")}</h3>
        <p>
          Finwise now uses a fallback ladder for market refresh: Twelve Data first where it has the strongest free allowance, then Finnhub, then Alpha Vantage. Mutual funds still use a free AMFI-backed NAV feed.
        </p>
        <div style={{ fontSize: 11.5, color: "var(--text3)", lineHeight: 1.7 }}>
          Twelve Data key: <strong style={{ color: backendHealth?.marketProviders?.twelveData ? "var(--income)" : "var(--expense)" }}>{backendHealth?.marketProviders?.twelveData ? "configured" : "missing"}</strong><br />
          Finnhub key: <strong style={{ color: backendHealth?.marketProviders?.finnhub ? "var(--income)" : "var(--expense)" }}>{backendHealth?.marketProviders?.finnhub ? "configured" : "missing"}</strong><br />
          Alpha Vantage key: <strong style={{ color: backendHealth?.marketProviders?.alphaVantage ? "var(--income)" : "var(--expense)" }}>{backendHealth?.marketProviders?.alphaVantage ? "configured" : "missing"}</strong><br />
          Mutual fund NAV feed: <strong style={{ color: "var(--income)" }}>available</strong><br />
          Refresh model: <strong style={{ color: "var(--text)" }}>manual, daily-friendly, fallback-aware</strong>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.account", "Account")}</h3>
        <p>
          Signed in as <strong style={{ color: "var(--text)" }}>{user?.email || "Google User"}</strong>
        </p>
        <div className="account-badges">
          <span className={`status-pill ${user?.emailVerified ? "verified" : "pending"}`}>
            {user?.emailVerified ? "Email verified" : "Email not verified"}
          </span>
          <span className="status-pill neutral">{user?.providerData?.map((p) => p.providerId.replace(".com", "")).join(", ") || "password"}</span>
        </div>
        {accountState.error && <div className="auth-error" style={{ marginTop: 14, marginBottom: 0 }}>{accountState.error}</div>}
        {accountState.ok && <div className="auth-ok" style={{ marginTop: 14, marginBottom: 0 }}>{accountState.ok}</div>}

        <div className="account-grid">
          <div className="account-card">
            <strong>Email verification</strong>
            <p>Send a verification email so your account is trusted for security-sensitive changes.</p>
            <button
              className="btn-secondary"
              disabled={accountState.loading === "verify" || user?.emailVerified}
              onClick={() => runAccountAction("verify", onSendVerificationEmail, "Verification email sent.")}
            >
              {user?.emailVerified ? "Already verified" : accountState.loading === "verify" ? "Sending..." : "Send verification email"}
            </button>
          </div>

          <div className="account-card">
            <strong>Password reset</strong>
            <p>Email yourself a secure reset link in case you want to rotate your password.</p>
            <button
              className="btn-secondary"
              disabled={accountState.loading === "reset"}
              onClick={() => runAccountAction("reset", onSendPasswordReset, "Password reset email sent.")}
            >
              {accountState.loading === "reset" ? "Sending..." : "Send reset email"}
            </button>
          </div>

          <div className="account-card account-card-wide">
            <strong>Change email address</strong>
            <p>We will send a verification link to the new address. The change completes after the link is approved.</p>
            <div className="setting-row">
              <input className="setting-input" type="email" value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} placeholder="new-email@example.com" />
              <button
                className="btn-save"
                disabled={accountState.loading === "change-email" || !nextEmail || nextEmail === user?.email}
                onClick={() =>
                  runAccountAction(
                    "change-email",
                    () => onChangeEmail(nextEmail),
                    `Verification sent to ${nextEmail}. Confirm it from your inbox to complete the email change.`
                  )
                }
              >
                {accountState.loading === "change-email" ? "Sending..." : "Change email"}
              </button>
            </div>
          </div>
        </div>

        <button className="danger-btn" style={{ marginTop: 18 }} onClick={logout}>Sign Out</button>
      </div>
    </>
  );
}
