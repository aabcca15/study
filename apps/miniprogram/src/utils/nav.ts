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
  if (!TAB_PAGES.has(path)) {
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
