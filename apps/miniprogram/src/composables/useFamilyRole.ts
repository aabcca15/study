import { useFamilyStore } from '@/stores/family'

export function useFamilyRole() {
  return useFamilyStore()
}

export function denyViewerWrite(message = '家人只能查看课表和地点') {
  const store = useFamilyStore()
  if (store.ready && !store.canWrite) {
    uni.showToast({ icon: 'none', title: message })
    const pages = getCurrentPages()
    if (pages.length > 1) uni.navigateBack()
    else uni.switchTab({ url: '/pages/today/index' })
    return true
  }
  return false
}

export function denyViewerBills(message = '家人不能查看账单') {
  const store = useFamilyStore()
  if (store.ready && !store.canViewBills) {
    uni.showToast({ icon: 'none', title: message })
    const pages = getCurrentPages()
    if (pages.length > 1) uni.navigateBack()
    else uni.switchTab({ url: '/pages/today/index' })
    return true
  }
  return false
}
