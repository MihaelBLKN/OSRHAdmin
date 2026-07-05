import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { z } from "zod";

import { env } from "../config/env";
import { AppError } from "../lib/errors";

const serviceAccountSchema = z.looseObject({
  project_id: z.string().min(1),
  client_email: z.email(),
  private_key: z.string().min(1),
});

const parseServiceAccountBase64 = (encodedServiceAccount: string): ServiceAccount => {
  try {
    const decoded = Buffer.from(encodedServiceAccount, "base64").toString("utf8");
    const parsedJson: unknown = JSON.parse(decoded);
    const serviceAccount = serviceAccountSchema.parse(parsedJson);

    return {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    };
  } catch (error) {
    throw new AppError("CONFIG_ERROR", "Invalid FIREBASE_SERVICE_ACCOUNT_BASE64.", {
      cause: error,
    });
  }
};

const initializeFirebaseApp = (): App => {
  const existingApp = getApps()[0];

  if (existingApp !== undefined) {
    return existingApp;
  }

  const credential =
    env.FIREBASE_SERVICE_ACCOUNT_BASE64 !== undefined
      ? cert(parseServiceAccountBase64(env.FIREBASE_SERVICE_ACCOUNT_BASE64))
      : applicationDefault();

  return initializeApp({
    credential,
    databaseURL: env.FIREBASE_DATABASE_URL,
    ...(env.FIREBASE_PROJECT_ID === undefined ? {} : { projectId: env.FIREBASE_PROJECT_ID }),
  });
};

export const firebaseApp = initializeFirebaseApp();

export const realtimeDatabase: Database = getDatabase(firebaseApp);
