<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { ChildAvatarKey } from '@server-domain/types'
import { WECHAT_LOGIN_ENABLED } from '@/config'
import { showCloudError } from '@/cloud/call'
import { hasDevSession } from '@/cloud/local'
import { hasLocalSession, useFamilyStore } from '@/stores/family'

const store = useFamilyStore()
const statusBar = uni.getSystemInfoSync().statusBarHeight || 20
const childName = ref('')
const avatarKey = ref<ChildAvatarKey>('boy-blue')
const submitting = ref(false)
const booting = ref(false)

onShow(() => {
  if (store.ready) {
    uni.reLaunch({ url: '/pages/today/index' })
    return
  }
  if (booting.value) return
  if (!WECHAT_LOGIN_ENABLED) {
    if (!hasDevSession()) return
    booting.value = true
    store.login('小U', 'boy-blue').then(() => {
      uni.reLaunch({ url: '/pages/today/index' })
    }).catch((error) => {
      store.logout()
      booting.value = false
      showCloudError(error)
    })
    return
  }
  if (!hasLocalSession()) return
  booting.value = true
  store.login('小U').then(() => {
    uni.reLaunch({ url: '/pages/today/index' })
  }).catch((error) => {
    store.logout()
    booting.value = false
    showCloudError(error)
  })
})

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await store.login(childName.value.trim() || '小U', avatarKey.value)
    uni.reLaunch({ url: '/pages/today/index' })
  } catch (error) {
    showCloudError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="login" :style="{ paddingTop: statusBar + 'px' }">
    <view class="stage">
      <view class="mark">U</view>
      <text class="word">Uday</text>
      <text class="slogan">Plan Your Day. Grow Your Way.</text>
    </view>

    <view v-if="booting" class="muted boot">正在进入…</view>
    <view v-else class="panel">
      <text class="pick-title">选择小U</text>
      <view class="picks">
        <view class="pick" :class="{ on: avatarKey === 'boy-blue' }" @click="avatarKey = 'boy-blue'">
          <view class="xiao boy">
            <view class="hair" />
            <view class="face">
              <view class="eyes"><view /><view /></view>
              <view class="mouth" />
            </view>
          </view>
          <text>男孩</text>
        </view>
        <view class="pick" :class="{ on: avatarKey === 'girl-flower' }" @click="avatarKey = 'girl-flower'">
          <view class="xiao girl">
            <view class="bow" />
            <view class="hair" />
            <view class="face">
              <view class="eyes"><view /><view /></view>
              <view class="mouth" />
            </view>
          </view>
          <text>女孩</text>
        </view>
      </view>

      <view class="field">
        <text class="field-label">孩子名字</text>
        <input v-model="childName" maxlength="20" placeholder="小U" />
      </view>
      <button class="btn block" :disabled="submitting" @click="submit">
        {{ submitting ? '进入中…' : (WECHAT_LOGIN_ENABLED ? '微信一键登录' : '进入') }}
      </button>
      <text v-if="!WECHAT_LOGIN_ENABLED" class="hint">本地模拟，不请求微信登录</text>
    </view>
  </view>
</template>

<style scoped>
.login {
  box-sizing: border-box;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 28px 48px;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 36px;
}

.mark {
  display: flex;
  width: 84px;
  height: 84px;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 18px 32px -14px rgba(255, 122, 69, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  font-size: 42px;
  font-weight: 800;
}

.word {
  margin-top: 16px;
  color: var(--ink);
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.slogan {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.boot {
  margin-top: 8px;
}

.panel {
  width: min(100%, 360px);
}

.pick-title {
  display: block;
  margin-bottom: 14px;
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
}

.picks {
  display: flex;
  justify-content: center;
  gap: 22px;
  margin-bottom: 22px;
}

.pick {
  display: flex;
  width: 108px;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--elev-sm);
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
}

.pick.on {
  color: var(--ink);
  box-shadow: 0 0 0 2px #ff7a45, var(--elev-sm);
}

.xiao {
  position: relative;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border-radius: 50%;
}

.boy { background: #d7e6ff; }
.girl { background: #ffd6e4; }

.hair {
  position: absolute;
  z-index: 1;
  top: 6px;
  right: 12px;
  left: 12px;
  height: 22px;
  border-radius: 14px 14px 8px 8px;
  background: #3d4f73;
}

.girl .hair {
  top: 8px;
  height: 26px;
  background: #6a3d52;
}

.bow {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 8px;
  width: 16px;
  height: 12px;
  border-radius: 4px 8px 4px 8px;
  background: #ff7a45;
}

.face {
  position: absolute;
  right: 14px;
  bottom: 12px;
  left: 14px;
  z-index: 2;
}

.eyes {
  display: flex;
  justify-content: space-between;
  padding: 0 6px;
}

.eyes view {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #243056;
}

.mouth {
  width: 12px;
  height: 6px;
  margin: 6px auto 0;
  border: 2px solid #243056;
  border-top: 0;
  border-radius: 0 0 12px 12px;
}

.hint {
  display: block;
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
</style>
