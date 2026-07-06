import { SlashCommandBuilder } from "discord.js";

import type { SlashCommand } from "../../types/command";

export const pingCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Replies with the bot latency."),
  async execute(interaction) {
    await interaction.editReply({
      content: `Pong! ${String(interaction.client.ws.ping)}ms`,
    });
  },
};
