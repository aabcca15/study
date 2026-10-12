import { defineStore } from 'pinia'
import { setMixBase } from '@/utils/color'

export type ThemeMode = 'light' | 'dark'

export const THEME_KEY = 'myhome.mp.theme'

export function hasThemeStore() {
  const app = getApp({ allowDefault: true }) as { globalData?: { hasThemeStore?: boolean } }
  app.globalData = app.globalData || {}
  app.globalData.hasThemeStore = true
  return true
}

const LIGHT = {
  bg: '#f3f4fb',
  paper: '#ffffff',
}

const DARK = {
  bg: '#10131b',
  paper: '#1c2230',
}

function readMode(): ThemeMode {
  const saved = uni.getStorageSync(THEME_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

type TabBarInstance = { syncState?: () => void }

/** getCurrentPages 不含已缓存的其它 tab 页，所以底栏自己在 globalData.tabBars 里登记。 */
function paintTabBars() {
  const app = getApp({ allowDefault: true }) as { globalData?: { tabBars?: TabBarInstance[] } }
  app.globalData?.tabBars?.forEach((bar) => bar.syncState?.())
}

/**
 * 换肤后，后台缓存的 tab 页切回来时会先露出旧主题的画面。
 * 记一个标记，下一次切 tab 用 reLaunch 重建页面，新页面首帧就是新主题。
 */
function markCachedPagesStale() {
  const app = getApp({ allowDefault: true }) as { globalData?: { themeStale?: boolean } }
  app.globalData = app.globalData || {}
  app.globalData.themeStale = true
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: readMode() as ThemeMode,
  }),
  getters: {
    isDark: (state) => state.mode === 'dark',
    colors(): { bg: string; paper: string } {
      return this.isDark ? DARK : LIGHT
    },
  },
  actions: {
    apply() {
      const app = getApp({ allowDefault: true }) as { globalData?: { theme?: ThemeMode } }
      app.globalData = app.globalData || {}
      app.globalData.theme = this.mode
      setMixBase(this.colors.paper, this.isDark)
      const { bg } = this.colors
      uni.setBackgroundColor({
        backgroundColor: bg,
        backgroundColorTop: bg,
        backgroundColorBottom: bg,
      })
      uni.setBackgroundTextStyle({
        textStyle: this.isDark ? 'light' : 'dark',
      })
      paintTabBars()
    },
    toggle() {
      this.mode = this.isDark ? 'light' : 'dark'
      uni.setStorageSync(THEME_KEY, this.mode)
      markCachedPagesStale()
      this.apply()
    },
  },
})

export default useThemeStore
