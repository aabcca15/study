import { hasThemeStore, useThemeStore as themeStoreNamed } from '@/stores/theme'
import themeStoreDefault from '@/stores/theme'
import { hasThemePage, useThemePage as themePageNamed } from '@/composables/useThemePage'
import themePageDefault from '@/composables/useThemePage'
import { pickFn } from '@/utils/wx-export'

export function useThemeStore() {
  hasThemeStore()
  return pickFn<typeof themeStoreNamed>(themeStoreNamed, themeStoreDefault, 'useThemeStore')()
}

export function useThemePage() {
  hasThemePage()
  return pickFn<typeof themePageNamed>(themePageNamed, themePageDefault, 'useThemePage')()
}
