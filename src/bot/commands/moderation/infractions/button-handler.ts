import { MessageFlags, type ButtonInteraction } from "discord.js";

import { listInfractionsForUser } from "../../../../database/repositories/infraction.repository";
import { AppError, getErrorMessage, toSafeUserMessage } from "../../../../lib/errors";
import { logger } from "../../../../lib/logger";
import { INFRACTIONS_BUTTON_PREFIX } from "./constants";
import { buildInfractionView } from "./view";

export const handleInfractionsButton = async (interaction: ButtonInteraction): Promise<boolean> => {
  if (!interaction.customId.startsWith(`${INFRACTIONS_BUTTON_PREFIX}:`)) {
    return false;
  }

  try {
    await updateInfractionPage(interaction);
  } catch (error) {
    logger.error("Failed to paginate infractions.", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      error: getErrorMessage(error),
    });

    await interaction.reply({
      content: toSafeUserMessage(error),
      flags: MessageFlags.Ephemeral,
    });
  }

  return true;
};

const updateInfractionPage = async (interaction: ButtonInteraction): Promise<void> => {
  if (!interaction.inGuild()) {
    throw new AppError("DISCORD_ERROR", "Infractions can only be viewed in a server.", {
      statusCode: 400,
    });
  }

  const parsedCustomId = parseInfractionsButtonId(interaction.customId);
  const infractions = await listInfractionsForUser(interaction.guildId, parsedCustomId.userId);

  if (infractions.length === 0) {
    await interaction.update({
      content: "This user has no infractions in this server.",
      embeds: [],
      components: [],
    });
    return;
  }

  await interaction.update({
    content: "",
    ...buildInfractionView(infractions, parsedCustomId.pageIndex),
  });
};

const parseInfractionsButtonId = (
  customId: string,
): {
  readonly userId: string;
  readonly pageIndex: number;
} => {
  const [, action, userId, pageIndexInput] = customId.split(":");
  const pageIndex = Number(pageIndexInput);

  if (
    (action !== "previous" && action !== "next") ||
    userId === undefined ||
    !/^\d+$/.test(userId) ||
    !Number.isInteger(pageIndex) ||
    pageIndex < 0
  ) {
    throw new AppError("DISCORD_ERROR", "Invalid infraction page button.", {
      statusCode: 400,
    });
  }

  return {
    userId,
    pageIndex,
  };
};
