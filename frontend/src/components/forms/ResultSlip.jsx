import { useRef, useState } from "react";
import RiskGauge from "../charts/RiskGauge.jsx";
import Button from "../ui/Button.jsx";
import { formatDate, shortId } from "../../utils/format.js";
import { exportSvgAsPng } from "../../utils/exportImage.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { ShieldAlert, ShieldCheck, Download, BarChart2, Activity, User } from "lucide-react";

export default function ResultSlip({ record }) {
  const gaugeRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();
  const { t } = useLanguage();

  if (!record) return null;
  const isPositive = record.result === "Positive";
  const probPct = record.probability ?? 0;
  const confidenceScore = `${Math.max(probPct, 100 - probPct).toFixed(1)}%`;
  const riskLevel = probPct >= 70 ? "High Risk" : probPct >= 40 ? "Moderate Risk" : "Low Risk";

  const glucoseScore = Math.min(100, Math.max(0, Math.round(((record.input.blood_glucose_level - 80) / 120) * 100)));
  const hba1cScore = Math.min(100, Math.max(0, Math.round(((record.input.HbA1c_level - 4.5) / 4.5) * 100)));
  const bmiScore = Math.min(100, Math.max(0, Math.round(((record.input.bmi - 18.5) / 21.5) * 100)));
  const ageScore = Math.min(100, Math.max(0, Math.round((record.input.age / 80) * 100)));
  const vitalsScore = (record.input.hypertension === "Yes" ? 40 : 0) + (record.input.heart_disease === "Yes" ? 60 : 0);

  const featureImportance = [
    { label: t("page_predict.glucose"), score: glucoseScore, color: glucoseScore > 50 ? "#e11d48" : "#0d9488" },
    { label: t("page_predict.hba1c"), score: hba1cScore, color: hba1cScore > 50 ? "#e11d48" : "#0d9488" },
    { label: t("page_predict.bmi"), score: bmiScore, color: bmiScore > 50 ? "#f59e0b" : "#0d9488" },
    { label: t("page_predict.age"), score: ageScore, color: "#64748b" },
    { label: "Vitals (BP/Heart)", score: vitalsScore, color: vitalsScore > 0 ? "#f59e0b" : "#64748b" },
  ];

  const handleExportImage = async () => {
    setExporting(true);
    try {
      await exportSvgAsPng(gaugeRef.current, `risk_gauge_${shortId(record.id)}.png`);
      showToast("Risk gauge downloaded as PNG.", "success");
    } catch (err) {
      showToast(err.message || "Could not export image.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Section 1: Prediction Summary */}
      <div
        style={{
          padding: "20px 24px",
          borderRadius: 14,
          background: isPositive
            ? "linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))"
            : "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(13,148,136,0.02))",
          border: `1px solid ${isPositive ? "rgba(220,38,38,0.2)" : "rgba(13,148,136,0.2)"}`,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: isPositive ? "var(--crimson)" : "var(--teal)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isPositive ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: isPositive ? "var(--crimson)" : "var(--teal-dark)",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {record.result} (Diabetes Screening Result)
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              REPORT #{shortId(record.id)} &middot; {formatDate(record.timestamp)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: 10, background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>Risk Level</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: isPositive ? "var(--crimson)" : "var(--teal)", marginTop: 2 }}>
              {riskLevel}
            </div>
          </div>

          <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: 10, background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>Probability</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>
              {probPct.toFixed(1)}%
            </div>
          </div>

          <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: 10, background: "var(--paper)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600 }}>Confidence</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--teal)", marginTop: 2 }}>
              {confidenceScore}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Charts (Responsive Row: Left = Gauge, Right = Feature Importance) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart2 size={18} color="var(--teal)" />
          <span>Diagnostic Risk & Feature Analysis Charts</span>
        </div>

        <div className="grid grid-2" style={{ gap: 20, alignItems: "stretch" }}>
          {/* Left Chart: Semicircular Risk Gauge */}
          <RiskGauge
            ref={gaugeRef}
            value={probPct}
            riskLevel={riskLevel}
            onDownload={handleExportImage}
            downloadLoading={exporting}
          />

          {/* Right Chart: Feature Factor Importance */}
          <div
            style={{
              padding: 20,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--paper)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: 14 }}>
              {t("page_predict.featureImportance")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {featureImportance.map((f) => (
                <div key={f.label} style={{ fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontWeight: 600, color: "var(--ink)" }}>
                    <span>{f.label}</span>
                    <span style={{ color: f.color, fontWeight: 700 }}>{f.score}%</span>
                  </div>
                  <div style={{ height: 8, width: "100%", background: "var(--surface-subtle)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                    <div style={{ height: "100%", width: `${f.score}%`, background: f.color, borderRadius: 4, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Below Charts: Probability Distribution Spectrum */}
        <div style={{ padding: 16, borderRadius: 12, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
            <span>Probability Distribution Spectrum</span>
            <span style={{ color: isPositive ? "var(--crimson)" : "var(--teal)", fontWeight: 700 }}>{probPct.toFixed(1)}% Risk Position</span>
          </div>
          <div style={{ height: 10, width: "100%", borderRadius: 5, background: "linear-gradient(to right, #0d9488, #f59e0b, #e11d48)", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: -4,
                left: `calc(${Math.min(98, Math.max(2, probPct))}% - 9px)`,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#ffffff",
                border: `3px solid ${isPositive ? "var(--crimson)" : "var(--teal)"}`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                transition: "left 0.4s ease",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
            <span>0% Low Risk</span>
            <span>50% Moderate Threshold</span>
            <span>100% High Risk</span>
          </div>
        </div>
      </div>

      {/* Section 3: Patient Information Card */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
          <User size={18} color="var(--teal)" />
          <span>Patient Clinical Measurements</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Age</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.age} yrs</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Gender</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.gender}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>BMI</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginTop: 2 }}>{record.input.bmi}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>HbA1c Level</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.HbA1c_level}%</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Blood Glucose</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.blood_glucose_level} mg/dL</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Hypertension</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.hypertension}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Heart Disease</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.heart_disease}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Smoking History</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{record.input.smoking_history}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
