import { describe, it, expect } from "vitest";
import {
  generateDeterministicEmbedding,
  computeCosineSimilarity,
  buildRagPrompt,
  generateEmbedding,
  EMBEDDING_DIMENSIONS,
} from "./rag.js";

describe("Active RAG & pgvector Embeddings", () => {
  it("generates deterministic embeddings with exact 1536 dimensions", () => {
    const vec = generateDeterministicEmbedding("Kubernetes deployment guide");
    expect(vec.length).toBe(EMBEDDING_DIMENSIONS);
    expect(vec.every((v) => typeof v === "number" && !isNaN(v))).toBe(true);
  });

  it("produces identical embeddings for identical text", () => {
    const text = "OpenTelemetry distributed tracing with Tempo and Loki";
    const vec1 = generateDeterministicEmbedding(text);
    const vec2 = generateDeterministicEmbedding(text);

    expect(vec1).toEqual(vec2);
    const sim = computeCosineSimilarity(vec1, vec2);
    expect(sim).toBeCloseTo(1.0, 4);
  });

  it("yields higher similarity for semantically close phrases than unrelated topics", () => {
    const v1 = generateDeterministicEmbedding("PostgreSQL database migrations and Drizzle ORM");
    const v2 = generateDeterministicEmbedding("PostgreSQL database query optimization and schema");
    const v3 = generateDeterministicEmbedding("Baking sourdough bread and homemade pastries");

    const simRelated = computeCosineSimilarity(v1, v2);
    const simUnrelated = computeCosineSimilarity(v1, v3);

    expect(simRelated).toBeGreaterThan(simUnrelated);
    expect(simRelated).toBeGreaterThan(0.3);
  });

  it("handles empty or whitespace text gracefully without crashing", () => {
    const vec = generateDeterministicEmbedding("   ");
    expect(vec.length).toBe(EMBEDDING_DIMENSIONS);
    expect(vec[0]).toBe(1.0);
  });

  it("generateEmbedding falls back to deterministic embedding when external key is test or absent", async () => {
    const vec = await generateEmbedding("Test prompt for fallback");
    expect(vec.length).toBe(EMBEDDING_DIMENSIONS);
  });

  describe("buildRagPrompt", () => {
    it("returns original prompt when relevant docs array is empty", () => {
      const prompt = "Explain Docker container healthchecks";
      const augmented = buildRagPrompt(prompt, []);
      expect(augmented).toBe(prompt);
    });

    it("formats and includes retrieved documents in augmented prompt", () => {
      const prompt = "How do we configure Loki in Promtail?";
      const docs = [
        {
          id: "doc-1",
          title: "Observability Architecture",
          content: "Promtail scrapes host application logs and forwards them to Loki on port 3100.",
          similarity: 0.895,
        },
      ];

      const augmented = buildRagPrompt(prompt, docs);
      expect(augmented).toContain("Document [1]: Observability Architecture");
      expect(augmented).toContain("89.5%");
      expect(augmented).toContain("Promtail scrapes host application logs");
      expect(augmented).toContain(prompt);
    });
  });
});

