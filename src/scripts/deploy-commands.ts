import { REST, Routes } from "discord.js";

import { getSlashCommands } from "../bot/commands";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const deployCommands = async (): Promise<void> => {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const commandPayload = getSlashCommands().map((command) => command.data.toJSON());

  if (env.DISCORD_GUILD_ID === undefined) {
    logger.error("DISCORD_GUILD_ID is required to deploy guild-only slash commands.");
    process.exitCode = 1;
    return;
  }

  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body: [],
  });

  logger.info("Cleared global slash commands.");

  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body: commandPayload,
  });

  logger.info("Deployed guild slash commands.", {
    commandCount: commandPayload.length,
    guildId: env.DISCORD_GUILD_ID,
  });
};

await deployCommands();
