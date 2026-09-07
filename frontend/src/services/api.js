import axios from "axios";

// Vite dev server proxies /api to the Flask backend (see vite.config.js).
// In production, set VITE_API_BASE_URL to the deployed backend URL.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// If the user is logged in, attach their token to every request. Existing
// routes (/predict, /history) already accept requests with or without a
// token — this just makes them user-aware once someone logs in, with zero
// changes needed to how those calls are made elsewhere in the app.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("gc_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("gc_token");
    }
    return Promise.reject(error);
  }
);

function normalizeError(error) {
  if (error.code === "ECONNABORTED") {
    return { message: "The request timed out. Please try again." };
  }
  if (error.response) {
    const backendMessage =
      error.response.data?.error ||
      error.response.data?.details ||
      error.response.data?.message;
    return {
      message: backendMessage || `Server Error (${error.response.status})`,
      status: error.response.status,
    };
  }
  if (error.request) {
    return { message: "Could not reach the server. Is the backend running?" };
  }
  return { message: error.message || "Unexpected error." };
}

async function withRetry(fn, retries = 1) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && !error.response) {
      return withRetry(fn, retries - 1);
    }
    throw normalizeError(error);
  }
}

export const authApi = {
  register: (payload) =>
    withRetry(() => client.post("/auth/register", payload).then((r) => r.data), 0),

  login: (payload) =>
    withRetry(() => client.post("/auth/login", payload).then((r) => r.data), 0),

  forgotPassword: (email) =>
    withRetry(() => client.post("/auth/forgot-password", { email }).then((r) => r.data), 0),

  resetPassword: (token, new_password) =>
    withRetry(
      () => client.post("/auth/reset-password", { token, new_password }).then((r) => r.data),
      0
    ),

  logout: () => withRetry(() => client.post("/auth/logout").then((r) => r.data), 0),

  me: (token) =>
    withRetry(() =>
      client.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data)
    ),

  updateProfile: (token, payload) =>
    withRetry(() =>
      client
        .put("/auth/profile", payload, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.data),
      0
    ),

  changePassword: (token, payload) =>
    withRetry(() =>
      client
        .put("/auth/change-password", payload, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.data),
      0
    ),
};

export const api = {
  health: () => withRetry(() => client.get("/health").then((r) => r.data)),

  predict: (payload) =>
    withRetry(() => client.post("/predict", payload).then((r) => r.data), 0),

  getHistory: (limit = 50) =>
    withRetry(() => client.get(`/history?limit=${limit}`).then((r) => r.data)),

  deleteHistoryItem: (id) =>
    withRetry(() => client.delete(`/history/${id}`).then((r) => r.data), 0),

  clearHistory: () =>
    withRetry(() => client.delete("/history").then((r) => r.data), 0),

  getStats: () => withRetry(() => client.get("/stats").then((r) => r.data)),

  searchHistory: (params = {}) =>
    withRetry(() => client.get("/history/search", { params }).then((r) => r.data)),

  exportHistoryUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `${BASE_URL}/history/export${qs ? `?${qs}` : ""}`;
  },
};

export const suggestionsApi = {
  get: (predictionId) =>
    withRetry(() => client.get(`/predictions/${predictionId}/suggestions`).then((r) => r.data)),

  generate: (predictionId, { force = false, language = "en" } = {}) =>
    withRetry(
      () =>
        client
          .post(`/predictions/${predictionId}/suggestions${force ? "?force=1" : ""}`, { language })
          .then((r) => r.data),
      0
    ),
};

export const reportsApi = {
  pdfUrl: (predictionId) => `${BASE_URL}/predictions/${predictionId}/report/pdf`,

  emailReport: (predictionId, email) =>
    withRetry(
      () =>
        client.post(`/predictions/${predictionId}/report/email`, { email }).then((r) => r.data),
      0
    ),

  list: (params = {}) =>
    withRetry(() => client.get("/reports", { params }).then((r) => r.data)),

  remove: (reportId) =>
    withRetry(() => client.delete(`/reports/${reportId}`).then((r) => r.data), 0),
};

export const chatApi = {
  status: () => withRetry(() => client.get("/chat/status").then((r) => r.data)),

  createSession: (language = "auto") =>
    withRetry(() => client.post("/chat/sessions", { language }).then((r) => r.data), 0),

  listSessions: (params = {}) =>
    withRetry(() => client.get("/chat/sessions", { params }).then((r) => r.data)),

  updateSession: (id, payload) =>
    withRetry(() => client.patch(`/chat/sessions/${id}`, payload).then((r) => r.data), 0),

  deleteSession: (id) =>
    withRetry(() => client.delete(`/chat/sessions/${id}`).then((r) => r.data), 0),

  getMessages: (id) =>
    withRetry(() => client.get(`/chat/sessions/${id}/messages`).then((r) => r.data)),

  sendMessage: (id, message, language = "auto") =>
    withRetry(() => client.post(`/chat/sessions/${id}/messages`, { message, language }).then((r) => r.data), 0),

  regenerate: (id, language = "en") =>
    withRetry(() => client.post(`/chat/sessions/${id}/regenerate`, { language }).then((r) => r.data), 0),

  exportUrl: (id, format = "pdf") => `${BASE_URL}/chat/sessions/${id}/export?format=${format}`,

  transcribeAudio: (audioBlob, language = "en") => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("file", audioBlob, "recording.webm");
    formData.append("language", language);
    return withRetry(
      () =>
        client
          .post("/speech-to-text", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          .then((r) => r.data),
      0
    );
  },
};

