import Button from "../ui/Button.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { Printer, AlertCircle } from "lucide-react";

export default function ReportActions({ predictionId, record }) {
  const { showToast } = useToast();
  const isEnabled = Boolean(predictionId);

  const handlePrint = () => {
    if (!isEnabled) {
      showToast("Please complete a diabetes prediction before printing the report.", "info");
      return;
    }
    window.print();
  };

  return (
    <div className="report-actions-wrapper" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="report-actions-container" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button
          variant="primary"
          disabled={!isEnabled}
          onClick={handlePrint}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px" }}
        >
          <Printer size={16} />
          Print Report
        </Button>
      </div>

      {!isEnabled && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--surface-subtle, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            color: "var(--text-faint, #64748b)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} color="var(--teal, #0d9488)" />
          <span>Please complete a diabetes prediction before printing the report.</span>
        </div>
      )}
    </div>
  );
}
