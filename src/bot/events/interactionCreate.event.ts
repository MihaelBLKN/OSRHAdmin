import type { DiscordEvent } from "../types/event";
import { handleCommandPermissionModal } from "../commands/admin/set-command-permission/modal-handler";
import { handleInfractionsButton } from "../commands/moderation/infractions/button-handler";
import { handleLinkVerifyButton } from "../commands/utility/link/button-handler";
import { executeSlashCommand } from "../handlers/command-handler";

export const interactionCreateEvent: DiscordEvent = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      await executeSlashCommand(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleCommandPermissionModal(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (await handleLinkVerifyButton(interaction)) {
        return;
      }

      await handleInfractionsButton(interaction);
    }
  },
};
