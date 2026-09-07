import { forwardRef, useRef, useState } from "react";
import { Download } from "lucide-react";
import { exportSvgAsPng } from "../../utils/exportImage.js";

/**
 * Professional Medical Dashboard "DIABETES RISK GAUGE" Component
 *
 * Requirements:
 * - Card: Border radius 16px, subtle border, soft shadow, 24px padding, center aligned.
 * - Header: "DIABETES RISK GAUGE" (14px, font-weight 700, letter-spacing 1px)
 * - Gauge: Semicircular SVG dial with smooth rounded edges & dynamic stroke
 * - Risk Percentage: Centered 32px font-weight 700 percentage (e.g., 0.05%)
 * - Subtitle: "Estimated likelihood" (smaller muted text)
 * - Risk Status: Dynamic badge (LOW RISK / MEDIUM RISK / HIGH RISK)
 * - Color Logic: Teal/Green for Low Risk, Amber for Medium Risk, Red for High Risk
 * - Download Button: "Download Gauge as Image" with icon centered at bottom
 * - Spacing: 24px card padding; Title -> Gauge 16px; Gauge -> Percentage 8px; Percentage -> Status 8px; Status -> Download 16px.
 */
const RiskGauge = forwardRef(function RiskGauge(
  {
    value = 0,
    riskLevel: customRiskLevel,
    size = 210,
    showTitle = true,
    showDownload = true,
    onDownload,
    downloadLoading = false,
  },
  ref
) {
  const internalSvgRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Merge forwarded ref and internal ref so exportSvgAsPng works cleanly
  const setSvgRef = (node) => {
    internalSvgRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref && "current" in ref) {
      ref.current = node;
    }
  };

  // Clamped probability percentage between 0 and 100
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));

  // Format percentage display without altering underlying calculation
  const formattedPct =
    clamped < 1 && clamped > 0 ? clamped.toFixed(2) : clamped.toFixed(1);

  // Dynamic Risk Level & Color Accent Determination
  let levelText = "LOW RISK";
  let accentColor = "#0d9488"; // Professional Green/Teal accent
  let bgBadge = "rgba(13, 148, 136, 0.12)";
  let borderBadge = "rgba(13, 148, 136, 0.25)";

  if (clamped >= 70) {
    levelText = "HIGH RISK";
    accentColor = "#dc2626"; // Red accent
    bgBadge = "rgba(220, 38, 38, 0.12)";
    borderBadge = "rgba(220, 38, 38, 0.25)";
  } else if (clamped >= 40) {
    levelText = "MEDIUM RISK";
    accentColor = "#f59e0b"; // Amber/Orange accent
    bgBadge = "rgba(245, 158, 11, 0.12)";
    borderBadge = "rgba(245, 158, 11, 0.25)";
  }

  // Override text/badge formatting if custom level is passed in
  if (customRiskLevel) {
    const upper = customRiskLevel.toUpperCase();
    if (upper.includes("HIGH")) {
      levelText = "HIGH RISK";
      accentColor = "#dc2626";
      bgBadge = "rgba(220, 38, 38, 0.12)";
      borderBadge = "rgba(220, 38, 38, 0.25)";
    } else if (upper.includes("MEDIUM") || upper.includes("MODERATE")) {
      levelText = "MEDIUM RISK";
      accentColor = "#f59e0b";
      bgBadge = "rgba(245, 158, 11, 0.12)";
      borderBadge = "rgba(245, 158, 11, 0.25)";
    } else if (upper.includes("LOW")) {
      levelText = "LOW RISK";
      accentColor = "#0d9488";
      bgBadge = "rgba(13, 148, 136, 0.12)";
      borderBadge = "rgba(13, 148, 136, 0.25)";
    } else {
      levelText = upper;
    }
  }

  // Semicircular SVG dial math
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2 + 8;

  const angleForValue = (v) => Math.PI - (v / 100) * Math.PI;

  const point = (angle) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  });

  const start = point(Math.PI); // 0% at left
  const end = point(angleForValue(clamped)); // current percentage position

  const largeArc = clamped > 50 ? 1 : 0;

  const trackPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${
    cx + radius
  } ${cy}`;
  const valuePath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  // Internal Fallback Download Handler
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!internalSvgRef.current) return;
    setDownloading(true);
    try {
      await exportSvgAsPng(internalSvgRef.current, "diabetes_risk_gauge.png");
    } catch (err) {
      console.error("Could not export gauge:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="risk-gauge-card"
      style={{
        padding: "24px",
        borderRadius: "16px",
        border: "1px solid var(--border, #e2e8f0)",
        background: "var(--paper, #ffffff)",
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      {showTitle && (
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--text-muted, #64748b)",
            marginBottom: "16px",
          }}
        >
          DIABETES RISK GAUGE
        </div>
      )}

      {/* Semicircular SVG Gauge Dial */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size / 1.75,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <svg
          ref={setSvgRef}
          width={size}
          height={size / 1.6}
          viewBox={`0 0 ${size} ${size / 1.6}`}
          style={{ overflow: "visible" }}
        >
          {/* Background Track Arc */}
          <path
            d={trackPath}
            fill="none"
            stroke="var(--line, #e2e8f0)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active Value Arc */}
          {clamped > 0 && (
            <path
              d={valuePath}
              fill="none"
              stroke={accentColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease",
              }}
            />
          )}
        </svg>

        {/* Center Percentage Display inside Semicircle */}
        <div
          style={{
            position: "absolute",
            bottom: "6px",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--ink, #0f172a)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {formattedPct}%
          </span>
        </div>
      </div>

      {/* Subtitle: Estimated likelihood (Gauge -> Percentage/Likelihood: 8px) */}
      <div
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--text-faint, #64748b)",
          marginTop: "8px",
        }}
      >
        Estimated likelihood
      </div>

      {/* Risk Status Badge (Percentage/Likelihood -> Status: 8px) */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 14px",
          borderRadius: "20px",
          background: bgBadge,
          border: `1px solid ${borderBadge}`,
          color: accentColor,
          fontSize: "11.5px",
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginTop: "8px",
          marginBottom: showDownload ? "16px" : "0px",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: accentColor,
          }}
        />
        {levelText}
      </div>

      {/* Download Button (Status -> Download Button: 16px) */}
      {showDownload && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloadLoading || downloading}
          style={{
            fontSize: "12.5px",
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border, #cbd5e1)",
            background: "var(--surface-subtle, #f8fafc)",
            color: "var(--ink, #0f172a)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
          }}
        >
          <Download size={14} />
          {downloadLoading || downloading
            ? "Downloading..."
            : "Download Gauge as Image"}
        </button>
      )}
    </div>
  );
});

export default RiskGauge;
