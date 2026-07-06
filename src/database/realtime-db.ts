import { ServerValue } from "firebase-admin/database";

import { AppError } from "../lib/errors";
import { realtimeDatabase } from "./firebase-admin";

type DatabaseUpdatePayload = Record<string, unknown>;
type DatabaseReadValue =
  | string
  | number
  | boolean
  | readonly DatabaseReadValue[]
  | { readonly [key: string]: DatabaseReadValue | null };

export const serverTimestamp = (): typeof ServerValue.TIMESTAMP => ServerValue.TIMESTAMP;

export const readDatabaseValue = async (path: string): Promise<DatabaseReadValue | null> => {
  try {
    const snapshot = await realtimeDatabase.ref(path).get();
    return snapshot.exists() ? (snapshot.val() as DatabaseReadValue) : null;
  } catch (error) {
    throw new AppError("DATABASE_ERROR", `Failed to read database path "${path}".`, {
      cause: error,
    });
  }
};

export const setDatabaseValue = async (path: string, value: unknown): Promise<void> => {
  try {
    await realtimeDatabase.ref(path).set(value);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", `Failed to write database path "${path}".`, {
      cause: error,
    });
  }
};

export const updateDatabaseValue = async (
  path: string,
  value: DatabaseUpdatePayload,
): Promise<void> => {
  try {
    await realtimeDatabase.ref(path).update(value);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", `Failed to update database path "${path}".`, {
      cause: error,
    });
  }
};

export const removeDatabaseValue = async (path: string): Promise<void> => {
  try {
    await realtimeDatabase.ref(path).remove();
  } catch (error) {
    throw new AppError("DATABASE_ERROR", `Failed to remove database path "${path}".`, {
      cause: error,
    });
  }
};

export const runDatabaseTransaction = async <TValue>(
  path: string,
  update: (currentValue: unknown) => TValue,
): Promise<TValue | null> => {
  try {
    const result = await realtimeDatabase
      .ref(path)
      .transaction((currentValue) => update(currentValue));
    return result.snapshot.exists() ? (result.snapshot.val() as TValue) : null;
  } catch (error) {
    throw new AppError("DATABASE_ERROR", `Failed to run transaction for "${path}".`, {
      cause: error,
    });
  }
};
