import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Loading from "../../components/common/Loading.jsx";
import Alert from "../../components/common/Alert.jsx";
import { adminApi, chatApi } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function ChatManagement() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadChats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      const data = await adminApi.listChats(params);
      setSessions(data.items);
    } catch (err) {
      setError(err.message || "Failed to load chat history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handleInspect = async (s) => {
    setActiveSession(s);
    setLoadingMessages(true);
    try {
      const data = await chatApi.getMessages(s.id);
      setMessages(data.messages);
    } catch (err) {
      showToast(err.message || "Could not load conversation transcript.", "error");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this chat session?")) return;
    try {
      await adminApi.deleteChat(id);
      showToast("Chat session deleted.", "success");
      if (activeSession?.id === id) {
        setActiveSession(null);
        setMessages([]);
      }
      loadChats();
    } catch (err) {
      showToast(err.message || "Could not delete chat session.", "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Admin Management</span>
        <h1>AI Chat Management</h1>
        <p className="sub">Monitor multi-turn AI health assistant conversations and Groq usage across users.</p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search chat session title..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
        />
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: activeSession ? "1fr 1fr" : "1fr", gap: 20 }}>
        <Card>
          {loading ? (
            <Loading label="Loading chats..." />
          ) : sessions.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-faint)", padding: "20px 0" }}>No chat sessions found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: 10 }}>Title</th>
                    <th style={{ padding: 10 }}>User</th>
                    <th style={{ padding: 10 }}>Messages</th>
                    <th style={{ padding: 10 }}>Last Activity</th>
                    <th style={{ padding: 10, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: activeSession?.id === s.id ? "var(--surface-subtle)" : "transparent" }}>
                      <td style={{ padding: 10, fontWeight: 600 }}>{s.title}</td>
                      <td style={{ padding: 10 }}>{s.username}</td>
                      <td style={{ padding: 10 }}>{s.message_count}</td>
                      <td style={{ padding: 10 }}>{new Date(s.updated_at).toLocaleDateString()}</td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        <Button variant="ghost" onClick={() => handleInspect(s)} style={{ marginRight: 6 }}>Inspect</Button>
                        <Button variant="ghost" onClick={() => handleDelete(s.id)} style={{ color: "var(--crimson)" }}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {activeSession && (
          <Card title={`Transcript: ${activeSession.title}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>User: {activeSession.username}</span>
              <Button variant="ghost" onClick={() => setActiveSession(null)}>Close Transcript</Button>
            </div>

            {loadingMessages ? (
              <Loading label="Loading transcript..." />
            ) : messages.length === 0 ? (
              <p style={{ color: "var(--text-faint)" }}>No messages in this chat.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto", paddingRight: 6 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ padding: "8px 12px", borderRadius: 8, background: m.role === "user" ? "var(--surface-subtle)" : "#f0fdf4", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: m.role === "user" ? "#475569" : "#15803d", marginBottom: 4 }}>
                      {m.role === "user" ? "User" : "Groq AI Assistant"}
                    </div>
                    <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.message}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
