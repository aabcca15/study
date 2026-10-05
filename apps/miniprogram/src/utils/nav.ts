import { useUiStore } from '@/stores/ui'

const TAB_PAGES = new Set([
  '/pages/today/index',
  '/pages/calendar/index',
  '/pages/courses/index',
  '/pages/stats/index',
])

export function openTab(url: string) {
  const path = url.split('?')[0]
  const ui = useUiStore()
  if (path.includes('/calendar/')) ui.tab = 'calendar'
  else if (path.includes('/courses/')) ui.tab = 'courses'
  else if (path.includes('/stats/')) ui.tab = 'stats'
  else if (path.includes('/today/')) ui.tab = 'today'
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
