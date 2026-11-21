import { describe, expect, it } from 'vitest'

import { transitionFor } from './presets'

describe('preferência de movimento reduzido', () => {
  it('remove duração quando a pessoa solicita menos movimento', () => {
    expect(transitionFor(true, 'slow')).toEqual({ duration: 0 })
    expect(transitionFor(false, 'slow')).toMatchObject({ duration: 0.42 })
  })
})
