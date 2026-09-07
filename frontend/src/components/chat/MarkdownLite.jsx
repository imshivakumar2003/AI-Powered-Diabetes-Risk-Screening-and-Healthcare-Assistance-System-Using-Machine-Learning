// Minimal markdown renderer — no external dependency. Supports the subset
// the AI assistant actually uses: **bold**, *italic*, `inline code`,
// ```fenced code blocks```, bullet lists (- / *), and line breaks.

function renderInline(text, keyPrefix) {
  // Split on inline code first, so bold/italic don't reach inside code spans.
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={key} className="md-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold then italic within the remaining plain text.
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={key}>
        {boldParts.map((bp, j) => {
          if (bp.startsWith("**") && bp.endsWith("**") && bp.length > 3) {
            return <strong key={`${key}-${j}`}>{bp.slice(2, -2)}</strong>;
          }
          const italicParts = bp.split(/(\*[^*]+\*)/g);
          return italicParts.map((ip, k) =>
            ip.startsWith("*") && ip.endsWith("*") && ip.length > 1 ? (
              <em key={`${key}-${j}-${k}`}>{ip.slice(1, -1)}</em>
            ) : (
              <span key={`${key}-${j}-${k}`}>{ip}</span>
            )
          );
        })}
      </span>
    );
  });
}

export default function MarkdownLite({ text }) {
  if (!text) return null;

  const blocks = text.split(/```/g);
  const nodes = [];

  blocks.forEach((block, blockIdx) => {
    const isCode = blockIdx % 2 === 1;
    if (isCode) {
      const cleaned = block.replace(/^\w*\n/, "");
      nodes.push(
        <pre key={`code-${blockIdx}`} className="md-code-block">
          <code>{cleaned}</code>
        </pre>
      );
      return;
    }

    const lines = block.split("\n");
    let listBuffer = [];

    const flushList = (idx) => {
      if (listBuffer.length) {
        nodes.push(
          <ul key={`list-${blockIdx}-${idx}`} className="md-list">
            {listBuffer.map((item, i) => (
              <li key={i}>{renderInline(item, `li-${blockIdx}-${idx}-${i}`)}</li>
            ))}
          </ul>
        );
        listBuffer = [];
      }
    };

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (/^[-*]\s+/.test(trimmed)) {
        listBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
        return;
      }
      flushList(lineIdx);
      if (trimmed === "") {
        nodes.push(<div key={`sp-${blockIdx}-${lineIdx}`} style={{ height: 6 }} />);
      } else {
        nodes.push(
          <p key={`p-${blockIdx}-${lineIdx}`} style={{ margin: "0 0 4px" }}>
            {renderInline(trimmed, `p-${blockIdx}-${lineIdx}`)}
          </p>
        );
      }
    });
    flushList(lines.length);
  });

  return <>{nodes}</>;
}
