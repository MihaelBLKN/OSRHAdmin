import { SlashCommandBuilder } from "discord.js";

import { listPointRoles } from "../../../database/repositories/point.repository";
import { AppError } from "../../../lib/errors";
import type { SlashCommand } from "../../types/command";
import { buildConfiguredRolesEmbed } from "./helpers";

export const showConfiguredRolesCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("showconfiguredroles")
    .setDescription("Show all configured point-role unlocks."),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guild === null) {
      throw new AppError("DISCORD_ERROR", "Point roles can only be viewed in a server.", {
        statusCode: 400,
      });
    }

    const pointRoles = await listPointRoles(interaction.guildId);

    await interaction.editReply({
      embeds: [buildConfiguredRolesEmbed(pointRoles, interaction.guild)],
    });
  },
};
