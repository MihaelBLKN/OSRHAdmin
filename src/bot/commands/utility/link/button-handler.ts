import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
  type User,
} from "discord.js";

import {
  completePendingRobloxLink,
  getPendingRobloxLink,
  type LinkedRobloxUserInput,
} from "../../../../database/repositories/linked-roblox-user.repository";
import { AppError, getErrorMessage, toSafeUserMessage } from "../../../../lib/errors";
import { logger } from "../../../../lib/logger";
import { getRobloxUserProfile } from "../../../../roblox/users";
import { LINK_VERIFY_BUTTON_PREFIX } from "./constants";

export const handleLinkVerifyButton = async (
  interaction: ButtonInteraction,
): Promise<boolean> => {
  if (!interaction.customId.startsWith(`${LINK_VERIFY_BUTTON_PREFIX}:`)) {
    return false;
  }

  await interaction.deferUpdate();

  try {
    await verifyRobloxLink(interaction);
  } catch (error) {
    logger.error("Failed to verify Roblox link.", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error: getErrorMessage(error),
    });

    await replyWithButtonError(interaction, toSafeUserMessage(error));
  }

  return true;
};

const verifyRobloxLink = async (interaction: ButtonInteraction): Promise<void> => {
  const discordUserId = parseLinkVerifyButtonId(interaction.customId);

  if (interaction.user.id !== discordUserId) {
    throw new AppError("DISCORD_ERROR", "This verification button belongs to another user.", {
      statusCode: 403,
    });
  }

  const pendingLink = await getPendingRobloxLink(interaction.user.id);

  if (pendingLink === null) {
    throw new AppError("NOT_FOUND", "Start verification first with `/link roblox_username`.", {
      statusCode: 404,
    });
  }

  if (pendingLink.expiresAt < Date.now()) {
    throw new AppError("VALIDATION_ERROR", "That verification code expired. Run `/link` again.", {
      statusCode: 400,
    });
  }

  const profile = await getRobloxUserProfile(pendingLink.robloxId);

  if (profile.isBanned) {
    throw new AppError("VALIDATION_ERROR", "That Roblox account is banned and cannot be linked.", {
      statusCode: 400,
    });
  }

  if (!profile.description.includes(pendingLink.verificationCode)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "I could not find your verification code in that Roblox profile description yet.",
      {
        statusCode: 400,
      },
    );
  }

  const linkedUser = await completePendingRobloxLink(interaction.user.id, {
    discordUser: mapUserSnapshot(interaction.user),
    robloxId: profile.id,
    robloxUsername: profile.username,
  });

  await interaction.editReply({
    content: `Verified and linked your Discord account to Roblox user \`${linkedUser.robloxUsername}\` (${linkedUser.robloxId}).`,
    components: [buildVerifiedButtonRow()],
  });
};

const replyWithButtonError = async (
  interaction: ButtonInteraction,
  content: string,
): Promise<void> => {
  try {
    await interaction.followUp(
      interaction.inGuild()
        ? {
            content,
            flags: MessageFlags.Ephemeral,
          }
        : {
            content,
          },
    );
  } catch (error) {
    logger.warn("Failed to send Roblox link verification error response.", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error: getErrorMessage(error),
    });
  }
};

const parseLinkVerifyButtonId = (customId: string): string => {
  const [, , discordUserId] = customId.split(":");

  if (discordUserId === undefined || !/^\d+$/.test(discordUserId)) {
    throw new AppError("DISCORD_ERROR", "Invalid Roblox link verification button.", {
      statusCode: 400,
    });
  }

  return discordUserId;
};

const buildVerifiedButtonRow = (): ActionRowBuilder<MessageActionRowComponentBuilder> =>
  new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("link:verified")
      .setLabel("Verified")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
  );

const mapUserSnapshot = (user: User): LinkedRobloxUserInput["discordUser"] => ({
  userId: user.id,
  username: user.username,
  ...(user.globalName === null ? {} : { globalName: user.globalName }),
});
