import { SlashCommandBuilder } from "discord.js";

import { adjustUserPoints } from "../../../database/repositories/point.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import {
  formatPointRoleSyncResult,
  requireVerifiedRobloxUser,
  syncPointRolesForRobloxUsername,
} from "./helpers";

export const addPointsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("addpoints")
    .setDescription("Add points to a Roblox username.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Roblox username.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20),
    )
    .addIntegerOption((option) =>
      option
        .setName("points")
        .setDescription("Points to add.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1_000_000),
    ),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guild === null) {
      throw new AppError("DISCORD_ERROR", "Points can only be updated in a server.", {
        statusCode: 400,
      });
    }

    const username = interaction.options.getString("username", true);
    const points = interaction.options.getInteger("points", true);
    const linkedUser = await requireVerifiedRobloxUser(username);
    const change = await adjustUserPoints(interaction.guildId, linkedUser.robloxUsername, points);
    const syncResult = await syncPointRolesForRobloxUsername(
      interaction.guild,
      change.after.robloxUsername,
    );

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Points Added",
          [
            `Added ${String(points)} points to \`${change.after.robloxUsername}\`.`,
            `Points: ${String(change.before?.points ?? 0)} -> ${String(change.after.points)}`,
            formatPointRoleSyncResult(syncResult),
          ].join("\n"),
          "success",
        ),
      ],
    });
  },
};
