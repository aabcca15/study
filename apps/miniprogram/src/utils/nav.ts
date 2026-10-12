import { useUiStore } from '@/stores/ui'

const TAB_PAGES = new Set([
  '/pages/today/index',
  '/pages/calendar/index',
  '/pages/courses/index',
  '/pages/stats/index',
])

type TabBarHandle = {
  own?: (index: number) => void
  setData?: (data: { covered?: boolean }) => void
}

function ownTabBar(route: string): TabBarHandle | undefined {
  const page = getCurrentPages().find((item) => item.route === route) as {
    getTabBar?: () => TabBarHandle
    $vm?: { getTabBar?: () => TabBarHandle }
  } | undefined
  return page?.getTabBar?.() || page?.$vm?.getTabBar?.()
}

/** 只告诉当前页面自己的那份底栏：它属于第几个 tab。 */
export function syncVisibleTab(index: number) {
  const route = getCurrentPages().slice(-1)[0]?.route
  if (!route) return
  const apply = () => {
    if (getCurrentPages().slice(-1)[0]?.route !== route) return
    ownTabBar(route)?.own?.(index)
  }
  apply()
  setTimeout(() => {
    const bar = ownTabBar(route) as { owner?: number } | undefined
    if (bar && bar.owner !== index) apply()
  }, 60)
}

export function setTabCover(covered: boolean) {
  const route = getCurrentPages().slice(-1)[0]?.route
  if (!route) return
  const apply = () => ownTabBar(route)?.setData?.({ covered })
  apply()
  setTimeout(apply, 30)
}

/** 换肤后第一次离开当前页：取走标记，调用方改用 reLaunch 丢掉旧主题的缓存页。 */
export function takeThemeStale() {
  const app = getApp({ allowDefault: true }) as { globalData?: { themeStale?: boolean } }
  if (!app.globalData?.themeStale) return false
  app.globalData.themeStale = false
  return true
}

/** 返回上一页；换过肤时上一页是旧主题的缓存画面，直接按新主题重建它。 */
export function goBack() {
  const pages = getCurrentPages()
  if (pages.length <= 1) {
    openTab('/pages/today/index')
    return
  }
  if (!takeThemeStale()) {
    uni.navigateBack()
    return
  }
  const prev = pages[pages.length - 2] as { route?: string; options?: Record<string, string> }
  const query = Object.entries(prev.options || {})
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  uni.reLaunch({ url: `/${prev.route}${query ? `?${query}` : ''}` })
}

export function openTab(url: string) {
  const path = url.split('?')[0]
  const ui = useUiStore()
  let key = 'today'
  if (path.includes('/calendar/')) key = 'calendar'
  else if (path.includes('/courses/')) key = 'courses'
  else if (path.includes('/stats/')) key = 'stats'
  else if (path.includes('/today/')) key = 'today'
  ui.tab = key as 'today' | 'calendar' | 'courses' | 'stats'
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]?.route
  if (current && `/${current}` === path) return
  if (!TAB_PAGES.has(path) || takeThemeStale()) {
    uni.reLaunch({ url: path })
    return
  }
  uni.switchTab({
    url: path,
    fail() {
      uni.reLaunch({ url: path })
    },
  })
}
