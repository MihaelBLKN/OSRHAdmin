import { SlashCommandBuilder } from "discord.js";

import { getLinkedRobloxUser } from "../../../database/repositories/linked-roblox-user.repository";
import { getPointUser, listPointRoles } from "../../../database/repositories/point.repository";
import { AppError } from "../../../lib/errors";
import type { SlashCommand } from "../../types/command";
import { buildProgressEmbed } from "./helpers";

export const progressCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("progress")
    .setDescription("Show point progress toward the next role unlock.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Roblox username. Leave empty to use your linked account.")
        .setMinLength(3)
        .setMaxLength(20),
    ),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guild === null) {
      throw new AppError("DISCORD_ERROR", "Progress can only be viewed in a server.", {
        statusCode: 400,
      });
    }

    const username = await getProgressUsername(
      interaction.options.getString("username"),
      interaction.user.id,
    );
    const [pointUser, pointRoles] = await Promise.all([
      getPointUser(interaction.guildId, username),
      listPointRoles(interaction.guildId),
    ]);

    await interaction.editReply({
      embeds: [
        buildProgressEmbed({
          pointUser,
          robloxUsername: username,
          pointRoles,
          guild: interaction.guild,
        }),
      ],
    });
  },
};

const getProgressUsername = async (
  username: string | null,
  discordUserId: string,
): Promise<string> => {
  if (username !== null) {
    return username;
  }

  const linkedUser = await getLinkedRobloxUser(discordUserId);

  if (linkedUser === null) {
    throw new AppError(
      "NOT_FOUND",
      "Provide a Roblox username or link your Roblox account with `/link` first.",
      {
        statusCode: 404,
      },
    );
  }

  return linkedUser.robloxUsername;
};
