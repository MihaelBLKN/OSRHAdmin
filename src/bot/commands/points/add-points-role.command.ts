import { SlashCommandBuilder } from "discord.js";

import { upsertPointRole } from "../../../database/repositories/point.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import { formatRoleForResponse } from "./helpers";

export const addPointsRoleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("addpointsrole")
    .setDescription("Configure a role to unlock at a point total.")
    .addRoleOption((option) =>
      option.setName("role").setDescription("Discord role to unlock.").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("points")
        .setDescription("Points required for this role.")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(1_000_000),
    )
    .addStringOption((option) =>
      option
        .setName("name_prefix")
        .setDescription("Optional nickname prefix for this unlock, like [OR-1].")
        .setMinLength(1)
        .setMaxLength(20),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "Point roles can only be configured in a server.", {
        statusCode: 400,
      });
    }

    const role = interaction.options.getRole("role", true);
    const points = interaction.options.getInteger("points", true);
    const namePrefix = interaction.options.getString("name_prefix")?.trim();
    const pointRole = await upsertPointRole(interaction.guildId, {
      roleId: role.id,
      requiredPoints: points,
      ...(namePrefix === undefined ? {} : { namePrefix }),
    });
    const prefixText =
      pointRole.namePrefix === undefined ? "" : ` with nickname prefix \`${pointRole.namePrefix}\``;

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Point Role Configured",
          `Configured ${formatRoleForResponse(role)} to unlock at ${String(
            pointRole.requiredPoints,
          )} points${prefixText}.`,
          "success",
        ),
      ],
    });
  },
};
