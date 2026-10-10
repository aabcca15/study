<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { CHILD_AVATAR_OPTIONS } from '@server-domain/constants'
import type { ChildAvatarKey } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { hasLocalSession, useFamilyStore } from '@/stores/family'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import { normalizeInviteCode } from '@/domain/family-account'
import { avatarDefaultName } from '@/domain/avatar-names'
import { openTab } from '@/utils/nav'
import { capsuleBox, statusBarHeight } from '@/utils/system'
import ThemeToggle from '@/components/ThemeToggle.vue'

const store = useFamilyStore()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const statusBar = statusBarHeight()
const capsule = capsuleBox()
const toggleStyle = {
  top: `${capsule.top + capsule.height / 2 - 19}px`,
  right: `${capsule.inset + 6}px`,
}
const avatarOptions = CHILD_AVATAR_OPTIONS
const mode = ref<'create' | 'join'>('create')
const childName = ref('')
const avatarKey = ref<ChildAvatarKey>('boy-blue')
const inviteCode = ref('')
const displayName = ref('')
const submitting = ref(false)
const booting = ref(false)
const childPlaceholder = computed(() => avatarDefaultName(avatarKey.value))

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
  if (booting.value || inviteCode.value || !hasLocalSession()) return
  booting.value = true
  store.resume().then(() => {
    openTab('/pages/today/index')
  }).catch((error) => {
    store.logout()
    booting.value = false
    showCloudError(error)
  })
})

function showCreate() {
  mode.value = 'create'
}

function showJoin() {
  mode.value = 'join'
}

function pickAvatar(key: ChildAvatarKey) {
  avatarKey.value = key
}

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
      await store.login(childName.value.trim() || childPlaceholder.value, avatarKey.value)
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
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root login" :class="themeClass" :style="{ paddingTop: statusBar + 'px' }">
    <view class="login-bar" :style="toggleStyle">
      <ThemeToggle />
    </view>
    <view class="stage">
      <view class="mark">U</view>
      <view class="word">Uday</view>
      <view class="slogan">Plan Your Day. Grow Your Way.</view>
    </view>

    <view v-if="booting" class="boot">正在进入…</view>
    <view v-else class="panel">
      <view class="modes">
        <view class="mode-thumb" :class="{ join: mode === 'join' }" />
        <view class="mode-tab press" :class="{ on: mode === 'create' }" hover-class="press-on" hover-stay-time="80" @click="showCreate">创建家庭</view>
        <view class="mode-tab press" :class="{ on: mode === 'join' }" hover-class="press-on" hover-stay-time="80" @click="showJoin">加入家庭</view>
      </view>

      <view class="forms">
        <view v-if="mode === 'create'" class="form">
          <view class="picks">
            <view
              v-for="option in avatarOptions"
              :key="option.key"
              class="pick press"
              :class="{ on: avatarKey === option.key }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pickAvatar(option.key)"
            >
              <ChildAvatar :avatar-key="option.key" :size="56" />
            </view>
          </view>
          <view class="field">
            <view class="field-label">孩子名字</view>
            <input v-model="childName" maxlength="20" :placeholder="childPlaceholder" placeholder-class="ph" />
          </view>
          <view class="submit press" :class="{ busy: submitting }" hover-class="press-on" hover-stay-time="80" @click="submit">
            <text class="submit-label">{{ submitting ? '进入中…' : '创建并进入' }}</text>
          </view>
        </view>

        <view v-else class="form">
          <view class="field">
            <view class="field-label">邀请码</view>
            <input :value="inviteCode" maxlength="8" placeholder="例如 AB12CD" placeholder-class="ph" @input="onCodeInput" />
          </view>
          <view class="field">
            <view class="field-label">你的称呼</view>
            <input v-model="displayName" maxlength="16" placeholder="爸爸/妈妈/爷爷/奶奶" placeholder-class="ph" />
          </view>
          <view class="submit press" :class="{ busy: submitting }" hover-class="press-on" hover-stay-time="80" @click="submit">
            <text class="submit-label">{{ submitting ? '加入中…' : '加入家庭' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.login {
  position: relative;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 28px 48px;
}

.login-bar {
  position: absolute;
  z-index: 2;
}

.stage {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  margin-bottom: 36px;
  text-align: center;
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
  color: var(--muted);
  text-align: center;
}

.panel {
  width: 100%;
  max-width: 360px;
  box-sizing: border-box;
}

.modes {
  position: relative;
  display: flex;
  width: 100%;
  margin-bottom: 22px;
  padding: 4px;
  box-sizing: border-box;
  border-radius: 16px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.mode-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: 36px;
  border-radius: 12px;
  background: var(--accent-soft);
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.mode-thumb.join {
  transform: translateX(100%);
}
.mode-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 36px;
  line-height: 36px;
  color: var(--muted);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
.mode-tab.on {
  color: var(--accent-text);
}
.form {
  display: flex;
  height: 240px;
  flex-direction: column;
  animation: form-in 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
@keyframes form-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.submit {
  width: 100%;
  height: 48px;
  margin-top: auto;
  box-sizing: border-box;
  border-radius: 14px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 10px 24px -8px rgba(255, 122, 69, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.28);
  text-align: center;
}
.submit-label {
  display: block;
  height: 48px;
  line-height: 48px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}
.submit.busy {
  opacity: 0.6;
}

.picks {
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
}

.pick {
  display: flex;
  width: 72px;
  height: 72px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.pick.on {
  box-shadow: 0 0 0 2px #ff7a45, var(--elev-sm);
  transform: scale(1.04);
}
.mode-tab.press-on,
.submit.press-on,
.pick.press-on,
.pick.on.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.94);
}

</style>
