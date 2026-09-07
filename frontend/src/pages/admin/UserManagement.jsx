import { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Loading from "../../components/common/Loading.jsx";
import Alert from "../../components/common/Alert.jsx";
import { adminApi } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";

export default function UserManagement() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", role: "user", is_active: true });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (role) params.role = role;
      if (active) params.active = active;
      const data = await adminApi.listUsers(params);
      setUsers(data.items);
    } catch (err) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, active]);

  const handleEditClick = (u) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name || "",
      email: u.email || "",
      role: u.role || "user",
      is_active: u.is_active,
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await adminApi.updateUser(editingUser.id, editForm);
      showToast("User updated successfully.", "success");
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      showToast(err.message || "Could not update user.", "error");
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"?`)) return;
    try {
      await adminApi.deleteUser(user.id);
      showToast("User deleted.", "success");
      loadUsers();
    } catch (err) {
      showToast(err.message || "Could not delete user.", "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{t("nav.adminPortal")}</span>
        <h1>{t("nav.userManagement")}</h1>
        <p className="sub">Search, edit user profiles, manage roles, and activate/deactivate accounts.</p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search name, username, email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          >
            <option value="">All Roles</option>
            <option value="user">User / Patient</option>
            <option value="admin">Administrator</option>
          </select>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          >
            <option value="">All Statuses</option>
            <option value="1">Active Only</option>
            <option value="0">Inactive Only</option>
          </select>
        </div>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      <Card>
        {loading ? (
          <Loading label="Loading users..." />
        ) : users.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-faint)", padding: "20px 0" }}>No users found matching filter.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>User</th>
                  <th style={{ padding: 10 }}>Email</th>
                  <th style={{ padding: 10 }}>Role</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Screenings</th>
                  <th style={{ padding: 10 }}>Joined</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>
                      {u.full_name || u.username}
                      <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400 }}>@{u.username}</div>
                    </td>
                    <td style={{ padding: 10 }}>{u.email}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: u.role === "admin" ? "#fef3c7" : "#e0f2fe", color: u.role === "admin" ? "#92400e" : "#0369a1" }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: u.is_active ? "#dcfce7" : "#fee2e2", color: u.is_active ? "#15803d" : "#b91c1c" }}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>{u.prediction_count}</td>
                    <td style={{ padding: 10 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>
                      <Button variant="ghost" onClick={() => handleEditClick(u)} style={{ marginRight: 6 }}>Edit</Button>
                      <Button variant="ghost" onClick={() => handleDelete(u)} style={{ color: "var(--crimson)" }}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <Card style={{ width: 420, maxWidth: "90vw" }}>
            <h3>Edit User: {editingUser.username}</h3>
            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                >
                  <option value="user">User / Patient</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="chk-active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                />
                <label htmlFor="chk-active" style={{ fontSize: 13, cursor: "pointer" }}>Account Active</label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
