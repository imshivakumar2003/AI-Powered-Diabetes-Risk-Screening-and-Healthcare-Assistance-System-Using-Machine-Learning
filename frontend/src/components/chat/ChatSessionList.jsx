import { useState } from "react";
import { formatDate } from "../../utils/format.js";

export default function ChatSessionList({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onToggleFavorite,
  search,
  onSearchChange,
  favoriteOnly,
  onToggleFavoriteFilter,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (session) => {
    setRenamingId(session.id);
    setRenameValue(session.title);
  };

  const commitRename = (id) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <div className="chat-sidebar">
      <button className="btn btn-primary" style={{ width: "100%", marginBottom: 12 }} onClick={onNew}>
        + New Chat
      </button>

      <input
        type="text"
        placeholder="Search chats…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="chat-search-input"
      />

      <button
        className={`chat-filter-toggle ${favoriteOnly ? "active" : ""}`}
        onClick={onToggleFavoriteFilter}
      >
        {favoriteOnly ? "★ Favorites only" : "☆ Show favorites only"}
      </button>

      <div className="chat-session-scroll">
        {sessions.length === 0 && (
          <div style={{ padding: "16px 8px", color: "var(--text-faint)", fontSize: 12.5 }}>
            No chats yet. Start a new one!
          </div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className={`chat-session-item ${s.id === activeId ? "active" : ""}`}>
            {renamingId === s.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={(e) => e.key === "Enter" && commitRename(s.id)}
                className="chat-rename-input"
              />
            ) : (
              <div onClick={() => onSelect(s.id)} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                <div className="chat-session-title">
                  {s.is_favorite && <span style={{ color: "#e0a30f" }}>★ </span>}
                  {s.title}
                </div>
                <div className="chat-session-meta">{formatDate(s.updated_at)}</div>
              </div>
            )}

            <div className="chat-session-actions">
              <button title="Rename" onClick={() => startRename(s)}>✎</button>
              <button title="Favorite" onClick={() => onToggleFavorite(s.id, !s.is_favorite)}>
                {s.is_favorite ? "★" : "☆"}
              </button>
              <button title="Delete" onClick={() => onDelete(s.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
