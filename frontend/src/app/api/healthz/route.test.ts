import { describe, it, expect } from "vitest";
import { GET } from "./route.js";

describe("Frontend Health Endpoint", () => {
  it("returns healthy status and process statistics", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      status: string;
      service: string;
      uptimeSeconds: number;
      memory: { heapUsedMb: number; rssMb: number };
    };

    expect(json.status).toBe("healthy");
    expect(json.service).toBe("ai-starter-frontend");
    expect(json.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(json.memory).toBeDefined();
    expect(json.memory.heapUsedMb).toBeGreaterThan(0);
  });
});

