<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { CLOUD_ENV } from './config'

onLaunch(() => {
  // #ifdef MP-WEIXIN
  if (wx.cloud) {
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
