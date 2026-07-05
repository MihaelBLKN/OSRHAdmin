import { createDiscordClient } from "./bot/client";
import { events } from "./bot/events";
import { registerEvents } from "./bot/handlers/event-handler";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const startBot = async (): Promise<void> => {
  const client = createDiscordClient();

  registerEvents(client, events);

  await client.login(env.DISCORD_TOKEN);
};

startBot().catch((error: unknown) => {
  logger.error("Failed to start Discord bot.", { error });
  process.exit(1);
});
