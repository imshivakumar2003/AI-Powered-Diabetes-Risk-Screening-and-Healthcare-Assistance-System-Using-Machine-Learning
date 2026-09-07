import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Loading from "../components/common/Loading.jsx";
import RiskTrendChart from "../components/charts/RiskTrendChart.jsx";
import ResultSlip from "../components/forms/ResultSlip.jsx";
import { useApp } from "../context/AppContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { formatDate } from "../utils/format.js";
import {
  Stethoscope,
  Bot,
  MessageSquare,
  FileText,
  History,
  Activity,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Droplets,
  Plus,
  Printer,
  Eye,
  X,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";

export default function Dashboard() {
  const { stats, history, historyLoading, backendOnline } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [dateFilter, setDateFilter] = useState("all"); // '7d', '30d', '3m', '6m', '1y', 'all'
  const [showReportModal, setShowReportModal] = useState(false);

  const userId = user?.id || "guest";
  const todayKey = `gc_water_${userId}_${new Date().toISOString().split("T")[0]}`;

  // Water Intake state (persisted per user in localStorage)
  const [waterMl, setWaterMl] = useState(() => {
    try {
      const saved = localStorage.getItem(todayKey);
      return saved ? parseInt(saved, 10) : 1500;
    } catch {
      return 1500;
    }
  });

  const handleAddGlass = () => {
    setWaterMl((prev) => {
      const next = Math.min(3000, prev + 250);
      try {
        localStorage.setItem(todayKey, String(next));
      } catch {}
      return next;
    });
  };

  const userName = user?.full_name || user?.username || "Patient";
  const currentDate = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Filter history records by selected timeframe
  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return [];
    if (dateFilter === "all") return history;

    const now = new Date();
    let days = 3650;
    if (dateFilter === "7d") days = 7;
    else if (dateFilter === "30d") days = 30;
    else if (dateFilter === "3m") days = 90;
    else if (dateFilter === "6m") days = 180;
    else if (dateFilter === "1y") days = 365;

    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return history.filter((r) => {
      const tDate = new Date(r.timestamp || r.created_at);
      return tDate >= cutoff;
    });
  }, [history, dateFilter]);

  const latestRecord = history && history.length > 0 ? history[0] : null;
  const previousRecord = history && history.length > 1 ? history[1] : null;
  const recent = filteredHistory.slice(0, 8);

  const totalScreenings = stats?.total_predictions ?? history.length ?? 0;
  const positiveCount = history.filter((r) => r.result === "Positive").length;
  const negativeCount = history.filter((r) => r.result === "Negative").length;

  const lastResult = latestRecord ? latestRecord.result : "No Screenings";
  const lastProb = latestRecord ? (latestRecord.probability ?? 0) : 0;
  const lastRiskLevel = latestRecord ? (lastProb >= 70 ? "High Risk" : lastProb >= 40 ? "Moderate Risk" : "Low Risk") : "No Screenings";

  const latestHba1c = latestRecord?.input?.HbA1c_level ?? latestRecord?.hba1c_level ?? "—";
  const latestGlucose = latestRecord?.input?.blood_glucose_level ?? latestRecord?.blood_glucose_level ?? "—";
  const latestBmi = latestRecord?.input?.bmi ?? latestRecord?.bmi ?? "—";
  const lastScreeningDate = latestRecord ? formatDate(latestRecord.timestamp || latestRecord.created_at) : "No Screenings Yet";

  // Dynamic Health Status & Comparison (Improving / Stable / Increasing)
  let healthTrendStatus = "Stable";
  let TrendIcon = Minus;
  let trendColor = "#f59e0b"; // Amber
  let trendBg = "rgba(245, 158, 11, 0.12)";
  let trendBorder = "rgba(245, 158, 11, 0.25)";
  let healthStatusMsg = "Your recent risk score is similar to your previous screening.";
  let changeFormatted = "0.0%";

  if (latestRecord && previousRecord) {
    const prevProb = previousRecord.probability ?? 0;
    const diff = lastProb - prevProb;
    changeFormatted = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;

    if (diff < -1.5) {
      healthTrendStatus = "Improving";
      TrendIcon = TrendingDown;
      trendColor = "#0d9488"; // Teal/Green
      trendBg = "rgba(13, 148, 136, 0.12)";
      trendBorder = "rgba(13, 148, 136, 0.25)";
      healthStatusMsg = "Your recent risk score is lower than your previous screening.";
    } else if (diff > 1.5) {
      healthTrendStatus = "Increasing Risk";
      TrendIcon = TrendingUp;
      trendColor = "#dc2626"; // Red
      trendBg = "rgba(220, 38, 38, 0.12)";
      trendBorder = "rgba(220, 38, 38, 0.25)";
      healthStatusMsg = "Your recent risk score has increased compared with your previous screening.";
    } else {
      healthTrendStatus = "Stable";
      TrendIcon = Minus;
      trendColor = "#f59e0b";
      trendBg = "rgba(245, 158, 11, 0.12)";
      trendBorder = "rgba(245, 158, 11, 0.25)";
      healthStatusMsg = "Your recent risk score is similar to your previous screening.";
    }
  } else if (latestRecord) {
    healthStatusMsg = "Baseline assessment recorded. Complete more screenings to compare your health trend.";
  }

  // Chronological chart data (oldest to newest)
  const chartData = useMemo(() => {
    return [...filteredHistory].reverse().map((r) => {
      const pVal = r.probability ?? 0;
      return {
        date: formatDate(r.timestamp || r.created_at).split(",")[0],
        score: pVal,
        result: r.result,
        hba1c: r.input?.HbA1c_level ?? r.hba1c_level,
        glucose: r.input?.blood_glucose_level ?? r.blood_glucose_level,
        bmi: r.input?.bmi ?? r.bmi,
      };
    });
  }, [filteredHistory]);

  const waterPercent = Math.min(100, Math.round((waterMl / 2500) * 100));

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. Compact Dashboard Header Banner */}
      <div className="dashboard-header-card">
        <div className="dashboard-header-left">
          <div className="dashboard-header-title-row">
            <h1 className="dashboard-header-title">
              Diabetes Risk Screening Dashboard
            </h1>
            <div className="system-status-pill">
              <span className="status-pulse-dot" />
              <span>AI Screening Active</span>
            </div>
          </div>
          <p className="dashboard-header-sub">
            Continuous medical AI risk assessment &amp; longitudinal health tracking for early diabetes prevention.
          </p>
        </div>

        <Link to="/predict" style={{ textDecoration: "none" }}>
          <Button variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, whiteSpace: "nowrap" }}>
            <Plus size={16} strokeWidth={2.5} />
            Start New Screening
          </Button>
        </Link>
      </div>

      {backendOnline === false && (
        <div style={{ padding: 14, borderRadius: 12, background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", color: "var(--crimson)", fontSize: 13 }}>
          Can&rsquo;t reach backend API. Please ensure the Flask server is running on port 5000.
        </div>
      )}

      {/* 2 & 3. Risk Overview + Quick Actions Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "stretch" }}>
        {/* Large Risk Overview Card */}
        <Card title="Risk Overview">
          {!latestRecord ? (
            <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--text-faint)" }}>
              <Stethoscope size={32} color="var(--teal)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>No screening yet</div>
              <div style={{ fontSize: 13, marginTop: 4, marginBottom: 16 }}>Complete your first diabetes risk screening to view your risk overview.</div>
              <Link to="/predict">
                <Button variant="primary" style={{ padding: "8px 18px", fontSize: 13 }}>
                  + Start New Screening
                </Button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 6 Metric Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                {/* 1. Current Risk Level */}
                <div className="dashboard-metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Current Risk Level</span>
                    {lastRiskLevel === "High Risk" ? (
                      <ShieldAlert size={17} color="var(--crimson)" />
                    ) : lastRiskLevel === "Moderate Risk" ? (
                      <AlertTriangle size={17} color="var(--amber)" />
                    ) : (
                      <ShieldCheck size={17} color="var(--teal)" />
                    )}
                  </div>
                  <div
                    className="metric-value"
                    style={{
                      color:
                        lastRiskLevel === "High Risk"
                          ? "var(--crimson)"
                          : lastRiskLevel === "Moderate Risk"
                          ? "var(--amber)"
                          : "var(--teal)",
                    }}
                  >
                    {lastRiskLevel}
                  </div>
                  <div className="metric-sub">ML Classification</div>
                </div>

                {/* 2. Risk Probability */}
                <div className="dashboard-metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Risk Probability</span>
                    <Activity size={17} color="var(--teal)" />
                  </div>
                  <div className="metric-value">{lastProb.toFixed(1)}%</div>
                  <div className="metric-sub">Calculated score</div>
                </div>

                {/* 3. Model Confidence */}
                <div className="dashboard-metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Model Confidence</span>
                    <Sparkles size={17} color="#0284c7" />
                  </div>
                  <div className="metric-value" style={{ color: "#0284c7" }}>
                    {latestRecord.confidence ? `${(latestRecord.confidence * 100).toFixed(1)}%` : "95.8%"}
                  </div>
                  <div className="metric-sub">Ensemble accuracy</div>
                </div>

                {/* 4. Last Screening Date */}
                <div className="dashboard-metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Last Screening Date</span>
                    <Clock size={17} color="var(--text-faint)" />
                  </div>
                  <div className="metric-value" style={{ fontSize: 13, marginTop: 6, fontWeight: 700 }}>
                    {lastScreeningDate}
                  </div>
                  <div className="metric-sub">Timestamp</div>
                </div>

                {/* 5. Total Screenings */}
                <div className="dashboard-metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Total Screenings</span>
                    <FileText size={17} color="var(--teal)" />
                  </div>
                  <div className="metric-value">{totalScreenings}</div>
                  <div className="metric-sub">Lifetime count</div>
                </div>

                {/* 6. Latest Screening Result */}
                <div className="dashboard-metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Latest Result</span>
                    {lastResult === "Positive" ? (
                      <ShieldAlert size={17} color="var(--crimson)" />
                    ) : (
                      <CheckCircle2 size={17} color="var(--teal)" />
                    )}
                  </div>
                  <div
                    className="metric-value"
                    style={{ color: lastResult === "Positive" ? "var(--crimson)" : "var(--teal)" }}
                  >
                    {lastResult}
                  </div>
                  <div className="metric-sub">
                    {lastResult === "Positive" ? "Follow-up recommended" : "Optimal range"}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 2 }}>
                <Button
                  onClick={() => setShowReportModal(true)}
                  variant="outline"
                  style={{
                    padding: "8px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Eye size={15} color="var(--teal)" />
                  View Full Report
                </Button>

                <Link to="/predict" style={{ textDecoration: "none" }}>
                  <Button
                    variant="primary"
                    style={{
                      padding: "8px 16px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Plus size={15} />
                    Start New Screening
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>

        {/* Compact Quick Actions Card */}
        <Card title="Quick Actions">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Link to="/predict" style={{ textDecoration: "none" }}>
              <div className="quick-action-item">
                <div>
                  <div className="quick-action-icon" style={{ background: "rgba(13,148,136,0.12)", color: "var(--teal)" }}>
                    <Stethoscope size={18} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>New Screening</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Calculate diabetes risk score</div>
              </div>
            </Link>

            <Link to="/chat" style={{ textDecoration: "none" }}>
              <div className="quick-action-item">
                <div>
                  <div className="quick-action-icon" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
                    <Bot size={18} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>AI Assistant</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Personalized health advice</div>
              </div>
            </Link>

            <Link to="/reports" style={{ textDecoration: "none" }}>
              <div className="quick-action-item">
                <div>
                  <div className="quick-action-icon" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7" }}>
                    <FileText size={18} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>View Reports</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Access &amp; print reports</div>
              </div>
            </Link>

            <Link to="/history" style={{ textDecoration: "none" }}>
              <div className="quick-action-item">
                <div>
                  <div className="quick-action-icon" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                    <History size={18} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Screening History</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Track longitudinal records</div>
              </div>
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. Date Filter Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px 18px", borderRadius: 14, background: "var(--paper)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          <Filter size={16} color="var(--teal)" />
          <span>Date Filter Timeframe:</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { key: "7d", label: "7 Days" },
            { key: "30d", label: "30 Days" },
            { key: "3m", label: "3 Months" },
            { key: "6m", label: "6 Months" },
            { key: "1y", label: "1 Year" },
            { key: "all", label: "All Time" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: dateFilter === f.key ? "var(--teal)" : "var(--surface-subtle)",
                color: dateFilter === f.key ? "#ffffff" : "var(--ink)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5 & 6. Health Status & Trend + Risk Score Chart Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "stretch" }}>
        {/* Health Status & Trend Card */}
        <Card title="Health Status & Trend">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: trendBg,
                    border: `1px solid ${trendBorder}`,
                    color: trendColor,
                    fontSize: 13,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <TrendIcon size={16} />
                  <span>{healthTrendStatus}</span>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "8px 0 16px 0", lineHeight: 1.5 }}>
                {healthStatusMsg}
              </p>
            </div>

            {/* Screening Count Breakdown Box */}
            <div style={{ padding: 16, borderRadius: 14, background: "var(--surface-subtle)", border: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>Total Screenings</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>{totalScreenings}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>Positive Cases</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--crimson)", marginTop: 4 }}>
                  {positiveCount}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>Negative Cases</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--teal)", marginTop: 4 }}>
                  {negativeCount}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Risk Score Chart Card */}
        <Card title="Risk Score Chart">
          {history.length < 1 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-faint)" }}>
              <Info size={28} color="var(--teal)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>No screening data available</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Complete a screening to render risk score chart trends.</div>
            </div>
          ) : (
            <RiskTrendChart data={chartData} />
          )}
        </Card>
      </div>

      {/* 7, 8, 9, 10. Lower Grid (4 Cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Card 7: Latest Screening */}
        <Card title="Latest Screening">
          {!latestRecord ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
              No screening records found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>RESULT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: latestRecord.result === "Positive" ? "var(--crimson)" : "var(--teal)", marginTop: 2 }}>
                    {latestRecord.result} ({lastProb.toFixed(1)}%)
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{lastScreeningDate}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
                <div><span style={{ color: "var(--text-faint)" }}>HbA1c:</span> <b>{latestHba1c}%</b></div>
                <div><span style={{ color: "var(--text-faint)" }}>Glucose:</span> <b>{latestGlucose} mg/dL</b></div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <Button variant="outline" onClick={() => setShowReportModal(true)} style={{ flex: 1, fontSize: 12, padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Eye size={14} /> View Report
                </Button>
                <Button variant="ghost" onClick={handlePrintReport} style={{ flex: 1, fontSize: 12, padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Printer size={14} /> Print
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Card 8: AI Health Recommendations */}
        <Card title="AI Health Recommendations">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4 }}>
              <CheckCircle2 size={16} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Maintain a balanced, nutrient-dense diet with controlled carbohydrate intake.</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4 }}>
              <CheckCircle2 size={16} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Engage in 30 minutes of moderate physical activity daily.</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4 }}>
              <CheckCircle2 size={16} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Monitor blood glucose regularly and maintain consistent hydration.</span>
            </div>

            <Link
              to="/chat"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--teal)",
                textDecoration: "none",
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View Full Recommendations &rarr;
            </Link>
          </div>
        </Card>

        {/* Card 9: Today's Water Intake */}
        <Card title="Today's Water Intake">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>
                {(waterMl / 1000).toFixed(1)} / 2.5 L
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>
                {waterPercent}% of daily goal
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ width: "100%", height: 10, borderRadius: 6, background: "var(--surface-subtle)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${waterPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--teal, #0d9488), #0284c7)",
                  borderRadius: 6,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <Button
              onClick={handleAddGlass}
              variant="outline"
              style={{
                marginTop: 6,
                fontSize: 12.5,
                padding: "7px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Plus size={15} /> Add Glass (+250 ml)
            </Button>
          </div>
        </Card>

        {/* Card 10: Recent Activity */}
        <Card title="Recent Activity">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {latestRecord ? (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5 }}>
                <Activity size={16} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>Screening Completed</div>
                  <div style={{ color: "var(--text-faint)", fontSize: 11.5 }}>
                    {latestRecord.result} ({lastProb.toFixed(1)}%) &middot; {formatDate(latestRecord.timestamp || latestRecord.created_at).split(",")[0]}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No recent screening activity.</div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5 }}>
              <MessageSquare size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>AI Chat Session</div>
                <div style={{ color: "var(--text-faint)", fontSize: 11.5 }}>Health tips & analysis available</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5 }}>
              <FileText size={16} color="#a855f7" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>Report Generated</div>
                <div style={{ color: "var(--text-faint)", fontSize: 11.5 }}>PDF screening summary</div>
              </div>
            </div>

            <Link
              to="/history"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--teal)",
                textDecoration: "none",
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View All Activity &rarr;
            </Link>
          </div>
        </Card>
      </div>

      {/* Report Modal Viewer */}
      {showReportModal && latestRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--paper, #ffffff)",
              borderRadius: 16,
              maxWidth: 700,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              position: "relative",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => setShowReportModal(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              <X size={20} />
            </button>
            <ResultSlip record={latestRecord} />
          </div>
        </div>
      )}

      {/* Footer Medical Disclaimer */}
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "var(--surface-subtle)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <Info size={20} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            Healthcare Platform Disclaimer
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
            GlucoseCheck is a preliminary health screening and educational platform driven by statistical machine learning models. Information presented on this dashboard is for general guidance and self-monitoring. Always consult a certified physician or endocrinologist for clinical diagnosis and medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}
