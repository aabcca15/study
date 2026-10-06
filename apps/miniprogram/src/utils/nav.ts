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

type TabBarHandle = {
  showTab?: (index: number, animate?: boolean) => void
  setData?: (data: { selected?: number; covered?: boolean }) => void
}

function tabBars(): TabBarHandle[] {
  return getCurrentPages().flatMap((page) => {
    const raw = page as {
      getTabBar?: () => TabBarHandle
      $vm?: { getTabBar?: () => TabBarHandle }
    }
    const bar = raw.getTabBar?.() || raw.$vm?.getTabBar?.()
    return bar ? [bar] : []
  })
}

/** 微信会缓存每个 tab 页，底栏也各有一份。切换时要把已经打开过的每一份都写成同一个下标。 */
export function syncVisibleTab(index: number) {
  const app = getApp({ allowDefault: true }) as {
    globalData?: { tabIndex?: number; tabStamp?: number; tabBars?: TabBarHandle[] }
  }
  app.globalData = app.globalData || {}
  const stamp = Date.now()
  app.globalData.tabIndex = index
  app.globalData.tabStamp = stamp
  const paint = () => {
    if (app.globalData?.tabStamp !== stamp || app.globalData.tabIndex !== index) return
    const bars = [...(app.globalData.tabBars || []), ...tabBars()]
    bars.forEach((bar) => {
      if (bar.showTab) bar.showTab(index, false)
      else bar.setData?.({ selected: index })
    })
  }
  paint()
  setTimeout(paint, 50)
  setTimeout(paint, 320)
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
  syncVisibleTab(TAB_INDEX[key])
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
