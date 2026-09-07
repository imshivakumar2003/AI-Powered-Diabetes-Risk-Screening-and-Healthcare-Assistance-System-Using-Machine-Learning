import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/common/Alert.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { adminApi } from "../../services/api.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import BrandLogo from "../../components/common/BrandLogo.jsx";

export default function AdminLogin() {
  const { setTokenAndUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await adminApi.adminLogin(form);
      setTokenAndUser(data.token, data.user);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Admin login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandLogo
          variant="auth"
          subtitle="system management portal"
          customTitle={<><span className="brand-title-bold">Glucose</span><span className="brand-title-medium">Check Admin</span></>}
        />

        <h1 className="auth-title">{t("auth.adminPortal")}</h1>
        <p className="auth-sub">{t("auth.adminLogin")}</p>

        <form onSubmit={handleSubmit}>
          <Alert type="error">{error}</Alert>

          <div className="auth-field-group">
            <div className="field">
              <label htmlFor="admin-email">{t("auth.email")}</label>
              <input
                id="admin-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@glucosecheck.app"
              />
            </div>
            <div className="field">
              <label htmlFor="admin-password">{t("auth.password")}</label>
              <input
                id="admin-password"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>

          <Button type="submit" loading={loading} style={{ width: "100%", background: "#0f1b2d" }}>
            {t("auth.signIn")}
          </Button>
        </form>

        <div className="auth-footer-link" style={{ marginTop: 20 }}>
          {t("auth.patientLoginPrompt")} <Link to="/login">{t("auth.userPortalLink")}</Link>
        </div>
      </div>
    </div>
  );
}
