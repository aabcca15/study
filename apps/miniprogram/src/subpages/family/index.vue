<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  FAMILY_ROLE_LABEL,
  formatInviteCode,
  INVITE_ROLE_HINT,
  type FamilyInviteView,
  type FamilyMemberView,
  type InviteRole,
} from '@/domain/family-account'

const store = useFamilyPage({ refresh: false })
const themeClass = useThemePage()
const pageBg = usePageBackground()
const members = ref<FamilyMemberView[]>([])
const invites = ref<FamilyInviteView[]>([])
const loading = ref(false)
const inviting = ref('')
const inviteRole = ref<InviteRole>(store.canInviteParent ? 'parent' : 'viewer')
const roleTabs = computed(() => [
  ...(store.canInviteParent ? [{ role: 'parent' as const, label: '邀请家长' }] : []),
  ...(store.canInviteViewer ? [{ role: 'viewer' as const, label: '邀请家人' }] : []),
])
const current = computed(() => invites.value.find((item) => item.role === inviteRole.value && isUsable(item)) || null)
const others = computed(() => invites.value.filter((item) => item.code !== current.value?.code))

watch(roleTabs, (tabs) => {
  if (tabs.length && !tabs.some((tab) => tab.role === inviteRole.value)) inviteRole.value = tabs[0].role
}, { immediate: true })

onShow(() => {
  refreshRoster()
})

onShareAppMessage((options) => {
  const target = (options as { target?: { dataset?: { code?: string } } } | undefined)?.target
  const code = target?.dataset?.code || current.value?.code || ''
  return {
    title: '邀请你加入我们的家庭课表',
    path: code ? `/pages/login/index?invite=${code}` : '/pages/login/index',
  }
})

function isUsable(item: FamilyInviteView) {
  return !item.expired && item.usedCount < item.maxUses
}

async function refreshRoster() {
  loading.value = true
  try {
    const roster = await store.listMembers()
    members.value = roster.members
    invites.value = roster.invites
  } catch (error) {
    showCloudError(error)
  } finally {
    loading.value = false
  }
}

function pickRole(role: InviteRole) {
  inviteRole.value = role
  if (!current.value && !loading.value) invite(role)
}

async function invite(role: InviteRole) {
  if (inviting.value) return
  inviting.value = role
  try {
    const created = await store.createInvite(role)
    if (created && !invites.value.some((item) => item.code === created.code)) {
      invites.value = [created, ...invites.value]
    }
    await refreshRoster()
  } catch (error) {
    showCloudError(error)
  } finally {
    inviting.value = ''
  }
}

function copyCode(code: string) {
  uni.setClipboardData({
    data: code,
    success: () => uni.showToast({ icon: 'none', title: '已复制邀请码' }),
  })
}

function expireLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hour}:${minute} 前有效`
}

function remove(member: FamilyMemberView) {
  if (!store.canRemove(member)) return
  uni.showModal({
    title: '移出家庭',
    content: `确定把「${member.displayName}」移出这个家庭？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeMember(member.openid)
        await refreshRoster()
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}

