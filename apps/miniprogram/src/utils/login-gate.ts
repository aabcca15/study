import { needsFamily } from '@/stores/family'
import { promptLogin } from '@/utils/login-prompt'

/**
 * 审核要求先体验、提交时才引导：页面和表单都能打开，只有真正要写入云端时调用。
 * 还没有家庭时弹一次引导并返回 true，调用方直接结束这次提交。
 * 本机有登录记录但还在恢复中时放行，云函数按 openid 认人。
 */
export function needFamily() {
  if (!needsFamily()) return false
  promptLogin()
  return true
}
