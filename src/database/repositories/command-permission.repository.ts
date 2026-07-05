import { ServerValue } from "firebase-admin/database";
import { z } from "zod";

import { dbPaths } from "../paths";
import { readDatabaseValue, serverTimestamp, setDatabaseValue } from "../realtime-db";
import { parseDatabaseData } from "../schemas";

type FirebaseServerTimestamp = typeof ServerValue.TIMESTAMP;

const discordIdSchema = z.string().regex(/^\d+$/, "Discord IDs must be stored as strings.");

const commandNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\w-]{1,32}$/, "Command names must match Discord slash command naming rules.");

const timestampSchema = z.number().int().nonnegative();

const firebaseServerTimestampSchema = z.custom<FirebaseServerTimestamp>(
  (value) => value === ServerValue.TIMESTAMP,
  "Expected Firebase server timestamp sentinel.",
);

const timestampWriteSchema = z.union([timestampSchema, firebaseServerTimestampSchema]);

const allowedRoleIdsSchema = z
  .array(discordIdSchema)
  .max(100)
  .transform((roleIds) => [...new Set(roleIds)].sort());

const commandPermissionSchema = z
  .object({
    guildId: discordIdSchema,
    commandName: commandNameSchema,
    allowedRoleIds: allowedRoleIdsSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const commandPermissionInputSchema = z
  .object({
    allowedRoleIds: allowedRoleIdsSchema,
  })
  .strict();

const commandPermissionWriteSchema = commandPermissionSchema
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: timestampWriteSchema,
    updatedAt: timestampWriteSchema,
  })
  .strict();

export type CommandPermission = z.infer<typeof commandPermissionSchema>;

export type CommandPermissionInput = z.input<typeof commandPermissionInputSchema>;

export const parseCommandName = (commandName: string): string =>
  parseDatabaseData(commandNameSchema, commandName, "Command name");

export const getCommandPermission = async (
  guildId: string,
  commandName: string,
): Promise<CommandPermission | null> => {
  const path = dbPaths.commandPermission(guildId, parseCommandName(commandName));
  const value = await readDatabaseValue(path);

  if (value === null) {
    return null;
  }

  return parseDatabaseData(commandPermissionSchema, value, "Command permission");
};

export const upsertCommandPermission = async (
  guildId: string,
  commandName: string,
  input: CommandPermissionInput,
): Promise<CommandPermission> => {
  const parsedCommandName = parseCommandName(commandName);
  const path = dbPaths.commandPermission(guildId, parsedCommandName);
  const existingPermission = await getCommandPermission(guildId, parsedCommandName);
  const parsedInput = parseDatabaseData(
    commandPermissionInputSchema,
    input,
    "Command permission input",
  );

  const writeData = parseDatabaseData(
    commandPermissionWriteSchema,
    {
      guildId,
      commandName: parsedCommandName,
      allowedRoleIds: parsedInput.allowedRoleIds,
      createdAt: existingPermission?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Command permission write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(
    commandPermissionSchema,
    await readDatabaseValue(path),
    "Saved command permission",
  );
};
