import { useState } from "react";
import BrandLogo from "../components/common/BrandLogo.jsx";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/common/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(form.email, form.password);
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandLogo variant="auth" />

        <h1 className="auth-title">{t("auth.welcomeBack")}</h1>
        <p className="auth-sub">{t("auth.patientLogin")}</p>

        <form onSubmit={handleSubmit}>
          {location.state?.message && <Alert type="success">{location.state.message}</Alert>}
          <Alert type="error">{error}</Alert>

          <div className="auth-field-group">
            <div className="field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>

          <Button type="submit" loading={loading} style={{ width: "100%" }}>
            {t("auth.signIn")}
          </Button>
        </form>

        <div className="auth-footer-link">
          <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>
        </div>
        <div className="auth-footer-link">
          {t("auth.dontHaveAccount")} <Link to="/register">{t("auth.signUp")}</Link>
        </div>
        <div className="auth-footer-link" style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {t("auth.systemAdministrator")} <Link to="/admin/login">{t("auth.adminPortalLink")}</Link>
        </div>
      </div>
    </div>
  );
}
