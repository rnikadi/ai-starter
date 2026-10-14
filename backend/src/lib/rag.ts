import { logger } from "./logger.js";
import { getBackendEnv } from "../config/env.js";

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Deterministic hash-based 1536-dimensional unit embedding generator.
 * Produces unit-normalized vectors suitable for PostgreSQL pgvector cosine distance operations (<=>).
 * Used for offline development, local unit testing, and graceful fallback when external model keys are absent.
 */
export function generateDeterministicEmbedding(
  text: string,
  dimensions = EMBEDDING_DIMENSIONS,
): number[] {
  const vec = new Float64Array(dimensions);
  const normalized = text.toLowerCase().trim();

  if (!normalized) {
    vec[0] = 1.0;
    return Array.from(vec);
  }

  // Tokenize by whitespace and generate 3-character n-grams for subword matching
  const tokens = normalized.split(/\s+/);
  for (let i = 0; i < normalized.length - 2; i++) {
    tokens.push(normalized.substring(i, i + 3));
  }

  for (const token of tokens) {
    // 32-bit FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }

  // Compute L2 Euclidean norm and normalize to unit vector
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);

  if (norm === 0) {
    vec[0] = 1.0;
  } else {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = Number((vec[i] / norm).toFixed(6));
    }
  }

  return Array.from(vec);
}

/**
 * Computes cosine similarity between two vector arrays: dot product of normalized vectors.
 */
export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export const DEFAULT_EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";

export function normalizeVector(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  return vec.map((val) => Number((val / norm).toFixed(6)));
}

/**
 * Generates vector embeddings for a given text snippet.
 * Queries configured embedding model (defaults to nvidia/nemotron-3-embed-1b:free).
 * Automatically applies Matryoshka dimension alignment & L2 re-normalization,
 * and falls back gracefully to deterministic unit embeddings when offline.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const apiKey = process.env.ARCHESTRA_VIRTUAL_KEY || process.env.OPENAI_API_KEY;
    const rawBaseUrl = process.env.ARCHESTRA_BASE_URL || process.env.OPENAI_BASE_URL;
    const model =
      process.env.ARCHESTRA_EMBEDDING_MODEL ||
      process.env.EMBEDDING_MODEL ||
      DEFAULT_EMBEDDING_MODEL;

    if (apiKey && rawBaseUrl && !apiKey.includes("test")) {
      const baseUrl = rawBaseUrl.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
        if (json.data && json.data[0]?.embedding) {
          const raw = json.data[0].embedding;
          if (raw.length === EMBEDDING_DIMENSIONS) {
            return raw;
          }
          if (raw.length > EMBEDDING_DIMENSIONS) {
            // Matryoshka dimension truncation & L2 re-normalization (supported by Nemotron 3 Embed)
            return normalizeVector(raw.slice(0, EMBEDDING_DIMENSIONS));
          }
          const padded = new Array(EMBEDDING_DIMENSIONS).fill(0);
          for (let i = 0; i < raw.length; i++) padded[i] = raw[i];
          return normalizeVector(padded);
        }
      }
    }
  } catch (err) {
    logger.debug("External embedding API unavailable, falling back to deterministic local embedding", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return generateDeterministicEmbedding(text, EMBEDDING_DIMENSIONS);
}

export interface RetrievedDocument {
  id: string;
  title: string;
  content: string;
  metadata?: string | null;
  similarity: number;
}

/**
 * Formats retrieved context documents and injects them into the augmented prompt for the LLM.
 */
export function buildRagPrompt(
  userPrompt: string,
  relevantDocs: RetrievedDocument[],
): string {
  if (relevantDocs.length === 0) {
    return userPrompt;
  }

  const contextBlocks = relevantDocs
    .map(
      (doc, index) =>
        `### Document [${index + 1}]: ${doc.title} (Relevance: ${(doc.similarity * 100).toFixed(1)}%)\n${doc.content.trim()}`,
    )
    .join("\n\n");

  return `You have access to the following relevant knowledge base context:\n\n${contextBlocks}\n\n---\nBased on the above context and your knowledge, answer the following request:\n${userPrompt}`;
}
