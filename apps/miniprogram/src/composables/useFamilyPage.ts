import { onShow } from '@dcloudio/uni-app'
import { showCloudError } from '@/cloud/call'
import { hasLocalSession, useFamilyStore } from '@/stores/family'
import { useUiStore } from '@/stores/ui'

/**
 * tab 页由微信缓存，切换时不重建；所有页面共用一份 store 快照，
 * 任一页写入后其他页自动跟着更新。显示时只在数据过期或跨月时补拉一次。
 */
export function useFamilyPage(options: { refresh?: boolean } = {}) {
  const store = useFamilyStore()
  const ui = useUiStore()
  const refresh = options.refresh !== false

  onShow(() => {
    if (!store.ready) {
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }
    ui.touchToday()
    if (!refresh) return
    store.refreshIfStale().catch((error) => showCloudError(error))
  })

  return store
}

export function redirectIfNeeded() {
  if (!useFamilyStore().ready && !hasLocalSession()) {
    uni.reLaunch({ url: '/pages/login/index' })
  }
}
