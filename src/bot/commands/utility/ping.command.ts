import { SlashCommandBuilder } from "discord.js";

import { buildSimpleEmbed } from "../../embeds";
import type { SlashCommand } from "../../types/command";

export const pingCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Replies with the bot latency."),
  async execute(interaction) {
    await interaction.editReply({
      embeds: [
        buildSimpleEmbed("Pong", `Latency: ${String(interaction.client.ws.ping)}ms`, "success"),
      ],
    });
  },
};
