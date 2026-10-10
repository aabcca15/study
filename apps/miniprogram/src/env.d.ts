/// <reference types="@dcloudio/types" />

interface ImportMetaEnv {
  /** dev / prod，来自 .env.development / .env.production */
  readonly VITE_APP_ENV?: string
  /** 微信云开发环境 ID */
  readonly VITE_CLOUD_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

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
