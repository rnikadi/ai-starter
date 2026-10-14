"use client";

import { useState, type FormEvent } from "react";

interface AiTestPanelProps {
  canTestAI: boolean;
}

export function AiTestPanel({ canTestAI }: AiTestPanelProps) {
  const [prompt, setPrompt] = useState(
    "Reply with exactly: MASTRA_ARCHESTRA_CONNECTION_SUCCESS",
  );
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult("");
    setError("");

    if (!canTestAI) {
      setError("Your account does not have permission to invoke the AI test.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = (await response.json()) as {
        result?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? `Request failed (${response.status}).`);
        return;
      }

      setResult(data.result ?? "(The model returned an empty response.)");
    } catch {
      setError("Could not reach the application API. Check the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-test">
      <form onSubmit={handleSubmit}>
        <label htmlFor="ai-prompt">Test prompt</label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={10_000}
          rows={4}
          disabled={!canTestAI || loading}
          required
        />
        <div className="form-actions">
          <span className="character-count">{prompt.length.toLocaleString()} / 10,000</span>
          <button
            className="primary-button"
            type="submit"
            disabled={!canTestAI || loading || !prompt.trim()}
          >
            {loading ? "Testing connection…" : "Run connection test"}
          </button>
        </div>
      </form>

      {!canTestAI && (
        <p className="inline-notice">
          Your session is authenticated, but the developer or admin role is
          required to run this test.
        </p>
      )}

      {error && <div className="output-panel error-panel" role="alert">{error}</div>}
      {result && (
        <div className="output-panel success-panel" aria-live="polite">
          <p className="output-label">AI RESPONSE</p>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}
