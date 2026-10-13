import { onShow } from '@dcloudio/uni-app'
import { showCloudError } from '@/cloud/call'
import { isMomentsPreview } from '@/utils/share'
import { promptLogin } from '@/utils/login-gate'
import { openTab } from '@/utils/nav'
import { hasLocalSession, useFamilyStore } from '@/stores/family'
import { useThemeStore } from '@/utils/wx-theme'
import { useUiStore } from '@/stores/ui'

/**
 * tab 页由微信缓存，切换时不重建；所有页面共用一份 store 快照，
 * 任一页写入后其他页自动跟着更新。显示时只在数据过期或跨月时补拉一次。
 * browse：今日、日历、课程允许未登录先看。其它页面会询问是否去登录。
 */
export function useFamilyPage(options: { refresh?: boolean; browse?: boolean } = {}) {
  const store = useFamilyStore()
  const ui = useUiStore()
  const theme = useThemeStore()
  const refresh = options.refresh !== false
  const browse = options.browse === true

  onShow(() => {
    theme.apply()
    if (isMomentsPreview()) return
    if (store.ready) {
      ui.touchToday()
      if (!refresh) return
      store.refreshIfStale().catch((error) => showCloudError(error))
      return
    }
    if (hasLocalSession()) {
      ensureSession().then(() => {
        if (!store.ready) {
          if (!browse) leaveForLogin()
          return
        }
        ui.touchToday()
        if (refresh) store.refreshIfStale().catch((error) => showCloudError(error))
      })
      return
    }
    if (!browse) leaveForLogin()
  })

  return store
}

let resumeTask: Promise<void> | null = null

function ensureSession() {
  const store = useFamilyStore()
  if (store.ready || !hasLocalSession()) return Promise.resolve()
  if (!resumeTask) {
    resumeTask = store.resume()
      .then(() => undefined)
      .catch(() => {
        store.logout()
      })
      .finally(() => {
        resumeTask = null
      })
  }
  return resumeTask
}

function leaveForLogin() {
  promptLogin('登录后才能使用这项功能。是否前往登录？').then((ok) => {
    if (ok) return
    if (getCurrentPages().length > 1) uni.navigateBack()
    else openTab('today')
  })
}
