import { computed, getCurrentInstance, nextTick, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useThemeStore as themeStoreNamed } from '@/stores/theme'
import themeStoreDefault from '@/stores/theme'
import { pickFn } from '@/utils/wx-export'
import { revealTabBar } from '@/utils/nav'

export function hasThemePage() {
  const app = getApp({ allowDefault: true }) as { globalData?: { hasThemePage?: boolean } }
  app.globalData = app.globalData || {}
  app.globalData.hasThemePage = true
  return true
}

/** 每个页面根节点挂上 theme-dark，缓存页回来时也同步一次窗口底色和底栏。 */
export function useThemePage() {
  const useThemeStore = pickFn<typeof themeStoreNamed>(
    themeStoreNamed,
    themeStoreDefault,
    'useThemeStore',
  )
  const theme = useThemeStore()
  const proxy = getCurrentInstance()?.proxy as { $scope?: { getTabBar?: () => { reveal?: () => void } } } | undefined
  onShow(() => {
    theme.apply()
  })
  // uni 的 nextTick 在 setData 回调里执行：此时页面已带着主题完成首屏渲染。
  onMounted(() => nextTick(() => revealTabBar(proxy?.$scope)))
  return computed(() => (theme.isDark ? 'theme-dark' : ''))
}

export default useThemePage
