import { ServerValue } from "firebase-admin/database";
import { z } from "zod";

import { AppError } from "../lib/errors";

type FirebaseServerTimestamp = typeof ServerValue.TIMESTAMP;

const timestampSchema = z.number().int().nonnegative();

const firebaseServerTimestampSchema = z.custom<FirebaseServerTimestamp>(
  (value) => value === ServerValue.TIMESTAMP,
  "Expected Firebase server timestamp sentinel.",
);

const timestampWriteSchema = z.union([timestampSchema, firebaseServerTimestampSchema]);

const nonEmptyStringSchema = z.string().trim().min(1);

const normalizedTagsSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(25)
  .transform((tags) => [...new Set(tags)].sort());

export const exampleRecordSchema = z
  .object({
    id: nonEmptyStringSchema,
    discordId: z.string().regex(/^\d+$/, "Discord IDs should be stored as strings."),
    requiredText: nonEmptyStringSchema.max(100),
    optionalText: nonEmptyStringSchema.max(100).optional(),
    nullableText: nonEmptyStringSchema.max(100).nullable(),
    status: z.enum(["draft", "active", "archived"]),
    count: z.number().int().nonnegative(),
    enabled: z.boolean(),
    tags: normalizedTagsSchema,
    metadata: z
      .object({
        notes: nonEmptyStringSchema.max(500).optional(),
        flags: z.record(z.string().min(1), z.boolean()).default({}),
      })
      .strict(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const exampleRecordInputSchema = exampleRecordSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();

export const exampleRecordWriteSchema = exampleRecordSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

export const exampleRecordUpdateInputSchema = exampleRecordInputSchema.partial().strict();

export const exampleRecordUpdateWriteSchema = exampleRecordUpdateInputSchema
  .extend({
    updatedAt: timestampWriteSchema,
  })
  .strict();

export const parseDatabaseData = <TData>(
  schema: z.ZodType<TData>,
  value: unknown,
  context: string,
): TData => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", `${context} failed validation.`, {
      cause: result.error,
      statusCode: 500,
    });
  }

  return result.data;
};
