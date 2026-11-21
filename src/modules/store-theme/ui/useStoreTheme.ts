import { useContext } from 'react'

import { StoreThemeContext } from './storeThemeContext'

export function useStoreTheme() {
  const context = useContext(StoreThemeContext)
  if (!context) throw new Error('useStoreTheme deve ser usado dentro de StoreThemeProvider.')
  return context
}
