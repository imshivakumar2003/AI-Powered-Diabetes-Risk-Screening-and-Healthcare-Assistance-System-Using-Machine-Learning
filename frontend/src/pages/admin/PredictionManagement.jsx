import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Loading from "../../components/common/Loading.jsx";
import Alert from "../../components/common/Alert.jsx";
import { adminApi, downloadWithAuth, reportsApi } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function PredictionManagement() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState("");
  const [result, setResult] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (result) params.result = result;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await adminApi.listPredictions(params);
      setItems(data.items);
    } catch (err) {
      setError(err.message || "Failed to load predictions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, result, dateFrom, dateTo]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this prediction record?")) return;
    try {
      await adminApi.deletePrediction(id);
      showToast("Prediction record deleted.", "success");
      loadPredictions();
    } catch (err) {
      showToast(err.message || "Could not delete record.", "error");
    }
  };

  const handleDownloadPdf = async (id) => {
    try {
      await downloadWithAuth(reportsApi.pdfUrl(id), `GlucoseCheck_Report_${id.slice(0, 8)}.pdf`);
    } catch (err) {
      showToast(err.message || "Could not download report PDF.", "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Admin Management</span>
        <h1>Prediction Management</h1>
        <p className="sub">Inspect, filter, export, and manage screening results across all system users.</p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search ID, username, email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          >
            <option value="">All Results</option>
            <option value="Positive">Positive Only</option>
            <option value="Negative">Negative Only</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </div>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      <Card>
        {loading ? (
          <Loading label="Loading prediction records..." />
        ) : items.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-faint)", padding: "20px 0" }}>No predictions match the search query.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>Record ID</th>
                  <th style={{ padding: 10 }}>User</th>
                  <th style={{ padding: 10 }}>Screening Values</th>
                  <th style={{ padding: 10 }}>Result</th>
                  <th style={{ padding: 10 }}>Risk Score</th>
                  <th style={{ padding: 10 }}>Date</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8)}...</td>
                    <td style={{ padding: 10, fontWeight: 500 }}>{r.username}</td>
                    <td style={{ padding: 10 }}>
                      BMI: <b>{r.input.bmi}</b> | HbA1c: <b>{r.input.HbA1c_level}</b> | Glucose: <b>{r.input.blood_glucose_level}</b>
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: r.result === "Positive" ? "#fee2e2" : "#dcfce7", color: r.result === "Positive" ? "#b91c1c" : "#15803d" }}>
                        {r.result}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>{r.probability !== null ? `${r.probability}%` : "N/A"}</td>
                    <td style={{ padding: 10 }}>{new Date(r.timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>
                      <Button variant="ghost" onClick={() => handleDownloadPdf(r.id)} style={{ marginRight: 6 }}>Report PDF</Button>
                      <Button variant="ghost" onClick={() => handleDelete(r.id)} style={{ color: "var(--crimson)" }}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
