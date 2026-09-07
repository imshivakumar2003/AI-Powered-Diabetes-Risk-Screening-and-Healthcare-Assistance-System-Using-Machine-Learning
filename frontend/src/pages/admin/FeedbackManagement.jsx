import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Loading from "../../components/common/Loading.jsx";
import Alert from "../../components/common/Alert.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { formatDate } from "../../utils/format.js";

export default function FeedbackManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("gc_token");
    fetch("http://localhost:5000/api/admin/feedback", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch feedback.");
        return res.json();
      })
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message || "Failed to load feedback."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading support tickets..." />;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Admin Portal</span>
        <h1>Feedback & Bug Reports</h1>
        <p className="sub">Inspect user submitted support tickets, bug reports, and feedback.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Card title="Submitted Tickets & Feedback">
        {items.length === 0 ? (
          <EmptyState title="No feedback submitted" message="When users submit feedback or report bugs, they will appear here." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((fb) => (
              <div
                key={fb.id}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: fb.category === "bug" ? "rgba(225,29,72,0.1)" : "rgba(13,148,136,0.1)",
                        color: fb.category === "bug" ? "var(--crimson)" : "var(--teal)",
                        marginRight: 8,
                      }}
                    >
                      {fb.category}
                    </span>
                    <strong style={{ fontSize: 14 }}>{fb.subject || "No Subject"}</strong>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {formatDate(fb.created_at)}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, whiteSpace: "pre-wrap" }}>
                  {fb.message}
                </div>

                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                  Submitted by: <b>@{fb.username}</b> (User ID #{fb.user_id})
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
