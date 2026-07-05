import type { DiscordEvent } from "../types/event";
import { interactionCreateEvent } from "./interactionCreate.event";
import { readyEvent } from "./ready.event";

export const events = [readyEvent, interactionCreateEvent] satisfies readonly DiscordEvent[];
