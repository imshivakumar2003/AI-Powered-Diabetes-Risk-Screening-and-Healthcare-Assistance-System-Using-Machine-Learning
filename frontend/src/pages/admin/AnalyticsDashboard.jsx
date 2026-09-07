import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Loading from "../../components/common/Loading.jsx";
import Alert from "../../components/common/Alert.jsx";
import { adminApi } from "../../services/api.js";

function BarChart({ data = {} }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      {entries.map(([label, count]) => {
        const pct = Math.round((count / max) * 100);
        return (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 500 }}>
              <span>{label}</span>
              <span>{count}</span>
            </div>
            <div style={{ height: 8, width: "100%", background: "var(--surface-subtle, #f1f5f9)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--teal, #0d9488)", borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi
      .getAnalytics()
      .then(setAnalytics)
      .catch((err) => setError(err.message || "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading clinical analytics..." />;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Admin Analytics</span>
        <h1>Population & Clinical Analytics</h1>
        <p className="sub">Demographic distributions, clinical metric splits, and screening statistics.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Card title="Diabetes Diagnosis Split">
          <BarChart data={analytics?.diabetes_split} />
        </Card>

        <Card title="Age Distribution">
          <BarChart data={analytics?.age_distribution} />
        </Card>

        <Card title="Gender Distribution">
          <BarChart data={analytics?.gender_distribution} />
        </Card>

        <Card title="BMI Bracket Distribution">
          <BarChart data={analytics?.bmi_distribution} />
        </Card>

        <Card title="HbA1c Level Distribution (%)">
          <BarChart data={analytics?.hba1c_distribution} />
        </Card>

        <Card title="Blood Glucose Distribution (mg/dL)">
          <BarChart data={analytics?.glucose_distribution} />
        </Card>
      </div>
    </>
  );
}
