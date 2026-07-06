import { MessageFlags, type ModalSubmitInteraction } from "discord.js";

import { commandRegistry } from "../../index";
import {
  SET_COMMAND_PERMISSION_COMMAND_NAME,
  SET_COMMAND_PERMISSION_MODAL_PREFIX,
  SET_COMMAND_PERMISSION_ROLES_FIELD_ID,
  TEMPORARY_PERMISSION_ADMIN_USER_ID,
} from "./constants";
import {
  parseCommandName,
  upsertCommandPermission,
} from "../../../../database/repositories/command-permission.repository";
import { AppError, getErrorMessage, toSafeUserMessage } from "../../../../lib/errors";
import { logger } from "../../../../lib/logger";

const roleIdPattern = /<@&(?<mentionId>\d+)>|(?<rawId>\b\d{17,20}\b)/g;

export const handleCommandPermissionModal = async (
  interaction: ModalSubmitInteraction,
): Promise<boolean> => {
  if (!interaction.customId.startsWith(SET_COMMAND_PERMISSION_MODAL_PREFIX)) {
    return false;
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    await saveCommandPermissionModal(interaction);
  } catch (error) {
    logger.error("Failed to save command permissions.", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error: getErrorMessage(error),
    });

    await replyWithModalError(interaction, toSafeUserMessage(error));
  }

  return true;
};

const saveCommandPermissionModal = async (interaction: ModalSubmitInteraction): Promise<void> => {
  if (interaction.user.id !== TEMPORARY_PERMISSION_ADMIN_USER_ID) {
    throw new AppError("DISCORD_ERROR", "You are not allowed to use this command.", {
      statusCode: 403,
    });
  }

  if (!interaction.inGuild()) {
    throw new AppError("DISCORD_ERROR", "Command permissions can only be edited in a server.", {
      statusCode: 400,
    });
  }

  const commandName = parseCommandName(
    interaction.customId.slice(SET_COMMAND_PERMISSION_MODAL_PREFIX.length),
  );

  if (commandName === SET_COMMAND_PERMISSION_COMMAND_NAME || !commandRegistry.has(commandName)) {
    throw new AppError("DISCORD_ERROR", "That command cannot be configured.", {
      statusCode: 400,
    });
  }

  const allowedRoleIds = parseRoleIds(
    interaction.fields.getTextInputValue(SET_COMMAND_PERMISSION_ROLES_FIELD_ID),
  );

  const unknownRoleIds = await findUnknownRoleIds(interaction, allowedRoleIds);

  if (unknownRoleIds.length > 0) {
    throw new AppError(
      "DISCORD_ERROR",
      `These roles do not exist in this server: ${unknownRoleIds.join(", ")}`,
      {
        statusCode: 400,
      },
    );
  }

  const permission = await upsertCommandPermission(interaction.guildId, commandName, {
    allowedRoleIds,
  });
  const roleList =
    permission.allowedRoleIds.length > 0
      ? permission.allowedRoleIds.map((roleId) => `<@&${roleId}>`).join(", ")
      : "No roles. This command is locked until roles are added.";

  await interaction.editReply({
    content: `Updated permissions for \`/${permission.commandName}\`.\nAllowed roles: ${roleList}`,
  });
};

const parseRoleIds = (input: string): string[] => {
  const roleIds = [...input.matchAll(roleIdPattern)].map((match) => {
    const groups = match.groups ?? {};
    return groups.mentionId ?? groups.rawId ?? "";
  });

  return [...new Set(roleIds.filter((roleId) => roleId.length > 0))].sort();
};

const findUnknownRoleIds = async (
  interaction: ModalSubmitInteraction,
  roleIds: readonly string[],
): Promise<string[]> => {
  const guild = interaction.guild;

  if (guild === null) {
    throw new AppError("DISCORD_ERROR", "Unable to load this server.", {
      statusCode: 400,
    });
  }

  const unknownRoleIds: string[] = [];

  for (const roleId of roleIds) {
    const role = await guild.roles.fetch(roleId);

    if (role === null) {
      unknownRoleIds.push(roleId);
    }
  }

  return unknownRoleIds;
};

const replyWithModalError = async (
  interaction: ModalSubmitInteraction,
  content: string,
): Promise<void> => {
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ content });
    return;
  }

  if (interaction.replied) {
    await interaction.followUp({
      content,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
};
