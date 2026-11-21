import { describe, expect, it } from 'vitest'
import { assertFirebaseEmulatorsReachable, readEmulatorConfig } from '../emulatorConfig'
import { emulatorConfig } from './testConfig'

const valid = {
  VITE_FIREBASE_MODE: 'emulator', VITE_FIREBASE_PROJECT_ID: 'demo-ats-loja-digital',
  VITE_FIREBASE_AUTH_HOST: '127.0.0.1', VITE_FIREBASE_AUTH_PORT: '9099',
  VITE_FIRESTORE_HOST: '127.0.0.1', VITE_FIRESTORE_PORT: '8180',
}

describe('local-only Firebase configuration', () => {
  it('accepts only the documented demo project and localhost ports', () => {
    expect(readEmulatorConfig(valid)).toMatchObject({ mode: 'emulator', projectId: 'demo-ats-loja-digital', authPort: 9099, firestorePort: 8180 })
  })

  it.each([
    ['VITE_FIREBASE_MODE', 'production'], ['VITE_FIREBASE_PROJECT_ID', 'real-project'],
    ['VITE_FIREBASE_AUTH_HOST', 'firebase.googleapis.com'], ['VITE_FIRESTORE_HOST', 'firestore.googleapis.com'],
    ['VITE_FIREBASE_AUTH_PORT', '443'], ['VITE_FIRESTORE_PORT', '443'],
  ])('fails closed when %s is %s', (key, value) => {
    expect(() => readEmulatorConfig({ ...valid, [key]: value })).toThrow()
  })

  it('fails when configuration is absent instead of choosing a default', () => {
    expect(() => readEmulatorConfig({})).toThrow('Missing required local Firebase setting')
  })

  it('proves both required local Emulator endpoints are reachable', async () => {
    await expect(assertFirebaseEmulatorsReachable(emulatorConfig)).resolves.toBeUndefined()
  })
})
