import { Routes, Route } from "react-router-dom";
import Dashboard from "../pages/Dashboard.jsx";
import Predict from "../pages/Predict.jsx";
import History from "../pages/History.jsx";
import ReportHistory from "../pages/ReportHistory.jsx";
import ChatAssistant from "../pages/ChatAssistant.jsx";
import About from "../pages/About.jsx";
import Profile from "../pages/Profile.jsx";
import UserSettings from "../pages/UserSettings.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import ForgotPassword from "../pages/ForgotPassword.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import NotFound from "../pages/NotFound.jsx";
import ProtectedRoute from "../components/auth/ProtectedRoute.jsx";

// Admin pages
import AdminLogin from "../pages/admin/AdminLogin.jsx";
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import UserManagement from "../pages/admin/UserManagement.jsx";
import PredictionManagement from "../pages/admin/PredictionManagement.jsx";
import ChatManagement from "../pages/admin/ChatManagement.jsx";
import FeedbackManagement from "../pages/admin/FeedbackManagement.jsx";
import AnalyticsDashboard from "../pages/admin/AnalyticsDashboard.jsx";
import AdminSettings from "../pages/admin/AdminSettings.jsx";
import AuditLogs from "../pages/admin/AuditLogs.jsx";
import BackupRestore from "../pages/admin/BackupRestore.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected app pages */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/predict"
        element={
          <ProtectedRoute>
            <Predict />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <UserSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatAssistant />
          </ProtectedRoute>
        }
      />
      <Route path="/about" element={<About />} />

      {/* Admin routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute adminOnly>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/predictions"
        element={
          <ProtectedRoute adminOnly>
            <PredictionManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/chats"
        element={
          <ProtectedRoute adminOnly>
            <ChatManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/feedback"
        element={
          <ProtectedRoute adminOnly>
            <FeedbackManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute adminOnly>
            <AnalyticsDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute adminOnly>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute adminOnly>
            <AuditLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/backup"
        element={
          <ProtectedRoute adminOnly>
            <BackupRestore />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
