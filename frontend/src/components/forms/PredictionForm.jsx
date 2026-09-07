import { useState } from "react";
import Button from "../ui/Button.jsx";
import Alert from "../common/Alert.jsx";
import api from "../../services/api.js";
import { useApp } from "../../context/AppContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";

const initialState = {
  age: 30,
  hypertension: "No",
  heart_disease: "No",
  bmi: 25.0,
  HbA1c_level: 5.5,
  blood_glucose_level: 100,
  gender: "Male",
  smoking_history: "never",
};

export default function PredictionForm({ onResult }) {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { addToHistory, refreshStats, refreshHistory } = useApp();
  const { t } = useLanguage();

  const update = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        ...form,
        age: Number(form.age),
        bmi: Number(form.bmi),
        HbA1c_level: Number(form.HbA1c_level),
        blood_glucose_level: Number(form.blood_glucose_level),
      };
      const record = await api.predict(payload);
      addToHistory(record);
      refreshStats();
      refreshHistory();
      onResult?.(record);
    } catch (err) {
      setError(err.message || "Prediction failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Alert type="error">{error}</Alert>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="age">{t("page_predict.age")}</label>
          <input
            id="age"
            type="number"
            min="0"
            max="120"
            value={form.age}
            onChange={update("age")}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="gender">{t("page_predict.gender")}</label>
          <select id="gender" value={form.gender} onChange={update("gender")}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="bmi">{t("page_predict.bmi")}</label>
          <input
            id="bmi"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.bmi}
            onChange={update("bmi")}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="hba1c">
            {t("page_predict.hba1c")} <span className="hint">(%)</span>
          </label>
          <input
            id="hba1c"
            type="number"
            step="0.1"
            min="0"
            max="20"
            value={form.HbA1c_level}
            onChange={update("HbA1c_level")}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="glucose">
            {t("page_predict.glucose")} <span className="hint">(mg/dL)</span>
          </label>
          <input
            id="glucose"
            type="number"
            min="0"
            max="600"
            value={form.blood_glucose_level}
            onChange={update("blood_glucose_level")}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="smoking">{t("page_predict.smoking")}</label>
          <select
            id="smoking"
            value={form.smoking_history}
            onChange={update("smoking_history")}
          >
            <option value="never">Never</option>
            <option value="former">Former</option>
            <option value="current">Current</option>
            <option value="not current">Not current</option>
            <option value="ever">Ever</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="hypertension">{t("page_predict.hypertension")}</label>
          <select
            id="hypertension"
            value={form.hypertension}
            onChange={update("hypertension")}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="heart">{t("page_predict.heartDisease")}</label>
          <select
            id="heart"
            value={form.heart_disease}
            onChange={update("heart_disease")}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <Button type="submit" loading={loading}>
          {t("page_predict.submitBtn")}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setForm(initialState)}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
