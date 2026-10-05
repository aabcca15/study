/// <reference types="@dcloudio/types" />

interface WxCloudCall {
  name: string
  data?: Record<string, unknown>
  success?: (res: { result: unknown }) => void
  fail?: (err: { errMsg?: string }) => void
}

interface WxCloud {
  init(options?: { env?: string; traceUser?: boolean }): void
  callFunction(options: WxCloudCall): void
}

declare const wx: {
  cloud?: WxCloud
}
