<script setup lang="ts">
import { openTab } from '@/utils/nav'
import { capsuleInset, statusBarHeight } from '@/utils/system'
import ThemeToggle from '@/components/ThemeToggle.vue'

const statusBar = statusBarHeight()
const actionsRight = capsuleInset() + 6
</script>

<template>
  <view class="app-brand-header" :style="{ paddingTop: statusBar + 'px' }">
    <view class="app-brand-inner" :style="{ paddingRight: actionsRight + 'px' }">
      <view class="brand press" hover-class="press-on" hover-stay-time="80" @click="openTab('/pages/today/index')">
        <text class="brand-mark">U</text>
        <view class="brand-copy">
          <text>Uday</text>
          <text>Plan Your Day. Grow Your Way.</text>
        </view>
      </view>
      <view class="app-actions">
        <ThemeToggle />
      </view>
    </view>
  </view>
</template>
