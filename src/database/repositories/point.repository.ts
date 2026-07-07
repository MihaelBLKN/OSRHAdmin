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

const robloxUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/, "Roblox usernames can only contain letters, numbers, and underscores.");

const usernameKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_]+$/, "Username keys must be normalized Roblox usernames.");

const pointsSchema = z.number().int().nonnegative().max(1_000_000_000);

const pointsDeltaSchema = z.number().int().min(-1_000_000_000).max(1_000_000_000);

const namePrefixSchema = z.string().trim().min(1).max(20);

const timestampSchema = z.number().int().nonnegative();

const firebaseServerTimestampSchema = z.custom<FirebaseServerTimestamp>(
  (value) => value === ServerValue.TIMESTAMP,
  "Expected Firebase server timestamp sentinel.",
);

const timestampWriteSchema = z.union([timestampSchema, firebaseServerTimestampSchema]);

const pointUserSchema = z
  .object({
    guildId: discordIdSchema,
    usernameKey: usernameKeySchema,
    robloxUsername: robloxUsernameSchema,
    points: pointsSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const pointUserWriteSchema = pointUserSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

const pointRoleSchema = z
  .object({
    guildId: discordIdSchema,
    roleId: discordIdSchema,
    requiredPoints: pointsSchema,
    namePrefix: namePrefixSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const pointRoleInputSchema = pointRoleSchema
  .pick({
    roleId: true,
    requiredPoints: true,
    namePrefix: true,
  })
  .strict();

const pointRoleWriteSchema = pointRoleSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

const pointRoleListSchema = z.record(discordIdSchema, pointRoleSchema);

export type PointUser = z.infer<typeof pointUserSchema>;

export type PointRole = z.infer<typeof pointRoleSchema>;

export type PointRoleInput = z.input<typeof pointRoleInputSchema>;

export type PointChange = {
  readonly before: PointUser | null;
  readonly after: PointUser;
};

export const normalizeRobloxUsername = (robloxUsername: string): string =>
  parseDatabaseData(usernameKeySchema, robloxUsername, "Roblox username");

export const parseRobloxUsername = (robloxUsername: string): string =>
  parseDatabaseData(robloxUsernameSchema, robloxUsername, "Roblox username");

export const getPointUser = async (
  guildId: string,
  robloxUsername: string,
): Promise<PointUser | null> => {
  const usernameKey = normalizeRobloxUsername(robloxUsername);
  const value = await readDatabaseValue(dbPaths.pointUser(guildId, usernameKey));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(pointUserSchema, value, "Point user");
};

export const setUserPoints = async (
  guildId: string,
  robloxUsername: string,
  points: number,
): Promise<PointChange> => {
  const parsedUsername = parseRobloxUsername(robloxUsername);
  const usernameKey = normalizeRobloxUsername(parsedUsername);
  const parsedPoints = parseDatabaseData(pointsSchema, points, "Points");
  const before = await getPointUser(guildId, parsedUsername);
  const after = await writePointUser(guildId, parsedUsername, usernameKey, parsedPoints, before);

  return {
    before,
    after,
  };
};

export const adjustUserPoints = async (
  guildId: string,
  robloxUsername: string,
  delta: number,
): Promise<PointChange> => {
  const parsedDelta = parseDatabaseData(pointsDeltaSchema, delta, "Point amount");
  const parsedUsername = parseRobloxUsername(robloxUsername);
  const usernameKey = normalizeRobloxUsername(parsedUsername);
  const before = await getPointUser(guildId, parsedUsername);
  const nextPoints = Math.max(0, (before?.points ?? 0) + parsedDelta);
  const after = await writePointUser(guildId, parsedUsername, usernameKey, nextPoints, before);

  return {
    before,
    after,
  };
};

export const upsertPointRole = async (
  guildId: string,
  input: PointRoleInput,
): Promise<PointRole> => {
  const parsedInput = parseDatabaseData(pointRoleInputSchema, input, "Point role input");
  const path = dbPaths.pointRole(guildId, parsedInput.roleId);
  const existingRole = await getPointRole(guildId, parsedInput.roleId);
  const writeData = parseDatabaseData(
    pointRoleWriteSchema,
    {
      guildId,
      ...parsedInput,
      createdAt: existingRole?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Point role write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(pointRoleSchema, await readDatabaseValue(path), "Saved point role");
};

export const getPointRole = async (guildId: string, roleId: string): Promise<PointRole | null> => {
  const value = await readDatabaseValue(dbPaths.pointRole(guildId, roleId));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(pointRoleSchema, value, "Point role");
};

export const removePointRole = async (
  guildId: string,
  roleId: string,
): Promise<PointRole | null> => {
  const path = dbPaths.pointRole(guildId, roleId);
  const existingRole = await getPointRole(guildId, roleId);

  if (existingRole === null) {
    return null;
  }

  await removeDatabaseValue(path);

  return existingRole;
};

export const listPointRoles = async (guildId: string): Promise<readonly PointRole[]> => {
  const value = await readDatabaseValue(dbPaths.guildPointRoles(guildId));

  if (value === null) {
    return [];
  }

  const rolesById = parseDatabaseData(pointRoleListSchema, value, "Point roles");

  return Object.values(rolesById).sort((left, right) => {
    if (left.requiredPoints !== right.requiredPoints) {
      return left.requiredPoints - right.requiredPoints;
    }

    return left.roleId.localeCompare(right.roleId);
  });
};

const writePointUser = async (
  guildId: string,
  robloxUsername: string,
  usernameKey: string,
  points: number,
  existingUser: PointUser | null,
): Promise<PointUser> => {
  const path = dbPaths.pointUser(guildId, usernameKey);
  const writeData = parseDatabaseData(
    pointUserWriteSchema,
    {
      guildId,
      usernameKey,
      robloxUsername,
      points,
      createdAt: existingUser?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Point user write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(pointUserSchema, await readDatabaseValue(path), "Saved point user");
};
