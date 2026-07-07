import { SlashCommandBuilder } from "discord.js";

import { getLinkedRobloxUser } from "../../../database/repositories/linked-roblox-user.repository";
import { AppError } from "../../../lib/errors";
import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";
import { formatPointRoleSyncResult, syncPointRolesForLinkedUser } from "./helpers";

export const updateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("update")
    .setDescription("Update your unlocked point roles."),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guild === null) {
      throw new AppError("DISCORD_ERROR", "Roles can only be updated in a server.", {
        statusCode: 400,
      });
    }

    const linkedUser = await getLinkedRobloxUser(interaction.user.id);

    if (linkedUser === null) {
      throw new AppError(
        "NOT_FOUND",
        "Link your Roblox account with `/link` first, then run `/update` again.",
        {
          statusCode: 404,
        },
      );
    }

    const syncResult = await syncPointRolesForLinkedUser(interaction.guild, linkedUser);

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Point Roles Updated",
          [
            `Checked point-role unlocks for \`${linkedUser.robloxUsername}\`.`,
            formatPointRoleSyncResult(syncResult),
          ].join("\n"),
          "success",
        ),
      ],
    });
  },
};
