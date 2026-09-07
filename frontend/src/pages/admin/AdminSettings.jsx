import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Loading from "../../components/common/Loading.jsx";
import { adminApi } from "../../services/adminApi.js";
import { useToast } from "../../context/ToastContext.jsx";

const CATEGORY_LABELS = {
  ai: "AI API",
  email: "Email",
  database: "Database",
  application: "Application",
  theme: "Theme",
  backup: "Backup",
};

export default function AdminSettings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("ai");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (err) {
      showToast(err.message || "Could not load settings.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (category, key, value) => {
    setFormValues((prev) => ({
      ...prev,
      [category]: { ...(prev[category] || {}), [key]: value },
    }));
  };

  const handleSave = async (category) => {
    const changes = formValues[category];
    if (!changes || Object.keys(changes).length === 0) {
      showToast("No changes to save.", "info");
      return;
    }
    setSaving(true);
    try {
      await adminApi.updateSettings({ [category]: changes });
      showToast(`${CATEGORY_LABELS[category]} settings saved.`, "success");
      setFormValues((prev) => ({ ...prev, [category]: {} }));
      await load();
    } catch (err) {
      showToast(err.message || "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading settings..." />;
  if (!settings) return null;

  const categoryData = settings[activeTab] || {};

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Administration</span>
        <h1>System Settings</h1>
        <p className="sub">Manage API keys, email, database, application, theme, and backup settings.</p>
      </div>

      <div className="tabs">
        {Object.keys(CATEGORY_LABELS).map((cat) => (
          <button
            key={cat}
            className={`tab ${activeTab === cat ? "active" : ""}`}
            onClick={() => setActiveTab(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <Card>
        <div className="form-grid">
          {Object.entries(categoryData).map(([key, meta]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>
                {meta.label}
                {meta.secret && <span className="hint"> (secret — masked)</span>}
              </label>
              <input
                id={key}
                type={meta.secret ? "password" : "text"}
                placeholder={meta.secret ? meta.value || "Not configured" : undefined}
                disabled={key === "url_display"}
                defaultValue={meta.secret ? "" : meta.value}
                onChange={(e) => handleChange(activeTab, key, e.target.value)}
              />
              {meta.secret && meta.value && (
                <span className="hint">Current: {meta.value}</span>
              )}
            </div>
          ))}
        </div>

        <div className="form-actions">
          <Button onClick={() => handleSave(activeTab)} loading={saving}>
            Save {CATEGORY_LABELS[activeTab]} Settings
          </Button>
        </div>
      </Card>
    </>
  );
}
