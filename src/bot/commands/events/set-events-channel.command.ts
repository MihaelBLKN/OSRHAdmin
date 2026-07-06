import { ChannelType, SlashCommandBuilder } from "discord.js";

import { upsertEventSettings } from "../../../database/repositories/event-settings.repository";
import { AppError } from "../../../lib/errors";
import type { SlashCommand } from "../../types/command";

export const setEventsChannelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("seteventschannel")
    .setDescription("Set the channel where finalized event logs are posted.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel where event log embeds should be posted.")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "The events channel can only be configured in a server.", {
        statusCode: 400,
      });
    }

    const channel = interaction.options.getChannel("channel", true);
    const settings = await upsertEventSettings(interaction.guildId, {
      eventsChannelId: channel.id,
      updatedByUserId: interaction.user.id,
    });

    await interaction.editReply({
      content: `Event logs will now be posted in <#${settings.eventsChannelId}>.`,
    });
  },
};
