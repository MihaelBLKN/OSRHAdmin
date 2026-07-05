import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";

import { commandRegistry } from "../commands";
import { SET_COMMAND_PERMISSION_COMMAND_NAME } from "../commands/admin/set-command-permission/constants";
import { getCommandPermission } from "../../database/repositories/command-permission.repository";
import { AppError, getErrorMessage, toSafeUserMessage } from "../../lib/errors";
import { logger } from "../../lib/logger";

export const executeSlashCommand = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  const command = commandRegistry.get(interaction.commandName);

  if (command === undefined) {
    logger.warn("Received unknown slash command.", {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
    });

    await replyWithCommandError(interaction, "That command is not available.");
    return;
  }

  try {
    await assertCommandRolePermission(interaction);
    await command.execute(interaction);
  } catch (error) {
    logger.error("Slash command execution failed.", {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error: getErrorMessage(error),
    });

    await replyWithCommandError(interaction, toSafeUserMessage(error));
  }
};

const assertCommandRolePermission = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  if (interaction.commandName === SET_COMMAND_PERMISSION_COMMAND_NAME || !interaction.inGuild()) {
    return;
  }

  const permission = await getCommandPermission(interaction.guildId, interaction.commandName);

  if (permission === null) {
    return;
  }

  const userRoleIds = getInteractionRoleIds(interaction);
  const hasAllowedRole = permission.allowedRoleIds.some((roleId) => userRoleIds.includes(roleId));

  if (!hasAllowedRole) {
    throw new AppError("DISCORD_ERROR", "You do not have permission to use this command.", {
      statusCode: 403,
    });
  }
};

const getInteractionRoleIds = (interaction: ChatInputCommandInteraction): readonly string[] => {
  const roles = interaction.member?.roles;

  if (roles === undefined) {
    return [];
  }

  if (Array.isArray(roles)) {
    return roles;
  }

  return [...roles.cache.keys()];
};

const replyWithCommandError = async (
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> => {
  if (interaction.deferred) {
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
