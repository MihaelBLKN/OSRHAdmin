import { EventEmitter } from "node:events";

import type { Awaitable, Client } from "discord.js";

import type { DiscordEvent } from "../types/event";
import { logger } from "../../lib/logger";

export const registerEvents = (client: Client, events: readonly DiscordEvent[]): void => {
  const emitter = client as EventEmitter;

  for (const event of events) {
    const execute = event.execute as (...args: unknown[]) => Awaitable<void>;
    const listener = (...args: unknown[]): void => {
      void Promise.resolve(execute(...args)).catch((error: unknown) => {
        logger.error("Discord event execution failed.", {
          eventName: event.name,
          error,
        });
      });
    };

    if (event.once === true) {
      emitter.once(event.name, listener);
    } else {
      emitter.on(event.name, listener);
    }

    logger.debug("Registered Discord event.", {
      eventName: event.name,
      once: event.once === true,
    });
  }
};
