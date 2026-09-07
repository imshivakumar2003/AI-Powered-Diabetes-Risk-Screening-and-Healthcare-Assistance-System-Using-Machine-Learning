export default function Button({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  style,
}) {
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
      ? "btn-danger-ghost"
      : "btn-ghost";

  return (
    <button
      type={type}
      className={`btn ${variantClass}`}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
    >
      {loading && <span className="loader" />}
      {children}
    </button>
  );
}
