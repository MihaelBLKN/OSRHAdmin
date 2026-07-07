import type { ChatInputCommandInteraction } from "discord.js";

import {
  findLinkedRobloxUserByRobloxUsername,
  getLinkedRobloxUser,
  type LinkedRobloxUser,
} from "../../../database/repositories/linked-roblox-user.repository";
import { AppError } from "../../../lib/errors";

export const requireGuildInteraction = (
  interaction: ChatInputCommandInteraction,
  action: string,
): string => {
  if (!interaction.inGuild()) {
    throw new AppError("DISCORD_ERROR", `${action} can only be used in a server.`, {
      statusCode: 400,
    });
  }

  return interaction.guildId;
};

export const requireLinkedRobloxUser = async (
  discordUserId: string,
): Promise<LinkedRobloxUser> => {
  const linkedUser = await getLinkedRobloxUser(discordUserId);

  if (linkedUser === null) {
    throw new AppError(
      "NOT_FOUND",
      "Link your Roblox account with `/link` before using shift commands.",
      {
        statusCode: 404,
      },
    );
  }

  return linkedUser;
};

export const requireVerifiedRobloxUsername = async (
  robloxUsername: string,
): Promise<LinkedRobloxUser> => {
  const linkedUser = await findLinkedRobloxUserByRobloxUsername(robloxUsername);

  if (linkedUser === null) {
    throw new AppError(
      "NOT_FOUND",
      "That Roblox username is not verified. Have the user link their Roblox account with `/link` first.",
      {
        statusCode: 404,
      },
    );
  }

  return linkedUser;
};

export const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${formatUnit(hours, "hour")}, ${formatUnit(minutes, "minute")}, ${formatUnit(
    seconds,
    "second",
  )}`;
};

export const formatDiscordTimestamp = (timestampMs: number): string =>
  `<t:${String(Math.floor(timestampMs / 1000))}:R>`;

const formatUnit = (value: number, unit: string): string =>
  `${String(value)} ${unit}${value === 1 ? "" : "s"}`;
