<script setup lang="ts">
import { useFamilyStore } from '@/stores/family'
import { openTab } from '@/utils/nav'

const store = useFamilyStore()
const statusBar = uni.getSystemInfoSync().statusBarHeight || 20

function logout() {
  store.logout()
  uni.reLaunch({ url: '/pages/login/index' })
}
</script>

<template>
  <view class="app-brand-header" :style="{ paddingTop: statusBar + 'px' }">
    <view class="app-brand-inner">
      <view class="brand" @click="openTab('/pages/today/index')">
        <text class="brand-mark">U</text>
        <view class="brand-copy">
          <text>Uday</text>
          <text>Plan Your Day. Grow Your Way.</text>
        </view>
      </view>
      <button v-if="store.ready" class="logout" @click="logout">退出</button>
    </view>
  </view>
</template>
