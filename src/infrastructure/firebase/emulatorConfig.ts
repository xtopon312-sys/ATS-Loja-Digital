import type { FirebaseOptions } from 'firebase/app'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

const LOCAL_PROJECT_ID = 'demo-ats-loja-digital'

export interface FirebaseEmulatorConfig {
  mode: 'emulator'
  projectId: typeof LOCAL_PROJECT_ID
  authHost: '127.0.0.1'
  authPort: 9099
  firestoreHost: '127.0.0.1'
  firestorePort: 8180
}

export interface FirebaseEmulatorServices {
  auth: Auth
  firestore: Firestore
  close(): Promise<void>
}

async function requireLocalEndpoint(name: string, url: string): Promise<void> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) })
  } catch (error) {
    throw new Error(`${name} is unavailable at its required local endpoint`, { cause: error })
  }
}

export async function assertFirebaseEmulatorsReachable(config: FirebaseEmulatorConfig): Promise<void> {
  const checked = readEmulatorConfig({
    VITE_FIREBASE_MODE: config.mode, VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_AUTH_HOST: config.authHost, VITE_FIREBASE_AUTH_PORT: String(config.authPort),
    VITE_FIRESTORE_HOST: config.firestoreHost, VITE_FIRESTORE_PORT: String(config.firestorePort),
  })
  await Promise.all([
    requireLocalEndpoint('Firebase Auth Emulator', `http://${checked.authHost}:${checked.authPort}/emulator/v1/projects/${checked.projectId}/config`),
    requireLocalEndpoint('Firestore Emulator', `http://${checked.firestoreHost}:${checked.firestorePort}/`),
  ])
}

function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`Missing required local Firebase setting: ${key}`)
  return value
}

function exactPort(value: string | undefined, expected: number, key: string): number {
  const parsed = Number(required(value, key))
  if (parsed !== expected) throw new Error(`${key} must be ${expected} in the local-only configuration`)
  return parsed
}

export function readEmulatorConfig(env: Readonly<Record<string, string | undefined>>): FirebaseEmulatorConfig {
  const mode = required(env.VITE_FIREBASE_MODE, 'VITE_FIREBASE_MODE')
  const projectId = required(env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID')
  const authHost = required(env.VITE_FIREBASE_AUTH_HOST, 'VITE_FIREBASE_AUTH_HOST')
  const firestoreHost = required(env.VITE_FIRESTORE_HOST, 'VITE_FIRESTORE_HOST')
  if (mode !== 'emulator') throw new Error('Firebase remote mode is forbidden in Phase 3')
  if (projectId !== LOCAL_PROJECT_ID) throw new Error(`Firebase projectId must be ${LOCAL_PROJECT_ID}`)
  if (authHost !== '127.0.0.1' || firestoreHost !== '127.0.0.1') {
    throw new Error('Firebase Emulator hosts must be 127.0.0.1')
  }
  return {
    mode, projectId, authHost, authPort: exactPort(env.VITE_FIREBASE_AUTH_PORT, 9099, 'VITE_FIREBASE_AUTH_PORT'),
    firestoreHost, firestorePort: exactPort(env.VITE_FIRESTORE_PORT, 8180, 'VITE_FIRESTORE_PORT'),
  } as FirebaseEmulatorConfig
}

let appSequence = 0

export function createFirebaseEmulatorServices(config: FirebaseEmulatorConfig): FirebaseEmulatorServices {
  // Recheck a structurally forged config at runtime. There is intentionally no remote branch or fallback.
  const checked = readEmulatorConfig({
    VITE_FIREBASE_MODE: config.mode,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_AUTH_HOST: config.authHost,
    VITE_FIREBASE_AUTH_PORT: String(config.authPort),
    VITE_FIRESTORE_HOST: config.firestoreHost,
    VITE_FIRESTORE_PORT: String(config.firestorePort),
  })
  const options: FirebaseOptions = {
    projectId: checked.projectId,
    apiKey: 'demo-api-key',
    authDomain: `${checked.projectId}.firebaseapp.com`,
    appId: 'demo-ats-loja-digital-local',
  }
  const app = initializeApp(options, `ats-emulator-${++appSequence}`)
  const auth = getAuth(app)
  const firestore = getFirestore(app)
  connectAuthEmulator(auth, `http://${checked.authHost}:${checked.authPort}`, { disableWarnings: true })
  connectFirestoreEmulator(firestore, checked.firestoreHost, checked.firestorePort)
  return { auth, firestore, close: () => deleteApp(app) }
}
