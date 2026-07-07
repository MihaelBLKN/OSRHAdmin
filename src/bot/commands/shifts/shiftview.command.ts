import { SlashCommandBuilder } from "discord.js";

import {
  getActiveShift,
  maxShiftDurationSeconds,
} from "../../../database/repositories/activity.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import {
  formatDiscordTimestamp,
  formatDuration,
  requireGuildInteraction,
  requireLinkedRobloxUser,
} from "./helpers";

export const shiftViewCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("shiftview")
    .setDescription("View your currently running shift."),
  async execute(interaction) {
    const guildId = requireGuildInteraction(interaction, "Shift tracking");

    await requireLinkedRobloxUser(interaction.user.id);

    const activeShift = await getActiveShift(guildId, interaction.user.id);

    if (activeShift === null) {
      throw new AppError("NOT_FOUND", "You do not have an active shift. Start one with `/shiftstart`.", {
        statusCode: 404,
      });
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - activeShift.startedAt) / 1000));
    const capped = elapsedSeconds > maxShiftDurationSeconds;
    const limitLine = capped
      ? "This shift is over the 5-hour limit. `/shiftend` will only log 5 hours."
      : `Time before limit: ${formatDuration(maxShiftDurationSeconds - elapsedSeconds)}`;

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Active Shift",
          [
            `Active shift for \`${activeShift.robloxUsername}\`.`,
            `Started: ${formatDiscordTimestamp(activeShift.startedAt)}`,
            `Running for: ${formatDuration(elapsedSeconds)}`,
            limitLine,
          ].join("\n"),
          capped ? "warning" : "info",
        ),
      ],
    });
  },
};
