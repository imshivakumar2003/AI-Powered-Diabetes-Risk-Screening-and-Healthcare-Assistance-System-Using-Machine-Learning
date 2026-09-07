import { useState, useEffect, useRef } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import NotificationPanel from "../notifications/NotificationPanel.jsx";
import {
  User,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Activity,
  Database,
  Clock,
  RefreshCw,
} from "lucide-react";

const ROUTE_KEY_MAP = {
  "/": "dashboard",
  "/predict": "newScreening",
  "/chat": "aiAssistant",
  "/history": "history",
  "/reports": "reports",
  "/settings": "settings",
  "/profile": "profile",
  "/admin": "adminControl",
  "/admin/dashboard": "adminControl",
  "/admin/users": "userManagement",
  "/admin/predictions": "predictionsLog",
  "/admin/chats": "aiChatHistory",
  "/admin/feedback": "feedbackReports",
  "/admin/analytics": "clinicalAnalytics",
  "/admin/settings": "systemSettings",
  "/admin/audit-logs": "auditLogs",
  "/admin/backup": "backupRestore",
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { backendOnline, refreshHealth } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();

  const [statusOpen, setStatusOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date().toLocaleTimeString());
  const [checkingHealth, setCheckingHealth] = useState(false);

  const statusRef = useRef(null);
  const profileRef = useRef(null);

  const activeKey = ROUTE_KEY_MAP[location.pathname] || "dashboard";
  const translatedPageName = t(`nav.${activeKey}`, { defaultValue: activeKey });

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleManualHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      if (refreshHealth) await refreshHealth();
      setLastSynced(new Date().toLocaleTimeString());
    } catch {}
    finally {
      setCheckingHealth(false);
    }
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login");
  };

  const userInitial = (user?.full_name || user?.username || "U")[0].toUpperCase();

  return (
    <header
      className="topbar"
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left Title / Multilingual Branding Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-faint, #64748b)", opacity: 0.85 }}>
          GlucoseCheck
        </span>
        <span style={{ color: "var(--border, #cbd5e1)", fontSize: 13, opacity: 0.6 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink, #0f172a)", letterSpacing: "-0.01em" }}>
          {translatedPageName}
        </span>
      </div>

      {/* Right Controls Container */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* 1. Notification Bell */}
        <NotificationPanel />

        {/* 2. API Status Indicator */}
        <div ref={statusRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setStatusOpen(!statusOpen)}
            title="View API & System Health"
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 10,
              background: "var(--surface-subtle, #f8fafc)",
              border: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--ink, #0f172a)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: backendOnline ? "#10b981" : "var(--crimson, #dc2626)",
                boxShadow: backendOnline ? "0 0 8px rgba(16, 185, 129, 0.5)" : "none",
              }}
            />
            <span>{backendOnline ? "API Connected" : "API Offline"}</span>
          </button>

          {/* API Status Popup Modal */}
          {statusOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 44,
                width: 260,
                borderRadius: 14,
                background: "var(--paper, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.12)",
                padding: 16,
                zIndex: 1000,
                animation: "fadeIn 0.15s ease-out",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>System Health Status</span>
                <button
                  type="button"
                  onClick={handleManualHealthCheck}
                  title="Refresh status"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--teal)", padding: 2 }}
                >
                  <RefreshCw size={14} className={checkingHealth ? "spin" : ""} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
                    <Activity size={14} /> API Server
                  </div>
                  <span style={{ fontWeight: 700, color: backendOnline ? "#10b981" : "var(--crimson)" }}>
                    {backendOnline ? "Online" : "Offline"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
                    <Database size={14} /> Database
                  </div>
                  <span style={{ fontWeight: 700, color: backendOnline ? "#10b981" : "var(--crimson)" }}>
                    {backendOnline ? "Connected" : "Disconnected"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px dashed var(--border)", color: "var(--text-faint)", fontSize: 11.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} /> Last Synced
                  </div>
                  <span>{lastSynced}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. User Profile Dropdown */}
        {isAuthenticated && user && (
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              title="User Profile Menu"
              style={{
                height: 36,
                padding: "0 8px 0 6px",
                borderRadius: 10,
                background: "var(--surface-subtle, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {user.profile_photo ? (
                <img
                  src={user.profile_photo}
                  alt="Avatar"
                  style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "linear-gradient(135deg, var(--teal, #0d9488), #0284c7)",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {userInitial}
                </div>
              )}
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                {user.username || "Account"}
              </span>
              <ChevronDown size={14} color="var(--text-faint)" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 44,
                  width: 240,
                  borderRadius: 14,
                  background: "var(--paper, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.12)",
                  padding: 8,
                  zIndex: 1000,
                  animation: "fadeIn 0.15s ease-out",
                }}
              >
                {/* User Info Header */}
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.full_name || user.username}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: user.role === "admin" ? "rgba(168, 85, 247, 0.12)" : "rgba(13, 148, 136, 0.12)",
                        color: user.role === "admin" ? "#a855f7" : "var(--teal)",
                        textTransform: "uppercase",
                      }}
                    >
                      {user.role === "admin" ? "Administrator" : "Patient"}
                    </span>
                  </div>
                </div>

                {/* Nav Links */}
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    textDecoration: "none",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <User size={15} color="var(--teal)" /> Profile & Account
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    textDecoration: "none",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Settings size={15} color="var(--teal)" /> App Settings
                </Link>

                {user.role === "admin" && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setProfileOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#a855f7",
                      textDecoration: "none",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(168, 85, 247, 0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Shield size={15} color="#a855f7" /> Admin Portal
                  </Link>
                )}

                <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--crimson, #dc2626)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220, 38, 38, 0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={15} color="var(--crimson, #dc2626)" /> Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Theme Toggle Button */}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          style={{
            height: 36,
            width: 36,
            borderRadius: 10,
            background: "var(--surface-subtle, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 16,
            transition: "all 0.15s ease",
          }}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
