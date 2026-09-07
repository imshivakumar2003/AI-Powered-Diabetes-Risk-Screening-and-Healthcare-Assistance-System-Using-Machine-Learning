import { useState, useRef, useEffect } from "react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import PredictionForm from "../components/forms/PredictionForm.jsx";
import ResultSlip from "../components/forms/ResultSlip.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import ReportActions from "../components/results/ReportActions.jsx";
import AiHealthRecommendations from "../components/results/AiHealthRecommendations.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { ChevronDown, ChevronUp, UserCheck, Stethoscope } from "lucide-react";

export default function Predict() {
  const [result, setResult] = useState(null);
  const [showInputs, setShowInputs] = useState(true);
  const resultsRef = useRef(null);
  const { t } = useLanguage();

  const handleResult = (newResult) => {
    setResult(newResult);
    setShowInputs(false); // Automatically collapse input card to maximize dashboard focus
  };

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <span className="eyebrow">{t("nav.newScreening")}</span>
        <h1>{t("page_predict.title")}</h1>
        <p className="sub">{t("page_predict.sub")}</p>
      </div>

      {!result ? (
        /* BEFORE PREDICTION: Balanced Two-Column Layout */
        <div className="grid grid-2" style={{ alignItems: "start", gap: 24 }}>
          <Card title={t("page_predict.patientInputs")}>
            <PredictionForm onResult={handleResult} />
          </Card>

          <div>
            <Card title={t("page_predict.result")}>
              <EmptyState
                title={t("page_predict.noResultYet")}
                message={t("page_predict.submitToGenerate")}
              />
            </Card>

            <div style={{ marginTop: 20 }}>
              <ReportActions predictionId={null} record={null} />
            </div>
          </div>
        </div>
      ) : (
        /* AFTER PREDICTION: Single-Column Centered Medical Dashboard */
        <div
          ref={resultsRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            width: "100%",
            animation: "fadeIn 0.5s ease-in-out",
          }}
        >
          {/* Collapsible Patient Input Header */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 16,
              background: "var(--paper, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Stethoscope size={20} color="var(--teal, #0d9488)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Patient Screening Input Parameters</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {showInputs ? "Modify clinical parameters below to rerun prediction model" : "Click expand to edit inputs"}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowInputs((prev) => !prev)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              {showInputs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showInputs ? "Hide Inputs" : "Edit Inputs"}
            </Button>
          </div>

          {showInputs && (
            <Card title={t("page_predict.patientInputs")}>
              <PredictionForm onResult={handleResult} />
            </Card>
          )}

          {/* Section 1, 2, 3: Prediction Summary, Charts & Patient Information */}
          <Card title={t("page_predict.result")}>
            <ResultSlip record={result} />
          </Card>

          {/* Section 4, 5, 6, 7: AI Health Recommendations, Diet Plan, Nutrition & Water Tracker */}
          <AiHealthRecommendations predictionId={result.id} record={result} />

          {/* Section 8: Print Report Button (Centered at Bottom) */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 24 }}>
            <ReportActions predictionId={result.id} record={result} />
          </div>
        </div>
      )}
    </div>
  );
}
