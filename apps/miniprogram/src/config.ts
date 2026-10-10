/** 当前环境：dev（开发 / 体验）或 prod（正式），由 apps/miniprogram/.env.* 决定。 */
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'dev'

/** 微信云开发环境 ID。留空时使用开发者工具里当前选中的环境。 */
export const CLOUD_ENV = import.meta.env.VITE_CLOUD_ENV || ''
