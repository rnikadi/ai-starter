"use client";

import React, { useState } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Inline Tokenizer & Renderer
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  // Regex to match inline patterns:
  // 1. Inline code: `code`
  // 2. Bold italic: ***text*** or ___text___
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Link: [label](url)
  const inlineRegex =
    /(`([^`]+)`)|(\*\*\*([^*]+)\*\*\*|___([^_]+)___)|(\*\*([^*]+)\*\*|__([^_]+)__)|(\*([^*]+)\*|_([^_]+)_)|(\[([^\]]+)\]\(([^)]+)\))/;

  while (remaining.length > 0) {
    const match = remaining.match(inlineRegex);
    if (!match || match.index === undefined) {
      nodes.push(remaining);
      break;
    }

    // Text before the match
    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }

    const matchedFull = match[0];
    const matchStart = match.index;
    remaining = remaining.slice(matchStart + matchedFull.length);

    // 1. Inline code: `code`
    if (match[1]) {
      const codeContent = match[2];
      nodes.push(
        <code key={`code-${keyIdx++}`} className="chatgpt-inline-code">
          {codeContent}
        </code>,
      );
      continue;
    }

    // 2. Bold Italic: ***text*** or ___text___
    if (match[3]) {
      const textContent = match[4] || match[5];
      nodes.push(
        <strong key={`bi-${keyIdx++}`}>
          <em>{textContent}</em>
        </strong>,
      );
      continue;
    }

    // 3. Bold: **text** or __text__
    if (match[6]) {
      const textContent = match[7] || match[8];
      nodes.push(
        <strong key={`b-${keyIdx++}`}>
          {renderInline(textContent)}
        </strong>,
      );
      continue;
    }

    // 4. Italic: *text* or _text_
    if (match[9]) {
      const textContent = match[10] || match[11];
      nodes.push(
        <em key={`i-${keyIdx++}`}>
          {renderInline(textContent)}
        </em>,
      );
      continue;
    }

    // 5. Link: [label](url)
    if (match[12]) {
      const label = match[13];
      const href = match[14];
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith("/") || href.startsWith("#");
      nodes.push(
        <a
          key={`a-${keyIdx++}`}
          href={isSafe ? href : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="chatgpt-link"
        >
          {label}
        </a>,
      );
      continue;
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Block Parsing & Rendering
// ---------------------------------------------------------------------------

type Block =
  | { type: "code"; language: string; content: string }
  | { type: "heading"; level: number; text: string }
  | { type: "hr" }
  | { type: "blockquote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(raw: string): Block[] {
  const lines = raw.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced Code Block: ```lang ... ```
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || "plaintext";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // consume closing ```
      }
      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    // 3. Horizontal Rule: ---, ***, ___
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 4. Headings: # to ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // 5. Blockquote: > text
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        text: quoteLines.join("\n"),
      });
      continue;
    }

    // 6. GFM Tables: | Header | Header |
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && i + 1 < lines.length && /^\|\s*[-:]+[-| :]*\|\s*$/.test(lines[i + 1].trim())) {
      const headerLine = trimmed;
      const headers = headerLine
        .slice(1, -1)
        .split("|")
        .map((h) => h.trim());
      i += 2; // skip header line and separator line
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const rowCells = lines[i]
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        rows.push(rowCells);
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // 7. Unordered List: - item or * item
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // 8. Ordered List: 1. item, 2. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 9. Paragraph: gather lines until next block or empty line
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^(?:---|\*\*\*|___)\s*$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paraLines.join(" "),
      });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Main React Component
// ---------------------------------------------------------------------------

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  async function handleCopyCode(index: number, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // clipboard access error fallback
    }
  }

  return (
    <div className={`chatgpt-markdown-body ${className}`.trim()}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            const inlineNodes = renderInline(block.text);
            switch (block.level) {
              case 1:
                return <h1 key={idx} className="chatgpt-h1">{inlineNodes}</h1>;
              case 2:
                return <h2 key={idx} className="chatgpt-h2">{inlineNodes}</h2>;
              case 3:
                return <h3 key={idx} className="chatgpt-h3">{inlineNodes}</h3>;
              case 4:
                return <h4 key={idx} className="chatgpt-h4">{inlineNodes}</h4>;
              case 5:
                return <h5 key={idx} className="chatgpt-h5">{inlineNodes}</h5>;
              default:
                return <h6 key={idx} className="chatgpt-h6">{inlineNodes}</h6>;
            }
          }

          case "paragraph":
            return (
              <p key={idx} className="chatgpt-paragraph">
                {renderInline(block.text)}
              </p>
            );

          case "hr":
            return <hr key={idx} className="chatgpt-hr" />;

          case "blockquote":
            return (
              <blockquote key={idx} className="chatgpt-blockquote">
                {renderInline(block.text)}
              </blockquote>
            );

          case "ul":
            return (
              <ul key={idx} className="chatgpt-ul">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="chatgpt-li">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={idx} className="chatgpt-ol">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="chatgpt-li">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );

          case "code": {
            const isCopied = copiedIndex === idx;
            return (
              <div key={idx} className="chatgpt-codeblock-container">
                <div className="chatgpt-codeblock-header">
                  <span className="chatgpt-codeblock-lang">{block.language}</span>
                  <button
                    type="button"
                    className="chatgpt-codeblock-copy"
                    onClick={() => void handleCopyCode(idx, block.content)}
                  >
                    {isCopied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="chatgpt-pre">
                  <code>{block.content}</code>
                </pre>
              </div>
            );
          }

          case "table":
            return (
              <div key={idx} className="chatgpt-table-wrapper">
                <table className="chatgpt-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx}>{renderInline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

