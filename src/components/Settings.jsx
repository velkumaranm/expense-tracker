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
  isAdmin,
  userRole,
  onSendVerificationEmail,
  onSendPasswordReset,
  onChangeEmail,
  language,
  setLanguage,
  pwaInstalled,
  pwaInstallReady,
  onInstallApp,
}) {
  const { t } = useI18n();
  const [nextEmail, setNextEmail] = useState(user?.email || "");
  const [accountState, setAccountState] = useState({ loading: "", error: "", ok: "" });
  const isLocalInstallHost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const installHint = pwaInstalled
    ? t("settings.installInstalledHint", "Finwise is already installed on this device.")
    : pwaInstallReady
      ? t("settings.installReadyHint", "This device is ready to install Finwise.")
      : isLocalInstallHost
        ? t("settings.installLocalHint", "Install prompts are usually limited in local development. Open the deployed HTTPS app and use your browser's Install App / Add to Home Screen action.")
        : t("settings.installBrowserHint", "If your browser does not surface an install prompt, use its Add to Home Screen / Install App menu action.");

  const runAccountAction = async (loadingKey, action, successMessage) => {
    setAccountState({ loading: loadingKey, error: "", ok: "" });
    try {
      await action();
      setAccountState({ loading: "", error: "", ok: successMessage });
    } catch (e) {
      setAccountState({
        loading: "",
        error: e?.message?.replace("Firebase: ", "") || t("settings.requestFailed", "Request failed."),
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
        <p>{t("settings.appearanceHelp", "Switch between dark and light mode. Your preference is saved automatically.")}</p>
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
        <h3>{t("settings.installTitle", "Install App")}</h3>
        <p>
          {t("settings.installBody", "Add Finwise to your home screen or desktop for a cleaner app-like experience, faster relaunch, and offline-ready shell caching.")}
        </p>
        <div className="setting-row install-row" style={{ alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div className="muted" style={{ flex: 1, minWidth: 0 }}>
            {installHint}
          </div>
          <button
            className={pwaInstallReady && !pwaInstalled ? "btn-save" : "btn-secondary"}
            disabled={pwaInstalled}
            onClick={pwaInstallReady ? onInstallApp : undefined}
          >
            {pwaInstalled ? t("settings.installed", "Installed") : pwaInstallReady ? t("settings.installFinwise", "Install Finwise") : t("settings.useBrowserInstall", "Use browser install menu")}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t("settings.budget", "Monthly Budget")}</h3>
        <p>{t("settings.budgetHelp", "Budget warnings are used by the dashboard and smart notifications system.")}</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder={t("settings.budgetPlaceholder", "Enter monthly limit...")} value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>{t("common.save", "Save")}</button>
        </div>
        {!!budget && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text3)" }}>{t("settings.current", "Current")}: <span style={{ color: "var(--accent)", fontWeight: 600 }}>₹{Number(budget).toLocaleString("en-IN")}</span></div>}
      </div>

      <div className="settings-section">
        <h3>{t("settings.notifications", "Smart Notifications")}</h3>
        <p>{t("settings.notificationsHelp", "Warn about budget overruns, low savings, and unusual transactions.")}</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{notificationsEnabled ? t("common.enabled", "Enabled") : t("common.disabled", "Disabled")}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setNotificationsEnabled((v) => !v)}>
            <div className={`tt-track ${notificationsEnabled ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <div className="settings-section">
            <h3>{t("settings.ai", "AI Proxy Configuration")}</h3>
            <p>
              {t("settings.aiAdminHelp", "Provider keys live on the backend proxy. This section is only shown to admin users because it controls operator-level model behavior.")}
            </p>
            <div className="form-grid">
              <div className="fg">
                <label className="fl">{t("settings.provider", "Provider")}</label>
                <select className="fs" value={aiConfig.provider} onChange={(e) => setAiConfig((s) => ({ ...s, provider: e.target.value }))}>
                  <option value="openrouter">{t("settings.openRouterFree", "OpenRouter Free Model")}</option>
                  <option value="anthropic">{t("settings.anthropicClaude", "Anthropic Claude")}</option>
                  <option value="openai">{t("settings.openAi", "OpenAI")}</option>
                </select>
              </div>
              <div className="fg">
                <label className="fl">{t("settings.model", "Model")}</label>
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
                <label className="fl">{t("settings.freeModel", "Free Model")}</label>
                <input className="fi" placeholder="openrouter/free" value={aiConfig.freeModel} onChange={(e) => setAiConfig((s) => ({ ...s, freeModel: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--text3)", lineHeight: 1.7 }}>
              {t("settings.anthropicKey", "Anthropic key")}: <strong style={{ color: backendHealth?.providers?.anthropic ? "var(--income)" : "var(--expense)" }}>{backendHealth?.providers?.anthropic ? t("settings.configured", "configured") : t("settings.missing", "missing")}</strong><br />
              {t("settings.openAiKey", "OpenAI key")}: <strong style={{ color: backendHealth?.providers?.openai ? "var(--income)" : "var(--expense)" }}>{backendHealth?.providers?.openai ? t("settings.configured", "configured") : t("settings.missing", "missing")}</strong><br />
              {t("settings.openRouterKey", "OpenRouter key")}: <strong style={{ color: backendHealth?.providers?.openrouter ? "var(--income)" : "var(--expense)" }}>{backendHealth?.providers?.openrouter ? t("settings.configured", "configured") : t("settings.missing", "missing")}</strong><br />
              {t("settings.proxyUrl", "Proxy URL")}: <strong style={{ color: "var(--text)" }}>{backendHealth?.proxyUrl || "http://127.0.0.1:8787"}</strong>
            </div>
            {backendHealth?.warnings?.likelyOpenAIKeyStoredAsOpenRouter && (
              <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--accent)", lineHeight: 1.6 }}>
                {t("settings.openAiKeyWarning", "It looks like an OpenAI-style key may be stored under OPENROUTER_API_KEY. Move it to OPENAI_API_KEY for the cleanest setup.")}
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>{t("settings.market", "Market Data")}</h3>
            <p>
              {t("settings.marketAdminHelp", "Finwise uses a fallback ladder for market refresh: Twelve Data first where it has the strongest free allowance, then Finnhub, then Alpha Vantage. Mutual funds still use a free AMFI-backed NAV feed.")}
            </p>
            <div style={{ fontSize: 11.5, color: "var(--text3)", lineHeight: 1.7 }}>
              {t("settings.twelveDataKey", "Twelve Data key")}: <strong style={{ color: backendHealth?.marketProviders?.twelveData ? "var(--income)" : "var(--expense)" }}>{backendHealth?.marketProviders?.twelveData ? t("settings.configured", "configured") : t("settings.missing", "missing")}</strong><br />
              {t("settings.finnhubKey", "Finnhub key")}: <strong style={{ color: backendHealth?.marketProviders?.finnhub ? "var(--income)" : "var(--expense)" }}>{backendHealth?.marketProviders?.finnhub ? t("settings.configured", "configured") : t("settings.missing", "missing")}</strong><br />
              {t("settings.alphaVantageKey", "Alpha Vantage key")}: <strong style={{ color: backendHealth?.marketProviders?.alphaVantage ? "var(--income)" : "var(--expense)" }}>{backendHealth?.marketProviders?.alphaVantage ? t("settings.configured", "configured") : t("settings.missing", "missing")}</strong><br />
              {t("settings.mfNavFeed", "Mutual fund NAV feed")}: <strong style={{ color: "var(--income)" }}>{t("settings.available", "available")}</strong><br />
              {t("settings.refreshModel", "Refresh model")}: <strong style={{ color: "var(--text)" }}>{t("settings.refreshModelValue", "manual, daily-friendly, fallback-aware")}</strong>
            </div>
          </div>
        </>
      )}

      <div className="settings-section">
        <h3>{t("settings.account", "Account")}</h3>
        <p>
          {t("settings.signedInAs", "Signed in as")} <strong style={{ color: "var(--text)" }}>{user?.email || t("settings.googleUser", "Google User")}</strong>
        </p>
        <div className="account-badges">
          <span className={`status-pill ${user?.emailVerified ? "verified" : "pending"}`}>
            {user?.emailVerified ? t("settings.emailVerified", "Email verified") : t("settings.emailNotVerified", "Email not verified")}
          </span>
          <span className="status-pill neutral">{user?.providerData?.map((p) => p.providerId.replace(".com", "")).join(", ") || t("settings.passwordProvider", "password")}</span>
          <span className={`status-pill ${isAdmin ? "verified" : "neutral"}`}>{isAdmin ? t("settings.admin", "Admin") : userRole || t("settings.user", "User")}</span>
        </div>
        {!isAdmin && user?.email && (
          <div className="auth-ok" style={{ marginTop: 14, marginBottom: 0 }}>
            {t("settings.adminHintPrefix", "To grant this account admin access, add")} <strong>{user.email}</strong> {t("settings.adminHintSuffix", "to FINWISE_ADMIN_EMAILS on the backend or assign the Firebase auth claim role=admin.")}
          </div>
        )}
        {accountState.error && <div className="auth-error" style={{ marginTop: 14, marginBottom: 0 }}>{accountState.error}</div>}
        {accountState.ok && <div className="auth-ok" style={{ marginTop: 14, marginBottom: 0 }}>{accountState.ok}</div>}

        <div className="account-grid">
          <div className="account-card">
            <strong>{t("settings.emailVerification", "Email verification")}</strong>
            <p>{t("settings.emailVerificationHelp", "Send a verification email so your account is trusted for security-sensitive changes.")}</p>
            <button
              className="btn-secondary"
              disabled={accountState.loading === "verify" || user?.emailVerified}
              onClick={() => runAccountAction("verify", onSendVerificationEmail, t("settings.verificationSent", "Verification email sent."))}
            >
              {user?.emailVerified ? t("settings.alreadyVerified", "Already verified") : accountState.loading === "verify" ? t("settings.sending", "Sending...") : t("settings.sendVerification", "Send verification email")}
            </button>
          </div>

          <div className="account-card">
            <strong>{t("settings.passwordReset", "Password reset")}</strong>
            <p>{t("settings.passwordResetHelp", "Email yourself a secure reset link in case you want to rotate your password.")}</p>
            <button
              className="btn-secondary"
              disabled={accountState.loading === "reset"}
              onClick={() => runAccountAction("reset", onSendPasswordReset, t("settings.passwordResetSent", "Password reset email sent."))}
            >
              {accountState.loading === "reset" ? t("settings.sending", "Sending...") : t("settings.sendReset", "Send reset email")}
            </button>
          </div>

          <div className="account-card account-card-wide">
            <strong>{t("settings.changeEmail", "Change email address")}</strong>
            <p>{t("settings.changeEmailHelp", "We will send a verification link to the new address. The change completes after the link is approved.")}</p>
            <div className="setting-row">
              <input className="setting-input" type="email" value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} placeholder="new-email@example.com" />
              <button
                className="btn-save"
                disabled={accountState.loading === "change-email" || !nextEmail || nextEmail === user?.email}
                onClick={() =>
                  runAccountAction(
                    "change-email",
                    () => onChangeEmail(nextEmail),
                    `${t("settings.changeEmailSent", "Verification sent. Confirm it from your inbox to complete the email change.")} ${nextEmail}`
                  )
                }
              >
                {accountState.loading === "change-email" ? t("settings.sending", "Sending...") : t("settings.changeEmailButton", "Change email")}
              </button>
            </div>
          </div>
        </div>

        <button className="danger-btn" style={{ marginTop: 18 }} onClick={logout}>{t("auth.signout", "Sign Out")}</button>
      </div>
    </>
  );
}
