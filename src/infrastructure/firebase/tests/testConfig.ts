import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FirebaseEmulatorConfig } from '../emulatorConfig'

export const projectId = 'demo-ats-loja-digital'
export const emulatorConfig: FirebaseEmulatorConfig = {
  mode: 'emulator', projectId, authHost: '127.0.0.1', authPort: 9099,
  firestoreHost: '127.0.0.1', firestorePort: 8180,
}

export function createRulesEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host: emulatorConfig.firestoreHost,
      port: emulatorConfig.firestorePort,
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
    },
  })
}

export const profile = (uid: string, role: string, storeId: string | null, status = 'ACTIVE') => ({
  uid, name: `User ${uid}`, email: `${uid}@example.test`, role, storeId, status,
  createdAt: '2026-09-04T12:00:00.000Z', updatedAt: '2026-09-04T12:00:00.000Z',
})

export const store = (id: string, status = 'ACTIVE') => ({
  id, slug: `store-${id}`, name: `Store ${id}`, status, planId: 'ats-loja-digital',
  billingStatus: 'PENDING', createdAt: '2026-09-04T12:00:00.000Z', updatedAt: '2026-09-04T12:00:00.000Z',
})
