import { useEffect, useState, useCallback } from "react";
import Card from "../../components/ui/Card.jsx";
import Loading from "../../components/common/Loading.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { adminApi } from "../../services/adminApi.js";
import { useToast } from "../../context/ToastContext.jsx";
import { formatDate } from "../../utils/format.js";
import { Search, Filter, Calendar, RefreshCw, ShieldAlert, CheckCircle2, User } from "lucide-react";

export default function AuditLogs() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(
    async (targetPage = page, isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const params = { page: targetPage, page_size: 20 };
        if (search.trim()) params.q = search.trim();
        if (actionFilter && actionFilter !== "all") params.action = actionFilter;
        if (adminFilter && adminFilter !== "all") params.admin_id = adminFilter;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        const result = await adminApi.getAuditLogs(params);
        setData(result);
        setPage(targetPage);
      } catch (err) {
        if (!isSilent) showToast(err.message || "Could not load audit logs.", "error");
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [page, search, actionFilter, adminFilter, dateFrom, dateTo, showToast]
  );

  // Initial & Filter Change Load
  useEffect(() => {
    load(1);
  }, [load]);

  // Real-Time 5-Second Auto-Refresh Polling Loop
  useEffect(() => {
    const timer = setInterval(() => {
      load(page, true);
    }, 5000);
    return () => clearInterval(timer);
  }, [load, page]);

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 1;
  const startIdx = total === 0 ? 0 : (page - 1) * 20 + 1;
  const endIdx = Math.min(page * 20, total);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <span className="eyebrow">Administration</span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 0 0", color: "var(--ink)" }}>System Audit Logs</h1>
          <p className="sub" style={{ margin: "4px 0 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            Real-time security and administrative activity log.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: "rgba(13,148,136,0.12)",
              color: "var(--teal)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal)" }} />
            ● Live Auto-Refresh (5s)
          </span>

          <button
            onClick={() => load(page)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--paper)",
              color: "var(--ink)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 240, position: "relative" }}>
            <Search size={16} color="var(--text-faint)" style={{ position: "absolute", left: 12 }} />
            <input
              type="text"
              placeholder="Search by action, admin, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13.5,
                background: "var(--paper)",
                color: "var(--ink)",
              }}
            />
          </div>

          {/* Action Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={15} color="var(--text-faint)" />
            <select
              value={actionFilter}
              aria-label="Filter by action type"
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--paper)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Action Types</option>
              <option value="admin_login">Admin Login</option>
              <option value="user_login">User Login</option>
              <option value="user_created">User Created</option>
              <option value="user_updated">User Updated</option>
              <option value="user_deleted">User Deleted</option>
              <option value="user_viewed">User Viewed</option>
              <option value="prediction_viewed">Prediction Viewed</option>
              <option value="report_viewed">Report Viewed</option>
              <option value="report_generated">Report Generated</option>
              <option value="chat_viewed">Chat History Viewed</option>
              <option value="settings_updated">Admin Settings Changed</option>
              <option value="database_backup">Database Backup</option>
              <option value="database_restore">Database Restore</option>
            </select>
          </div>

          {/* Admin Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <User size={15} color="var(--text-faint)" />
            <select
              value={adminFilter}
              aria-label="Filter by admin"
              onChange={(e) => setAdminFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--paper)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Admins</option>
              {data?.admins?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (ID: {a.id})
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={15} color="var(--text-faint)" />
            <input
              type="date"
              aria-label="Start date filter"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                background: "var(--paper)",
                color: "var(--ink)",
              }}
            />
          </div>

          {/* Reset Filters */}
          {(search || actionFilter !== "all" || adminFilter !== "all" || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch("");
                setActionFilter("all");
                setAdminFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                background: "var(--surface-subtle)",
                color: "var(--crimson)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </Card>

      {/* Main Audit Table */}
      <Card>
        {loading ? (
          <Loading label="Loading real-time audit logs..." />
        ) : items.length === 0 ? (
          <EmptyState title="No Audit Log Entries" message="No activity records match your filter criteria." />
        ) : (
          <>
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>Date &amp; Time</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>Admin</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>Action</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>Target</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>Description</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", borderBottom: "1px solid var(--line)" }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id}>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontSize: 12.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontWeight: 700, color: "var(--ink)" }}>
                        {log.admin_name || "Admin"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            background: "rgba(13,148,136,0.12)",
                            color: "var(--teal)",
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontWeight: 600, fontSize: 13 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "var(--surface-subtle)", color: "var(--ink)" }}>
                          {log.target_type}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontSize: 13, color: "var(--text-muted)" }}>
                        {log.description}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--text-faint)", fontFamily: "monospace" }}>
                        {log.ip_address}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination & Summary Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                Showing {startIdx}–{endIdx} of {total} audit logs
              </div>

              <Pagination page={page} totalPages={totalPages} onChange={(p) => load(p)} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
