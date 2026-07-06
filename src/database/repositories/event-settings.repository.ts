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

const eventSettingsSchema = z
  .object({
    guildId: discordIdSchema,
    eventsChannelId: discordIdSchema,
    updatedByUserId: discordIdSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const eventSettingsInputSchema = eventSettingsSchema
  .pick({
    eventsChannelId: true,
    updatedByUserId: true,
  })
  .strict();

const eventSettingsWriteSchema = eventSettingsSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

export type EventSettings = z.infer<typeof eventSettingsSchema>;

export type EventSettingsInput = z.input<typeof eventSettingsInputSchema>;

export const getEventSettings = async (guildId: string): Promise<EventSettings | null> => {
  const value = await readDatabaseValue(dbPaths.eventSettings(guildId));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(eventSettingsSchema, value, "Event settings");
};

export const upsertEventSettings = async (
  guildId: string,
  input: EventSettingsInput,
): Promise<EventSettings> => {
  const path = dbPaths.eventSettings(guildId);
  const existingSettings = await getEventSettings(guildId);
  const parsedInput = parseDatabaseData(eventSettingsInputSchema, input, "Event settings input");

  const writeData = parseDatabaseData(
    eventSettingsWriteSchema,
    {
      guildId,
      ...parsedInput,
      createdAt: existingSettings?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Event settings write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(eventSettingsSchema, await readDatabaseValue(path), "Saved event settings");
};
