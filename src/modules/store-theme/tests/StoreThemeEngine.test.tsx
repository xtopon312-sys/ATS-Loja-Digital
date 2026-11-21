import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getStoreThemeAttributes, resolveStoreTheme } from '../application/StoreThemeEngine'
import { StoreThemeProvider } from '../ui/StoreThemeProvider'
import { useStoreTheme } from '../ui/useStoreTheme'

function ThemeProbe() {
  const { themeId, setThemeId } = useStoreTheme()
  return <button onClick={() => setThemeId('dark')}>Tema {themeId}</button>
}

describe('Store Theme Engine', () => {
  it('aceita somente presets da whitelist e aplica fallback determinístico', () => {
    expect(resolveStoreTheme('premium').id).toBe('premium')
    expect(resolveStoreTheme('<style>body{display:none}</style>').id).toBe('clean')
    expect(getStoreThemeAttributes('bold')['data-store-density']).toBe('compact')
  })

  it('troca apenas atributos de marca no mesmo contêiner estrutural', () => {
    const { container } = render(<StoreThemeProvider><ThemeProbe /></StoreThemeProvider>)
    const themeRoot = container.querySelector('.store-theme')
    expect(themeRoot).toHaveAttribute('data-store-theme', 'clean')
    fireEvent.click(screen.getByRole('button', { name: 'Tema clean' }))
    expect(themeRoot).toHaveAttribute('data-store-theme', 'dark')
    expect(themeRoot).toHaveClass('store-theme')
  })
})
