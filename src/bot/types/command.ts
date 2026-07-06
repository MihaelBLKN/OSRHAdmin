import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

export type SlashCommand = {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  readonly deferReply?: boolean;
  readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
