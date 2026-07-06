import { z } from "zod";

import { AppError } from "../lib/errors";

const robloxUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/, "Roblox usernames can only contain letters, numbers, and underscores.");

const robloxUserLookupResponseSchema = z
  .object({
    data: z.array(
      z.object({
        id: z.number().int().positive(),
        name: robloxUsernameSchema,
        displayName: z.string(),
        requestedUsername: z.string().optional(),
      }),
    ),
  });

const robloxUserProfileSchema = z
  .object({
    id: z.number().int().positive(),
    name: robloxUsernameSchema,
    displayName: z.string(),
    description: z.string(),
    created: z.string(),
    isBanned: z.boolean(),
    externalAppDisplayName: z.string().nullable().optional(),
    hasVerifiedBadge: z.boolean().optional(),
  });

export type RobloxUserIdentity = {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
};

export type RobloxUserProfile = RobloxUserIdentity & {
  readonly description: string;
  readonly isBanned: boolean;
};

export const findRobloxUserByUsername = async (
  username: string,
): Promise<RobloxUserIdentity | null> => {
  const parsedUsername = parseRobloxUsername(username);
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      usernames: [parsedUsername],
      excludeBannedUsers: true,
    }),
  });

  const parsedResponse = await parseRobloxResponse(
    response,
    robloxUserLookupResponseSchema,
    "Roblox username lookup",
  );
  const matchedUser = parsedResponse.data[0];

  if (matchedUser === undefined) {
    return null;
  }

  return {
    id: String(matchedUser.id),
    username: matchedUser.name,
    displayName: matchedUser.displayName,
  };
};

export const getRobloxUserProfile = async (userId: string): Promise<RobloxUserProfile> => {
  if (!/^\d+$/.test(userId)) {
    throw new AppError("VALIDATION_ERROR", "Invalid Roblox user ID.", {
      statusCode: 400,
    });
  }

  const response = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const parsedProfile = await parseRobloxResponse(
    response,
    robloxUserProfileSchema,
    "Roblox user profile",
  );

  return {
    id: String(parsedProfile.id),
    username: parsedProfile.name,
    displayName: parsedProfile.displayName,
    description: parsedProfile.description,
    isBanned: parsedProfile.isBanned,
  };
};

const parseRobloxUsername = (username: string): string => {
  const result = robloxUsernameSchema.safeParse(username);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid Roblox username.", {
      cause: result.error,
      statusCode: 400,
    });
  }

  return result.data;
};

const parseRobloxResponse = async <TData>(
  response: Response,
  schema: z.ZodType<TData>,
  context: string,
): Promise<TData> => {
  if (!response.ok) {
    throw new AppError(
      "UNKNOWN_ERROR",
      `${context} failed with status ${String(response.status)}.`,
      {
        statusCode: response.status >= 500 ? 500 : 400,
      },
    );
  }

  const value: unknown = await response.json();
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", `${context} returned an unexpected response.`, {
      cause: result.error,
      statusCode: 500,
    });
  }

  return result.data;
};
