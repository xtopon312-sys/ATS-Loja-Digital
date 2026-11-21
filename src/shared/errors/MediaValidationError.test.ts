import { describe, expect, it } from 'vitest'

import { MediaValidationError } from './MediaValidationError'

describe('MediaValidationError', () => {
  it('preserva os detalhes necessários para apresentar uma falha', () => {
    const issues = [{ code: 'empty-file' as const, message: 'Arquivo vazio.' }]
    const error = new MediaValidationError(issues)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('MediaValidationError')
    expect(error.message).toBe('Arquivo vazio.')
    expect(error.issues).toEqual(issues)
  })

  it('oferece mensagem quando não existem detalhes', () => {
    expect(new MediaValidationError([]).message).toBe('Não foi possível validar o arquivo de mídia.')
  })
})
