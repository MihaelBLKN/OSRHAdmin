import { z } from "zod";

import { AppError } from "../lib/errors";

const databasePathIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[.#$/[\]]/.test(value), "Database path IDs cannot contain . # $ / [ ].");

const parseDatabasePathId = (label: string, value: string): string => {
  const result = databasePathIdSchema.safeParse(value);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", `Invalid ${label}.`, {
      cause: result.error,
      statusCode: 400,
    });
  }

  return result.data;
};

export const dbPaths = {
  exampleRecord: (exampleId: string): string =>
    `examples/${parseDatabasePathId("exampleId", exampleId)}`,
  commandPermission: (guildId: string, commandName: string): string =>
    `commandPermissions/${parseDatabasePathId("guildId", guildId)}/${parseDatabasePathId(
      "commandName",
      commandName,
    )}`,
} as const;
