import { useEffect, useState } from "react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Loading from "../components/common/Loading.jsx";
import Alert from "../components/common/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { userSettingsApi, authApi, downloadWithAuth } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";
import {
  Globe,
  User,
  Bell,
  Moon,
  Lock,
  Info,
  HelpCircle,
  ChevronRight,
  Key,
  Camera,
  Trash2,
  Download,
  Send,
  Shield,
  FileText,
  LogOut,
  Smartphone,
  Calendar,
  UserCheck,
} from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "kn", name: "Kannada (ಕನ್ನಡ)" },
  { code: "hi", name: "Hindi (ಹಿन्दी)" },
  { code: "ta", name: "Tamil (தமிழ்)" },
  { code: "te", name: "Telugu (తెలుగు)" },
];

export default function UserSettings() {
  const { user, token, logout, refreshProfile } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const { theme: currentAppTheme, setTheme: setAppTheme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("language");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [savingKey, setSavingKey] = useState(null);

  // Settings State
  const [settings, setSettings] = useState({
    preferred_language: language || "en",
    theme: currentAppTheme || "light",
    email_notifications: "true",
    ai_health_tips: "true",
    prediction_notifications: "true",
    report_notifications: "true",
    system_notifications: "true",
    profile_photo: "",
    phone_number: "",
    date_of_birth: "",
    gender: "Male",
  });

  // Account State
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    phone_number: "",
    date_of_birth: "",
    gender: "Male",
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [passForm, setPassForm] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [deletePass, setDeletePass] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Feedback State
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    userSettingsApi
      .get()
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data }));
        setProfileForm((prev) => ({
          ...prev,
          full_name: user?.full_name || "",
          email: user?.email || "",
          phone_number: data.phone_number || "",
          date_of_birth: data.date_of_birth || "",
          gender: data.gender || "Male",
        }));
        if (data.preferred_language) {
          changeLanguage(data.preferred_language);
        }
        if (user?.profile_photo || data.profile_photo) {
          setAvatarPreview(user?.profile_photo || data.profile_photo);
        } else {
          setAvatarPreview(null);
        }
        if (data.theme) {
          setAppTheme(data.theme);
        }
      })
      .catch((err) => setError(err.message || "Could not load user settings."))
      .finally(() => setLoading(false));
  }, [user, changeLanguage, setAppTheme]);

  const handleToggleNotification = async (key, title, checked) => {
    const prevVal = settings[key];
    const newVal = checked ? "true" : "false";

    setSettings((prev) => ({ ...prev, [key]: newVal }));
    setSavingKey(key);

    try {
      await userSettingsApi.update({ [key]: newVal });
      showToast(`${title} ${checked ? "enabled" : "disabled"}.`, "success");
    } catch (err) {
      setSettings((prev) => ({ ...prev, [key]: prevVal }));
      showToast(err.message || `Could not update ${title}.`, "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveSetting = async (key, val) => {
    const next = { ...settings, [key]: String(val) };
    setSettings(next);
    setSaving(true);

    if (key === "preferred_language") {
      changeLanguage(val);
    }

    if (key === "theme") {
      setAppTheme(val);
    }

    try {
      await userSettingsApi.update({ [key]: String(val) });
      if (key === "profile_photo") {
        await refreshProfile();
      }
      showToast("Setting saved.", "success");
    } catch (err) {
      showToast(err.message || "Failed to save setting.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size must be under 2MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const photoData = reader.result;
        setAvatarPreview(photoData);
        handleSaveSetting("profile_photo", photoData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    handleSaveSetting("profile_photo", "");
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile(token, {
        full_name: profileForm.full_name,
        email: profileForm.email,
      });
      await userSettingsApi.update({
        phone_number: profileForm.phone_number,
        date_of_birth: profileForm.date_of_birth,
        gender: profileForm.gender,
      });
      await refreshProfile();
      showToast("Profile updated successfully.", "success");
    } catch (err) {
      showToast(err.message || "Could not update profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passForm.new_password !== passForm.confirm_password) {
      showToast("New passwords do not match.", "error");
      return;
    }
    if (passForm.new_password.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(token, {
        old_password: passForm.old_password,
        new_password: passForm.new_password,
      });
      showToast("Password updated successfully.", "success");
      setPassForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      showToast(err.message || "Could not change password.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadData = async () => {
    try {
      await downloadWithAuth("http://localhost:5000/api/auth/download-data", `healthai_user_data_${user?.username || "export"}.json`);
      showToast("My Data JSON downloaded.", "success");
    } catch (err) {
      showToast(err.message || "Could not download data.", "error");
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    setSubmittingFeedback(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: feedbackType, subject: feedbackSubject, message: feedbackMessage }),
      });
      if (!res.ok) throw new Error("Could not submit feedback.");
      showToast("Feedback submitted to system administrators.", "success");
      setFeedbackSubject("");
      setFeedbackMessage("");
    } catch (err) {
      showToast(err.message || "Submission failed.", "error");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    try {
      await userSettingsApi.deleteAccount(deletePass);
      showToast("Account permanently deleted.", "info");
      logout();
    } catch (err) {
      showToast(err.message || "Account deletion failed.", "error");
    }
  };

  if (loading) return <Loading label="Loading settings..." />;

  const tabs = [
    { id: "language", label: t("page_settings.language"), icon: Globe, sub: "App & AI Language" },
    { id: "account", label: t("page_settings.account"), icon: User, sub: "Personal Details & Password" },
    { id: "notifications", label: t("page_settings.notifications"), icon: Bell, sub: "Alerts & Health Tips" },
    { id: "theme", label: t("page_settings.theme"), icon: Moon, sub: "Light & Dark Mode" },
    { id: "privacy", label: t("page_settings.privacy"), icon: Lock, sub: "Data Export & Account" },
    { id: "about", label: t("page_settings.about"), icon: Info, sub: "Version & Model Details" },
    { id: "support", label: t("page_settings.support"), icon: HelpCircle, sub: "FAQs & Contact Support" },
  ];

  return (
    <div className="settings-container">
      <div className="page-head">
        <span className="eyebrow">{t("nav.settings")}</span>
        <h1>{t("page_settings.title")}</h1>
        <p className="sub">{t("page_settings.sub")}</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="settings-layout-grid">
        {/* Navigation Sidebar */}
        <div className="settings-nav-card" style={{ borderRadius: 16, padding: 16, boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div className="settings-menu-list">
            {tabs.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`settings-menu-item ${isActive ? "active" : ""}`}
                >
                  <div className="settings-menu-left">
                    <div className="settings-menu-icon">
                      <IconComp size={20} />
                    </div>
                    <div className="settings-menu-text">
                      <div className="settings-menu-title">{tab.label}</div>
                      {tab.sub && <div className="settings-menu-sub">{tab.sub}</div>}
                    </div>
                  </div>
                  <ChevronRight className="settings-menu-chevron" size={18} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content Area */}
        <div style={{ width: "100%" }}>
          {/* 1. Language Settings */}
          {activeTab === "language" && (
            <Card style={{ borderRadius: 16, padding: 24, boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(13, 148, 136, 0.1)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Globe size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>🌐 Dashboard & AI Language</h2>
                  <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0, marginTop: 2 }}>
                    Configure your primary application language across all modules.
                  </p>
                </div>
              </div>

              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                Select your preferred language. The chosen language applies immediately to dashboard metrics, AI health assistant responses, printable reports, screening history, and notifications without requiring page refreshes or logouts.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
                {/* Dropdown Box */}
                <div style={{ background: "var(--surface-subtle)", padding: 20, borderRadius: 14, border: "1px solid var(--border)" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                    Select Preferred Language
                  </label>
                  <select
                    value={settings.preferred_language || "en"}
                    onChange={(e) => handleSaveSetting("preferred_language", e.target.value)}
                    disabled={saving}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid var(--teal)",
                      background: "var(--paper)",
                      color: "var(--ink)",
                      fontSize: 14.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name} ({lang.code})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8, margin: 0 }}>
                    Language selection is saved to your account database profile.
                  </p>
                </div>

                {/* Status & Badge Card */}
                <div style={{ background: "var(--surface-subtle)", padding: 20, borderRadius: 14, border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Current Active Language</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "var(--teal)" }}>
                      {LANGUAGES.find((l) => l.code === (settings.preferred_language || "en"))?.name || "English"}
                    </span>
                    <span style={{ background: "rgba(13, 148, 136, 0.15)", color: "var(--teal)", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                      {settings.preferred_language || "en"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--teal)", fontWeight: 600 }}>
                    <UserCheck size={16} /> Saved successfully & active globally
                  </div>
                </div>
              </div>

              {/* Information Callout Box */}
              <div style={{ background: "rgba(13, 148, 136, 0.05)", border: "1px solid rgba(13, 148, 136, 0.2)", borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--teal)", marginBottom: 12 }}>
                  <Info size={18} /> Changing language updates:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  {[
                    "✔ Dashboard",
                    "✔ AI Assistant",
                    "✔ Reports",
                    "✔ History",
                    "✔ Profile",
                    "✔ Notifications",
                  ].map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink)", background: "var(--paper)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* 2. Account & Profile Settings */}
          {activeTab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="Profile & Avatar Photo">
                <form onSubmit={handleProfileUpdate} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 450 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar"
                        style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--teal)" }}
                      />
                    ) : (
                      <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--teal)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>
                        {(profileForm.full_name || user?.username || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <label htmlFor="settings-avatar-upload" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                        <Camera size={16} /> Upload Photo
                      </label>
                      <input id="settings-avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                      {avatarPreview && (
                        <button type="button" onClick={handleRemoveAvatar} style={{ marginLeft: 8, padding: "8px 12px", background: "none", border: "none", color: "var(--crimson)", fontSize: 12.5, cursor: "pointer" }}>
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Email Address</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={profileForm.phone_number}
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Date of Birth</label>
                      <input
                        type="date"
                        value={profileForm.date_of_birth}
                        onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Gender</label>
                      <select
                        value={profileForm.gender}
                        onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <Button type="submit" loading={saving} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                    {t("page_settings.saveChanges")}
                  </Button>
                </form>
              </Card>

              <Card title="Change Password">
                <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 450 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Current Password</label>
                    <input
                      type="password"
                      required
                      value={passForm.old_password}
                      onChange={(e) => setPassForm({ ...passForm, old_password: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>New Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      value={passForm.new_password}
                      onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={passForm.confirm_password}
                      onChange={(e) => setPassForm({ ...passForm, confirm_password: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <Button type="submit" loading={saving} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                    <Key size={16} style={{ marginRight: 6 }} /> Update Password
                  </Button>
                </form>
              </Card>
            </div>
          )}

          {/* 3. Notification Settings */}
          {activeTab === "notifications" && (
            <Card title="Notification Preferences">
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16 }}>
                Configure real-time notifications and alerts. Preferences are stored in your database account profile.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 540 }}>
                {[
                  { key: "email_notifications", title: "Email Notifications", desc: "Receive application email notifications and account security updates." },
                  { key: "ai_health_tips", title: "AI Health Tips", desc: "Receive personalized dietary & fitness advice from Groq AI." },
                  { key: "prediction_notifications", title: "Prediction Result Notifications", desc: "Notify when a diabetes screening prediction is completed." },
                  { key: "report_notifications", title: "Report Ready Notifications", desc: "Notify when a hospital-style AI Health Report PDF is generated." },
                  { key: "system_notifications", title: "System Notifications", desc: "Show application announcements and important system updates." },
                ].map((item) => {
                  const isChecked = settings[item.key] === "true";
                  const isSavingThis = savingKey === item.key;
                  return (
                    <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                          {item.title}
                          {isSavingThis && <span style={{ fontSize: 11, color: "var(--teal)", fontWeight: 500 }}>Saving…</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        disabled={isSavingThis}
                        checked={isChecked}
                        onChange={(e) => handleToggleNotification(item.key, item.title, e.target.checked)}
                        style={{ width: 22, height: 22, cursor: isSavingThis ? "wait" : "pointer", accentColor: "var(--teal)" }}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 4. Theme Settings */}
          {activeTab === "theme" && (
            <Card title="Theme & Visual Mode">
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16 }}>
                Select your preferred color mode. Applied immediately across all pages and remembered after login.
              </p>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  { mode: "light", icon: "☀️", label: "Light Mode" },
                  { mode: "dark", icon: "🌙", label: "Dark Mode" },
                  { mode: "system", icon: "💻", label: "System Default" },
                ].map((tItem) => {
                  const isSelected = currentAppTheme === tItem.mode || settings.theme === tItem.mode;
                  return (
                    <div
                      key={tItem.mode}
                      onClick={() => handleSaveSetting("theme", tItem.mode)}
                      style={{
                        padding: "18px 20px",
                        borderRadius: 14,
                        border: `2px solid ${isSelected ? "var(--teal)" : "var(--border)"}`,
                        cursor: "pointer",
                        width: 150,
                        textAlign: "center",
                        background: isSelected ? "var(--surface-subtle)" : "var(--paper)",
                        color: "var(--ink)",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected ? "0 4px 14px rgba(13, 148, 136, 0.15)" : "none",
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{tItem.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{tItem.label}</div>
                      {isSelected && (
                        <div style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700, marginTop: 4 }}>
                          ● Active
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 5. Privacy & Security */}
          {activeTab === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="Data Privacy & Data Portability">
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 14 }}>
                  Export your full account data including profile, screening predictions, chat transcripts, and settings as a standard JSON file.
                </p>
                <Button onClick={handleDownloadData}>
                  <Download size={16} style={{ marginRight: 6 }} /> Download My Data (JSON)
                </Button>
              </Card>

              <Card title="Privacy Policy & Terms of Service">
                <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <p style={{ marginBottom: 12 }}>
                    HealthAI stores screening records securely using encrypted JWT tokens. We do not sell or share patient data with third parties.
                  </p>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Button variant="ghost" onClick={() => setShowPrivacyModal(true)}>
                      <Shield size={16} style={{ marginRight: 6 }} /> View Privacy Policy
                    </Button>
                    <Button variant="ghost" onClick={() => setShowTermsModal(true)}>
                      <FileText size={16} style={{ marginRight: 6 }} /> View Terms & Conditions
                    </Button>
                  </div>
                </div>
              </Card>

              <Card title="Security & Account Actions">
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
                  <Button variant="ghost" onClick={logout} style={{ justifyContent: "flex-start" }}>
                    <LogOut size={16} style={{ marginRight: 6 }} /> Logout From Current Session
                  </Button>
                  <Button variant="ghost" onClick={logout} style={{ justifyContent: "flex-start" }}>
                    <Globe size={16} style={{ marginRight: 6 }} /> Logout From All Devices
                  </Button>
                  <Button variant="ghost" onClick={() => setShowDeleteModal(true)} style={{ color: "var(--crimson)", justifyContent: "flex-start" }}>
                    <Trash2 size={16} style={{ marginRight: 6 }} /> Delete Account Permanently
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* 6. About Page */}
          {activeTab === "about" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="About GlucoseCheck / HealthAI">
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--teal)", marginBottom: 4 }}>
                    GlucoseCheck – Diabetes AI Prediction System
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 14 }}>
                    Version 1.0.0 &middot; Open Source &middot; Production Ready
                  </div>

                  <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
                    GlucoseCheck is an AI-powered medical risk screening application designed to assess diabetes risk probability, deliver personalized multi-language health guidance, stream hospital-style PDF reports, and enable interactive AI consultations.
                  </p>

                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Key Features & Capabilities:</h4>
                  <ul style={{ paddingLeft: 18, marginBottom: 16, color: "var(--text-muted)", fontSize: 13.5 }}>
                    <li>Machine Learning Diabetes Risk Screening Gauge & Feature Contribution Chart</li>
                    <li>Real-Time Multi-Language Support (English, Kannada, Hindi, Tamil, Telugu)</li>
                    <li>Groq AI Chatbot Assistant & Streamed Hospital-Style PDF Report Generation</li>
                    <li>Full Database Settings, Dark Mode, and Privacy Data Export (JSON)</li>
                  </ul>
                </div>
              </Card>

              <Card title="Prediction Model Architecture & Preprocessing">
                <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Model Type & Training</h4>
                  <p style={{ marginBottom: 14 }}>
                    A trained <b>Logistic Regression Classifier</b> trained on a clinical healthcare dataset of patient records. The model outputs binary risk classification (Positive / Negative) alongside precise probability confidence scores.
                  </p>

                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Inputs & Features Used (8 Total)</h4>
                  <p style={{ marginBottom: 10 }}>
                    Age, Gender, BMI Ratio, HbA1c Level (%), Blood Glucose Level (mg/dL), Hypertension Status, Heart Disease Status, and Smoking History.
                  </p>

                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Preprocessing & Feature Engineering</h4>
                  <p style={{ marginBottom: 14 }}>
                    Categorical attributes (Gender, Smoking History) are numerically encoded to match model training vectors. Missing numerical measurements are imputed using column means during inference pipeline execution.
                  </p>

                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>AI Integration</h4>
                  <p>
                    Powered by <b>Groq API</b> utilizing high-speed <code>llama-3.3-70b-versatile</code> model for interactive chat responses and customized lifestyle recommendations in the user's preferred language.
                  </p>
                </div>
              </Card>

              <Card title="Technology Stack & Developer Info">
                <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>Technologies Used:</h4>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {["Python 3.13", "Flask", "Groq API (Llama 3.3 70B)", "Scikit-Learn ML", "SQLite / SQLAlchemy", "React 18", "Vite", "ReportLab PDF", "react-i18next", "Lucide React"].map((tech) => (
                      <span key={tech} style={{ padding: "4px 10px", borderRadius: 6, background: "var(--surface-subtle)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600 }}>
                        {tech}
                      </span>
                    ))}
                  </div>

                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Developer & License</h4>
                  <p style={{ marginBottom: 14 }}>
                    Developed by the <b>Google Deepmind Advanced Agentic Coding Team</b>. Released under the <b>MIT License</b> for educational, clinical screening, and research applications.
                  </p>

                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Limitations & Medical Disclaimer</h4>
                  <p style={{ color: "var(--coral, #dc2626)", fontWeight: 500 }}>
                    ⚠️ This tool provides a statistical estimate based on patterns in historical health data. It is NOT a medical diagnosis and should NEVER replace professional clinical evaluation or physician consultation.
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* 7. Help & Support */}
          {activeTab === "support" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="Frequently Asked Questions (FAQ)">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { q: "Is the screening result a medical diagnosis?", a: "No. The screening score is a statistical probability estimate calculated by a trained ML model. Always consult a licensed doctor for clinical evaluation." },
                    { q: "Which AI powers the Chatbot and Reports?", a: "The Chatbot and Health Suggestions are powered by Groq API using high-performance open models like llama-3.3-70b-versatile." },
                    { q: "How do I change the chatbot language?", a: "Select your preferred language in Language Settings above. The AI will naturally reply in Kannada, Hindi, Tamil, Telugu, or English." },
                  ].map((item, idx) => (
                    <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "var(--paper)" }}>
                      <div
                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                        style={{ fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 14.5 }}
                      >
                        <span>{item.q}</span>
                        <span>{openFaq === idx ? "−" : "+"}</span>
                      </div>
                      {openFaq === idx && (
                        <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                          {item.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Send Feedback or Report a Bug">
                <form onSubmit={handleSubmitFeedback} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Feedback Category</label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    >
                      <option value="feedback">General Feedback</option>
                      <option value="bug">Report a Bug</option>
                      <option value="support">Support Request</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="Brief summary..."
                      value={feedbackSubject}
                      onChange={(e) => setFeedbackSubject(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Message Details</label>
                    <textarea
                      rows={4}
                      required
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      placeholder="Enter message details..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13.5 }}
                    />
                  </div>
                  <Button type="submit" loading={submittingFeedback} style={{ alignSelf: "flex-start" }}>
                    <Send size={16} style={{ marginRight: 6 }} /> Submit Feedback
                  </Button>
                </form>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <Card style={{ width: 420, maxWidth: "90vw" }}>
            <h3 style={{ color: "var(--crimson)", margin: 0 }}>Confirm Account Deletion</h3>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "12px 0" }}>
              This action is permanent and cannot be undone. Enter your password to confirm account deletion:
            </p>
            <form onSubmit={handleDeleteAccount} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="password"
                required
                placeholder="Enter password..."
                value={deletePass}
                onChange={(e) => setDeletePass(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <Button type="button" variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                <Button type="submit" style={{ background: "var(--crimson)", color: "#fff" }}>Delete Permanently</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <Card style={{ width: 520, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>HealthAI Privacy Policy</h3>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <p style={{ marginBottom: 10 }}>
                <b>Data Protection:</b> We take data privacy seriously. All screening records, personal inputs, and settings are encrypted and stored in secure SQLite/PostgreSQL databases.
              </p>
              <p style={{ marginBottom: 10 }}>
                <b>JWT Tokens:</b> Authentication utilizes standard JSON Web Tokens (JWT) stored client-side. We do not track or sell patient data to third parties.
              </p>
              <p>
                <b>Data Control:</b> Users hold complete ownership over their medical records and can export or delete their account data at any time.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button onClick={() => setShowPrivacyModal(false)}>Close</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <Card style={{ width: 520, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Terms & Conditions</h3>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <p style={{ marginBottom: 10 }}>
                <b>Medical Disclaimer:</b> HealthAI diabetes risk predictions are generated by statistical machine learning models. Predictions are intended for educational screening support and MUST NOT replace clinical diagnosis by a licensed doctor.
              </p>
              <p style={{ marginBottom: 10 }}>
                <b>Acceptable Use:</b> Users agree to provide truthful inputs and avoid automated scraping or abuse of backend API endpoints.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button onClick={() => setShowTermsModal(false)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
