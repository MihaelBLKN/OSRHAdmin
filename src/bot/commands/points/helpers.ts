import { EmbedBuilder, roleMention, type APIEmbed, type Guild, type GuildMember } from "discord.js";

import { findLinkedRobloxUserByRobloxUsername } from "../../../database/repositories/linked-roblox-user.repository";
import type { LinkedRobloxUser } from "../../../database/repositories/linked-roblox-user.repository";
import {
  getPointUser,
  listPointRoles,
  type PointRole,
  type PointUser,
} from "../../../database/repositories/point.repository";
import { AppError, getErrorMessage } from "../../../lib/errors";
import { logger } from "../../../lib/logger";

type PointRoleTier = {
  readonly requiredPoints: number;
  readonly roles: readonly PointRole[];
};

export type PointRoleSyncResult =
  | {
      readonly status: "updated";
      readonly discordUserId: string;
      readonly addedRoleIds: readonly string[];
      readonly removedRoleIds: readonly string[];
      readonly nicknameUpdated: boolean;
      readonly nicknameUpdateFailed: boolean;
    }
  | {
      readonly status: "not-linked" | "member-not-found" | "failed";
      readonly reason: string;
    };

export type ProgressViewData = {
  readonly pointUser: PointUser | null;
  readonly robloxUsername: string;
  readonly pointRoles: readonly PointRole[];
  readonly guild: Guild;
};

export const syncPointRolesForRobloxUsername = async (
  guild: Guild,
  robloxUsername: string,
): Promise<PointRoleSyncResult> => {
  const linkedUser = await findLinkedRobloxUserByRobloxUsername(robloxUsername);

  if (linkedUser === null) {
    return {
      status: "not-linked",
      reason: "No verified Discord user is linked to that Roblox username.",
    };
  }

  return syncPointRolesForLinkedUser(guild, linkedUser);
};

export const syncPointRolesForLinkedUser = async (
  guild: Guild,
  linkedUser: LinkedRobloxUser,
): Promise<PointRoleSyncResult> => {
  const member = await guild.members.fetch(linkedUser.discordUser.userId).catch(() => null);

  if (member === null) {
    return {
      status: "member-not-found",
      reason: "The linked Discord user is not in this server.",
    };
  }

  const pointUser = await getPointUser(guild.id, linkedUser.robloxUsername);
  const pointRoles = await listPointRoles(guild.id);

  return syncPointRolesForMember(
    member,
    linkedUser.robloxUsername,
    pointUser?.points ?? 0,
    pointRoles,
  );
};

const syncPointRolesForMember = async (
  member: GuildMember,
  robloxUsername: string,
  points: number,
  pointRoles: readonly PointRole[],
): Promise<PointRoleSyncResult> => {
  const activeTier = getActivePointRoleTier(pointRoles, points);
  const activeRoleIds = new Set(activeTier?.roles.map((role) => role.roleId) ?? []);
  const configuredRoleIds = new Set(pointRoles.map((role) => role.roleId));
  const memberRoleIds = new Set(member.roles.cache.keys());
  const addedRoleIds = [...activeRoleIds].filter((roleId) => !memberRoleIds.has(roleId));
  const removedRoleIds = [...configuredRoleIds].filter(
    (roleId) => !activeRoleIds.has(roleId) && memberRoleIds.has(roleId),
  );
  const namePrefix = getActiveNamePrefix(activeTier);
  const configuredNamePrefixes = pointRoles
    .map((pointRole) => pointRole.namePrefix)
    .filter((prefix): prefix is string => prefix !== undefined);
  const nickname = buildPrefixedNickname(member.displayName, namePrefix, configuredNamePrefixes);
  let nicknameUpdated = false;
  let nicknameUpdateFailed = false;

  try {
    if (removedRoleIds.length > 0) {
      await member.roles.remove(removedRoleIds, "Point role progression update");
    }

    if (addedRoleIds.length > 0) {
      await member.roles.add(addedRoleIds, "Point role progression update");
    }
  } catch (error) {
    logger.warn("Failed to sync point roles.", {
      guildId: member.guild.id,
      robloxUsername,
      discordUserId: member.id,
      error: getErrorMessage(error),
    });

    return {
      status: "failed",
      reason: "I updated the points, but could not update the Discord roles.",
    };
  }

  if (nickname !== null) {
    try {
      await member.setNickname(nickname, "Point role progression name prefix update");
      nicknameUpdated = true;
    } catch (error) {
      nicknameUpdateFailed = true;
      logger.warn("Failed to update point role name prefix.", {
        guildId: member.guild.id,
        robloxUsername,
        discordUserId: member.id,
        error: getErrorMessage(error),
      });
    }
  }

  return {
    status: "updated",
    discordUserId: member.id,
    addedRoleIds,
    removedRoleIds,
    nicknameUpdated,
    nicknameUpdateFailed,
  };
};

