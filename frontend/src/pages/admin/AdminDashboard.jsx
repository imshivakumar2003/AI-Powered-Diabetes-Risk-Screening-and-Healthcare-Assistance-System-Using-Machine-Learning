import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Loading from "../../components/common/Loading.jsx";
import { adminApi } from "../../services/api.js";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { formatDate } from "../../utils/format.js";
import {
  Users,
  UserCheck,
  Activity,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  FileText,
  Percent,
  Server,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusState, setStatusState] = useState("updating"); // "live", "updating", "error"
  const [errorMsg, setErrorMsg] = useState(null);
  const timerRef = useRef(null);

  const fetchDashboardStats = useCallback(async () => {
    setStatusState((prev) => (prev === "live" ? "updating" : prev));
    try {
      const res = await adminApi.getDashboard();
      if (res && !res.error) {
        setData(res);
        setErrorMsg(null);
        setStatusState("live");
      } else {
        setErrorMsg(res?.error || "Unable to update live statistics");
        setStatusState("error");
      }
    } catch (err) {
      setErrorMsg("Unable to update live statistics");
      setStatusState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    // 5-second real-time polling interval
    timerRef.current = setInterval(fetchDashboardStats, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchDashboardStats]);

  if (loading && !data) {
    return <Loading label="Loading real-time admin statistics..." />;
  }

  const isOnline = statusState !== "error";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          padding: 24,
          borderRadius: 16,
          background: "linear-gradient(135deg, var(--paper, #ffffff), var(--surface-subtle, #f8fafc))",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div>
          <span className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--teal)", fontWeight: 700 }}>
            {t("nav.adminPortal")}
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: "4px 0 0 0" }}>{t("page_admin.overview")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-faint)", margin: "4px 0 0 0" }}>
            Real-time database analytics, screening records, AI chat volume, and server status
          </p>
        </div>

        {/* Live Auto-Refresh Truthful Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 20,
              background:
                statusState === "live"
                  ? "rgba(16, 185, 129, 0.12)"
                  : statusState === "updating"
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(220, 38, 38, 0.12)",
              color:
                statusState === "live"
                  ? "#10b981"
                  : statusState === "updating"
                  ? "#f59e0b"
                  : "var(--crimson, #dc2626)",
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  statusState === "live"
                    ? "#10b981"
                    : statusState === "updating"
                    ? "#f59e0b"
                    : "var(--crimson, #dc2626)",
                boxShadow: statusState === "live" ? "0 0 8px #10b981" : "none",
              }}
            />
            {statusState === "live" && "● Live Auto-Refresh (5s)"}
            {statusState === "updating" && "● Updating..."}
            {statusState === "error" && "● Connection Error"}
          </div>

          <Button
            variant="ghost"
            onClick={fetchDashboardStats}
            style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}
          >
            <RefreshCw size={14} className={statusState === "updating" ? "spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Inline Error Notice (Non-Crashing) */}
      {errorMsg && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--crimson, #dc2626)", fontSize: 13, fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
          <Button onClick={fetchDashboardStats} style={{ fontSize: 12, padding: "6px 14px" }}>
            Retry Now
          </Button>
        </div>
      )}

      {/* Primary Metrics Grid (5 cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {/* 1. Total Users */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Total Users</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13, 148, 136, 0.1)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)", marginTop: 8 }}>
            {data?.totalUsers ?? data?.total_users ?? 0}
          </div>
        </div>

        {/* 2. Active Users Today */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Active Users Today</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#10b981", marginTop: 8 }}>
            {data?.activeUsersToday ?? data?.active_users_today ?? 0}
          </div>
        </div>

        {/* 3. Total Predictions */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Total Predictions</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)", marginTop: 8 }}>
            {data?.totalPredictions ?? data?.total_predictions ?? 0}
          </div>
        </div>

        {/* 4. Positive Predictions */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Positive Predictions</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220, 38, 38, 0.1)", color: "var(--crimson, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "var(--crimson, #dc2626)", marginTop: 8 }}>
            {data?.positivePredictions ?? data?.positive_cases ?? data?.positive_predictions ?? 0}
          </div>
        </div>

        {/* 5. Negative Predictions */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Negative Predictions</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13, 148, 136, 0.1)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "var(--teal)", marginTop: 8 }}>
            {data?.negativePredictions ?? data?.negative_cases ?? data?.negative_predictions ?? 0}
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid (4 cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {/* 6. Total AI Chats */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Total AI Chats</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(168, 85, 247, 0.1)", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", marginTop: 8 }}>
            {data?.totalAIChats ?? data?.total_chats ?? 0}
          </div>
        </div>

        {/* 7. Reports Generated */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Reports Generated</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", marginTop: 8 }}>
            {data?.reportsGenerated ?? data?.reports_generated ?? 0}
          </div>
        </div>

        {/* 8. Average Risk Score */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Average Risk Score</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Percent size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)", marginTop: 8 }}>
            {data?.averageRiskScore ?? data?.avg_risk_score ?? 0}%
          </div>
        </div>

        {/* 9. API & Server Status */}
        <div style={{ padding: 20, borderRadius: 16, background: "var(--paper)", border: "1px solid var(--border)", boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>API & Server Status</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: isOnline ? "rgba(16, 185, 129, 0.1)" : "rgba(220, 38, 38, 0.1)", color: isOnline ? "#10b981" : "var(--crimson)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Server size={18} />
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: isOnline ? "#10b981" : "var(--crimson)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
            {isOnline ? "🟢 Operational (Online)" : "🔴 Server Offline"}
          </div>
        </div>
      </div>

      {/* Lower Section: Quick Management Links + Recent Monthly Trends */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        {/* Quick Management Links Card (8 functional links) */}
        <Card title="Quick Management Links">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Link to="/admin/users" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>👤 User Management</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/predictions" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>📋 Prediction Logs</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/chats" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>💬 AI Chat Monitoring</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/feedback" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>📩 Feedback & Tickets</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/analytics" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>📈 Clinical Analytics</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/settings" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>⚙ System Settings</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/audit-logs" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>▥ Audit Logs</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>

            <Link to="/admin/backup" style={{ padding: 12, borderRadius: 10, background: "var(--surface-subtle)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>⇅ Backup & Restore</span>
              <ArrowRight size={14} color="var(--text-faint)" />
            </Link>
          </div>
        </Card>

        {/* Dynamic Recent Monthly Trends Card */}
        <Card title="Recent Monthly Trends (Dynamic DB Data)">
          {!data?.monthly_trends || data.monthly_trends.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-faint)", fontSize: 13 }}>
              No monthly screening trend records found in database.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.monthly_trends.map((m) => (
                <div
                  key={m.month}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ fontWeight: 800, color: "var(--ink)" }}>{m.month}</span>
                  <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
                    <span style={{ color: "var(--teal)", fontWeight: 700 }}>Neg: {m.negative}</span>
                    <span style={{ color: "var(--crimson)", fontWeight: 700 }}>Pos: {m.positive}</span>
                    <span style={{ fontWeight: 800, color: "var(--ink)" }}>Total: {m.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 3. Recent Admin Activity Section */}
      <Card title="Recent Admin Activity">
        {!data?.recentAuditLogs || data.recentAuditLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--text-faint)", fontSize: 13 }}>
            No audit logs recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.recentAuditLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                    {log.admin_name || "Admin"} &middot; <span style={{ color: "var(--teal)" }}>{log.action}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                    {log.description}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))}
            <Link
              to="/admin/audit-logs"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--teal)",
                textDecoration: "none",
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View All Audit Logs &rarr;
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
