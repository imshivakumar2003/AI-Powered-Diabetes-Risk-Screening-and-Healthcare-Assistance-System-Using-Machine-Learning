import { NavLink, useNavigate } from "react-router-dom";
import BrandLogo from "../common/BrandLogo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import {
  LayoutDashboard,
  Stethoscope,
  Bot,
  History,
  FileText,
  Settings,
  User,
  ShieldCheck,
  Users,
  ClipboardList,
  MessageSquare,
  Inbox,
  TrendingUp,
  SlidersHorizontal,
  ScrollText,
  Database,
  LogOut,
} from "lucide-react";

const LINKS = [
  { to: "/", key: "nav.dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} strokeWidth={2} />, end: true },
  { to: "/predict", key: "nav.newScreening", label: "New Screening", icon: <Stethoscope size={18} strokeWidth={2} /> },
  { to: "/chat", key: "nav.aiAssistant", label: "AI Assistant", icon: <Bot size={18} strokeWidth={2} /> },
  { to: "/history", key: "nav.history", label: "History", icon: <History size={18} strokeWidth={2} /> },
  { to: "/reports", key: "nav.reports", label: "Reports", icon: <FileText size={18} strokeWidth={2} /> },
  { to: "/settings", key: "nav.settings", label: "Settings", icon: <Settings size={18} strokeWidth={2} /> },
  { to: "/profile", key: "nav.profile", label: "Profile", icon: <User size={18} strokeWidth={2} /> },
];

const ADMIN_LINKS = [
  { to: "/admin/dashboard", key: "nav.adminControl", label: "Admin Control", icon: <ShieldCheck size={18} strokeWidth={2} /> },
  { to: "/admin/users", key: "nav.userManagement", label: "User Management", icon: <Users size={18} strokeWidth={2} /> },
  { to: "/admin/predictions", key: "nav.predictionsLog", label: "Predictions Log", icon: <ClipboardList size={18} strokeWidth={2} /> },
  { to: "/admin/chats", key: "nav.aiChatHistory", label: "AI Chat History", icon: <MessageSquare size={18} strokeWidth={2} /> },
  { to: "/admin/feedback", key: "nav.feedbackReports", label: "Feedback & Bug Reports", icon: <Inbox size={18} strokeWidth={2} /> },
  { to: "/admin/analytics", key: "nav.clinicalAnalytics", label: "Clinical Analytics", icon: <TrendingUp size={18} strokeWidth={2} /> },
  { to: "/admin/settings", key: "nav.systemSettings", label: "System Settings", icon: <SlidersHorizontal size={18} strokeWidth={2} /> },
  { to: "/admin/audit-logs", key: "nav.auditLogs", label: "Audit Logs", icon: <ScrollText size={18} strokeWidth={2} /> },
  { to: "/admin/backup", key: "nav.backupRestore", label: "Backup & Restore", icon: <Database size={18} strokeWidth={2} /> },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate(isAdmin ? "/admin/login" : "/login", { replace: true });
  };

  return (
    <aside className="sidebar">
      <BrandLogo variant="sidebar" />

      <nav className="sidebar-nav">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="nav-text">{t(link.key)}</span>
          </NavLink>
        ))}
      </nav>

      {isAdmin && (
        <>
          <div className="sidebar-admin-heading">
            {t("nav.adminPortal")}
          </div>
          <nav className="sidebar-nav">
            {ADMIN_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">{link.icon}</span>
                <span className="nav-text">{t(link.key)}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          className="nav-link logout-btn"
        >
          <span className="nav-icon"><LogOut size={18} strokeWidth={2} /></span>
          <span className="nav-text">{t("nav.logOut")}</span>
        </button>
        <p className="disclaimer-text">
          Predictions are a statistical estimate, not a medical diagnosis. Always consult a clinician.
        </p>
      </div>
    </aside>
  );
}
