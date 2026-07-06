import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbed,
  type MessageActionRowComponentBuilder,
} from "discord.js";

import {
  formatInfractionSeverity,
  type Infraction,
} from "../../../../database/repositories/infraction.repository";
import { INFRACTIONS_BUTTON_PREFIX } from "./constants";

type InfractionView = {
  readonly embeds: readonly APIEmbed[];
  readonly components: readonly ActionRowBuilder<MessageActionRowComponentBuilder>[];
};

export const buildInfractionView = (
  infractions: readonly Infraction[],
  pageIndex: number,
): InfractionView => {
  const pageCount = infractions.length;
  const boundedPageIndex = Math.min(Math.max(pageIndex, 0), pageCount - 1);
  const infraction = infractions[boundedPageIndex];

  if (infraction === undefined) {
    return {
      embeds: [],
      components: [],
    };
  }

  const embed = new EmbedBuilder()
    .setTitle(`Infraction ${String(boundedPageIndex + 1)} of ${String(pageCount)}`)
    .setDescription(infraction.description)
    .addFields(
      {
        name: "User",
        value: `<@${infraction.targetUser.userId}> (${infraction.targetUser.userId})`,
      },
      {
        name: "Severity",
        value: formatInfractionSeverity(infraction.severity),
        inline: true,
      },
      {
        name: "Moderator",
        value: `<@${infraction.moderator.userId}> (${infraction.moderator.userId})`,
        inline: true,
      },
      {
        name: "Created",
        value: `<t:${String(Math.floor(infraction.createdAt / 1000))}:F>`,
      },
      {
        name: "Proof",
        value: formatProof(infraction),
      },
      {
        name: "Infraction ID",
        value: `\`${infraction.infractionId}\``,
      },
    )
    .setColor(0xd9480f);

  const previousPage = Math.max(boundedPageIndex - 1, 0);
  const nextPage = Math.min(boundedPageIndex + 1, pageCount - 1);
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildInfractionsButtonId("previous", infraction.targetUser.userId, previousPage))
      .setLabel("←")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(boundedPageIndex === 0),
    new ButtonBuilder()
      .setCustomId(buildInfractionsButtonId("next", infraction.targetUser.userId, nextPage))
      .setLabel("→")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(boundedPageIndex === pageCount - 1),
  );

  return {
    embeds: [embed.toJSON()],
    components: [row],
  };
};

export const buildInfractionsButtonId = (
  action: "previous" | "next",
  userId: string,
  pageIndex: number,
): string => `${INFRACTIONS_BUTTON_PREFIX}:${action}:${userId}:${String(pageIndex)}`;

const formatProof = (infraction: Infraction): string =>
  infraction.proof
    .map((proofItem, index) => {
      const label = proofItem.name ?? proofItem.type;
      return `${String(index + 1)}. [${label}](${proofItem.url})`;
    })
    .join("\n");
