import { onShow } from '@dcloudio/uni-app'
import { showCloudError } from '@/cloud/call'
import { isMomentsPreview } from '@/utils/share'
import { hasLocalSession, useFamilyStore } from '@/stores/family'
import { useThemeStore } from '@/utils/wx-theme'
import { useUiStore } from '@/stores/ui'

/**
 * tab 页由微信缓存，切换时不重建；所有页面共用一份 store 快照，
 * 任一页写入后其他页自动跟着更新。显示时只在数据过期或跨月时补拉一次。
 * 还没有家庭时所有页面和表单都能照常打开浏览，提交写入时才由 store 引导去创建。
 */
export function useFamilyPage(options: { refresh?: boolean } = {}) {
  const store = useFamilyStore()
  const ui = useUiStore()
  const theme = useThemeStore()
  const refresh = options.refresh !== false

  onShow(() => {
    theme.apply()
    if (isMomentsPreview()) return
    if (store.ready) {
      ui.touchToday()
      if (!refresh) return
      store.refreshIfStale().catch((error) => showCloudError(error))
      return
    }
    if (!hasLocalSession()) return
    ensureSession().then(() => {
      if (!store.ready) return
      ui.touchToday()
      if (refresh) store.refreshIfStale().catch((error) => showCloudError(error))
    })
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
