import type { Awaitable, ClientEvents } from "discord.js";

export type DiscordEvent = {
  [EventName in keyof ClientEvents]: {
    readonly name: EventName;
    readonly once?: boolean;
    readonly execute: (...args: ClientEvents[EventName]) => Awaitable<void>;
  };
}[keyof ClientEvents];
