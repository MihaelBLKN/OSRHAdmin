import {
  LabelBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { getCommandPermission } from "../../../../database/repositories/command-permission.repository";
import { AppError } from "../../../../lib/errors";
import type { SlashCommand } from "../../../types/command";
import {
  SET_COMMAND_PERMISSION_COMMAND_NAME,
  SET_COMMAND_PERMISSION_MODAL_PREFIX,
  SET_COMMAND_PERMISSION_ROLES_FIELD_ID,
  TEMPORARY_PERMISSION_ADMIN_USER_ID,
} from "./constants";

export const setCommandPermissionCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName(SET_COMMAND_PERMISSION_COMMAND_NAME)
    .setDescription("Set role permissions for a bot command.")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command name to configure.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(32),
    ),
  async execute(interaction) {
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

    const commandName = interaction.options.getString("command", true).trim().toLowerCase();

    if (commandName === SET_COMMAND_PERMISSION_COMMAND_NAME) {
      throw new AppError(
        "DISCORD_ERROR",
        "This command uses a temporary owner-only check and cannot be edited here.",
        {
          statusCode: 400,
        },
      );
    }

    const permission = await getCommandPermission(interaction.guildId, commandName);
    const currentRoleMentions =
      permission?.allowedRoleIds.map((roleId) => `<@&${roleId}>`).join(" ") ?? "";

    const rolesInput = new TextInputBuilder()
      .setCustomId(SET_COMMAND_PERMISSION_ROLES_FIELD_ID)
      .setPlaceholder("@Admin @Moderator or 123456789012345678")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000)
      .setValue(currentRoleMentions);
    const rolesLabel = new LabelBuilder()
      .setLabel("Allowed role mentions or IDs")
      .setTextInputComponent(rolesInput);

    const modal = new ModalBuilder()
      .setCustomId(`${SET_COMMAND_PERMISSION_MODAL_PREFIX}${commandName}`)
      .setTitle(`Permissions: /${commandName}`)
      .addLabelComponents(rolesLabel);

    await interaction.showModal(modal);
  },
};
