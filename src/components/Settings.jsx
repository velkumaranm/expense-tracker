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
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Appearance, budgets, AI configuration, and account preferences.</p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <p>Switch between dark and light mode. Your preference is saved automatically.</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{darkMode ? "Dark mode" : "Light mode"}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setDarkMode((v) => !v)}>
            <div className={`tt-track ${darkMode ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Monthly Budget</h3>
        <p>Budget warnings are used by the dashboard and smart notifications system.</p>
        <div className="setting-row">
          <input className="setting-input" type="number" placeholder="Enter monthly limit…" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          <button className="btn-save" onClick={onSaveBudget}>Save</button>
        </div>
        {!!budget && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text3)" }}>Current: <span style={{ color: "var(--accent)", fontWeight: 600 }}>₹{Number(budget).toLocaleString("en-IN")}</span></div>}
      </div>

      <div className="settings-section">
        <h3>Smart Notifications</h3>
        <p>Warn about budget overruns, low savings, and unusual transactions.</p>
        <div className="toggle-row">
          <span style={{ fontSize: 13, color: "var(--text)" }}>{notificationsEnabled ? "Enabled" : "Disabled"}</span>
          <div className="theme-row" style={{ margin: 0, border: "none", padding: 0, background: "none" }} onClick={() => setNotificationsEnabled((v) => !v)}>
            <div className={`tt-track ${notificationsEnabled ? "on" : ""}`}>
              <div className="tt-thumb" />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>AI Proxy Configuration</h3>
        <p>
          Provider keys now live only on the backend proxy. Configure the provider here, then put real keys in server env vars.
        </p>
        <div className="form-grid">
          <div className="fg">
            <label className="fl">Provider</label>
            <select className="fs" value={aiConfig.provider} onChange={(e) => setAiConfig((s) => ({ ...s, provider: e.target.value }))}>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter Free Model</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Model</label>
            <input className="fi" placeholder={aiConfig.provider === "openai" ? "gpt-4.1-mini" : "claude-3-5-haiku-latest"} value={aiConfig.model} onChange={(e) => setAiConfig((s) => ({ ...s, model: e.target.value }))} />
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
        <h3>Account</h3>
        <p>Signed in as <strong style={{ color: "var(--text)" }}>{user?.email || user?.phoneNumber || "Google User"}</strong></p>
        <button className="danger-btn" onClick={logout}>Sign Out</button>
      </div>
    </>
  );
}
