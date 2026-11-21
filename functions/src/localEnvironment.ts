export function assertLocalEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.FUNCTIONS_EMULATOR !== 'true' || env.GCLOUD_PROJECT !== 'demo-ats-loja-digital'
    || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180' || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
    throw new Error('Privileged commands require the local ATS Emulator Suite')
  }
}
