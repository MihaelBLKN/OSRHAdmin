import { z } from "zod";

import { dbPaths } from "../paths";
import {
  readDatabaseValue,
  removeDatabaseValue,
  runDatabaseTransaction,
  setDatabaseValue,
} from "../realtime-db";
import { parseDatabaseData } from "../schemas";
import type { LinkedRobloxUser } from "./linked-roblox-user.repository";
import { normalizeRobloxUsername, parseRobloxUsername } from "./point.repository";

export const maxShiftDurationSeconds = 5 * 60 * 60;

const discordIdSchema = z.string().regex(/^\d+$/, "Discord IDs must be stored as strings.");

const robloxIdSchema = z.string().regex(/^\d+$/, "Roblox IDs must be stored as strings.");

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

const timestampSchema = z.number().int().nonnegative();

const secondsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const timePartsSchema = z
  .object({
    hours: z.number().int().nonnegative(),
    minutes: z.number().int().min(0).max(59),
    seconds: z.number().int().min(0).max(59),
  })
  .strict();

const activeShiftSchema = z
  .object({
    guildId: discordIdSchema,
    discordUserId: discordIdSchema,
    robloxId: robloxIdSchema,
    robloxUsername: robloxUsernameSchema,
    usernameKey: usernameKeySchema,
    startedAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

const activityUserSchema = z
  .object({
    guildId: discordIdSchema,
    usernameKey: usernameKeySchema,
    robloxUsername: robloxUsernameSchema,
    totalSeconds: secondsSchema,
    totalTime: timePartsSchema,
    shiftCount: z.number().int().nonnegative(),
    lastShift: z
      .object({
        durationSeconds: secondsSchema,
        durationTime: timePartsSchema,
        endedAt: timestampSchema,
        capped: z.boolean(),
      })
      .strict()
      .optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export type ActiveShift = z.infer<typeof activeShiftSchema>;

export type ActivityUser = z.infer<typeof activityUserSchema>;

export type ShiftEndResult = {
  readonly activityUser: ActivityUser;
  readonly activeShift: ActiveShift;
  readonly elapsedSeconds: number;
  readonly loggedSeconds: number;
  readonly capped: boolean;
};

export type TimeParts = z.infer<typeof timePartsSchema>;

export const getActiveShift = async (
  guildId: string,
  discordUserId: string,
): Promise<ActiveShift | null> => {
  const value = await readDatabaseValue(dbPaths.activeShift(guildId, discordUserId));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(activeShiftSchema, value, "Active shift");
};

export const startShift = async (
  guildId: string,
  discordUserId: string,
  linkedUser: LinkedRobloxUser,
): Promise<ActiveShift> => {
  const existingShift = await getActiveShift(guildId, discordUserId);

  if (existingShift !== null) {
    return existingShift;
  }

  const startedAt = Date.now();
  const parsedUsername = parseRobloxUsername(linkedUser.robloxUsername);
  const usernameKey = normalizeRobloxUsername(parsedUsername);
  const shift = parseDatabaseData(
    activeShiftSchema,
    {
      guildId,
      discordUserId,
      robloxId: linkedUser.robloxId,
      robloxUsername: parsedUsername,
      usernameKey,
      startedAt,
      createdAt: startedAt,
    },
    "Active shift write",
  );

  await setDatabaseValue(dbPaths.activeShift(guildId, discordUserId), shift);

  return shift;
};

export const endShift = async (
  guildId: string,
  discordUserId: string,
): Promise<ShiftEndResult | null> => {
  const activeShift = await getActiveShift(guildId, discordUserId);

  if (activeShift === null) {
    return null;
  }

  const endedAt = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((endedAt - activeShift.startedAt) / 1000));
  const loggedSeconds = Math.min(elapsedSeconds, maxShiftDurationSeconds);
  const capped = elapsedSeconds > maxShiftDurationSeconds;
  const activityUser = await addLoggedShift(activeShift, loggedSeconds, endedAt, capped);

  await removeDatabaseValue(dbPaths.activeShift(guildId, discordUserId));

  return {
    activityUser,
    activeShift,
    elapsedSeconds,
    loggedSeconds,
    capped,
  };
};

export const getActivityUser = async (
  guildId: string,
  robloxUsername: string,
): Promise<ActivityUser | null> => {
  const usernameKey = normalizeRobloxUsername(robloxUsername);
  const value = await readDatabaseValue(dbPaths.activityUser(guildId, usernameKey));

  if (value === null) {
    return null;
  }

  return parseDatabaseData(activityUserSchema, value, "Activity user");
};

export const secondsToTimeParts = (totalSeconds: number): TimeParts => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return parseDatabaseData(
    timePartsSchema,
    {
      hours,
      minutes,
      seconds,
    },
    "Time parts",
  );
};

const addLoggedShift = async (
  activeShift: ActiveShift,
  loggedSeconds: number,
  endedAt: number,
  capped: boolean,
): Promise<ActivityUser> => {
  const path = dbPaths.activityUser(activeShift.guildId, activeShift.usernameKey);
  const value = await runDatabaseTransaction(path, (currentValue) => {
    const existingActivity =
      currentValue === null
        ? null
        : parseDatabaseData(activityUserSchema, currentValue, "Activity user");
    const totalSeconds = (existingActivity?.totalSeconds ?? 0) + loggedSeconds;

    return parseDatabaseData(
      activityUserSchema,
      {
        guildId: activeShift.guildId,
        usernameKey: activeShift.usernameKey,
        robloxUsername: activeShift.robloxUsername,
        totalSeconds,
        totalTime: secondsToTimeParts(totalSeconds),
        shiftCount: (existingActivity?.shiftCount ?? 0) + 1,
        lastShift: {
          durationSeconds: loggedSeconds,
          durationTime: secondsToTimeParts(loggedSeconds),
          endedAt,
          capped,
        },
        createdAt: existingActivity?.createdAt ?? endedAt,
        updatedAt: endedAt,
      },
      "Activity user write",
    );
  });

  return parseDatabaseData(activityUserSchema, value, "Saved activity user");
};
