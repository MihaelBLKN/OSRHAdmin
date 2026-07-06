import { randomUUID } from "node:crypto";

import { ServerValue } from "firebase-admin/database";
import { z } from "zod";

import { dbPaths } from "../paths";
import {
  readDatabaseValue,
  removeDatabaseValue,
  serverTimestamp,
  setDatabaseValue,
} from "../realtime-db";
import { parseDatabaseData } from "../schemas";

type FirebaseServerTimestamp = typeof ServerValue.TIMESTAMP;

const discordIdSchema = z.string().regex(/^\d+$/, "Discord IDs must be stored as strings.");

const timestampSchema = z.number().int().nonnegative();

const firebaseServerTimestampSchema = z.custom<FirebaseServerTimestamp>(
  (value) => value === ServerValue.TIMESTAMP,
  "Expected Firebase server timestamp sentinel.",
);

const timestampWriteSchema = z.union([timestampSchema, firebaseServerTimestampSchema]);

const infractionSeveritySchema = z.enum([
  "minor",
  "medium",
  "major",
]);

const discordUserSnapshotSchema = z
  .object({
    userId: discordIdSchema,
    username: z.string().trim().min(1).max(32),
    globalName: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

const proofItemSchema = z
  .object({
    type: z.enum(["attachment", "link"]),
    url: z.url(),
    name: z.string().trim().min(1).max(256).optional(),
    contentType: z.string().trim().min(1).max(128).optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .strict();

const proofItemsSchema = z.array(proofItemSchema).min(1).max(8);

const infractionSchema = z
  .object({
    infractionId: z.uuid(),
    guildId: discordIdSchema,
    targetUser: discordUserSnapshotSchema,
    moderator: discordUserSnapshotSchema,
    severity: infractionSeveritySchema,
    description: z.string().trim().min(1).max(1000),
    proof: proofItemsSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const legacyInfractionSchema = infractionSchema
  .omit({
    severity: true,
  })
  .extend({
    reason: infractionSeveritySchema,
  })
  .transform(({ reason, ...infraction }) => ({
    ...infraction,
    severity: reason,
  }));

const infractionReadSchema = z.union([infractionSchema, legacyInfractionSchema]);

const infractionInputSchema = infractionSchema
  .omit({
    infractionId: true,
    guildId: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();

const infractionWriteSchema = infractionSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

const infractionListSchema = z.record(z.uuid(), infractionReadSchema);

export type Infraction = z.infer<typeof infractionSchema>;

export type InfractionInput = z.input<typeof infractionInputSchema>;

export type InfractionSeverity = z.infer<typeof infractionSeveritySchema>;

export type RemovedInfraction = {
  readonly infractionId: string;
  readonly parsedInfraction: Infraction | null;
};

export const infractionSeverityChoices = [
  {
    name: "Minor",
    value: "minor",
  },
  {
    name: "Medium",
    value: "medium",
  },
  {
    name: "Major",
    value: "major",
  },
] as const satisfies readonly {
  readonly name: string;
  readonly value: InfractionSeverity;
}[];

export const formatInfractionSeverity = (severity: InfractionSeverity): string =>
  infractionSeverityChoices.find((choice) => choice.value === severity)?.name ?? severity;

export const createInfraction = async (
  guildId: string,
  targetUserId: string,
  input: InfractionInput,
): Promise<Infraction> => {
  const infractionId = randomUUID();
  const path = dbPaths.infraction(guildId, targetUserId, infractionId);
  const parsedInput = parseDatabaseData(infractionInputSchema, input, "Infraction input");

  const writeData = parseDatabaseData(
    infractionWriteSchema,
    {
      infractionId,
      guildId,
      ...parsedInput,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Infraction write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(infractionReadSchema, await readDatabaseValue(path), "Saved infraction");
};

export const listInfractionsForUser = async (
  guildId: string,
  targetUserId: string,
): Promise<readonly Infraction[]> => {
  const value = await readDatabaseValue(dbPaths.userInfractions(guildId, targetUserId));

  if (value === null) {
    return [];
  }

  const infractionsById = parseDatabaseData(infractionListSchema, value, "User infractions");

  return Object.values(infractionsById).sort((left, right) => right.createdAt - left.createdAt);
};

export const getInfraction = async (
  guildId: string,
  targetUserId: string,
  infractionId: string,
): Promise<Infraction | null> => {
  const value = await readDatabaseValue(dbPaths.infraction(guildId, targetUserId, infractionId));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(infractionReadSchema, value, "Infraction");
};

export const removeInfraction = async (
  guildId: string,
  targetUserId: string,
  infractionId: string,
): Promise<RemovedInfraction | null> => {
  const path = dbPaths.infraction(guildId, targetUserId, infractionId);
  const value = await readDatabaseValue(path);

  if (value === null) {
    return null;
  }

  const parsedInfraction = infractionReadSchema.safeParse(value);

  await removeDatabaseValue(path);

  return {
    infractionId: parsedInfraction.success ? parsedInfraction.data.infractionId : infractionId,
    parsedInfraction: parsedInfraction.success ? parsedInfraction.data : null,
  };
};
