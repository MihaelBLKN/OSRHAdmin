import type { DiscordEvent } from "../types/event";
import { logger } from "../../lib/logger";

export const readyEvent: DiscordEvent = {
  name: "ready",
  once: true,
  execute(client) {
    logger.info("Discord bot is ready.", {
      tag: client.user.tag,
      clientId: client.user.id,
      guildCount: client.guilds.cache.size,
    });
  },
};
