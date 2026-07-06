import { Collection } from "discord.js";

import type { SlashCommand } from "../types/command";
import { eventLogCommand } from "./events/event-log.command";
import { setEventsChannelCommand } from "./events/set-events-channel.command";
import { setCommandPermissionCommand } from "./admin/set-command-permission/command";
import { infractionCommand } from "./moderation/infraction/command";
import { infractionsCommand } from "./moderation/infractions/command";
import { removeInfractionCommand } from "./moderation/remove-infraction/command";
import { linkCommand } from "./utility/link/command";
import { pingCommand } from "./utility/ping.command";

const commands = [
  pingCommand,
  linkCommand,
  eventLogCommand,
  setEventsChannelCommand,
  setCommandPermissionCommand,
  infractionCommand,
  infractionsCommand,
  removeInfractionCommand,
] satisfies readonly SlashCommand[];

export const commandRegistry = new Collection<string, SlashCommand>(
  commands.map((command) => [command.data.name, command]),
);

export const getSlashCommands = (): readonly SlashCommand[] => commands;
