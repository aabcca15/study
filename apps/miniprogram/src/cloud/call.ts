export class CloudError extends Error {
  code: string

  constructor(message: string, code = 'CLOUD_ERROR') {
    super(message)
    this.code = code
  }
}

type CloudBody<T> = { ok: true; data: T } | { ok: false; code?: string; message?: string }

export function callCloud<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    if (!wx.cloud) {
      reject(new CloudError('请使用支持云开发的微信基础库', 'CLOUD_MISSING'))
      return
    }
    wx.cloud.callFunction({
      name: 'api',
      data: { action, payload: payload ?? {} },
      success(res) {
        const body = res.result as CloudBody<T> | undefined
        if (!body || body.ok !== true) {
          reject(new CloudError(
            body && 'message' in body ? body.message || '请求失败' : '请求失败',
            body && 'code' in body ? body.code || 'CLOUD_ERROR' : 'CLOUD_ERROR',
          ))
          return
        }
        resolve(body.data)
      },
      fail(err) {
        reject(new CloudError(err?.errMsg || '云函数调用失败', 'CALL_FAILED'))
      },
    })
    // #endif
    // #ifndef MP-WEIXIN
    reject(new CloudError('当前平台还没有接入云开发，请先使用微信小程序。', 'PLATFORM_UNSUPPORTED'))
    // #endif
  })
}

export function showCloudError(error: unknown) {
  const message = error instanceof Error ? error.message : '操作失败'
  if (message.length > 18) {
    uni.showModal({ title: '提示', content: message, showCancel: false })
    return
  }
  uni.showToast({ icon: 'none', title: message })
}
