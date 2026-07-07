import { SlashCommandBuilder } from "discord.js";

import {
  getActiveShift,
  maxShiftDurationSeconds,
  startShift,
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

export const shiftStartCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("shiftstart")
    .setDescription("Start tracking your shift time."),
  async execute(interaction) {
    const guildId = requireGuildInteraction(interaction, "Shift tracking");
    const linkedUser = await requireLinkedRobloxUser(interaction.user.id);
    const activeShift = await getActiveShift(guildId, interaction.user.id);

    if (activeShift !== null) {
      throw new AppError(
        "DISCORD_ERROR",
        `You already have a shift running for \`${activeShift.robloxUsername}\` that started ${formatDiscordTimestamp(
          activeShift.startedAt,
        )}. End it with \`/shiftend\` first.`,
        {
          statusCode: 400,
        },
      );
    }

    const shift = await startShift(guildId, interaction.user.id, linkedUser);

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Shift Started",
          [
            `Started your shift for \`${shift.robloxUsername}\`.`,
            `Started: ${formatDiscordTimestamp(shift.startedAt)}`,
            `Shift limit: ${formatDuration(maxShiftDurationSeconds)}. Time beyond this will not be added to activity.`,
          ].join("\n"),
          "success",
        ),
      ],
    });
  },
};
