import { assertFirebaseEmulatorsReachable, createFirebaseEmulatorServices, readEmulatorConfig } from './emulatorConfig'

/** UI composition root. Importing this file performs no connection by itself. */
export async function createServicesFromImportMetaEnvironment() {
  const env: Record<string, string | undefined> = {
    VITE_FIREBASE_MODE: import.meta.env.VITE_FIREBASE_MODE,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_AUTH_HOST: import.meta.env.VITE_FIREBASE_AUTH_HOST,
    VITE_FIREBASE_AUTH_PORT: import.meta.env.VITE_FIREBASE_AUTH_PORT,
    VITE_FIRESTORE_HOST: import.meta.env.VITE_FIRESTORE_HOST,
    VITE_FIRESTORE_PORT: import.meta.env.VITE_FIRESTORE_PORT,
  }
  const config = readEmulatorConfig(env)
  await assertFirebaseEmulatorsReachable(config)
  return createFirebaseEmulatorServices(config)
}
