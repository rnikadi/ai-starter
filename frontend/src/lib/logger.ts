import { appConfig } from "./app-config";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  reqId?: string;
  service?: string;
  [key: string]: unknown;
}

export class Logger {
  private levelWeight: number;
  private context: LogContext;
  private isJson: boolean;

  constructor(context: LogContext = {}, minLevel: LogLevel = "info") {
    const configuredLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || minLevel;
    this.levelWeight = LEVEL_WEIGHTS[configuredLevel] ?? LEVEL_WEIGHTS.info;
    this.context = {
      service: `${appConfig.packageName}-frontend`,
      ...context,
    };
    this.isJson =
      process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production";
  }

  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_WEIGHTS[level] < this.levelWeight) {
      return;
    }

    const timestamp = new Date().toISOString();
    const merged = { ...this.context, ...meta };

    if (this.isJson) {
      const entry = {
        level,
        time: timestamp,
        msg: message,
        ...merged,
      };
      const jsonStr = JSON.stringify(entry);
      if (level === "error") {
        console.error(jsonStr);
      } else if (level === "warn") {
        console.warn(jsonStr);
      } else {
        console.log(jsonStr);
      }
    } else {
      const colors: Record<LogLevel, string> = {
        debug: "\x1b[35m",
        info: "\x1b[32m", // Green for frontend
        warn: "\x1b[33m",
        error: "\x1b[31m",
      };
      const reset = "\x1b[0m";
      const gray = "\x1b[90m";
      const color = colors[level] || reset;
      const reqIdTag = merged.reqId ? ` ${gray}[${merged.reqId}]${reset}` : "";
      const metaStr =
        meta && Object.keys(meta).length > 0 ? ` ${gray}${JSON.stringify(meta)}${reset}` : "";

      const output = `${gray}${timestamp}${reset} ${color}[${level.toUpperCase()}]${reset}${reqIdTag} ${message}${metaStr}`;

      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }
}

export const logger = new Logger();

