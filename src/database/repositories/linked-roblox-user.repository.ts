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

const robloxIdSchema = z.string().regex(/^\d+$/, "Roblox IDs must be stored as strings.");

const robloxUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/, "Roblox usernames can only contain letters, numbers, and underscores.");

const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^OSRH-[A-Z0-9]{8}$/, "Verification codes must match the generated format.");

const timestampSchema = z.number().int().nonnegative();

const firebaseServerTimestampSchema = z.custom<FirebaseServerTimestamp>(
  (value) => value === ServerValue.TIMESTAMP,
  "Expected Firebase server timestamp sentinel.",
);

const timestampWriteSchema = z.union([timestampSchema, firebaseServerTimestampSchema]);

const discordUserSnapshotSchema = z
  .object({
    userId: discordIdSchema,
    username: z.string().trim().min(1).max(32),
    globalName: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

const robloxLinkIdentitySchema = z
  .object({
    robloxId: robloxIdSchema,
    robloxUsername: robloxUsernameSchema,
  })
  .strict();

const linkedRobloxUserSchema = robloxLinkIdentitySchema
  .extend({
    discordUser: discordUserSnapshotSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    verifiedAt: timestampSchema,
  })
  .strict();

const pendingRobloxLinkSchema = robloxLinkIdentitySchema
  .extend({
    discordUser: discordUserSnapshotSchema,
    verificationCode: verificationCodeSchema,
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const pendingRobloxLinkInputSchema = pendingRobloxLinkSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .strict();

const pendingRobloxLinkWriteSchema = pendingRobloxLinkSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

const linkedRobloxUserInputSchema = linkedRobloxUserSchema
  .omit({
    createdAt: true,
    updatedAt: true,
    verifiedAt: true,
  })
  .strict();

const linkedRobloxUserWriteSchema = linkedRobloxUserSchema
  .omit({
    createdAt: true,
    updatedAt: true,
    verifiedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
    verifiedAt: timestampWriteSchema,
  })
  .strict();

const linkedRobloxUsersSchema = z.record(discordIdSchema, linkedRobloxUserSchema);

export type LinkedRobloxUser = z.infer<typeof linkedRobloxUserSchema>;

export type PendingRobloxLink = z.infer<typeof pendingRobloxLinkSchema>;

export type PendingRobloxLinkInput = z.input<typeof pendingRobloxLinkInputSchema>;

export type LinkedRobloxUserInput = z.input<typeof linkedRobloxUserInputSchema>;

export const createPendingRobloxLink = async (
  discordUserId: string,
  input: PendingRobloxLinkInput,
): Promise<PendingRobloxLink> => {
  const path = dbPaths.pendingRobloxLink(discordUserId);
  const existingPendingLink = await getPendingRobloxLink(discordUserId);
  const parsedInput = parseDatabaseData(pendingRobloxLinkInputSchema, input, "Pending link input");

  const writeData = parseDatabaseData(
    pendingRobloxLinkWriteSchema,
    {
      ...parsedInput,
      createdAt: existingPendingLink?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Pending link write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(
    pendingRobloxLinkSchema,
    await readDatabaseValue(path),
    "Saved pending link",
  );
};

export const getPendingRobloxLink = async (
  discordUserId: string,
): Promise<PendingRobloxLink | null> => {
  const value = await readDatabaseValue(dbPaths.pendingRobloxLink(discordUserId));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(pendingRobloxLinkSchema, value, "Pending link");
};

export const completePendingRobloxLink = async (
  discordUserId: string,
  input: LinkedRobloxUserInput,
): Promise<LinkedRobloxUser> => {
  const linkedUser = await upsertLinkedRobloxUser(discordUserId, input);

  await removeDatabaseValue(dbPaths.pendingRobloxLink(discordUserId));

  return linkedUser;
};

export const getLinkedRobloxUser = async (
  discordUserId: string,
): Promise<LinkedRobloxUser | null> => {
  const value = await readDatabaseValue(dbPaths.linkedRobloxUser(discordUserId));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(linkedRobloxUserSchema, value, "Linked user");
};

export const findLinkedRobloxUserByRobloxUsername = async (
  robloxUsername: string,
): Promise<LinkedRobloxUser | null> => {
  const normalizedUsername = robloxUsername.trim().toLowerCase();
  const value = await readDatabaseValue(dbPaths.linkedRobloxUsers());

  if (value === null) {
    return null;
  }

  const linkedUsers = parseDatabaseData(linkedRobloxUsersSchema, value, "Linked users");

  return (
    Object.values(linkedUsers).find(
      (linkedUser) => linkedUser.robloxUsername.toLowerCase() === normalizedUsername,
    ) ?? null
  );
};

const upsertLinkedRobloxUser = async (
  discordUserId: string,
  input: LinkedRobloxUserInput,
): Promise<LinkedRobloxUser> => {
  const path = dbPaths.linkedRobloxUser(discordUserId);
  const existingLink = await getLinkedRobloxUser(discordUserId);
  const parsedInput = parseDatabaseData(linkedRobloxUserInputSchema, input, "Linked user input");

  const writeData = parseDatabaseData(
    linkedRobloxUserWriteSchema,
    {
      ...parsedInput,
      createdAt: existingLink?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
      verifiedAt: serverTimestamp(),
    },
    "Linked user write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(
    linkedRobloxUserSchema,
    await readDatabaseValue(path),
    "Saved linked user",
  );
};