export const requireVerifiedRobloxUser = async (
  robloxUsername: string,
): Promise<LinkedRobloxUser> => {
  const linkedUser = await findLinkedRobloxUserByRobloxUsername(robloxUsername);

  if (linkedUser === null) {
    throw new AppError(
      "NOT_FOUND",
      "That Roblox username is not verified. Have the user link their Roblox account with `/link` first.",
      {
        statusCode: 404,
      },
    );
  }

  return linkedUser;
};

export const buildConfiguredRolesEmbed = (
  pointRoles: readonly PointRole[],
  guild: Guild,
): APIEmbed => {
  const tiers = groupPointRolesByThreshold(pointRoles);
  const description =
    tiers.length === 0
      ? "No point roles have been configured yet."
      : tiers
          .map(
            (tier) =>
              `**${String(tier.requiredPoints)} points**: ${tier.roles
                .map((pointRole) => formatPointRole(pointRole, guild))
                .join(", ")}`,
          )
          .join("\n");

  return new EmbedBuilder()
    .setTitle("Configured Point Roles")
    .setDescription(description)
    .setColor(0x2f9e44)
    .toJSON();
};

export const buildProgressEmbed = ({
  pointUser,
  robloxUsername,
  pointRoles,
  guild,
}: ProgressViewData): APIEmbed => {
  const points = pointUser?.points ?? 0;
  const tiers = groupPointRolesByThreshold(pointRoles);
  const activeTier = getActiveTier(tiers, points);
  const nextTier = getNextTier(tiers, points);
  const targetPoints =
    nextTier?.requiredPoints ?? Math.max(activeTier?.requiredPoints ?? points, points);
  const barTarget = Math.max(targetPoints, 1);
  const displayedTargetPoints = tiers.length === 0 ? points : targetPoints;
  const progressBar = buildAsciiProgressBar(points, barTarget);
  const currentRoles =
    activeTier === null
      ? "No unlocked point roles yet."
      : activeTier.roles.map((pointRole) => formatPointRole(pointRole, guild)).join(", ");
  const nextRoles =
    nextTier === null
      ? "Max configured point tier reached."
      : `${String(nextTier.requiredPoints)} points: ${nextTier.roles
          .map((pointRole) => formatPointRole(pointRole, guild))
          .join(", ")}`;

  return new EmbedBuilder()
    .setTitle("Point Progress")
    .setDescription(
      `\`${progressBar}\`\n${String(points)} / ${String(displayedTargetPoints)} points`,
    )
    .addFields(
      {
        name: "Roblox Username",
        value: `\`${pointUser?.robloxUsername ?? robloxUsername}\``,
        inline: true,
      },
      {
        name: "Current Points",
        value: String(points),
        inline: true,
      },
      {
        name: "Current Unlock",
        value: currentRoles,
      },
      {
        name: "Next Unlock",
        value: nextRoles,
      },
    )
    .setColor(nextTier === null && activeTier !== null ? 0x2f9e44 : 0x1c7ed6)
    .toJSON();
};

export const formatPointRoleSyncResult = (result: PointRoleSyncResult): string => {
  if (result.status !== "updated") {
    return `Role sync: ${result.reason}`;
  }

  const changes = [
    result.addedRoleIds.length === 0
      ? null
      : `added ${result.addedRoleIds.map((roleId) => roleMention(roleId)).join(", ")}`,
    result.removedRoleIds.length === 0
      ? null
      : `removed ${result.removedRoleIds.map((roleId) => roleMention(roleId)).join(", ")}`,
  ].filter((change): change is string => change !== null);

  if (changes.length === 0) {
    changes.push("already had the correct point roles");
  }

  if (result.nicknameUpdated) {
    changes.push("updated nickname prefix");
  } else if (result.nicknameUpdateFailed) {
    changes.push("could not update nickname prefix");
  }

  return `Role sync: <@${result.discordUserId}> ${changes.join("; ")}.`;
};

