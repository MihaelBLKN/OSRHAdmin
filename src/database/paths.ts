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
  userInfractions: (guildId: string, userId: string): string =>
    `infractions/${parseDatabasePathId("guildId", guildId)}/${parseDatabasePathId("userId", userId)}`,
  infraction: (guildId: string, userId: string, infractionId: string): string =>
    `${dbPaths.userInfractions(guildId, userId)}/${parseDatabasePathId(
      "infractionId",
      infractionId,
    )}`,
  guildEventLogs: (guildId: string): string =>
    `eventLogs/${parseDatabasePathId("guildId", guildId)}`,
  eventLog: (guildId: string, eventLogId: string): string =>
    `${dbPaths.guildEventLogs(guildId)}/${parseDatabasePathId("eventLogId", eventLogId)}`,
  eventSettings: (guildId: string): string =>
    `eventSettings/${parseDatabasePathId("guildId", guildId)}`,
  guildPointUsers: (guildId: string): string =>
    `points/${parseDatabasePathId("guildId", guildId)}/users`,
  pointUser: (guildId: string, usernameKey: string): string =>
    `${dbPaths.guildPointUsers(guildId)}/${parseDatabasePathId("usernameKey", usernameKey)}`,
  guildActivityUsers: (guildId: string): string =>
    `activity/${parseDatabasePathId("guildId", guildId)}/users`,
  activityUser: (guildId: string, usernameKey: string): string =>
    `${dbPaths.guildActivityUsers(guildId)}/${parseDatabasePathId("usernameKey", usernameKey)}`,
  activeShift: (guildId: string, discordUserId: string): string =>
    `activeShifts/${parseDatabasePathId("guildId", guildId)}/${parseDatabasePathId(
      "discordUserId",
      discordUserId,
    )}`,
  guildPointRoles: (guildId: string): string =>
    `pointRoles/${parseDatabasePathId("guildId", guildId)}`,
  pointRole: (guildId: string, roleId: string): string =>
    `${dbPaths.guildPointRoles(guildId)}/${parseDatabasePathId("roleId", roleId)}`,
  linkedRobloxUsers: (): string => "linkedRobloxUsers",
  linkedRobloxUser: (discordUserId: string): string =>
    `linkedRobloxUsers/${parseDatabasePathId("discordUserId", discordUserId)}`,
  pendingRobloxLink: (discordUserId: string): string =>
    `pendingRobloxLinks/${parseDatabasePathId("discordUserId", discordUserId)}`,
} as const;
