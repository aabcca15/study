import { useFamilyStore } from '@/stores/family'

let asking = false

/** 未登录时询问是否去登录。已登录直接通过，不打断浏览。 */
export function promptLogin(content: string) {
  if (useFamilyStore().ready) return Promise.resolve(true)
  if (asking) return Promise.resolve(false)
  asking = true
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '登录后继续',
      content,
      confirmText: '去登录',
      cancelText: '先看看',
      confirmColor: '#ff7a45',
      success: (result) => {
        if (result.confirm) uni.navigateTo({ url: '/pages/login/index' })
        resolve(Boolean(result.confirm))
      },
      fail: () => resolve(false),
      complete: () => {
        asking = false
      },
    })
  })
}
