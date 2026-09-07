import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/common/Alert.jsx";
import { authApi } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Eye, EyeOff } from "lucide-react";
import BrandLogo from "../components/common/BrandLogo.jsx";

export default function ResetPassword() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!token) {
      return "Invalid or missing reset token link.";
    }
    if (!form.new_password) {
      return "Password is required.";
    }
    if (form.new_password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (form.new_password !== form.confirm_password) {
      return "Confirm Password must match Password.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, form.new_password);
      showToast("Password reset successfully. Please sign in.", "success");
      navigate("/login", {
        replace: true,
        state: { message: "Password reset successfully. Please sign in." },
      });
    } catch (err) {
      let msg = err.message || "";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")) {
        setError("This reset link is invalid or has expired.");
      } else {
        setError("Unable to reset your password right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandLogo variant="auth" />

        <h1 className="auth-title">{t("auth.chooseNewPassword")}</h1>
        <p className="auth-sub">{t("auth.chooseNewPasswordSub")}</p>

        <form onSubmit={handleSubmit}>
          <Alert type="error">{error}</Alert>

          <div className="auth-field-group">
            {/* New Password */}
            <div className="field">
              <label htmlFor="new_password">
                {t("auth.newPassword")} <span className="hint">(min 8 characters)</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  style={{ width: "100%", paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-faint)",
                    padding: 4,
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="field">
              <label htmlFor="confirm_password">{t("auth.confirmNewPassword")}</label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  style={{ width: "100%", paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-faint)",
                    padding: 4,
                  }}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" loading={loading} style={{ width: "100%", marginTop: 8 }}>
            {t("auth.resetPasswordBtn")}
          </Button>
        </form>

        <div className="auth-footer-link" style={{ marginTop: 20 }}>
          <Link to="/login">{t("auth.backToLogin")}</Link>
        </div>
      </div>
    </div>
  );
}
