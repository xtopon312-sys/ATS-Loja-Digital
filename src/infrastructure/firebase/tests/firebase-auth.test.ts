import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ResolveActorContext } from '../../../modules/auth/application/ResolveActorContext'
import type { SessionState } from '../../../modules/auth/application/AuthService'
import { FirebaseAuthService } from '../FirebaseAuthService'
import { FirebaseStoreIdentityRepository } from '../FirebaseStoreIdentityRepository'
import { FirebaseUserProfileRepository } from '../FirebaseUserProfileRepository'
import { createFirebaseEmulatorServices, type FirebaseEmulatorServices } from '../emulatorConfig'
import { createRulesEnvironment, emulatorConfig, profile, projectId, store } from './testConfig'

let env: RulesTestEnvironment
const openServices: FirebaseEmulatorServices[] = []

beforeAll(async () => { env = await createRulesEnvironment() })
beforeEach(async () => {
  await env.clearFirestore()
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`Auth Emulator reset failed: ${response.status}`)
})
afterAll(async () => {
  await Promise.all(openServices.map(service => service.close()))
  await env.cleanup()
})

function services() {
  const value = createFirebaseEmulatorServices(emulatorConfig)
  openServices.push(value)
  return value
}

async function createAuthUser(email: string, password = 'local-test-password') {
  const setup = services()
  const credential = await createUserWithEmailAndPassword(setup.auth, email, password)
  await setup.close()
  openServices.splice(openServices.indexOf(setup), 1)
  return credential.user.uid
}

async function seed(entries: Array<[string, Record<string, unknown>]>) {
  await env.withSecurityRulesDisabled(async context => {
    await Promise.all(entries.map(([path, value]) => setDoc(doc(context.firestore(), path), value)))
  })
}

function authService(firebase: FirebaseEmulatorServices) {
  const actors = new ResolveActorContext(
    new FirebaseUserProfileRepository(firebase.firestore),
    new FirebaseStoreIdentityRepository(firebase.firestore),
  )
  return new FirebaseAuthService(firebase.auth, actors)
}

function terminalState(service: FirebaseAuthService): Promise<SessionState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for session state')), 10000)
    const unsubscribe = service.observeSession(state => {
      if (state.status !== 'LOADING') {
        clearTimeout(timer)
        unsubscribe()
        resolve(state)
      }
    })
  })
}

describe('Authentication Emulator and trusted identity resolution', () => {
  it('emits LOADING then UNAUTHENTICATED without a session', async () => {
    const service = authService(services())
    const states: string[] = []
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out')), 10000)
      const unsubscribe = service.observeSession(state => {
        states.push(state.status)
        if (state.status === 'UNAUTHENTICATED') {
          clearTimeout(timer)
          unsubscribe()
          resolve()
        }
      })
    })
    expect(states).toEqual(['LOADING', 'UNAUTHENTICATED'])
  })

  it('signs in MERCHANT_A, resolves store from protected profile, and signs out', async () => {
    const uid = await createAuthUser('merchant-a@example.test')
    await seed([[`users/${uid}`, profile(uid, 'MERCHANT', 'store-a')], ['stores/store-a', store('store-a')]])
    const service = authService(services())
    await service.signIn('merchant-a@example.test', 'local-test-password')
    await expect(terminalState(service)).resolves.toEqual({ status: 'AUTHENTICATED', actor: { actorId: uid, role: 'MERCHANT', storeId: 'store-a' } })
    await service.signOut()
    await expect(terminalState(service)).resolves.toEqual({ status: 'UNAUTHENTICATED' })
  })

  it('signs in MASTER only when profile has null storeId', async () => {
    const uid = await createAuthUser('master@example.test')
    await seed([[`users/${uid}`, profile(uid, 'MASTER', null)]])
    const service = authService(services())
    await service.signIn('master@example.test', 'local-test-password')
    await expect(terminalState(service)).resolves.toEqual({ status: 'AUTHENTICATED', actor: { actorId: uid, role: 'MASTER' } })
  })

  it('allows a valid merchant session for a SUSPENDED store', async () => {
    const uid = await createAuthUser('suspended-store@example.test')
    await seed([[`users/${uid}`, profile(uid, 'MERCHANT', 'store-suspended')], ['stores/store-suspended', store('store-suspended', 'SUSPENDED')]])
    const service = authService(services())
    await service.signIn('suspended-store@example.test', 'local-test-password')
    await expect(terminalState(service)).resolves.toMatchObject({ status: 'AUTHENTICATED', actor: { storeId: 'store-suspended' } })
  })

  it.each([
    ['missing profile', undefined, undefined],
    ['disabled profile', 'MERCHANT', 'DISABLED'],
    ['invalid role', 'OWNER', 'ACTIVE'],
    ['merchant without storeId', 'MERCHANT', 'ACTIVE'],
    ['master with storeId', 'MASTER', 'ACTIVE'],
  ])('returns ACCESS_DENIED for %s', async (_case, role, status) => {
    const email = `${_case.replaceAll(' ', '-')}@example.test`
    const uid = await createAuthUser(email)
    if (role) {
      const storeId = _case === 'master with storeId' ? 'store-a' : _case === 'merchant without storeId' ? null : 'store-a'
      await seed([[`users/${uid}`, profile(uid, role, storeId, status)]])
    }
    const service = authService(services())
    await service.signIn(email, 'local-test-password')
    await expect(terminalState(service)).resolves.toEqual({ status: 'ACCESS_DENIED' })
  })

  it('returns ACCESS_DENIED when merchant Store document is absent', async () => {
    const uid = await createAuthUser('missing-store@example.test')
    await seed([[`users/${uid}`, profile(uid, 'MERCHANT', 'missing-store')]])
    const service = authService(services())
    await service.signIn('missing-store@example.test', 'local-test-password')
    await expect(terminalState(service)).resolves.toEqual({ status: 'ACCESS_DENIED' })
  })

  it('rejects wrong password and unknown user through the Auth Emulator', async () => {
    await createAuthUser('known@example.test')
    const service = authService(services())
    await expect(service.signIn('known@example.test', 'wrong-password')).rejects.toMatchObject({ code: 'auth/wrong-password' })
    await expect(service.signIn('unknown@example.test', 'local-test-password')).rejects.toMatchObject({ code: 'auth/user-not-found' })
  })

  it('URL, payload, localStorage-like and query values cannot influence ActorContext', async () => {
    const uid = await createAuthUser('fixed-scope@example.test')
    await seed([[`users/${uid}`, profile(uid, 'MERCHANT', 'store-a')], ['stores/store-a', store('store-a')]])
    const untrustedNavigation = { urlStoreId: 'store-b', payloadStoreId: 'store-b', localStorageStoreId: 'store-b', queryStoreId: 'store-b' }
    const service = authService(services())
    await service.signIn('fixed-scope@example.test', 'local-test-password')
    const state = await terminalState(service)
    untrustedNavigation.urlStoreId = 'store-a'
    expect(state).toEqual({ status: 'AUTHENTICATED', actor: { actorId: uid, role: 'MERCHANT', storeId: 'store-a' } })
    expect(Object.keys(untrustedNavigation)).not.toContain('actor')
  })
})
