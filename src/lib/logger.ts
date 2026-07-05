import { env } from "../config/env";

const logPriorities = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

type LogLevel = keyof typeof logPriorities;

const shouldLog = (level: LogLevel): boolean =>
  logPriorities[level] >= logPriorities[env.LOG_LEVEL];

const writeLog = (level: LogLevel, message: string, meta?: unknown): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = meta === undefined ? "" : ` ${JSON.stringify(meta, errorJsonReplacer)}`;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

const errorJsonReplacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause,
    };
  }

  return value;
};

export const logger = {
  debug: (message: string, meta?: unknown): void => {
    writeLog("debug", message, meta);
  },
  info: (message: string, meta?: unknown): void => {
    writeLog("info", message, meta);
  },
  warn: (message: string, meta?: unknown): void => {
    writeLog("warn", message, meta);
  },
  error: (message: string, meta?: unknown): void => {
    writeLog("error", message, meta);
  },
};
