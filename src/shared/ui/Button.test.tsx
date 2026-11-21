import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

describe('Button extraído', () => {
  it('impede ações enquanto está carregando', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Verificar</Button>)
    const button = screen.getByRole('button', { name: 'Carregando…' })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('executa a ação sem submeter um formulário implicitamente', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Verificar</Button>)
    const button = screen.getByRole('button', { name: 'Verificar' })

    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
