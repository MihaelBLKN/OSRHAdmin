import { EmbedBuilder, type APIEmbed } from "discord.js";

type SimpleEmbedVariant = "info" | "success" | "warning" | "error";

const simpleEmbedColors: Record<SimpleEmbedVariant, number> = {
  info: 0x1c7ed6,
  success: 0x2f9e44,
  warning: 0xf08c00,
  error: 0xd9480f,
};

export const buildSimpleEmbed = (
  title: string,
  description: string,
  variant: SimpleEmbedVariant = "info",
): APIEmbed =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(simpleEmbedColors[variant])
    .toJSON();

export const buildErrorEmbed = (description: string): APIEmbed =>
  buildSimpleEmbed("Command Error", description, "error");
