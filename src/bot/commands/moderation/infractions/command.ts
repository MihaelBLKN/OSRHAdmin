import { MessageFlags, SlashCommandBuilder } from "discord.js";

import { listInfractionsForUser } from "../../../../database/repositories/infraction.repository";
import { AppError } from "../../../../lib/errors";
import type { SlashCommand } from "../../../types/command";
import { buildInfractionView } from "./view";

export const infractionsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("infractions")
    .setDescription("View infractions for a user.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to look up.").setRequired(true),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "Infractions can only be viewed in a server.", {
        statusCode: 400,
      });
    }

    const targetUser = interaction.options.getUser("user", true);
    const infractions = await listInfractionsForUser(interaction.guildId, targetUser.id);

    if (infractions.length === 0) {
      await interaction.reply({
        content: `<@${targetUser.id}> has no infractions in this server.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      ...buildInfractionView(infractions, 0),
      flags: MessageFlags.Ephemeral,
    });
  },
};
