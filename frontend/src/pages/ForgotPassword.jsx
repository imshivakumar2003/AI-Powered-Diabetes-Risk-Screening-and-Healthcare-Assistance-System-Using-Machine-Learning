import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/common/Alert.jsx";
import { authApi } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import BrandLogo from "../components/common/BrandLogo.jsx";

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState(null);

  const validate = () => {
    if (!email.trim()) {
      return "Please enter your email address.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.forgotPassword(email.trim());
      setMessage(data.message || "If an account exists for this email, password reset instructions have been provided.");
      setDevToken(data.reset_token_dev_only || null);
    } catch {
      setError("Unable to process your password reset request right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandLogo variant="auth" />

        <h1 className="auth-title">{t("auth.resetPasswordTitle")}</h1>
        <p className="auth-sub">{t("auth.resetPasswordSub")}</p>

        <form onSubmit={handleSubmit}>
          <Alert type="error">{error}</Alert>
          <Alert type="success">{message}</Alert>

          <div className="auth-field-group">
            <div className="field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>

          <Button type="submit" loading={loading} style={{ width: "100%", marginTop: 8 }}>
            {t("auth.sendResetLink")}
          </Button>
        </form>

        {devToken && (
          <div style={{ marginTop: 18, padding: 12, background: "var(--paper)", borderRadius: 8, fontSize: 12.5, border: "1px solid var(--border)" }}>
            <strong>Dev Mode Link</strong> —{" "}
            <Link to={`/reset-password?token=${devToken}`} style={{ color: "var(--teal)", fontWeight: 700 }}>
              Click to Reset Password
            </Link>
          </div>
        )}

        <div className="auth-footer-link" style={{ marginTop: 20 }}>
          <Link to="/login">{t("auth.backToLogin")}</Link>
        </div>
      </div>
    </div>
  );
}
