import { onShow } from '@dcloudio/uni-app'
import { showCloudError } from '@/cloud/call'
import { hasLocalSession, useFamilyStore } from '@/stores/family'

export function useFamilyPage(options: { refresh?: boolean } = {}) {
  const store = useFamilyStore()
  const refresh = options.refresh !== false

  onShow(() => {
    if (!store.ready) {
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (!refresh) return
    store.refresh().catch((error) => showCloudError(error))
  })

  return store
}

export function redirectIfNeeded() {
  if (!useFamilyStore().ready && !hasLocalSession()) {
    uni.reLaunch({ url: '/pages/login/index' })
  }
}
