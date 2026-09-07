import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, send this to an error-tracking service.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ marginBottom: 8, color: "var(--crimson, #dc2626)" }}>Something went wrong</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
            Please refresh the page. If this keeps happening, contact support.
          </p>
          {this.state.error && (
            <div style={{ padding: 16, borderRadius: 8, background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", textAlign: "left", marginBottom: 16, overflowX: "auto" }}>
              <div style={{ fontWeight: 700, color: "var(--crimson, #dc2626)", marginBottom: 4 }}>
                {this.state.error.name}: {this.state.error.message}
              </div>
              <pre style={{ fontSize: 11, color: "var(--ink)", margin: 0, whiteSpace: "pre-wrap" }}>
                {this.state.error.stack}
              </pre>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
