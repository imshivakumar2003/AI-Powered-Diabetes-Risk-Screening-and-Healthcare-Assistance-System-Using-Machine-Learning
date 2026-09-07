import { useEffect, useState } from "react";
import Loading from "../common/Loading.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { recommendationsApi } from "../../services/api.js";

export default function AiHealthRecommendations({ predictionId, record }) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!predictionId) return;
    setLoading(true);

    recommendationsApi
      .get(predictionId)
      .then((resData) => setData(resData))
      .catch((err) => showToast(err.message || "Failed to load recommendations.", "error"))
      .finally(() => setLoading(false));
  }, [predictionId]);

  if (loading) {
    return (
      <div
        style={{
          marginTop: 24,
          marginBottom: 24,
          padding: 24,
          borderRadius: 16,
          background: "var(--paper, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Loading label="Generating AI Health Recommendations..." />
        <div style={{ height: 120, borderRadius: 12, background: "var(--surface-subtle)", animation: "pulse 1.5s infinite" }} />
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};
  const suggestions = data.suggestions || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, width: "100%" }}>
      {/* AI Health Recommendations Main Card */}
      <div
        className="ai-recommendations-card"
        style={{
          marginTop: 24,
          marginBottom: 24,
          padding: 24,
          borderRadius: 16,
          background: "var(--paper, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          transition: "opacity 0.4s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
          <span style={{ fontSize: 22 }}>🩺</span>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              AI Health Recommendations
            </h2>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              Personalized medical guidance based on your clinical inputs
            </div>
          </div>
        </div>

        {/* 🩺 AI Health Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🩺</span> AI Health Summary
          </h3>

          <div style={{ padding: 14, borderRadius: 10, background: "var(--surface-subtle)", borderLeft: "4px solid var(--teal)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>Overall Health Status</div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {summary.overall_assessment || "Initial AI evaluation based on glucose, HbA1c, and BMI parameters."}
            </p>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>Diabetes Risk Explanation</div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {summary.risk_explanation || "Analytical evaluation of metabolic markers and lifestyle factors."}
            </p>
          </div>
        </div>

        {/* 💊 Recommendations */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span>💊</span> Recommendations
          </h3>

          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {(suggestions.lifestyle || ["Maintain a consistent daily sleep schedule", "Avoid prolonged sedentary behavior"]).map((item, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>

        {/* 🏃 Lifestyle Tips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🏃</span> Lifestyle Tips
          </h3>

          <div className="grid grid-3" style={{ gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", marginBottom: 4 }}>Exercise</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {(suggestions.exercise && suggestions.exercise[0]) || "30 minutes brisk walking daily"}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", marginBottom: 4 }}>Sleep</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {suggestions.sleep || "7–8 hours restful sleep nightly"}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", marginBottom: 4 }}>Stress Management</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {(suggestions.stress_management && suggestions.stress_management[0]) || "10 minutes deep breathing daily"}
              </div>
            </div>
          </div>
        </div>

        {/* ⚠ Medical Disclaimer */}
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, marginTop: 2 }}>⚠</span>
          <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>
            <b>Medical Disclaimer:</b> {suggestions.disclaimer || "This screening report is generated by an AI model and is not a substitute for clinical medical advice. Always consult a physician."}
          </div>
        </div>
      </div>
    </div>
  );
}
