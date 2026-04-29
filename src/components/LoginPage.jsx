import { useState } from "react";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function LoginPage({ onLogin, onSignup, onGoogle, onSendEmailLink }) {
  const [authTab, setAuthTab] = useState("email");
  const [signTab, setSignTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [sentLinkEmail, setSentLinkEmail] = useState("");

  const getError = (e, fallback) => e?.message?.replace("Firebase: ", "") || fallback;

  const handleEmail = async () => {
    if (!email || !password) return;
    setErr("");
    setOk("");
    setLoading(true);
    try {
      if (signTab === "signin") await onLogin(email, password);
      else await onSignup(email, password);
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
      setOk("Reset link sent. Check your inbox.");
    } catch (e) {
      setErr(getError(e, "Could not send reset email."));
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
    } catch (e) {
      setErr(getError(e, "Could not send sign-in link."));
    } finally {
      setLoading(false);
    }
  };

  if (forgot) {
    return (
      <div className="login-page">
        <div className="login-bg" />
        <div className="login-card">
          <div className="login-logo">◈ Finwise</div>
          <div className="login-tagline">Reset your password</div>
          {err && <div className="auth-error">{err}</div>}
          {ok && <div className="auth-ok">{ok}</div>}
          {!ok && (
            <>
              <div className="fg" style={{ marginBottom: 14 }}>
                <label className="fl">Email</label>
                <input className="fi" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={handleForgot} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
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
            Back to Sign In
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
        <div className="login-tagline">Premium personal finance command center</div>
        <div className="tab2">
          <button className={`tab2-btn ${authTab === "email" ? "active" : ""}`} onClick={() => setAuthTab("email")}>Email</button>
          <button className={`tab2-btn ${authTab === "email-link" ? "active" : ""}`} onClick={() => setAuthTab("email-link")}>Magic Link</button>
        </div>
        {err && <div className="auth-error">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}
        {authTab === "email" ? (
          <>
            <div className="tab2" style={{ marginBottom: 16 }}>
              <button className={`tab2-btn ${signTab === "signin" ? "active" : ""}`} onClick={() => setSignTab("signin")}>Sign In</button>
              <button className={`tab2-btn ${signTab === "signup" ? "active" : ""}`} onClick={() => setSignTab("signup")}>Sign Up</button>
            </div>
            <div className="fg" style={{ marginBottom: 12 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="fg" style={{ marginBottom: 4 }}>
              <label className="fl">Password</label>
              <input className="fi" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEmail()} />
            </div>
            {signTab === "signin" && <span className="forgot-link" onClick={() => setForgot(true)}>Forgot password?</span>}
            <button className="btn-primary" onClick={handleEmail} disabled={loading}>
              {loading ? "Please wait..." : signTab === "signin" ? "Sign In" : "Create Account"}
            </button>
            <div className="divider">or</div>
            <button className="google-btn" onClick={onGoogle}>Continue with Google</button>
          </>
        ) : (
          <>
            <div className="magic-header">
              <strong>Passwordless sign-in</strong>
              <p>Get a secure sign-in link by email. It is faster than a code and works smoothly across desktop and mobile.</p>
            </div>
            <div className="fg" style={{ marginBottom: 8 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" placeholder="you@example.com" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEmailLink()} />
            </div>
            <p className="muted" style={{ marginBottom: 14 }}>
              We will send a one-tap sign-in link to your inbox. If you do not see it quickly, check Promotions or Spam first.
            </p>
            <button className="btn-primary" onClick={handleEmailLink} disabled={loading}>
              {loading ? "Sending..." : sentLinkEmail ? "Resend Sign-In Link" : "Send Sign-In Link"}
            </button>
            {sentLinkEmail && (
              <div className="magic-checklist">
                <div className="magic-check-item">
                  <span className="magic-check-dot" />
                  Sent to <strong>{sentLinkEmail}</strong>
                </div>
                <div className="magic-check-item">
                  <span className="magic-check-dot" />
                  Open the email on this same device for the smoothest sign-in
                </div>
                <div className="magic-check-item">
                  <span className="magic-check-dot" />
                  Check Inbox, Promotions, and Spam if it does not show up right away
                </div>
              </div>
            )}
            <div className="divider">or</div>
            <button className="google-btn" onClick={onGoogle}>Continue with Google</button>
          </>
        )}
      </div>
    </div>
  );
}
