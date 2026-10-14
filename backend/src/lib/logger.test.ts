import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, generateRequestId } from "./logger.js";

describe("Logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
  });

  it("generates a valid UUID request ID", () => {
    const id = generateRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("logs info messages with default level", () => {
    const logger = new Logger({}, "info");
    logger.info("Test info message");
    expect(logSpy).toHaveBeenCalled();
  });

  it("filters out debug logs when level is info", () => {
    const logger = new Logger({}, "info");
    logger.debug("Test debug message");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("creates child logger that inherits and extends context", () => {
    process.env.LOG_FORMAT = "json";
    const parent = new Logger({ service: "test-service" }, "info");
    const child = parent.child({ reqId: "req-123", customField: "hello" });

    child.info("Child log message");
    expect(logSpy).toHaveBeenCalled();

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.service).toBe("test-service");
    expect(output.reqId).toBe("req-123");
    expect(output.customField).toBe("hello");
    expect(output.msg).toBe("Child log message");
    expect(output.level).toBe("info");
  });

  it("logs errors using console.error", () => {
    const logger = new Logger({}, "info");
    logger.error("Something went wrong");
    expect(errorSpy).toHaveBeenCalled();
  });
});

