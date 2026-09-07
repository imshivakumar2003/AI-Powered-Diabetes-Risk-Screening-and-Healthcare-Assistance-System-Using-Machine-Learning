import { useEffect, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Loading from "../../components/common/Loading.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { adminApi, downloadWithAuth } from "../../services/adminApi.js";
import { useToast } from "../../context/ToastContext.jsx";
import { formatDate } from "../../utils/format.js";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupRestore() {
  const { showToast } = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listBackups();
      setBackups(data.items);
    } catch (err) {
      showToast(err.message || "Could not load backups.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await adminApi.createBackup();
      showToast("Backup snapshot created.", "success");
      await load();
    } catch (err) {
      showToast(err.message || "Backup failed.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleExportSql = async () => {
    try {
      await downloadWithAuth(adminApi.exportSqlUrl(), "database_export.sql");
      showToast("SQL export downloaded.", "success");
    } catch (err) {
      showToast(err.message || "Export failed.", "error");
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      await downloadWithAuth(adminApi.downloadBackupUrl(filename), filename);
    } catch (err) {
      showToast(err.message || "Download failed.", "error");
    }
  };

  const handleRestore = async (filename) => {
    setRestoring(filename);
    try {
      await adminApi.restoreBackup(filename);
      showToast(`Restored from ${filename}. A safety backup was made automatically.`, "success");
      setConfirmTarget(null);
      await load();
    } catch (err) {
      showToast(err.message || "Restore failed.", "error");
    } finally {
      setRestoring(null);
    }
  };

  const handleImportSql = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await adminApi.importSql(file);
      showToast(result.message || "Database restored from SQL file.", "success");
      await load();
    } catch (err) {
      showToast(err.message || "Import failed.", "error");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Administration</span>
        <h1>Backup &amp; Restore</h1>
        <p className="sub">Snapshot the database, export/import portable SQL, or roll back to a previous state.</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <Card title="Create Backup">
          <p style={{ marginBottom: 16 }}>
            Takes a full snapshot of the current database file. Stored on the
            server and can be restored or downloaded later.
          </p>
          <Button onClick={handleCreateBackup} loading={creating}>
            Create Snapshot
          </Button>
        </Card>

        <Card title="Export / Import SQL">
          <p style={{ marginBottom: 16 }}>
            Export a portable <code>.sql</code> dump, or restore from one.
            Importing overwrites current data — a safety backup is made
            automatically first.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={handleExportSql}>
              Export SQL
            </Button>
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
              Import SQL
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              style={{ display: "none" }}
              onChange={handleImportSql}
            />
          </div>
        </Card>
      </div>

      <Card title="Stored Backups">
        {loading ? (
          <Loading label="Loading backups..." />
        ) : backups.length === 0 ? (
          <EmptyState title="No backups yet" message="Create your first snapshot above." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Type</th>
                <th>Size</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filename}>
                  <td>{b.filename}</td>
                  <td>{b.type}</td>
                  <td>{formatBytes(b.size_bytes)}</td>
                  <td>{formatDate(b.created_at)}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <Button variant="ghost" onClick={() => handleDownloadBackup(b.filename)}>
                      Download
                    </Button>
                    {b.type === "db" && (
                      <Button
                        variant="danger"
                        loading={restoring === b.filename}
                        onClick={() => setConfirmTarget(b.filename)}
                      >
                        Restore
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {confirmTarget && (
        <div className="modal-overlay" onClick={() => setConfirmTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Restore this backup?</h3>
            <p>
              This will overwrite the current database with <strong>{confirmTarget}</strong>.
              A safety backup of the current state will be created automatically first.
            </p>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={restoring === confirmTarget}
                onClick={() => handleRestore(confirmTarget)}
              >
                Yes, Restore
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
