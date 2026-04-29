import { useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

export default function LoginPage({ onLogin, onSignup, onGoogle, onApple }) {
  const [authTab, setAuthTab] = useState("email");
  const [signTab, setSignTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [conf, setConf] = useState(null);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (authTab !== "phone" || step !== "phone") return undefined;

    const setup = async () => {
      try {
        if (window._rcv) {
          try { window._rcv.clear(); } catch {}
          window._rcv = null;
        }
        window._rcv = new RecaptchaVerifier(auth, "phone-recaptcha", {
          size: "normal",
        });
        await window._rcv.render();
      } catch (e) {
        setErr(e.message?.replace("Firebase: ", "") || "Could not load reCAPTCHA");
      }
    };

    setup();

    return () => {
      if (window._rcv) {
        try { window._rcv.clear(); } catch {}
        window._rcv = null;
      }
    };
  }, [authTab, step]);

  const handleEmail = async () => {
    if (!email || !password) return;
    setErr("");
    setLoading(true);
    try {
      if (signTab === "signin") await onLogin(email, password);
      else await onSignup(email, password);
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!resetEmail) return;
    setErr("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setOk("Reset link sent. Check your inbox.");
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      setErr("Enter a valid 10-digit number");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      if (!window._rcv) {
        window._rcv = new RecaptchaVerifier(auth, "phone-recaptcha", { size: "normal" });
        await window._rcv.render();
      }
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, window._rcv);
      setConf(result);
      setStep("otp");
      setOk(`OTP sent to +91-${phone}`);
    } catch (e) {
      setErr(e.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length < 4) {
      setErr("Enter the OTP");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await conf.confirm(otp);
    } catch {
      setErr("Invalid OTP. Try again.");
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
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </>
          )}
          <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => {
            setForgot(false);
            setErr("");
            setOk("");
          }}>
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
          <button className={`tab2-btn ${authTab === "phone" ? "active" : ""}`} onClick={() => setAuthTab("phone")}>Mobile OTP</button>
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
              {loading ? "Please wait…" : signTab === "signin" ? "Sign In" : "Create Account"}
            </button>
            <div className="divider">or</div>
            <button className="google-btn" onClick={onGoogle}>Continue with Google</button>
            <button className="google-btn" style={{ marginTop: 10 }} onClick={onApple}>Continue with Apple</button>
          </>
        ) : step === "phone" ? (
          <>
            <div className="fg" style={{ marginBottom: 14 }}>
              <label className="fl">Mobile Number (India +91)</label>
              <div className="phone-row">
                <div className="phone-pre">+91</div>
                <input className="phone-inp" type="tel" placeholder="9876543210" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div id="phone-recaptcha" style={{ marginBottom: 14 }} />
            <button className="btn-primary" onClick={sendOTP} disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>Enter the 6-digit OTP sent to +91-{phone}</p>
            <input className="otp-input" type="tel" maxLength={6} placeholder="------" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            <button className="btn-primary" onClick={verifyOTP} disabled={loading}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
            <span className="resend-link" style={{ marginTop: 8, textAlign: "center" }} onClick={() => setStep("phone")}>Change number / Resend</span>
          </>
        )}
      </div>
    </div>
  );
}
