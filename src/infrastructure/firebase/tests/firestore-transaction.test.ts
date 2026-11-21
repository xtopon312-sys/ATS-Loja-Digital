import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRulesEnvironment } from './testConfig'

let env: RulesTestEnvironment

beforeAll(async () => { env = await createRulesEnvironment() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'transactionProof', 'stock'), { stock: 1 }))
})
afterAll(async () => { await env.cleanup() })

describe('Firestore Emulator transaction semantics', () => {
  it('detects conflict, retries one callback and never produces negative stock', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      let firstReads = 0
      let releaseFirstReads!: () => void
      const bothRead = new Promise<void>(resolve => { releaseFirstReads = resolve })
      const attempts = { a: 0, b: 0 }

      const confirm = (id: 'a' | 'b') => runTransaction(db, async transaction => {
        attempts[id]++
        const snapshot = await transaction.get(doc(db, 'transactionProof', 'stock'))
        const stock = snapshot.data()?.stock as number
        if (attempts[id] === 1) {
          firstReads++
          if (firstReads === 2) releaseFirstReads()
          await bothRead
        }
        if (stock < 1) throw new Error('INSUFFICIENT_STOCK')
        transaction.update(snapshot.ref, { stock: stock - 1 })
        transaction.set(doc(db, 'transactionProof/stock/confirmations', id), { confirmed: true })
      })

      const results = await Promise.allSettled([confirm('a'), confirm('b')])
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { message: 'INSUFFICIENT_STOCK' } })
      expect(attempts.a + attempts.b).toBeGreaterThanOrEqual(3)
      expect((await getDoc(doc(db, 'transactionProof', 'stock'))).data()?.stock).toBe(0)
      expect((await getDocs(collection(db, 'transactionProof/stock/confirmations'))).size).toBe(1)
    })
  })

  it('commits no partial writes when a transaction callback fails', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      await expect(runTransaction(db, async transaction => {
        const stockRef = doc(db, 'transactionProof', 'stock')
        transaction.update(stockRef, { stock: 0 })
        transaction.set(doc(db, 'transactionProof/stock/confirmations', 'failed'), { confirmed: true })
        throw new Error('injected failure')
      })).rejects.toThrow('injected failure')
      expect((await getDoc(doc(db, 'transactionProof', 'stock'))).data()?.stock).toBe(1)
      expect((await getDocs(collection(db, 'transactionProof/stock/confirmations'))).empty).toBe(true)
    })
  })
})
