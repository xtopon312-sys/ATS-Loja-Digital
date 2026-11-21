import { STORE_THEME_IDS, STORE_THEME_PRESETS, type StoreThemeId, type StoreThemePreset } from '../domain/StoreTheme'

export const DEFAULT_STORE_THEME: StoreThemeId = 'clean'

export function isStoreThemeId(value: unknown): value is StoreThemeId {
  return typeof value === 'string' && STORE_THEME_IDS.some((themeId) => themeId === value)
}

export function resolveStoreTheme(value: unknown): StoreThemePreset {
  return STORE_THEME_PRESETS[isStoreThemeId(value) ? value : DEFAULT_STORE_THEME]
}

export function getStoreThemeAttributes(value: unknown) {
  const theme = resolveStoreTheme(value)
  return {
    'data-store-theme': theme.id,
    'data-store-density': theme.density,
    'data-store-typography': theme.typography,
  } as const
}
