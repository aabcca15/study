<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { CLOUD_ENV, WX_ENV_VERSION } from './config'
import { useThemeStore } from './utils/wx-theme'

onLaunch(() => {
  try {
    useThemeStore().apply()
  } catch (error) {
    console.warn('[theme] apply skipped', error)
  }
  // #ifdef MP-WEIXIN
  if (wx.cloud) {
    if (!CLOUD_ENV) console.warn(`[cloud] ${WX_ENV_VERSION} 没有配置云环境 ID，将使用默认环境`)
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
