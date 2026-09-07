import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("gc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function normalizeError(error) {
  if (error.response) {
    return { message: error.response.data?.error || "Request failed.", status: error.response.status };
  }
  if (error.request) return { message: "Could not reach the server." };
  return { message: error.message || "Unexpected error." };
}

async function call(fn) {
  try {
    return await fn();
  } catch (error) {
    throw normalizeError(error);
  }
}

export const adminApi = {
  getSettings: () => call(() => client.get("/admin/settings").then((r) => r.data)),
  updateSettings: (payload) => call(() => client.put("/admin/settings", payload).then((r) => r.data)),

  getAuditLogs: (params = {}) =>
    call(() => client.get("/admin/audit-logs", { params }).then((r) => r.data)),

  createBackup: () => call(() => client.post("/admin/backup/create").then((r) => r.data)),
  listBackups: () => call(() => client.get("/admin/backup/list").then((r) => r.data)),
  restoreBackup: (filename) =>
    call(() => client.post(`/admin/backup/restore/${encodeURIComponent(filename)}`).then((r) => r.data)),

  exportSqlUrl: () => `${BASE_URL}/admin/backup/export-sql`,
  downloadBackupUrl: (filename) => `${BASE_URL}/admin/backup/download/${encodeURIComponent(filename)}`,

  importSql: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return call(() =>
      client
        .post("/admin/backup/import-sql", formData, { headers: { "Content-Type": "multipart/form-data" } })
        .then((r) => r.data)
    );
  },
};

// Helper to trigger an authenticated file download (adds the JWT as a
// query-free approach isn't possible for <a href>, so we fetch as a blob).
export async function downloadWithAuth(url, filename) {
  const token = localStorage.getItem("gc_token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed.");
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default adminApi;
