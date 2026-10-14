import { useFamilyStore } from '@/stores/family'

let asking = false

/** 还没有家庭时用同一句询问是否去创建。已有家庭直接通过。 */
export function promptLogin() {
  if (useFamilyStore().ready) return Promise.resolve(true)
  if (asking) return Promise.resolve(false)
  asking = true
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '创建后继续',
      content: '创建家庭即可开启课程计划管理，是否前往？',
      confirmText: '去创建',
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
