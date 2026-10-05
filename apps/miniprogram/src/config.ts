/** 微信云开发环境 ID。留空时使用开发者工具里当前选中的环境。 */
export const CLOUD_ENV = ''

/**
 * 微信登录开关。本地模拟器游客模式没有 openid，请保持 false。
 * false：不调用云函数。还没有测试家庭时停留在登录页，选好男孩或女孩并填写名字后模拟登录；
 *        已经进入过则跳过登录页，直接打开今日。数据只写在本机。
 * true：微信云登录。需要真实 AppID 和云环境，游客 AppID 不可用。上线前改为 true。
 */
export const WECHAT_LOGIN_ENABLED = false
