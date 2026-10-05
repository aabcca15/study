<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { showCloudError } from '@/cloud/call'
import { hasLocalSession, useFamilyStore } from '@/stores/family'

const store = useFamilyStore()
const childName = ref('')
const submitting = ref(false)
const booting = ref(false)

onShow(() => {
  if (store.ready) {
    uni.reLaunch({ url: '/pages/today/index' })
    return
  }
  if (!hasLocalSession() || booting.value) return
  booting.value = true
  store.login('').then(() => {
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
    await store.login(childName.value.trim())
    uni.reLaunch({ url: '/pages/today/index' })
  } catch (error) {
    showCloudError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="muted">小树成长</text>
      <view class="h1">微信登录家庭课表</view>
      <text class="muted">用当前微信号进入。课表和账单保存在微信云开发，和网页版账号分开。</text>
    </view>

    <view v-if="booting" class="card empty">正在用微信身份进入…</view>
    <view v-else class="card">
      <view class="field">
        <text class="field-label">孩子昵称</text>
        <input v-model="childName" maxlength="20" placeholder="第一次登录时创建，例如小树" />
      </view>
      <button class="btn block" :disabled="submitting" @click="submit">
        {{ submitting ? '登录中…' : '微信一键登录' }}
      </button>
    </view>
  </view>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin: 48rpx 8rpx 28rpx;
}
</style>
