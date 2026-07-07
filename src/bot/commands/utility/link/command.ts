import { randomBytes } from "node:crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  type MessageActionRowComponentBuilder,
  type User,
} from "discord.js";

import {
  createPendingRobloxLink,
  type LinkedRobloxUserInput,
} from "../../../../database/repositories/linked-roblox-user.repository";
import { AppError } from "../../../../lib/errors";
import { findRobloxUserByUsername } from "../../../../roblox/users";
import { buildSimpleEmbed } from "../../../embeds";
import type { SlashCommand } from "../../../types/command";
import { LINK_VERIFY_BUTTON_PREFIX } from "./constants";

const verificationCodeLifetimeMs = 30 * 60 * 1000;

export const linkCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord user to your Roblox account.")
    .addStringOption((option) =>
      option
        .setName("roblox_username")
        .setDescription("Your Roblox username.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20),
    ),
  async execute(interaction) {
    const robloxUsername = interaction.options.getString("roblox_username", true);
    const robloxUser = await findRobloxUserByUsername(robloxUsername);

    if (robloxUser === null) {
      throw new AppError("NOT_FOUND", "That Roblox username was not found.", {
        statusCode: 404,
      });
    }

    const pendingLink = await createPendingRobloxLink(interaction.user.id, {
      discordUser: mapUserSnapshot(interaction.user),
      robloxId: robloxUser.id,
      robloxUsername: robloxUser.username,
      verificationCode: generateVerificationCode(),
      expiresAt: Date.now() + verificationCodeLifetimeMs,
    });

    try {
      await interaction.user.send({
        embeds: [
          buildSimpleEmbed(
            "Roblox Verification",
            [
              `Add this code to your Roblox profile description/About section: \`${pendingLink.verificationCode}\``,
              `Roblox account: \`${pendingLink.robloxUsername}\` (${pendingLink.robloxId})`,
              "After saving your Roblox profile, click the button below to verify it.",
            ].join("\n"),
            "info",
          ),
        ],
        components: [buildVerifyButtonRow(interaction.user.id)],
      });
    } catch (error) {
      throw new AppError(
        "DISCORD_ERROR",
        "I could not DM you. Enable direct messages from this server and run `/link` again.",
        {
          cause: error,
          statusCode: 400,
        },
      );
    }

    await interaction.editReply({
      embeds: [
        buildSimpleEmbed(
          "Verification Sent",
          "I sent you a DM with your Roblox verification code and a button to finish linking.",
          "success",
        ),
      ],
    });
  },
};

export const buildLinkVerifyButtonId = (discordUserId: string): string =>
  `${LINK_VERIFY_BUTTON_PREFIX}:${discordUserId}`;

const buildVerifyButtonRow = (
  discordUserId: string,
): ActionRowBuilder<MessageActionRowComponentBuilder> =>
  new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildLinkVerifyButtonId(discordUserId))
      .setLabel("I've added it")
      .setStyle(ButtonStyle.Primary),
  );

const mapUserSnapshot = (user: User): LinkedRobloxUserInput["discordUser"] => ({
  userId: user.id,
  username: user.username,
  ...(user.globalName === null ? {} : { globalName: user.globalName }),
});

const generateVerificationCode = (): string =>
  `OSRH-${randomBytes(4).toString("hex").toUpperCase()}`;
