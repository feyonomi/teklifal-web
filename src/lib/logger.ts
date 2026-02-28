import type { NextRequest } from "next/server";
import { captureException } from "@/lib/monitoring";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getConfiguredLogLevel(): LogLevel {
  const value = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

function shouldLog(level: LogLevel) {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[getConfiguredLogLevel()];
}

function safeSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ note: "unserializable" });
  }
}

function write(level: LogLevel, event: string, data?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const line = safeSerialize(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function getRequestContext(req: NextRequest) {
  return {
    requestId: req.headers.get("x-request-id") ?? "unknown",
    method: req.method,
    path: req.nextUrl.pathname,
  };
}

export function logInfo(event: string, data?: Record<string, unknown>) {
  write("info", event, data);
}

export function logWarn(event: string, data?: Record<string, unknown>) {
  write("warn", event, data);
}

export function logError(event: string, error: unknown, data?: Record<string, unknown>) {
  const base =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      : {
          errorName: "UnknownError",
          errorMessage: String(error),
        };

  write("error", event, {
    ...data,
    ...base,
  });

  captureException(error, {
    event,
    requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
    path: typeof data?.path === "string" ? data.path : undefined,
    method: typeof data?.method === "string" ? data.method : undefined,
    userId: typeof data?.userId === "string" ? data.userId : undefined,
    extra: data,
  });
}
