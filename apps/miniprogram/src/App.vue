<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { CLOUD_ENV, WECHAT_LOGIN_ENABLED } from './config'
import { useThemeStore } from './utils/wx-theme'

onLaunch(() => {
  try {
    useThemeStore().apply()
  } catch (error) {
    console.warn('[theme] apply skipped', error)
  }
  // #ifdef MP-WEIXIN
  if (WECHAT_LOGIN_ENABLED && wx.cloud) {
    wx.cloud.init({
      traceUser: true,
      ...(CLOUD_ENV ? { env: CLOUD_ENV } : {}),
    })
  }
  // #endif
})
</script>

<style lang="scss">
@import './styles/app.scss';
</style>
