import { SlashCommandBuilder } from "discord.js";

import { setUserPoints } from "../../../database/repositories/point.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import {
  formatPointRoleSyncResult,
  requireVerifiedRobloxUser,
  syncPointRolesForRobloxUsername,
} from "./helpers";

export const resetPointsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("resetpoints")
    .setDescription("Reset points for a Roblox username to 0.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Roblox username.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20),
    ),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guild === null) {
      throw new AppError("DISCORD_ERROR", "Points can only be reset in a server.", {
        statusCode: 400,
      });
    }

    const username = interaction.options.getString("username", true);
    const linkedUser = await requireVerifiedRobloxUser(username);
    const change = await setUserPoints(interaction.guildId, linkedUser.robloxUsername, 0);
    const syncResult = await syncPointRolesForRobloxUsername(
      interaction.guild,
      change.after.robloxUsername,
    );

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Points Reset",
          [
            `Reset points for \`${change.after.robloxUsername}\`.`,
            `Points: ${String(change.before?.points ?? 0)} -> 0`,
            formatPointRoleSyncResult(syncResult),
          ].join("\n"),
          "success",
        ),
      ],
    });
  },
};
