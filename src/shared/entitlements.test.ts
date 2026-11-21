import { describe, expect, it } from 'vitest'

import { resolveEntitlements } from './entitlements'

describe('resolveEntitlements', () => {
  it('aplica overrides sem alterar a configuração base', () => {
    const base = { capabilities: { feature: false }, limits: { items: 2 } }
    const result = resolveEntitlements(base, {
      capabilities: { feature: true },
      limits: { items: 4 },
    })

    expect(result).toEqual({ capabilities: { feature: true }, limits: { items: 4 } })
    expect(base.capabilities.feature).toBe(false)
    expect(base.limits.items).toBe(2)
  })
})
