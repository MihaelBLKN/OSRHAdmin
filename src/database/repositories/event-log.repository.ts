import { randomUUID } from "node:crypto";

import { ServerValue } from "firebase-admin/database";
import { z } from "zod";

import { dbPaths } from "../paths";
import { readDatabaseValue, serverTimestamp, setDatabaseValue } from "../realtime-db";
import { parseDatabaseData } from "../schemas";

type FirebaseServerTimestamp = typeof ServerValue.TIMESTAMP;

const discordIdSchema = z.string().regex(/^\d+$/, "Discord IDs must be stored as strings.");

const timestampSchema = z.number().int().nonnegative();

const firebaseServerTimestampSchema = z.custom<FirebaseServerTimestamp>(
  (value) => value === ServerValue.TIMESTAMP,
  "Expected Firebase server timestamp sentinel.",
);

const timestampWriteSchema = z.union([timestampSchema, firebaseServerTimestampSchema]);

const eventTypeSchema = z.enum([
  "combat_training",
  "general_training",
  "nco_certification_course",
  "inspection",
]);

const discordUserSnapshotSchema = z
  .object({
    userId: discordIdSchema,
    username: z.string().trim().min(1).max(32),
    globalName: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

const eventPictureSchema = z
  .object({
    url: z.url(),
    name: z.string().trim().min(1).max(256),
    contentType: z.string().trim().min(1).max(128).optional(),
    size: z.number().int().nonnegative(),
  })
  .strict();

const eventLogSchema = z
  .object({
    eventLogId: z.uuid(),
    guildId: discordIdSchema,
    eventType: eventTypeSchema,
    attendees: z.string().trim().min(1).max(2000),
    host: discordUserSnapshotSchema,
    coHost: discordUserSnapshotSchema,
    supervisor: discordUserSnapshotSchema,
    topPerforming: z.string().trim().min(1).max(1000).optional(),
    picture: eventPictureSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const eventLogInputSchema = eventLogSchema
  .omit({
    eventLogId: true,
    guildId: true,
    createdAt: true,
    updatedAt: true,
  })
  .strict();

const eventLogWriteSchema = eventLogSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

export type EventLog = z.infer<typeof eventLogSchema>;

export type EventLogInput = z.input<typeof eventLogInputSchema>;

export type EventType = z.infer<typeof eventTypeSchema>;

export const eventTypeChoices = [
  {
    name: "Combat Training",
    value: "combat_training",
  },
  {
    name: "General Training",
    value: "general_training",
  },
  {
    name: "NCO Certification Course",
    value: "nco_certification_course",
  },
  {
    name: "Inspection",
    value: "inspection",
  },
] as const satisfies readonly {
  readonly name: string;
  readonly value: EventType;
}[];

export const formatEventType = (eventType: EventType): string =>
  eventTypeChoices.find((choice) => choice.value === eventType)?.name ?? eventType;

export const createEventLog = async (
  guildId: string,
  input: EventLogInput,
): Promise<EventLog> => {
  const eventLogId = randomUUID();
  const path = dbPaths.eventLog(guildId, eventLogId);
  const parsedInput = parseDatabaseData(eventLogInputSchema, input, "Event log input");

  const writeData = parseDatabaseData(
    eventLogWriteSchema,
    {
      eventLogId,
      guildId,
      ...parsedInput,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Event log write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(eventLogSchema, await readDatabaseValue(path), "Saved event log");
};
