import { useUiStore } from '@/stores/ui'

const TAB_PAGES = new Set([
  '/pages/today/index',
  '/pages/calendar/index',
  '/pages/courses/index',
  '/pages/stats/index',
])

const TAB_INDEX: Record<string, number> = {
  today: 0,
  calendar: 1,
  courses: 2,
  stats: 3,
}

export function setTabCover(covered: boolean) {
  const apply = () => {
    const page = getCurrentPages().slice(-1)[0] as {
      getTabBar?: () => { setData?: (data: { covered: boolean }) => void }
      $vm?: { getTabBar?: () => { setData?: (data: { covered: boolean }) => void } }
    } | undefined
    const bar = page?.getTabBar?.() || page?.$vm?.getTabBar?.()
    bar?.setData?.({ covered })
  }
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
  const app = getApp({ allowDefault: true }) as { globalData?: { tabIndex?: number; tabStamp?: number } }
  app.globalData = app.globalData || {}
  app.globalData.tabIndex = TAB_INDEX[key]
  app.globalData.tabStamp = Date.now()
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
