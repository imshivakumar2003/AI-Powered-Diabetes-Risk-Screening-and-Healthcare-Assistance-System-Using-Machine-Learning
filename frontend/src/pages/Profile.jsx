import { useState, useEffect } from "react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/common/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi, userSettingsApi } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { Camera, Trash2, Key } from "lucide-react";

export default function Profile() {
  const { user, token, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
  });
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || "",
        email: user.email || "",
      });
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size must be under 2MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoData = reader.result;
        try {
          await userSettingsApi.update({ profile_photo: photoData });
          await refreshProfile();
          showToast("Profile photo updated successfully.", "success");
        } catch (err) {
          showToast(err.message || "Failed to update profile photo.", "error");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await userSettingsApi.update({ profile_photo: "" });
      await refreshProfile();
      showToast("Profile photo removed.", "info");
    } catch (err) {
      showToast(err.message || "Failed to remove photo.", "error");
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setProfileLoading(true);
    try {
      await authApi.updateProfile(token, profileForm);
      await refreshProfile();
      setProfileSuccess("Profile updated successfully.");
    } catch (err) {
      setProfileError(err.message || "Could not update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError("New passwords do not match.");
      return;
    }
    if (pwForm.new_password.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }

    setPwLoading(true);
    try {
      await authApi.changePassword(token, {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      });
      setPwSuccess("Password changed successfully.");
      setPwForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setPwError(err.message || "Could not change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const displayAvatar = user?.profile_photo;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Account</span>
        <h1>Profile</h1>
        <p className="sub">Manage your personal account details, avatar photo, and password.</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="Profile Details">
          <form onSubmit={handleProfileSubmit}>
            <Alert type="error">{profileError}</Alert>
            <Alert type="success">{profileSuccess}</Alert>

            {/* Profile Avatar Upload */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt="Avatar"
                  style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--teal)" }}
                />
              ) : (
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--teal)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>
                  {(profileForm.full_name || user?.username || "U")[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <label htmlFor="avatar-upload" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  <Camera size={16} /> Upload Photo
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: "none" }}
                />
                {displayAvatar && (
                  <button type="button" onClick={handleRemoveAvatar} style={{ marginLeft: 8, padding: "8px 12px", background: "none", border: "none", color: "var(--crimson)", fontSize: 12.5, cursor: "pointer" }}>
                    Remove Photo
                  </button>
                )}
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>PNG, JPG up to 2MB</div>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="full_name">Full Name</label>
              <input
                id="full_name"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              />
            </div>

            <Button type="submit" loading={profileLoading}>
              Save Changes
            </Button>
          </form>
        </Card>

        <Card title="Change Password">
          <form onSubmit={handlePasswordSubmit}>
            <Alert type="error">{pwError}</Alert>
            <Alert type="success">{pwSuccess}</Alert>

            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="old_password">Current Password</label>
              <input
                id="old_password"
                type="password"
                required
                value={pwForm.old_password}
                onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label htmlFor="new_password">New Password</label>
              <input
                id="new_password"
                type="password"
                required
                minLength={8}
                value={pwForm.new_password}
                onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="confirm_password">Confirm New Password</label>
              <input
                id="confirm_password"
                type="password"
                required
                value={pwForm.confirm_password}
                onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })}
              />
            </div>

            <Button type="submit" loading={pwLoading}>
              <Key size={16} style={{ marginRight: 6 }} /> Update Password
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
