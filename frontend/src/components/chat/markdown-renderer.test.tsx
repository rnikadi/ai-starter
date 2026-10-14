import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer Component", () => {
  it("renders empty string if content is empty", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="" />);
    expect(html).toBe("");
  });

  it("renders paragraphs with inline bold and italic formatting", () => {
    const markdown = "This is **bold text** and *italic text* and ***bold italic***.";
    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain("<strong>bold text</strong>");
    expect(html).toContain("<em>italic text</em>");
    expect(html).toContain("<strong><em>bold italic</em></strong>");
    expect(html).toContain("chatgpt-paragraph");
  });

  it("renders inline code elements", () => {
    const markdown = "Use the `fetch()` function to call `/api/ai/test`.";
    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<code class="chatgpt-inline-code">fetch()</code>');
    expect(html).toContain('<code class="chatgpt-inline-code">/api/ai/test</code>');
  });

  it("renders headings with nested bold text", () => {
    const markdown = [
      "# Header Level 1",
      "## Header Level 2",
      "### **1. Frontend: Next.js**",
    ].join("\n\n");

    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<h1 class="chatgpt-h1">Header Level 1</h1>');
    expect(html).toContain('<h2 class="chatgpt-h2">Header Level 2</h2>');
    expect(html).toContain('<h3 class="chatgpt-h3"><strong>1. Frontend: Next.js</strong></h3>');
  });

  it("renders bulleted lists correctly", () => {
    const markdown = [
      "- **Role**: React-based framework",
      "- **AI-Specific Use**: Dynamic UI",
      "- **Why Next.js?**: DX and routing",
    ].join("\n");

    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<ul class="chatgpt-ul">');
    expect(html).toContain('<li class="chatgpt-li"><strong>Role</strong>: React-based framework</li>');
    expect(html).toContain('<li class="chatgpt-li"><strong>AI-Specific Use</strong>: Dynamic UI</li>');
    expect(html).toContain('<li class="chatgpt-li"><strong>Why Next.js?</strong>: DX and routing</li>');
  });

  it("renders numbered lists correctly", () => {
    const markdown = [
      "1. First step",
      "2. Second step",
      "3. Third step",
    ].join("\n");

    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<ol class="chatgpt-ol">');
    expect(html).toContain('<li class="chatgpt-li">First step</li>');
    expect(html).toContain('<li class="chatgpt-li">Second step</li>');
    expect(html).toContain('<li class="chatgpt-li">Third step</li>');
  });

  it("renders fenced code blocks with language and copy button", () => {
    const markdown = [
      "```typescript",
      "const message = 'Hello world';",
      "console.log(message);",
      "```",
    ].join("\n");

    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain("chatgpt-codeblock-container");
    expect(html).toContain('<span class="chatgpt-codeblock-lang">typescript</span>');
    expect(html).toContain("Copy code");
    expect(html).toContain("const message = &#x27;Hello world&#x27;;");
  });

  it("renders horizontal dividers", () => {
    const markdown = ["Section 1", "---", "Section 2"].join("\n\n");
    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<hr class="chatgpt-hr"/>');
  });

  it("renders blockquotes", () => {
    const markdown = "> This is an important quote from the model.";
    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<blockquote class="chatgpt-blockquote">This is an important quote from the model.</blockquote>');
  });

  it("renders tables with headers and rows", () => {
    const markdown = [
      "| Service | Port | Description |",
      "| --- | --- | --- |",
      "| Frontend | 3001 | Next.js UI |",
      "| Backend | 4000 | Fastify API |",
    ].join("\n");

    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<table class="chatgpt-table">');
    expect(html).toContain("<th>Service</th>");
    expect(html).toContain("<td>Frontend</td>");
    expect(html).toContain("<td>3001</td>");
    expect(html).toContain("<td>Fastify API</td>");
  });

  it("renders safe external links", () => {
    const markdown = "Visit [OpenTelemetry Docs](https://opentelemetry.io) for more information.";
    const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} />);

    expect(html).toContain('<a href="https://opentelemetry.io" target="_blank" rel="noopener noreferrer" class="chatgpt-link">OpenTelemetry Docs</a>');
  });
});

