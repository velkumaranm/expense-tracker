import { useState } from "react";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { useI18n } from "../lib/i18n";

const EMAIL_MEMORY_KEY = "finwise-remembered-emails";

function readRememberedEmails() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EMAIL_MEMORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function rememberEmailAddress(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return;
  const next = [normalized, ...readRememberedEmails().filter((item) => item !== normalized)].slice(0, 5);
  window.localStorage.setItem(EMAIL_MEMORY_KEY, JSON.stringify(next));
}

export default function LoginPage({
  onLogin,
  onSignup,
  onGoogle,
  onSendEmailLink,
  passkeySupported = false,
}) {
  const { t } = useI18n();
  const [authTab, setAuthTab] = useState("email");
  const [signTab, setSignTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [sentLinkEmail, setSentLinkEmail] = useState("");
  const [rememberedEmails, setRememberedEmails] = useState(() => readRememberedEmails());
  const [showSavedEmails, setShowSavedEmails] = useState(false);
  const getError = (e, fallback) => {
    const code = String(e?.code || "");
    if (code === "auth/unauthorized-domain") {
      return t(
        "login.googleDomainError",
        "Google sign-in is not enabled for this app address. Add this domain in Firebase Authentication > Settings > Authorized domains, then try again."
      );
    }
    if (code === "auth/popup-blocked") {
      return t("login.googlePopupBlocked", "The browser blocked the Google sign-in popup. Allow popups or use the magic link.");
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return t("login.googlePopupClosed", "Google sign-in was closed before it finished.");
    }
    if (code === "auth/network-request-failed") {
      return t("login.networkFailed", "Network error. Check your connection and try again.");
    }
    return e?.message?.replace("Firebase: ", "") || fallback;
  };

  const handleGoogle = async () => {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      await onGoogle();
    } catch (e) {
      setErr(getError(e, t("login.googleFailed", "Google sign-in failed.")));
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email || !password) return;
    setErr("");
    setOk("");
    setLoading(true);
    try {
      if (signTab === "signin") await onLogin(email, password, rememberMe);
      else await onSignup(email, password);
      rememberEmailAddress(email);
      setRememberedEmails(readRememberedEmails());
    } catch (e) {
      setErr(getError(e, "Authentication failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!resetEmail) return;
    setErr("");
    setOk("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setOk(t("login.resetSent", "Reset link sent. Check your inbox."));
    } catch (e) {
      setErr(getError(e, t("login.resetFailed", "Could not send reset email.")));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLink = async () => {
    if (!magicEmail) return;
    setErr("");
    setOk("");
    setLoading(true);
    try {
      await onSendEmailLink(magicEmail);
      setSentLinkEmail(magicEmail);
      setOk(`Sign-in link sent to ${magicEmail}.`);
      rememberEmailAddress(magicEmail);
      setRememberedEmails(readRememberedEmails());
    } catch (e) {
      setErr(getError(e, "Could not send sign-in link."));
    } finally {
      setLoading(false);
    }
  };

  const knownEmails = rememberedEmails.filter(Boolean);
  const pickEmail = (value) => {
    setEmail(value);
    setMagicEmail(value);
    setResetEmail(value);
    setShowSavedEmails(false);
  };

  if (forgot) {
    return (
      <div className="login-page">
        <div className="login-bg" />
        <div className="login-card">
          <div className="login-logo">◈ Finwise</div>
          <div className="login-tagline">{t("login.resetPassword", "Reset your password")}</div>
          {err && <div className="auth-error">{err}</div>}
          {ok && <div className="auth-ok">{ok}</div>}
          {!ok && (
            <>
              <div className="fg" style={{ marginBottom: 14 }}>
              <label className="fl">{t("login.email", "Email")}</label>
              <input className="fi" name="email" autoComplete="email" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            </div>
              <button className="btn-primary" onClick={handleForgot} disabled={loading}>
                {loading ? t("settings.sending", "Sending...") : t("login.sendResetLink", "Send Reset Link")}
              </button>
            </>
          )}
          <button
            className="btn-secondary"
            style={{ marginTop: 10 }}
            onClick={() => {
              setForgot(false);
              setErr("");
              setOk("");
            }}
          >
            {t("login.signin", "Sign In")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">◈ Finwise</div>
        <div className="login-tagline">{t("login.tagline", "Premium personal finance command center")}</div>
        <div className="login-quick-panel">
          <div className="login-quick-copy">
            <strong>{t("login.quickTitle", "Mobile-friendly sign in")}</strong>
            <p>{t("login.quickBody", "Use Google, a magic link in your inbox, or email and password when you want the fastest path back in.")}</p>
          </div>
          <div className="login-quick-actions">
            <button className="google-btn login-quick-btn" onClick={handleGoogle} disabled={loading}>
              {loading ? t("common.pleaseWait", "Please wait...") : t("login.google", "Continue with Google")}
            </button>
          </div>
          {!passkeySupported ? (
            <div className="login-passkey-note">
              {t("login.passkeyLocalNote", "Passkeys are shown after sign-in inside Settings. For now, use Google, email, or a magic link to get into Finwise.")}
            </div>
          ) : null}
          {passkeySupported ? (
            <div className="login-passkey-note">
              {t("login.passkeySetupNote", "After your first sign-in, you can add a device passkey from Settings. A full passkey-only sign-in flow is not enabled yet.")}
            </div>
          ) : null}
        </div>
        <div className="tab2">
          <button className={`tab2-btn ${authTab === "email" ? "active" : ""}`} onClick={() => setAuthTab("email")}>{t("login.email", "Email")}</button>
          <button className={`tab2-btn ${authTab === "email-link" ? "active" : ""}`} onClick={() => setAuthTab("email-link")}>{t("login.magic", "Magic Link")}</button>
        </div>
        {err && <div className="auth-error">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}
        {authTab === "email" ? (
          <>
            <div className="tab2" style={{ marginBottom: 16 }}>
              <button className={`tab2-btn ${signTab === "signin" ? "active" : ""}`} onClick={() => setSignTab("signin")}>{t("login.signin", "Sign In")}</button>
              <button className={`tab2-btn ${signTab === "signup" ? "active" : ""}`} onClick={() => setSignTab("signup")}>{t("login.signup", "Sign Up")}</button>
            </div>
            <div className="fg" style={{ marginBottom: 12, position: "relative" }}>
              <label className="fl">{t("login.email", "Email")}</label>
              <input
                className="fi"
                name="username"
                autoComplete="username email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onFocus={() => setShowSavedEmails(true)}
                onBlur={() => setTimeout(() => setShowSavedEmails(false), 120)}
                onChange={(e) => setEmail(e.target.value)}
              />
              {showSavedEmails && knownEmails.length ? (
                <div
                  style={{
                    position: "absolute",
                    insetInline: 0,
                    top: "100%",
                    marginTop: 6,
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: 16,
                    padding: 8,
                    boxShadow: "0 18px 40px rgba(0,0,0,.08)",
                    zIndex: 20,
                  }}
                >
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("login.savedAccounts", "Saved accounts")}</div>
                  <div className="stack" style={{ gap: 6 }}>
                    {knownEmails.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="btn-secondary"
                        style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickEmail(item);
                        }}
                      >
                        <span style={{ overflowWrap: "anywhere" }}>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="fg" style={{ marginBottom: 4 }}>
              <label className="fl">{t("login.password", "Password")}</label>
              <input className="fi" name="current-password" autoComplete="current-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEmail()} />
            </div>
            {signTab === "signin" ? (
              <div className="setting-row" style={{ marginBottom: 10, alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)", cursor: "pointer" }}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  {t("login.keep", "Keep me signed in on this device")}
                </label>
                <span className="forgot-link" onClick={() => setForgot(true)}>{t("login.forgot", "Forgot password?")}</span>
              </div>
            ) : null}
            <button className="btn-primary" onClick={handleEmail} disabled={loading}>
              {loading ? t("common.pleaseWait", "Please wait...") : signTab === "signin" ? t("login.signin", "Sign In") : t("login.signup", "Sign Up")}
            </button>
          </>
        ) : (
          <>
            <div className="magic-header">
              <strong>{t("login.passwordless", "Passwordless sign-in")}</strong>
              <p>{t("login.passwordlessHelp", "Get a secure sign-in link by email. It is faster than a code and works smoothly across desktop and mobile.")}</p>
            </div>
            <div className="fg" style={{ marginBottom: 8, position: "relative" }}>
              <label className="fl">{t("login.email", "Email")}</label>
              <input
                className="fi"
                name="email-link"
                autoComplete="email"
                type="email"
                placeholder="you@example.com"
                value={magicEmail}
                onFocus={() => setShowSavedEmails(true)}
                onBlur={() => setTimeout(() => setShowSavedEmails(false), 120)}
                onChange={(e) => setMagicEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailLink()}
              />
              {showSavedEmails && knownEmails.length ? (
                <div
                  style={{
                    position: "absolute",
                    insetInline: 0,
                    top: "100%",
                    marginTop: 6,
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: 16,
                    padding: 8,
                    boxShadow: "0 18px 40px rgba(0,0,0,.08)",
                    zIndex: 20,
                  }}
                >
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("login.savedAccounts", "Saved accounts")}</div>
                  <div className="stack" style={{ gap: 6 }}>
                    {knownEmails.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="btn-secondary"
                        style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickEmail(item);
                        }}
                      >
                        <span style={{ overflowWrap: "anywhere" }}>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="muted" style={{ marginBottom: 14 }}>
              {t("login.magicHint", "We will send a one-tap sign-in link to your inbox. If you do not see it quickly, check Promotions or Spam first.")}
            </p>
            <button className="btn-primary" onClick={handleEmailLink} disabled={loading}>
              {loading ? t("settings.sending", "Sending...") : sentLinkEmail ? t("login.resendLink", "Resend Sign-In Link") : t("login.sendLink", "Send Sign-In Link")}
            </button>
            {sentLinkEmail && (
              <div className="magic-checklist">
                <div className="magic-link-badge">{t("login.mobileReady", "Best on mobile")}</div>
                <div className="magic-check-item">
                  <span className="magic-check-dot" />
                  {t("login.sentTo", "Sent to")} <strong>{sentLinkEmail}</strong>
                </div>
                <div className="magic-check-item">
                  <span className="magic-check-dot" />
                  {t("login.sameDevice", "Open the email on this same device for the smoothest sign-in")}
                </div>
                <div className="magic-check-item">
                  <span className="magic-check-dot" />
                  {t("login.checkFolders", "Check Inbox, Promotions, and Spam if it does not show up right away")}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
