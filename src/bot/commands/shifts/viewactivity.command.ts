import { SlashCommandBuilder } from "discord.js";

import { getActivityUser } from "../../../database/repositories/activity.repository";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import {
  formatDuration,
  requireGuildInteraction,
  requireVerifiedRobloxUsername,
} from "./helpers";

export const viewActivityCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("viewactivity")
    .setDescription("View total logged shift activity for a verified Roblox username.")
    .addStringOption((option) =>
      option
        .setName("roblox_username")
        .setDescription("Verified Roblox username to view activity for.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20),
    ),
  async execute(interaction) {
    const guildId = requireGuildInteraction(interaction, "Activity viewing");
    const linkedUser = await requireVerifiedRobloxUsername(
      interaction.options.getString("roblox_username", true),
    );
    const activityUser = await getActivityUser(guildId, linkedUser.robloxUsername);
    const totalSeconds = activityUser?.totalSeconds ?? 0;
    const shiftCount = activityUser?.shiftCount ?? 0;

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Activity",
          [
            `Activity for \`${linkedUser.robloxUsername}\` (<@${linkedUser.discordUser.userId}>):`,
            `Total logged time: ${formatDuration(totalSeconds)}`,
            `Completed shifts: ${String(shiftCount)}`,
          ].join("\n"),
          "info",
        ),
      ],
    });
  },
};
