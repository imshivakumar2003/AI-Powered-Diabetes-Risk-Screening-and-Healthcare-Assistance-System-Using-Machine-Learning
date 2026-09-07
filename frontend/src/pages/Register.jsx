import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/common/Alert.jsx";
import { authApi } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Eye, EyeOff } from "lucide-react";
import BrandLogo from "../components/common/BrandLogo.jsx";

export default function Register() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const validate = () => {
    if (!form.full_name.trim()) {
      return "Full name is required.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim() || !emailRegex.test(form.email.trim())) {
      return "Please enter a valid email address.";
    }
    if (!form.password) {
      return "Password is required.";
    }
    if (form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (form.password !== form.confirm_password) {
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
      // Derive a fallback username from email if not given
      const DerivedUsername = form.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_") + "_" + Math.floor(Math.random() * 1000);

      await authApi.register({
        username: DerivedUsername,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        password: form.password,
      });

      // Clear any auto-login token to ensure fresh login flow
      localStorage.removeItem("gc_token");

      showToast("Account created successfully. Please sign in.", "success");
      navigate("/login", {
        replace: true,
        state: { message: "Account created successfully. Please sign in." },
      });
    } catch (err) {
      let msg = err.message || "";
      if (msg.toLowerCase().includes("email") && msg.toLowerCase().includes("exist")) {
        setError("An account with this email already exists.");
      } else if (msg.toLowerCase().includes("username") || msg.toLowerCase().includes("registered")) {
        setError("An account with this email already exists.");
      } else {
        setError("Unable to create your account right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandLogo variant="auth" />

        <h1 className="auth-title">{t("auth.createAccountTitle")}</h1>
        <p className="auth-sub">{t("auth.createAccountSub")}</p>

        <form onSubmit={handleSubmit}>
          <Alert type="error">{error}</Alert>

          <div className="auth-field-group">
            {/* Full Name */}
            <div className="field">
              <label htmlFor="full_name">{t("auth.fullName")}</label>
              <input
                id="full_name"
                type="text"
                required
                value={form.full_name}
                onChange={update("full_name")}
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div className="field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={update("email")}
                placeholder="name@example.com"
              />
            </div>

            {/* Password with Visibility Toggle */}
            <div className="field">
              <label htmlFor="password">
                {t("auth.password")} <span className="hint">(min 8 characters)</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={update("password")}
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

            {/* Confirm Password with Visibility Toggle */}
            <div className="field">
              <label htmlFor="confirm_password">{t("auth.confirmPassword")}</label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={form.confirm_password}
                  onChange={update("confirm_password")}
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
            {t("auth.signUp")}
          </Button>
        </form>

        <div className="auth-footer-link" style={{ marginTop: 20 }}>
          {t("auth.alreadyHaveAccount")} <Link to="/login">{t("auth.signIn")}</Link>
        </div>
      </div>
    </div>
  );
}
