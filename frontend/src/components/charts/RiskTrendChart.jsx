import { useState } from "react";

/**
 * Professional SVG Line Chart for Diabetes Risk Score Trends
 * Scales dynamically across Desktop, Tablet, and Mobile with zero horizontal overflow.
 */
export default function RiskTrendChart({ data = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-faint)", fontSize: 13.5 }}>
        No historical screening data available for the selected timeframe.
      </div>
    );
  }

  const width = 700;
  const height = 220;
  const padding = { top: 25, right: 35, bottom: 40, left: 45 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate X and Y coordinates
  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (i / (data.length - 1)) * innerWidth;
    const score = Math.max(0, Math.min(100, d.score || 0));
    const y = padding.top + innerHeight - (score / 100) * innerHeight;
    return { x, y, ...d, score };
  });

  // SVG Path generation
  let pathD = "";
  if (points.length === 1) {
    pathD = `M ${padding.left} ${points[0].y} L ${padding.left + innerWidth} ${points[0].y}`;
  } else {
    pathD = points.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      const prev = points[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, "");
  }

  // Area fill path below curve
  const areaD =
    points.length === 1
      ? ""
      : `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Grid lines & tick labels */}
        {yTicks.map((tick) => {
          const y = padding.top + innerHeight - (tick / 100) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={tick === 0 || tick === 100 ? "0" : "4 4"}
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
                fontWeight="600"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Gradient Area Fill */}
        {areaD && <path d={areaD} fill="url(#chartGradient)" />}

        {/* Trend Line Curve */}
        <path
          d={pathD}
          fill="none"
          stroke="#0d9488"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points & Interactive Tooltips */}
        {points.map((pt, idx) => {
          const isLatest = idx === points.length - 1;
          const isHovered = hoveredIndex === idx;
          const isHigh = pt.score >= 70;
          const ptColor = isHigh ? "#dc2626" : pt.score >= 40 ? "#f59e0b" : "#0d9488";

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Highlight Ring for Newest Prediction */}
              {isLatest && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="10"
                  fill="none"
                  stroke={ptColor}
                  strokeWidth="2"
                  opacity="0.5"
                >
                  <animate
                    attributeName="r"
                    values="7;13;7"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.8;0.2;0.8"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Point Circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered || isLatest ? "6" : "4.5"}
                fill="#ffffff"
                stroke={ptColor}
                strokeWidth="3"
                style={{ transition: "all 0.15s ease" }}
              />

              {/* X-Axis Date Label */}
              <text
                x={pt.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill={isLatest ? "#0f172a" : "#64748b"}
                fontWeight={isLatest ? "700" : "500"}
              >
                {pt.date}
              </text>

              {/* Score label above node if space permits */}
              {(isLatest || isHovered) && (
                <text
                  x={pt.x}
                  y={pt.y - 12}
                  textAnchor="middle"
                  fontSize="11.5"
                  fill={ptColor}
                  fontWeight="800"
                >
                  {pt.score.toFixed(1)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip detail card when hovering point */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 15,
            padding: "8px 12px",
            borderRadius: 10,
            background: "#0f172a",
            color: "#ffffff",
            fontSize: 12,
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 700 }}>{points[hoveredIndex].date}</div>
          <div>Risk Score: <b>{points[hoveredIndex].score.toFixed(1)}%</b></div>
          <div>Result: <span style={{ color: points[hoveredIndex].result === "Positive" ? "#f87171" : "#34d399" }}>{points[hoveredIndex].result}</span></div>
          {points[hoveredIndex].hba1c && <div>HbA1c: {points[hoveredIndex].hba1c}%</div>}
          {points[hoveredIndex].glucose && <div>Glucose: {points[hoveredIndex].glucose} mg/dL</div>}
        </div>
      )}
    </div>
  );
}
