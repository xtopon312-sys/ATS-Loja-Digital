import { createContext } from 'react'

import type { StoreThemeId } from '../domain/StoreTheme'

export interface StoreThemeContextValue {
  themeId: StoreThemeId
  setThemeId: (themeId: StoreThemeId) => void
}

export const StoreThemeContext = createContext<StoreThemeContextValue | null>(null)
