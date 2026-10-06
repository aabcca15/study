import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useThemeStore } from '@/stores/theme'

/** 每个页面根节点挂上 theme-dark，缓存页回来时也同步一次窗口底色和底栏。 */
export function useThemePage() {
  const theme = useThemeStore()
  onShow(() => {
    theme.apply()
  })
  return computed(() => (theme.isDark ? 'theme-dark' : ''))
}
