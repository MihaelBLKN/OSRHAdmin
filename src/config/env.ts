import "dotenv/config";

import { z } from "zod";

const emptyStringToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const optionalString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required."),
    DISCORD_CLIENT_ID: z.string().regex(/^\d+$/, "DISCORD_CLIENT_ID must be a Discord snowflake."),
    FIREBASE_DATABASE_URL: z.url("FIREBASE_DATABASE_URL must be a valid URL."),
    FIREBASE_SERVICE_ACCOUNT_BASE64: optionalString,
    GOOGLE_APPLICATION_CREDENTIALS: optionalString,
    FIREBASE_PROJECT_ID: optionalString,
  })
  .readonly();

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:");
  console.error(z.prettifyError(parsedEnv.error));
  process.exit(1);
}

export const env = parsedEnv.data;

export type AppEnv = typeof env;
