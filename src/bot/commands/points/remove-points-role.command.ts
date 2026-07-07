import { SlashCommandBuilder } from "discord.js";

import { removePointRole } from "../../../database/repositories/point.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import { formatRoleForResponse } from "./helpers";

export const removePointsRoleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("removepointsrole")
    .setDescription("Remove a configured point role.")
    .addRoleOption((option) =>
      option.setName("role").setDescription("Configured Discord role to remove.").setRequired(true),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "Point roles can only be configured in a server.", {
        statusCode: 400,
      });
    }

    const role = interaction.options.getRole("role", true);
    const removedRole = await removePointRole(interaction.guildId, role.id);

    if (removedRole === null) {
      throw new AppError("NOT_FOUND", "That role is not configured as a point role.", {
        statusCode: 404,
      });
    }

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Point Role Removed",
          `Removed ${formatRoleForResponse(role)} from point-role configuration.`,
          "success",
        ),
      ],
    });
  },
};
