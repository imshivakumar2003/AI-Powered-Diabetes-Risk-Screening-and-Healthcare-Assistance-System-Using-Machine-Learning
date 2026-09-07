import { useState, useEffect, useRef, useCallback } from "react";
import { notificationsApi } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import {
  Bell,
  CheckCheck,
  Stethoscope,
  FileText,
  BrainCircuit,
  User,
  Sparkles,
  Info,
  Clock,
  Trash2,
  ShieldAlert,
  Droplets,
} from "lucide-react";

const TYPE_ICONS = {
  prediction_completed: <Stethoscope size={16} color="#0d9488" />,
  report_generated: <FileText size={16} color="#3b82f6" />,
  ai_chat_response: <BrainCircuit size={16} color="#a855f7" />,
  ai_recommendation: <Sparkles size={16} color="#f59e0b" />,
  ai_diet_plan: <Sparkles size={16} color="#10b981" />,
  high_risk_alert: <ShieldAlert size={16} color="#dc2626" />,
  hydration_reminder: <Droplets size={16} color="#0284c7" />,
  profile_updated: <User size={16} color="#64748b" />,
  screening_reminder: <Bell size={16} color="#ec4899" />,
  health_tip: <Info size={16} color="#10b981" />,
};

function formatTimeAgo(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationPanel() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationsApi.getUnreadCount();
      if (res && typeof res.unread_count === "number") {
        setUnreadCount(res.unread_count);
      }
    } catch {}
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const list = await notificationsApi.list(50);
      setNotifications(list || []);
      const unread = (list || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load and 6-second polling loop
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 6000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUnreadCount]);

  // Handle panel open/close
  const togglePanel = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await notificationsApi.markRead(id);
      if (res && res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount(res.unread_count);
      }
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await notificationsApi.markAllRead();
      if (res && res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch {}
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await notificationsApi.delete(id);
      if (res && res.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount(res.unread_count);
      }
    } catch {}
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell Icon Trigger */}
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Notifications"
        title="Notifications"
        style={{
          position: "relative",
          background: "var(--surface-subtle, #f8fafc)",
          border: "1px solid var(--border, #e2e8f0)",
          cursor: "pointer",
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink)",
          transition: "all 0.15s ease",
        }}
      >
        <Bell size={18} color="var(--ink)" />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--crimson, #dc2626)",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 10,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--paper, #ffffff)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 42,
            width: 360,
            maxHeight: 480,
            borderRadius: 16,
            background: "var(--paper, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface-subtle, #f8fafc)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "rgba(13, 148, 136, 0.12)",
                    color: "var(--teal, #0d9488)",
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--teal, #0d9488)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1, padding: 4 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-faint)" }}>
                <Bell size={28} color="var(--border)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>No notifications yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>You will be notified when screening & AI events occur.</div>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => handleMarkRead(item.id, e)}
                  style={{
                    padding: 12,
                    margin: 4,
                    borderRadius: 12,
                    background: item.is_read ? "var(--paper, #ffffff)" : "rgba(13, 148, 136, 0.05)",
                    border: item.is_read ? "1px solid transparent" : "1px solid rgba(13, 148, 136, 0.15)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "var(--surface-subtle, #f8fafc)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICONS[item.type] || <Bell size={16} color="var(--teal)" />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: item.is_read ? 600 : 800, color: "var(--ink)" }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--text-faint)", flexShrink: 0 }}>
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                      {item.message}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(item.id, e)}
                    title="Delete notification"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-faint)",
                      cursor: "pointer",
                      padding: 2,
                      opacity: 0.6,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
