import { useEffect, useState } from "react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Loading from "../components/common/Loading.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Pagination from "../components/common/Pagination.jsx";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import api, { downloadWithAuth } from "../services/api.js";
import { formatDate, shortId } from "../utils/format.js";
import { useLanguage } from "../context/LanguageContext.jsx";

const PAGE_SIZE = 10;

export default function History() {
  const { refreshStats } = useApp();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [filters, setFilters] = useState({
    result: "",
    gender: "",
    date_from: "",
    date_to: "",
    min_age: "",
    max_age: "",
  });

  const buildParams = (targetPage) => {
    const params = { page: targetPage, page_size: PAGE_SIZE };
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "") params[k] = v;
    });
    return params;
  };

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const result = await api.searchHistory(buildParams(targetPage));
      setData(result);
      setPage(targetPage);
    } catch (err) {
      showToast(err.message || "Could not load history.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await api.deleteHistoryItem(id);
      showToast("Record deleted.", "success");
      await load(page);
      await refreshStats();
    } catch (err) {
      showToast(err.message || "Delete failed.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all screening history? This can't be undone.")) return;
    try {
      await api.clearHistory();
      showToast("History cleared.", "success");
      await load(1);
      await refreshStats();
    } catch (err) {
      showToast(err.message || "Clear failed.", "error");
    }
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const url = api.exportHistoryUrl({ ...buildParams(1), format, page_size: 10000 });
      const ext = format === "excel" ? "xlsx" : format;
      await downloadWithAuth(url, `prediction_history.${ext}`);
      showToast(`Exported as ${format.toUpperCase()}.`, "success");
    } catch (err) {
      showToast(err.message || "Export failed.", "error");
    } finally {
      setExporting(null);
    }
  };

  const items = data?.items || [];

  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span className="eyebrow">{t("nav.history")}</span>
          <h1>{t("page_history.title")}</h1>
          <p className="sub">{t("page_history.sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" loading={exporting === "csv"} onClick={() => handleExport("csv")}>
            {t("page_history.exportCsv")}
          </Button>
          <Button variant="ghost" loading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            {t("page_history.exportPdf")}
          </Button>
          {items.length > 0 && (
            <Button variant="danger" onClick={handleClear}>
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="f-result">{t("page_predict.result")}</label>
          <select id="f-result" value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}>
            <option value="">All</option>
            <option value="Positive">Positive</option>
            <option value="Negative">Negative</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-gender">{t("page_predict.gender")}</label>
          <select id="f-gender" value={filters.gender} onChange={(e) => setFilters({ ...filters, gender: e.target.value })}>
            <option value="">All</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-from">From</label>
          <input id="f-from" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-to">To</label>
          <input id="f-to" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-min-age">Min Age</label>
          <input id="f-min-age" type="number" min="0" value={filters.min_age} onChange={(e) => setFilters({ ...filters, min_age: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="f-max-age">Max Age</label>
          <input id="f-max-age" type="number" min="0" value={filters.max_age} onChange={(e) => setFilters({ ...filters, max_age: e.target.value })} />
        </div>
      </div>

      <Card>
        {loading ? (
          <Loading label={t("common.loading")} />
        ) : items.length === 0 ? (
          <EmptyState
            title={t("page_history.noRecords")}
            message="Try adjusting your filters, or run your first prediction."
          />
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Date</th>
                  <th>{t("page_predict.age")}</th>
                  <th>{t("page_predict.gender")}</th>
                  <th>{t("page_predict.bmi")}</th>
                  <th>{t("page_predict.hba1c")}</th>
                  <th>{t("page_predict.glucose")}</th>
                  <th>{t("page_predict.result")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>#{shortId(r.id)}</td>
                    <td>{formatDate(r.timestamp)}</td>
                    <td>{r.input.age}</td>
                    <td>{r.input.gender}</td>
                    <td>{r.input.bmi}</td>
                    <td>{r.input.HbA1c_level}</td>
                    <td>{r.input.blood_glucose_level}</td>
                    <td>
                      <span className={`pill ${r.result === "Positive" ? "positive" : "negative"}`}>
                        {r.result}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        loading={busyId === r.id}
                        onClick={() => handleDelete(r.id)}
                      >
                        {t("common.delete")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={data.total_pages} onChange={load} />
          </>
        )}
      </Card>
    </>
  );
}
