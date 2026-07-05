import { Collection } from "discord.js";

import type { SlashCommand } from "../types/command";
import { setCommandPermissionCommand } from "./admin/set-command-permission/command";
import { pingCommand } from "./utility/ping.command";

const commands = [pingCommand, setCommandPermissionCommand] satisfies readonly SlashCommand[];

export const commandRegistry = new Collection<string, SlashCommand>(
  commands.map((command) => [command.data.name, command]),
);

export const getSlashCommands = (): readonly SlashCommand[] => commands;
