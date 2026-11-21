import { useMemo, useState, type PropsWithChildren } from 'react'

import { DEFAULT_STORE_THEME, getStoreThemeAttributes } from '../application/StoreThemeEngine'
import type { StoreThemeId } from '../domain/StoreTheme'
import { StoreThemeContext } from './storeThemeContext'

export function StoreThemeProvider({ children, initialTheme = DEFAULT_STORE_THEME }: PropsWithChildren<{ initialTheme?: StoreThemeId }>) {
  const [themeId, setThemeId] = useState(initialTheme)
  const value = useMemo(() => ({ themeId, setThemeId }), [themeId])

  return (
    <StoreThemeContext.Provider value={value}>
      <div className="store-theme" {...getStoreThemeAttributes(themeId)}>
        {children}
      </div>
    </StoreThemeContext.Provider>
  )
}
