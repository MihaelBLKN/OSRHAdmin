import { SlashCommandBuilder, type Attachment, type User } from "discord.js";

import {
  createInfraction,
  formatInfractionReason,
  infractionReasonChoices,
  type InfractionInput,
  type InfractionReason,
} from "../../../../database/repositories/infraction.repository";
import { AppError } from "../../../../lib/errors";
import type { SlashCommand } from "../../../types/command";

const proofLinkPattern = /https?:\/\/[^\s<>()]+/gi;

export const infractionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("infraction")
    .setDescription("Create an infraction for a user.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user receiving the infraction.").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The infraction reason.")
        .setRequired(true)
        .addChoices(...infractionReasonChoices),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Describe what happened.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1000),
    )
    .addAttachmentOption((option) =>
      option.setName("proof").setDescription("Image, video, or other proof attachment."),
    )
    .addStringOption((option) =>
      option
        .setName("proof_links")
        .setDescription("Optional proof links separated by spaces or new lines.")
        .setMaxLength(1500),
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      throw new AppError("DISCORD_ERROR", "Infractions can only be created in a server.", {
        statusCode: 400,
      });
    }

    const targetUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true) as InfractionReason;
    const description = interaction.options.getString("description", true);
    const proofAttachment = interaction.options.getAttachment("proof");
    const proof = [
      ...(proofAttachment === null ? [] : [mapAttachmentProof(proofAttachment)]),
      ...parseProofLinks(interaction.options.getString("proof_links")),
    ];

    if (proof.length === 0) {
      throw new AppError(
        "DISCORD_ERROR",
        "Add at least one proof attachment or proof link before creating an infraction.",
        {
          statusCode: 400,
        },
      );
    }

    const infraction = await createInfraction(interaction.guildId, targetUser.id, {
      targetUser: mapUserSnapshot(targetUser),
      moderator: mapUserSnapshot(interaction.user),
      reason,
      description,
      proof,
    });

    await interaction.editReply({
      content: `Created infraction \`${infraction.infractionId}\` for <@${targetUser.id}>.\nReason: ${formatInfractionReason(
        infraction.reason,
      )}\nProof items: ${String(infraction.proof.length)}`,
    });
  },
};

const mapUserSnapshot = (user: User): InfractionInput["targetUser"] => ({
  userId: user.id,
  username: user.username,
  ...(user.globalName === null ? {} : { globalName: user.globalName }),
});

const mapAttachmentProof = (attachment: Attachment): InfractionInput["proof"][number] => ({
  type: "attachment",
  url: attachment.url,
  name: attachment.name,
  size: attachment.size,
  ...(attachment.contentType === null ? {} : { contentType: attachment.contentType }),
});

const parseProofLinks = (input: string | null): InfractionInput["proof"] => {
  if (input === null) {
    return [];
  }

  return [...new Set([...input.matchAll(proofLinkPattern)].map((match) => match[0]))].map(
    (url) => ({
      type: "link",
      url,
    }),
  );
};