</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
    <view class="page family-page">
      <PageHeader show-back safe title="家庭成员" :caption="`你是${store.roleLabel} · ${store.canWrite ? '可以改课表和账单' : '只能看课表和地点'}`" />

      <view class="card role-card">
        <text class="eyebrow">当前身份</text>
        <text class="role-name">{{ store.displayName || store.roleLabel }}</text>
        <text class="muted">{{ store.role === 'viewer' ? '接送时看今天上哪节课、在哪里。改课和账单由家长来。' : '邀请家长一起管课表，或邀请家人只看安排。' }}</text>
      </view>

      <view class="section-head">
        <text class="h2">成员</text>
        <text class="muted">{{ loading ? '同步中…' : `${members.length} 人` }}</text>
      </view>
      <view class="card list">
        <view v-for="member in members" :key="member.openid" class="member">
          <view class="avatar" :class="member.role">{{ member.displayName.slice(0, 1) }}</view>
          <view class="member-copy">
            <text class="name">{{ member.displayName }}{{ member.self ? ' · 我' : '' }}</text>
            <text class="muted">{{ FAMILY_ROLE_LABEL[member.role] }}</text>
          </view>
          <button hover-class="press-on" hover-stay-time="80" v-if="store.canRemove(member)" class="ghost" @click="remove(member)">移出</button>
        </view>
      </view>

      <view v-if="store.canInviteParent || store.canInviteViewer" class="section-head">
        <text class="h2">邀请加入</text>
      </view>
      <view v-if="store.canInviteParent || store.canInviteViewer" class="card">
        <view class="role-tabs">
          <view
            v-if="roleTabs.length > 1"
            class="role-thumb"
            :class="{ right: inviteRole === roleTabs[1].role }"
          />
          <view
            v-for="tab in roleTabs"
            :key="tab.role"
            class="role-tab press"
            :class="{ on: inviteRole === tab.role, solo: roleTabs.length === 1 }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="pickRole(tab.role)"
          >{{ tab.label }}</view>
        </view>
        <text class="hint">{{ INVITE_ROLE_HINT[inviteRole] }}</text>
        <view class="code-box">
          <template v-if="current">
            <text class="code-label">邀请码 · {{ FAMILY_ROLE_LABEL[current.role] }}</text>
            <text class="code press" hover-class="press-on" hover-stay-time="80" @click="copyCode(current.code)">{{ formatInviteCode(current.code) }}</text>
            <text class="muted">{{ expireLabel(current.expireAt) }} · 已用 {{ current.usedCount }}/{{ current.maxUses }}</text>
            <button hover-class="press-on" hover-stay-time="80" class="btn share-btn" open-type="share" :data-code="current.code">
              <AppIcon name="share" tone="white" :size="17" />
              <text>发给微信好友</text>
            </button>
          </template>
          <template v-else>
            <text class="muted">{{ inviting ? '正在生成邀请码…' : '还没有可用的邀请码' }}</text>
            <button hover-class="press-on" hover-stay-time="80" class="btn share-btn" :disabled="Boolean(inviting)" @click="invite(inviteRole)">
              {{ inviting ? '生成中…' : '生成邀请码' }}
            </button>
          </template>
        </view>
        <view v-for="item in others" :key="item.code" class="invite-row">
          <view class="invite-copy">
            <text class="name">{{ formatInviteCode(item.code) }} · {{ FAMILY_ROLE_LABEL[item.role] }}</text>
            <text class="muted">{{ item.expired ? '已过期' : expireLabel(item.expireAt) }} · 已用 {{ item.usedCount }}/{{ item.maxUses }}</text>
          </view>
          <button
            v-if="isUsable(item)"
            hover-class="press-on"
            hover-stay-time="80"
            class="share-icon"
            open-type="share"
            :data-code="item.code"
          >
            <AppIcon name="share" tone="accent" :size="17" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.family-page { padding-bottom: 48px; }
.role-card { margin-bottom: 22px; }
.role-name {
  display: block;
  margin: 6px 0 8px;
  color: var(--ink);
  font-size: 22px;
  font-weight: 800;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 8px 2px 10px;
}
.h2 { font-size: 17px; font-weight: 800; }
.list { padding: 6px 14px; }
.member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.member:last-child { border-bottom: 0; }
.avatar {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  font-weight: 800;
  background: #8c93a3;
}
.avatar.owner { background: linear-gradient(135deg, #ffb45c, #f15a36); }
.avatar.parent { background: linear-gradient(135deg, #5d9cff, #3c6fe0); }
.avatar.viewer { background: linear-gradient(135deg, #39c6a4, #1fa98c); }
.member-copy { flex: 1; min-width: 0; }
.name { display: block; font-size: 15px; font-weight: 700; }
.ghost {
  padding: 6px 10px;
  color: #ed5d6e;
  background: var(--danger-soft);
  border-radius: 999px;
  font-size: 12px;
}
.role-tabs {
  position: relative;
  display: flex;
  padding: 4px;
  border-radius: 16px;
  background: var(--bg);
}
.role-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 8px 18px -8px rgba(255, 122, 69, 0.6);
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.role-thumb.right { transform: translateX(100%); }
.role-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 40px;
  line-height: 40px;
  border-radius: 12px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  transition: color 0.3s ease, transform 0.46s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.role-tab.on { color: #fff; }
.role-tab.solo.on {
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
}
.share-btn {
  gap: 6px;
  width: 100%;
  margin-top: 12px;
}
.invite-copy { flex: 1; min-width: 0; }
.share-icon {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--accent-soft);
}
.hint {
  display: block;
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.code-box {
  margin-top: 16px;
  padding: 16px;
  border-radius: 18px;
  background: var(--bg);
  text-align: center;
}
.code-label {
  display: block;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
.code {
  display: block;
  margin: 8px 0 6px;
  color: var(--ink);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.invite-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.eyebrow {
  display: block;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
</style>
