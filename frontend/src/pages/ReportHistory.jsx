import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Loading from "../components/common/Loading.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Pagination from "../components/common/Pagination.jsx";
import ResultSlip from "../components/forms/ResultSlip.jsx";
import AiHealthRecommendations from "../components/results/AiHealthRecommendations.jsx";
import { api, reportsApi } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useApp } from "../context/AppContext.jsx";
import { formatDate, shortId } from "../utils/format.js";
import {
  Search,
  Filter,
  ArrowUpDown,
  Printer,
  Trash2,
  Eye,
  X,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  User,
  Plus,
} from "lucide-react";

const PAGE_SIZE = 10;

export default function ReportHistory() {
  const { showToast } = useToast();
  const { refreshHistory } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("latest");

  // Modal / Action state
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadReports = async (targetPage = page) => {
    setLoading(true);
    try {
      const result = await reportsApi.list({ page: targetPage, page_size: 500 });
      if (result && result.items) {
        setReports(result.items);
        setTotalPages(result.total_pages || 1);
        setPage(targetPage);
      }
    } catch (err) {
      showToast(err.message || "Could not load report history.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (predictionId, reportId) => {
    setBusyId(reportId || predictionId);
    try {
      await api.deleteHistoryItem(predictionId);
      showToast("Report deleted successfully.", "success");
      setDeleteConfirmId(null);
      if (selectedReport && selectedReport.prediction_id === predictionId) {
        setSelectedReport(null);
      }
      refreshHistory();
      loadReports(page);
    } catch (err) {
      showToast(err.message || "Could not delete report.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handlePrint = (record) => {
    if (selectedReport?.prediction_id === record.prediction_id) {
      window.print();
    } else {
      setSelectedReport(record);
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  // Client-side Filter, Search & Sort
  const filteredReports = reports.filter((r) => {
    // 1. Search Query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchId = r.id.toLowerCase().includes(query) || r.prediction_id.toLowerCase().includes(query);
      const matchName = (r.patient_name || "").toLowerCase().includes(query);
      const matchDate = formatDate(r.generated_at).toLowerCase().includes(query);
      if (!matchId && !matchName && !matchDate) return false;
    }

    // 2. Filter Type
    if (filterType === "positive" && r.result !== "Positive") return false;
    if (filterType === "negative" && r.result !== "Negative") return false;
    if (filterType === "high" && r.risk_level !== "High Risk") return false;
    if (filterType === "medium" && r.risk_level !== "Moderate Risk") return false;
    if (filterType === "low" && r.risk_level !== "Low Risk") return false;

    return true;
  });

  // Sorting logic
  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sortBy === "latest") return new Date(b.generated_at) - new Date(a.generated_at);
    if (sortBy === "oldest") return new Date(a.generated_at) - new Date(b.generated_at);
    if (sortBy === "highest_risk") return (b.probability || 0) - (a.probability || 0);
    if (sortBy === "lowest_risk") return (a.probability || 0) - (b.probability || 0);
    return 0;
  });

  const paginatedReports = sortedReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <span className="eyebrow">Reports</span>
        <h1>Report History</h1>
        <p className="sub">View, search, filter, print, and manage all your completed diabetes prediction reports.</p>
      </div>

      {/* Controls Bar: Search, Filter, Sort */}
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          {/* Search Box */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260, position: "relative" }}>
            <Search size={16} color="var(--text-faint)" style={{ position: "absolute", left: 12 }} />
            <input
              type="text"
              placeholder="Search by Report ID, Patient Name, or Date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Filter Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={15} color="var(--text-faint)" />
            <select
              value={filterType}
              aria-label="Filter reports"
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13.5,
                background: "var(--paper)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Reports</option>
              <option value="positive">Positive Result</option>
              <option value="negative">Negative Result</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>

          {/* Sorting Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowUpDown size={15} color="var(--text-faint)" />
            <select
              value={sortBy}
              aria-label="Sort reports"
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13.5,
                background: "var(--paper)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <option value="latest">Latest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_risk">Highest Risk</option>
              <option value="lowest_risk">Lowest Risk</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      <Card>
        {loading ? (
          <Loading label="Loading report history..." />
        ) : sortedReports.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--surface-subtle)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>No reports available</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 4, maxWidth: 400 }}>
                {searchQuery || filterType !== "all"
                  ? "No reports match your current search or filter criteria."
                  : "Complete a diabetes screening to generate your first report."}
              </p>
            </div>
            <Link to="/predict">
              <Button style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={16} /> Start New Screening
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Patient Name</th>
                    <th>Screening Date</th>
                    <th>Prediction Result</th>
                    <th>Risk Level</th>
                    <th>Risk Score</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.map((r) => (
                    <tr key={r.prediction_id}>
                      <td style={{ fontWeight: 700, color: "var(--ink)" }}>{r.id}</td>
                      <td>{r.patient_name}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{formatDate(r.generated_at)}</td>
                      <td>
                        <span className={`pill ${r.result === "Positive" ? "positive" : "negative"}`}>
                          {r.result}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: r.risk_level === "High Risk" ? "var(--crimson)" : "var(--teal)",
                          }}
                        >
                          {r.risk_level}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{r.probability ? `${r.probability.toFixed(1)}%` : "—"}</td>
                      <td>
                        <span style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 4, background: "var(--surface-subtle)", color: "var(--teal-dark)", fontWeight: 600 }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <Button
                            variant="ghost"
                            onClick={() => setSelectedReport(r)}
                            title="View Report Details"
                            aria-label="View Report Details"
                            style={{ padding: "6px 10px" }}
                          >
                            <Eye size={14} /> Details
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => handlePrint(r)}
                            title="Print Report"
                            aria-label="Print Report"
                            style={{ padding: "6px 10px" }}
                          >
                            <Printer size={14} /> Print
                          </Button>

                          <Button
                            variant="danger"
                            loading={busyId === r.prediction_id}
                            onClick={() => setDeleteConfirmId(r.prediction_id)}
                            title="Delete Report"
                            aria-label="Delete Report"
                            style={{ padding: "6px 10px" }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ marginTop: 20 }}>
              <Pagination
                page={page}
                totalPages={Math.ceil(sortedReports.length / PAGE_SIZE)}
                onChange={(p) => setPage(p)}
              />
            </div>
          </>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div style={{ background: "var(--paper)", padding: 24, borderRadius: 16, maxWidth: 400, width: "90%", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Confirm Deletion</h3>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 8 }}>
              Are you sure you want to delete this report? This action cannot be undone.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={busyId === deleteConfirmId}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Delete Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report Modal View */}
      {selectedReport && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div
            className="printable-report-area"
            style={{
              background: "var(--paper, #ffffff)",
              borderRadius: 16,
              maxWidth: 1000,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "var(--ink)" }}>
                  Detailed Screening Report #{selectedReport.id}
                </h2>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                  Screened on {formatDate(selectedReport.generated_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Printer size={15} /> Print Report
                </Button>
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4 }}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Section 1, 2, 3: Prediction Summary, Charts & Patient Information */}
            <Card title="Prediction Result & Risk Analysis">
              <ResultSlip record={selectedReport.record} />
            </Card>

            {/* Section 4, 5, 6, 7: AI Health Recommendations, Diet Plan & Water Tracker */}
            <AiHealthRecommendations predictionId={selectedReport.prediction_id} record={selectedReport.record} />
          </div>
        </div>
      )}
    </div>
  );
}
