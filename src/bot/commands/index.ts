import { Collection } from "discord.js";

import type { SlashCommand } from "../types/command";
import { eventLogCommand } from "./events/event-log.command";
import { setEventsChannelCommand } from "./events/set-events-channel.command";
import { setCommandPermissionCommand } from "./admin/set-command-permission/command";
import { infractionCommand } from "./moderation/infraction/command";
import { infractionsCommand } from "./moderation/infractions/command";
import { removeInfractionCommand } from "./moderation/remove-infraction/command";
import { addPointsCommand } from "./points/add-points.command";
import { addPointsRoleCommand } from "./points/add-points-role.command";
import { progressCommand } from "./points/progress.command";
import { removePointsCommand } from "./points/remove-points.command";
import { removePointsRoleCommand } from "./points/remove-points-role.command";
import { resetPointsCommand } from "./points/reset-points.command";
import { showConfiguredRolesCommand } from "./points/show-configured-roles.command";
import { updateCommand } from "./points/update.command";
import { shiftEndCommand } from "./shifts/shiftend.command";
import { shiftStartCommand } from "./shifts/shiftstart.command";
import { shiftViewCommand } from "./shifts/shiftview.command";
import { viewActivityCommand } from "./shifts/viewactivity.command";
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
  resetPointsCommand,
  addPointsCommand,
  removePointsCommand,
  addPointsRoleCommand,
  removePointsRoleCommand,
  showConfiguredRolesCommand,
  progressCommand,
  updateCommand,
  shiftStartCommand,
  shiftViewCommand,
  shiftEndCommand,
  viewActivityCommand,
] satisfies readonly SlashCommand[];

export const commandRegistry = new Collection<string, SlashCommand>(
  commands.map((command) => [command.data.name, command]),
);

export const getSlashCommands = (): readonly SlashCommand[] => commands;
