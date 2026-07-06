import {
  EmbedBuilder,
  SlashCommandBuilder,
  type Attachment,
  type MessageCreateOptions,
  type User,
} from "discord.js";

import { getEventSettings } from "../../../database/repositories/event-settings.repository";
import {
  createEventLog,
  eventTypeChoices,
  formatEventType,
  type EventLog,
  type EventLogInput,
  type EventType,
} from "../../../database/repositories/event-log.repository";
import { AppError } from "../../../lib/errors";
import type { SlashCommand } from "../../types/command";

export const eventLogCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("eventlog")
    .setDescription("Log a training, course, or inspection event.")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The event type.")
        .setRequired(true)
        .addChoices(...eventTypeChoices),
    )
    .addStringOption((option) =>
      option
        .setName("attendees")
        .setDescription("Attendees for this event.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000),
    )
    .addUserOption((option) =>
      option.setName("co_host").setDescription("The event co-host.").setRequired(true),
    )
    .addUserOption((option) =>
      option.setName("supervisor").setDescription("The event supervisor.").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("top_performing")
        .setDescription("Optional top performing attendee or notes.")
        .setMinLength(1)
        .setMaxLength(1000),
    )
    .addAttachmentOption((option) =>
      option.setName("picture").setDescription("Optional picture to include in the event log embed."),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "Events can only be logged in a server.", {
        statusCode: 400,
      });
    }

    const eventType = interaction.options.getString("event", true) as EventType;
    const attendees = interaction.options.getString("attendees", true);
    const coHost = interaction.options.getUser("co_host", true);
    const supervisor = interaction.options.getUser("supervisor", true);
    const topPerforming = interaction.options.getString("top_performing");
    const picture = interaction.options.getAttachment("picture");
    const eventSettings = await getEventSettings(interaction.guildId);

    if (picture?.contentType?.startsWith("image/") === false) {
      throw new AppError("DISCORD_ERROR", "The event log picture must be an image attachment.", {
        statusCode: 400,
      });
    }

    if (eventSettings === null) {
      throw new AppError(
        "DISCORD_ERROR",
        "Set an events logging channel with /seteventschannel before logging events.",
        {
          statusCode: 400,
        },
      );
    }

    const eventLog = await createEventLog(interaction.guildId, {
      eventType,
      attendees,
      host: mapUserSnapshot(interaction.user),
      coHost: mapUserSnapshot(coHost),
      supervisor: mapUserSnapshot(supervisor),
      ...(topPerforming === null ? {} : { topPerforming }),
      ...(picture === null ? {} : { picture: mapEventPicture(picture) }),
    });
    const channel = await interaction.client.channels.fetch(eventSettings.eventsChannelId);

    if (!isSendableTextChannel(channel)) {
      throw new AppError(
        "DISCORD_ERROR",
        "The configured events logging channel is no longer available.",
        {
          statusCode: 400,
        },
      );
    }

    await channel.send({
      embeds: [buildEventLogEmbed(eventLog)],
    });

    await interaction.editReply({
      content: `Logged event \`${eventLog.eventLogId}\` in <#${eventSettings.eventsChannelId}>.`,
    });
  },
};

type SendableTextChannel = {
  readonly isTextBased: () => boolean;
  readonly send: (options: MessageCreateOptions) => Promise<unknown>;
};

const isSendableTextChannel = (channel: unknown): channel is SendableTextChannel => {
  const maybeChannel = channel as Partial<SendableTextChannel> | null;

  return maybeChannel?.isTextBased?.() === true && typeof maybeChannel.send === "function";
};

const buildEventLogEmbed = (eventLog: EventLog): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setTitle(formatEventType(eventLog.eventType))
    .setDescription(eventLog.attendees)
    .addFields(
      {
        name: "Host",
        value: `<@${eventLog.host.userId}>`,
        inline: true,
      },
      {
        name: "Co-host",
        value: `<@${eventLog.coHost.userId}>`,
        inline: true,
      },
      {
        name: "Supervisor",
        value: `<@${eventLog.supervisor.userId}>`,
        inline: true,
      },
      {
        name: "Event ID",
        value: `\`${eventLog.eventLogId}\``,
      },
    )
    .setColor(0x2f9e44)
    .setTimestamp(eventLog.createdAt);

  if (eventLog.topPerforming !== undefined) {
    embed.addFields({
      name: "Top performing",
      value: eventLog.topPerforming,
    });
  }

  if (eventLog.picture !== undefined) {
    embed.setImage(eventLog.picture.url);
  }

  return embed;
};

const mapUserSnapshot = (user: User): EventLogInput["host"] => ({
  userId: user.id,
  username: user.username,
  ...(user.globalName === null ? {} : { globalName: user.globalName }),
});

const mapEventPicture = (attachment: Attachment): EventLogInput["picture"] => ({
  url: attachment.url,
  name: attachment.name,
  size: attachment.size,
  ...(attachment.contentType === null ? {} : { contentType: attachment.contentType }),
});
