import { useEffect, useState } from "react";
import Button from "../ui/Button.jsx";
import { suggestionsApi } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

function Bullets({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 4, fontSize: 13.5, lineHeight: 1.5 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--teal-dark)", marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SuggestionsPanel({ predictionId }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!predictionId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await suggestionsApi.get(predictionId);
        if (!cancelled) setSuggestions(data);
      } catch {
        if (!cancelled) setSuggestions(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictionId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const fresh = await suggestionsApi.generate(predictionId, { force: true });
      setSuggestions(fresh);
      showToast("Suggestions refreshed.", "success");
    } catch (err) {
      showToast(err.message || "Could not refresh suggestions.", "error");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "18px 0", color: "var(--text-faint)", fontSize: 13.5 }}>
        Generating AI health suggestions…
      </div>
    );
  }

  if (!suggestions) return null;

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px dashed var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          AI Health Suggestions
          {suggestions.source === "fallback" && (
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase" }}>
              general guidance
            </span>
          )}
        </div>
        <Button variant="ghost" loading={regenerating} onClick={handleRegenerate}>
          Regenerate
        </Button>
      </div>

      <Section title="Risk Analysis">
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{suggestions.risk_analysis}</p>
      </Section>

      <Section title="Lifestyle Recommendations"><Bullets items={suggestions.lifestyle} /></Section>
      <Section title="Food Suggestions"><Bullets items={suggestions.food} /></Section>
      <Section title="Exercise Recommendations"><Bullets items={suggestions.exercise} /></Section>

      <div className="grid grid-2" style={{ gap: 12, marginBottom: 16 }}>
        <Section title="Water Intake">
          <p style={{ fontSize: 13.5, margin: 0 }}>{suggestions.water_intake}</p>
        </Section>
        <Section title="Sleep">
          <p style={{ fontSize: 13.5, margin: 0 }}>{suggestions.sleep}</p>
        </Section>
      </div>

      <Section title="Stress Management"><Bullets items={suggestions.stress_management} /></Section>

      <Section title="Next Recommended Checkup">
        <p style={{ fontSize: 13.5, margin: 0 }}>{suggestions.next_checkup}</p>
      </Section>

      <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
        {suggestions.disclaimer}
      </p>
    </div>
  );
}