export const formatRoleForResponse = (role: {
  readonly id: string;
  readonly name: string;
}): string => `${roleMention(role.id)} (${role.name})`;

const groupPointRolesByThreshold = (pointRoles: readonly PointRole[]): readonly PointRoleTier[] => {
  const tiersByRequiredPoints = new Map<number, PointRole[]>();

  for (const pointRole of pointRoles) {
    tiersByRequiredPoints.set(pointRole.requiredPoints, [
      ...(tiersByRequiredPoints.get(pointRole.requiredPoints) ?? []),
      pointRole,
    ]);
  }

  return [...tiersByRequiredPoints.entries()]
    .map(([requiredPoints, roles]) => ({
      requiredPoints,
      roles,
    }))
    .sort((left, right) => left.requiredPoints - right.requiredPoints);
};

const getActivePointRoleTier = (
  pointRoles: readonly PointRole[],
  points: number,
): PointRoleTier | null => getActiveTier(groupPointRolesByThreshold(pointRoles), points);

const getActiveTier = (tiers: readonly PointRoleTier[], points: number): PointRoleTier | null =>
  [...tiers].reverse().find((tier) => tier.requiredPoints <= points) ?? null;

const getNextTier = (tiers: readonly PointRoleTier[], points: number): PointRoleTier | null =>
  tiers.find((tier) => tier.requiredPoints > points) ?? null;

const getActiveNamePrefix = (activeTier: PointRoleTier | null): string | null =>
  activeTier?.roles.find((role) => role.namePrefix !== undefined)?.namePrefix ?? null;

const buildPrefixedNickname = (
  displayName: string,
  namePrefix: string | null,
  configuredNamePrefixes: readonly string[],
): string | null => {
  const baseName = stripConfiguredNamePrefixes(displayName, configuredNamePrefixes);
  const targetNickname =
    namePrefix === null ? baseName : `${namePrefix} ${truncateNicknameBase(baseName, namePrefix)}`;

  return targetNickname === displayName ? null : targetNickname;
};

const stripConfiguredNamePrefixes = (
  displayName: string,
  configuredNamePrefixes: readonly string[],
): string => {
  const prefixes = [...configuredNamePrefixes].sort((left, right) => right.length - left.length);
  let name = displayName.trim();
  let strippedPrefix = true;

  while (strippedPrefix) {
    strippedPrefix = false;

    for (const prefix of prefixes) {
      if (name === prefix) {
        name = "";
        strippedPrefix = true;
        break;
      }

      if (name.startsWith(`${prefix} `)) {
        name = name.slice(prefix.length).trimStart();
        strippedPrefix = true;
        break;
      }
    }
  }

  return name.length === 0 ? displayName.trim() : name;
};

const truncateNicknameBase = (baseName: string, namePrefix: string): string => {
  const maxBaseLength = Math.max(1, 32 - namePrefix.length - 1);

  return baseName.length <= maxBaseLength ? baseName : baseName.slice(0, maxBaseLength);
};

const buildAsciiProgressBar = (points: number, targetPoints: number): string => {
  const width = 18;
  const filledWidth = Math.min(width, Math.round((points / targetPoints) * width));

  return `[${"#".repeat(filledWidth)}${"-".repeat(width - filledWidth)}]`;
};

const formatRole = (roleId: string, guild: Guild): string => {
  const role = guild.roles.cache.get(roleId);

  if (role === undefined) {
    return roleMention(roleId);
  }

  return `${roleMention(roleId)} (${role.name})`;
};

const formatPointRole = (pointRole: PointRole, guild: Guild): string => {
  const prefixText =
    pointRole.namePrefix === undefined ? "" : `, prefix \`${pointRole.namePrefix}\``;

  return `${formatRole(pointRole.roleId, guild)}${prefixText}`;
};
