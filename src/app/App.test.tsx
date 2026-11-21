import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('fundação independente', () => {
  it('renderiza a identidade técnica e responde à interação', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'ATS Loja Digital' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar interface' }))
    expect(screen.getByRole('status')).toHaveTextContent('Interface respondendo.')
  })
})
