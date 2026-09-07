export default function Loading({ label = "Loading..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", justifyContent: "center" }}>
      <span className="loader dark" />
      <span style={{ color: "var(--text-muted)", fontSize: 13.5 }}>{label}</span>
    </div>
  );
}
