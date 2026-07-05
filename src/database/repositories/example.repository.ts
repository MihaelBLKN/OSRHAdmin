import { dbPaths } from "../paths";
import {
  readDatabaseValue,
  serverTimestamp,
  setDatabaseValue,
  updateDatabaseValue,
} from "../realtime-db";
import {
  exampleRecordInputSchema,
  exampleRecordSchema,
  exampleRecordUpdateInputSchema,
  exampleRecordUpdateWriteSchema,
  exampleRecordWriteSchema,
  parseDatabaseData,
} from "../schemas";
import type { ExampleRecord, ExampleRecordInput, ExampleRecordUpdateInput } from "../types";

export const getExampleRecord = async (exampleId: string): Promise<ExampleRecord | null> => {
  const path = dbPaths.exampleRecord(exampleId);
  const value = await readDatabaseValue(path);

  if (value === null) {
    return null;
  }

  return parseDatabaseData(exampleRecordSchema, value, "Example record");
};

export const upsertExampleRecord = async (
  exampleId: string,
  input: ExampleRecordInput,
): Promise<ExampleRecord> => {
  const path = dbPaths.exampleRecord(exampleId);
  const existingRecord = await getExampleRecord(exampleId);
  const parsedInput = parseDatabaseData(exampleRecordInputSchema, input, "Example record input");

  const writeData = parseDatabaseData(
    exampleRecordWriteSchema,
    {
      id: exampleId,
      ...parsedInput,
      createdAt: existingRecord?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    "Example record write",
  );

  await setDatabaseValue(path, writeData);

  return parseDatabaseData(
    exampleRecordSchema,
    await readDatabaseValue(path),
    "Saved example record",
  );
};

export const updateExampleRecord = async (
  exampleId: string,
  input: ExampleRecordUpdateInput,
): Promise<ExampleRecord> => {
  const parsedInput = parseDatabaseData(
    exampleRecordUpdateInputSchema,
    input,
    "Example record update input",
  );
  const updateData = parseDatabaseData(
    exampleRecordUpdateWriteSchema,
    {
      ...parsedInput,
      updatedAt: serverTimestamp(),
    },
    "Example record update",
  );

  await updateDatabaseValue(dbPaths.exampleRecord(exampleId), updateData);

  return parseDatabaseData(
    exampleRecordSchema,
    await readDatabaseValue(dbPaths.exampleRecord(exampleId)),
    "Updated example record",
  );
};
