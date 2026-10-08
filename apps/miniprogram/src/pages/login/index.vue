<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { CHILD_AVATAR_OPTIONS } from '@server-domain/constants'
import type { ChildAvatarKey } from '@server-domain/types'
import { WECHAT_LOGIN_ENABLED } from '@/config'
import { showCloudError } from '@/cloud/call'
import { hasDevSession } from '@/cloud/local'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { hasLocalSession, useFamilyStore } from '@/stores/family'
import { useThemePage } from '@/composables/useThemePage'
import { normalizeInviteCode } from '@/domain/family-account'
import { openTab } from '@/utils/nav'
import { statusBarHeight } from '@/utils/system'
import ThemeToggle from '@/components/ThemeToggle.vue'

const store = useFamilyStore()
const themeClass = useThemePage()
const statusBar = statusBarHeight()
const mode = ref<'create' | 'join'>('create')
const childName = ref('')
const avatarKey = ref<ChildAvatarKey>('boy-blue')
const inviteCode = ref('')
const displayName = ref('')
const submitting = ref(false)
const booting = ref(false)

onLoad((query) => {
  const invite = typeof query?.invite === 'string' ? normalizeInviteCode(query.invite) : ''
  if (!invite) return
  inviteCode.value = invite
  mode.value = 'join'
})

onShow(() => {
  if (store.ready) {
    openTab('/pages/today/index')
    return
  }
  if (booting.value || inviteCode.value) return
  if (!WECHAT_LOGIN_ENABLED) {
    if (!hasDevSession()) return
    booting.value = true
    store.login('小U', 'boy-blue').then(() => {
      openTab('/pages/today/index')
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
    openTab('/pages/today/index')
  }).catch((error) => {
    store.logout()
    booting.value = false
    showCloudError(error)
  })
})

function onCodeInput(event: { detail?: { value?: string } }) {
  inviteCode.value = normalizeInviteCode(event.detail?.value || '')
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (mode.value === 'join') {
      const code = normalizeInviteCode(inviteCode.value)
      if (code.length < 6) {
        uni.showToast({ icon: 'none', title: '请填写邀请码' })
        return
      }
      await store.joinFamily(code, displayName.value.trim())
    } else {
      await store.login(childName.value.trim() || '小U', avatarKey.value)
    }
    openTab('/pages/today/index')
  } catch (error) {
    showCloudError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="theme-root login" :class="themeClass" :style="{ paddingTop: statusBar + 'px' }">
    <view class="login-bar">
      <ThemeToggle />
    </view>
    <view class="stage">
      <view class="mark">U</view>
      <text class="word">Uday</text>
      <text class="slogan">Plan Your Day. Grow Your Way.</text>
    </view>

    <view v-if="booting" class="muted boot">正在进入…</view>
    <view v-else class="panel">
      <view class="modes">
        <button :class="{ on: mode === 'create' }" @click="mode = 'create'">创建家庭</button>
        <button :class="{ on: mode === 'join' }" @click="mode = 'join'">加入家庭</button>
      </view>

      <template v-if="mode === 'create'">
        <text class="pick-title">选择小U</text>
        <view class="picks">
          <view
            v-for="option in CHILD_AVATAR_OPTIONS"
            :key="option.key"
            class="pick"
            :class="{ on: avatarKey === option.key }"
            @click="avatarKey = option.key"
          >
            <ChildAvatar :avatar-key="option.key" :size="64" />
            <text>{{ option.label }}</text>
          </view>
        </view>

        <view class="field">
          <text class="field-label">孩子名字</text>
          <input v-model="childName" maxlength="20" placeholder="小U" placeholder-class="ph" />
        </view>
        <button class="btn block" :disabled="submitting" @click="submit">
          {{ submitting ? '进入中…' : (WECHAT_LOGIN_ENABLED ? '微信登录并创建' : '创建并进入') }}
        </button>
      </template>

      <template v-else>
        <text class="pick-title">用邀请码加入</text>
        <text class="join-lead">家长生成邀请码后发给你。加入后按邀请身份进入：家长可改课表，家人只能看安排和地点。</text>
        <view class="field">
          <text class="field-label">邀请码</text>
          <input :value="inviteCode" maxlength="8" placeholder="例如 AB12CD" placeholder-class="ph" @input="onCodeInput" />
        </view>
        <view class="field">
          <text class="field-label">你的称呼</text>
          <input v-model="displayName" maxlength="16" placeholder="妈妈 / 爸爸 / 奶奶" placeholder-class="ph" />
        </view>
        <button class="btn block" :disabled="submitting" @click="submit">
          {{ submitting ? '加入中…' : (WECHAT_LOGIN_ENABLED ? '微信登录并加入' : '加入家庭') }}
        </button>
      </template>
      <text v-if="!WECHAT_LOGIN_ENABLED" class="hint">本地模拟，不请求微信登录。两台真机共享需打开云开发。</text>
    </view>
  </view>
</template>

<style scoped>
.login {
  position: relative;
  box-sizing: border-box;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 28px 48px;
}

.login-bar {
  position: absolute;
  top: 8px;
  right: 10px;
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

.modes {
  display: flex;
  margin-bottom: 22px;
  padding: 4px;
  border-radius: 16px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.modes button {
  flex: 1;
  height: 36px;
  color: var(--muted);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
}
.modes button.on {
  color: var(--accent-text);
  background: var(--accent-soft);
}
.pick-title {
  display: block;
  margin-bottom: 14px;
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
}
.join-lead {
  display: block;
  margin: -6px 0 18px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
  text-align: center;
}

.picks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-bottom: 22px;
}

.pick {
  display: flex;
  width: calc(50% - 6px);
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
  border-radius: 22px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
  color: var(--muted);
  font-size: 12px;
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
