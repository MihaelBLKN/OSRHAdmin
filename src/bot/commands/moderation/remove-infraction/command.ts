import { SlashCommandBuilder } from "discord.js";

import { removeInfraction } from "../../../../database/repositories/infraction.repository";
import { AppError } from "../../../../lib/errors";
import type { SlashCommand } from "../../../types/command";

export const removeInfractionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("removeinfraction")
    .setDescription("Remove an infraction from a user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user whose infraction should be removed.")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("infraction_id")
        .setDescription("The infraction ID to remove.")
        .setRequired(true)
        .setMinLength(36)
        .setMaxLength(36),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "Infractions can only be removed in a server.", {
        statusCode: 400,
      });
    }

    const targetUser = interaction.options.getUser("user", true);
    const infractionId = interaction.options.getString("infraction_id", true);
    const removedInfraction = await removeInfraction(
      interaction.guildId,
      targetUser.id,
      infractionId,
    );

    if (removedInfraction === null) {
      throw new AppError("DISCORD_ERROR", "That infraction does not exist for this user.", {
        statusCode: 404,
      });
    }

    await interaction.editReply({
      content:
        `Removed infraction \`${removedInfraction.infractionId}\` from <@${targetUser.id}>.` +
        (removedInfraction.parsedInfraction === null
          ? "\nThe stored record did not match the current schema, but it was removed."
          : ""),
    });
  },
};
