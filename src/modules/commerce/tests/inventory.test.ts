import { describe, expect, it } from 'vitest'
import { fixture, merchant, product } from './fixtures'

const entry = { storeId: 'a', productId: 'p', type: 'MANUAL_ENTRY' as const, quantity: 2, reason: 'Count correction', idempotencyKey: 'adjust-1' }

describe('manual inventory', () => {
  it('records manual entry and exit with actor, reason and before/after balances', async () => {
    const f = fixture()
    expect(await f.adjust.execute(merchant, entry)).toMatchObject({ type: 'MANUAL_ENTRY', quantity: 2, previousStock: 5, newStock: 7, createdBy: merchant.actorId, reason: entry.reason })
    expect(await f.adjust.execute(merchant, { ...entry, type: 'MANUAL_EXIT', quantity: 3, idempotencyKey: 'exit' })).toMatchObject({ previousStock: 7, newStock: 4 })
    expect((await f.readProduct())?.stock).toBe(4)
    expect(await f.movements()).toHaveLength(2)
  })
  it('rejects insufficient manual exit without writes', async () => {
    const f = fixture()
    await expect(f.adjust.execute(merchant, { ...entry, type: 'MANUAL_EXIT', quantity: 6 })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    expect((await f.readProduct())?.stock).toBe(5)
    expect(await f.movements()).toEqual([])
  })
  it.each([0, -1, 0.5, Infinity])('rejects invalid adjustment quantity %s', async quantity => {
    await expect(async () => fixture().adjust.execute(merchant, { ...entry, quantity })).rejects.toMatchObject({ code: 'INVALID_QUANTITY' })
  })
  it('requires a reason', async () => {
    await expect(async () => fixture().adjust.execute(merchant, { ...entry, reason: ' ' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('adjustment retries are idempotent and conflicting intent is rejected', async () => {
    const f = fixture()
    const [a, b] = await Promise.all([f.adjust.execute(merchant, entry), f.adjust.execute(merchant, entry)])
    expect(a.id).toBe(b.id)
    expect((await f.readProduct())?.stock).toBe(7)
    expect(await f.movements()).toHaveLength(1)
    await expect(f.adjust.execute(merchant, { ...entry, quantity: 3 })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('concurrent manual exits cannot make stock negative', async () => {
    const f = fixture([product('p', 1)])
    const results = await Promise.allSettled(['a', 'b'].map(idempotencyKey => f.adjust.execute(merchant, { ...entry, type: 'MANUAL_EXIT', quantity: 1, idempotencyKey })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await f.readProduct())?.stock).toBe(0)
    expect(await f.movements()).toHaveLength(1)
  })
  it('rejects safe integer overflow without writes', async () => {
    const f = fixture([product('p', Number.MAX_SAFE_INTEGER)])
    await expect(f.adjust.execute(merchant, entry)).rejects.toMatchObject({ code: 'INVALID_STOCK' })
    expect((await f.readProduct())?.stock).toBe(Number.MAX_SAFE_INTEGER)
  })
})
