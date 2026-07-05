import { REST, Routes } from "discord.js";

import { getSlashCommands } from "../bot/commands";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const deployCommands = async (): Promise<void> => {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const commandPayload = getSlashCommands().map((command) => command.data.toJSON());

  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body: commandPayload,
  });

  logger.info("Deployed global slash commands.", {
    commandCount: commandPayload.length,
  });
};

await deployCommands();