export const speechToTextApi = {
  transcribe: (audioBlob, language = "en") => chatApi.transcribeAudio(audioBlob, language),
};

export const textToSpeechApi = {
  generateAudio: (text, language = "en") =>
    withRetry(
      () =>
        client
          .post("/text-to-speech", { text, language }, { responseType: "blob" })
          .then((r) => r.data),
      0
    ),
};

export const adminApi = {
  adminLogin: (payload) =>
    withRetry(() => client.post("/auth/admin-login", payload).then((r) => r.data), 0),

  getDashboard: () =>
    withRetry(() => client.get("/admin/dashboard").then((r) => r.data)),

  getStats: () =>
    withRetry(() => client.get("/admin/dashboard/stats").then((r) => r.data)),

  getAnalytics: () =>
    withRetry(() => client.get("/admin/analytics").then((r) => r.data)),

  listUsers: (params = {}) =>
    withRetry(() => client.get("/admin/users", { params }).then((r) => r.data)),

  updateUser: (id, payload) =>
    withRetry(() => client.put(`/admin/users/${id}`, payload).then((r) => r.data), 0),

  resetUserPassword: (id) =>
    withRetry(() => client.post(`/admin/users/${id}/reset-password`).then((r) => r.data), 0),

  deleteUser: (id) =>
    withRetry(() => client.delete(`/admin/users/${id}`).then((r) => r.data), 0),

  listPredictions: (params = {}) =>
    withRetry(() => client.get("/admin/predictions", { params }).then((r) => r.data)),

  deletePrediction: (id) =>
    withRetry(() => client.delete(`/admin/predictions/${id}`).then((r) => r.data), 0),

  listChats: (params = {}) =>
    withRetry(() => client.get("/admin/chats", { params }).then((r) => r.data)),

  deleteChat: (id) =>
    withRetry(() => client.delete(`/admin/chats/${id}`).then((r) => r.data), 0),

  listFeedback: (params = {}) =>
    withRetry(() => client.get("/admin/feedback", { params }).then((r) => r.data)),

  updateFeedback: (id, payload) =>
    withRetry(() => client.put(`/admin/feedback/${id}`, payload).then((r) => r.data), 0),

  deleteFeedback: (id) =>
    withRetry(() => client.delete(`/admin/feedback/${id}`).then((r) => r.data), 0),

  getSettings: () =>
    withRetry(() => client.get("/admin/settings").then((r) => r.data)),

  updateSettings: (payload) =>
    withRetry(() => client.put("/admin/settings", payload).then((r) => r.data), 0),

  listAuditLogs: (params = {}) =>
    withRetry(() => client.get("/admin/audit-logs", { params }).then((r) => r.data)),

  listBackups: () =>
    withRetry(() => client.get("/admin/backup/list").then((r) => r.data)),

  createBackup: () =>
    withRetry(() => client.post("/admin/backup/create").then((r) => r.data), 0),

  restoreBackup: (name) =>
    withRetry(() => client.post(`/admin/backup/restore/${name}`).then((r) => r.data), 0),
};

export const userSettingsApi = {
  get: () => withRetry(() => client.get("/auth/user-settings").then((r) => r.data)),
  update: (payload) => withRetry(() => client.put("/auth/user-settings", payload).then((r) => r.data), 0),
  deleteAccount: (password) => withRetry(() => client.delete("/auth/account", { data: { password } }).then((r) => r.data), 0),
};

export const recommendationsApi = {
  get: (predictionId) =>
    withRetry(() => client.get(`/recommendations/${predictionId}`).then((r) => r.data)),
};

export const notificationsApi = {
  list: (limit = 50) =>
    withRetry(() => client.get("/notifications", { params: { limit } }).then((r) => r.data)),
  getUnreadCount: () =>
    withRetry(() => client.get("/notifications/unread-count").then((r) => r.data)),
  markRead: (id) =>
    withRetry(() => client.patch(`/notifications/${id}/read`).then((r) => r.data), 0),
  markAllRead: () =>
    withRetry(() => client.patch("/notifications/read-all").then((r) => r.data), 0),
  delete: (id) =>
    withRetry(() => client.delete(`/notifications/${id}`).then((r) => r.data), 0),
  getPreferences: () =>
    withRetry(() => client.get("/notifications/preferences").then((r) => r.data)),
  updatePreferences: (payload) =>
    withRetry(() => client.put("/notifications/preferences", payload).then((r) => r.data), 0),
};

export async function downloadWithAuth(url, filename) {
  const token = localStorage.getItem("gc_token");
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Download failed.");
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default api;
