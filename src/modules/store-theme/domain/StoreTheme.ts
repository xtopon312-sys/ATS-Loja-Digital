export const STORE_THEME_IDS = ['clean', 'premium', 'dark', 'playful', 'classic', 'bold'] as const

export type StoreThemeId = (typeof STORE_THEME_IDS)[number]

export interface StoreThemePreset {
  id: StoreThemeId
  name: string
  description: string
  density: 'comfortable' | 'compact' | 'spacious'
  typography: 'sans' | 'serif'
}

export const STORE_THEME_PRESETS: Readonly<Record<StoreThemeId, StoreThemePreset>> = {
  clean: { id: 'clean', name: 'Clean', description: 'Claro, direto e versátil.', density: 'comfortable', typography: 'sans' },
  premium: { id: 'premium', name: 'Premium', description: 'Editorial e sofisticado.', density: 'spacious', typography: 'serif' },
  dark: { id: 'dark', name: 'Dark', description: 'Imersivo, contrastado e noturno.', density: 'compact', typography: 'sans' },
  playful: { id: 'playful', name: 'Playful', description: 'Colorido, gentil e arredondado.', density: 'spacious', typography: 'sans' },
  classic: { id: 'classic', name: 'Classic', description: 'Atemporal, sóbrio e artesanal.', density: 'comfortable', typography: 'serif' },
  bold: { id: 'bold', name: 'Bold', description: 'Enérgico, forte e promocional.', density: 'compact', typography: 'sans' },
}
