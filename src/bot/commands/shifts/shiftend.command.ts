import { SlashCommandBuilder } from "discord.js";

import { endShift } from "../../../database/repositories/activity.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import {
  formatDuration,
  requireGuildInteraction,
  requireLinkedRobloxUser,
} from "./helpers";

export const shiftEndCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("shiftend")
    .setDescription("End your current shift and add it to your activity time."),
  async execute(interaction) {
    const guildId = requireGuildInteraction(interaction, "Shift tracking");

    await requireLinkedRobloxUser(interaction.user.id);

    const result = await endShift(guildId, interaction.user.id);

    if (result === null) {
      throw new AppError("NOT_FOUND", "You do not have an active shift to end.", {
        statusCode: 404,
      });
    }

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Shift Ended",
          [
            `Ended shift for \`${result.activeShift.robloxUsername}\`.`,
            `Shift duration: ${formatDuration(result.elapsedSeconds)}`,
            `Logged time: ${formatDuration(result.loggedSeconds)}`,
            `Total activity: ${formatDuration(result.activityUser.totalSeconds)} across ${String(
              result.activityUser.shiftCount,
            )} shifts.`,
            result.capped
              ? "This shift exceeded 5 hours, so only 5 hours were added to activity."
              : null,
          ]
            .filter((line): line is string => line !== null)
            .join("\n"),
          result.capped ? "warning" : "success",
        ),
      ],
    });
  },
};
