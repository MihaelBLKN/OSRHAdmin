export type AppErrorCode =
  | "CONFIG_ERROR"
  | "DATABASE_ERROR"
  | "DISCORD_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;

  public constructor(
    code: AppErrorCode,
    message: string,
    options: { cause?: unknown; statusCode?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.statusCode = options.statusCode ?? 500;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const toSafeUserMessage = (error: unknown): string => {
  if (isAppError(error) && error.statusCode >= 400 && error.statusCode < 500) {
    return error.message;
  }

  return "Something went wrong while handling that command.";
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
