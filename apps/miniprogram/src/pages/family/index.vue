<script setup lang="ts">
import { ref } from 'vue'
import { onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { WECHAT_LOGIN_ENABLED } from '@/config'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useThemePage } from '@/composables/useThemePage'
import PageHeader from '@/components/PageHeader.vue'
import {
  FAMILY_ROLE_LABEL,
  formatInviteCode,
  INVITE_ROLE_HINT,
  type FamilyInviteView,
  type FamilyMemberView,
  type FamilyRole,
  type InviteRole,
} from '@/domain/family-account'

const store = useFamilyPage({ refresh: false })
const themeClass = useThemePage()
const members = ref<FamilyMemberView[]>([])
const invites = ref<FamilyInviteView[]>([])
const latest = ref<FamilyInviteView | null>(null)
const loading = ref(false)
const inviting = ref('')

onShow(() => {
  refreshRoster()
})

onShareAppMessage(() => {
  const code = latest.value?.code || invites.value[0]?.code || ''
  return {
    title: '邀请你加入我们的家庭课表',
    path: code ? `/pages/login/index?invite=${code}` : '/pages/login/index',
  }
})

async function refreshRoster() {
  loading.value = true
  try {
    const roster = await store.listMembers()
    members.value = roster.members
    invites.value = roster.invites
    if (latest.value && !roster.invites.some((item) => item.code === latest.value?.code)) {
      latest.value = roster.invites[0] || null
    }
  } catch (error) {
    showCloudError(error)
  } finally {
    loading.value = false
  }
}

async function invite(role: InviteRole) {
  if (inviting.value) return
  inviting.value = role
  try {
    latest.value = await store.createInvite(role)
    await refreshRoster()
    uni.showToast({ icon: 'none', title: '邀请码已生成' })
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

async function preview(role: FamilyRole) {
  try {
    await store.previewRole(role)
    uni.showToast({ icon: 'none', title: `已预览${FAMILY_ROLE_LABEL[role]}视角` })
  } catch (error) {
    showCloudError(error)
  }
}
</script>

<template>
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
          <button v-if="store.canRemove(member)" class="ghost" @click="remove(member)">移出</button>
        </view>
      </view>

      <view v-if="store.canInviteParent || store.canInviteViewer" class="section-head">
        <text class="h2">邀请加入</text>
      </view>
      <view v-if="store.canInviteParent || store.canInviteViewer" class="card">
        <view class="invite-actions">
          <button v-if="store.canInviteParent" class="btn" :disabled="Boolean(inviting)" @click="invite('parent')">
            {{ inviting === 'parent' ? '生成中…' : '邀请家长' }}
          </button>
          <button v-if="store.canInviteViewer" class="btn ghost-btn" :disabled="Boolean(inviting)" @click="invite('viewer')">
            {{ inviting === 'viewer' ? '生成中…' : '邀请家人' }}
          </button>
        </view>
        <text class="hint">{{ store.canInviteParent ? INVITE_ROLE_HINT.parent + '；' : '' }}{{ INVITE_ROLE_HINT.viewer }}。邀请码 24 小时内有效，最多用 10 次。</text>
        <view v-if="latest" class="code-box">
          <text class="code-label">最新邀请码 · {{ FAMILY_ROLE_LABEL[latest.role] }}</text>
          <text class="code" @click="copyCode(latest.code)">{{ formatInviteCode(latest.code) }}</text>
          <text class="muted">{{ expireLabel(latest.expireAt) }}</text>
          <view class="invite-actions">
            <button class="btn" @click="copyCode(latest.code)">复制</button>
            <button class="btn ghost-btn" open-type="share">发给微信好友</button>
          </view>
        </view>
        <view v-for="item in invites.filter((invite) => invite.code !== latest?.code)" :key="item.code" class="invite-row">
          <view>
            <text class="name">{{ formatInviteCode(item.code) }} · {{ FAMILY_ROLE_LABEL[item.role] }}</text>
            <text class="muted">{{ expireLabel(item.expireAt) }} · 已用 {{ item.usedCount }}/{{ item.maxUses }}</text>
          </view>
          <button class="ghost" @click="copyCode(item.code)">复制</button>
        </view>
      </view>

      <view v-if="!WECHAT_LOGIN_ENABLED" class="card preview">
        <text class="eyebrow">本地预览</text>
        <text class="muted">游客模式只有一台设备。可用下面按钮切换视角检查家人只读界面。</text>
        <view class="invite-actions">
          <button class="btn ghost-btn" :class="{ on: store.role === 'owner' }" @click="preview('owner')">创建者</button>
          <button class="btn ghost-btn" :class="{ on: store.role === 'parent' }" @click="preview('parent')">家长</button>
          <button class="btn ghost-btn" :class="{ on: store.role === 'viewer' }" @click="preview('viewer')">家人</button>
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
.invite-actions {
  display: flex;
  gap: 10px;
}
.invite-actions .btn { flex: 1; }
.ghost-btn {
  color: var(--ink);
  background: var(--bg);
  box-shadow: none;
}
.ghost-btn.on {
  color: var(--accent-text);
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
.preview { margin-top: 22px; }
.eyebrow {
  display: block;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
</style>
