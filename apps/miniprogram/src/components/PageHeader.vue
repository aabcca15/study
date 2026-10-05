<script setup lang="ts">
import { openTab } from '@/utils/nav'

defineProps<{
  eyebrow?: string
  title: string
  caption?: string
  showBack?: boolean
  safe?: boolean
}>()

const statusBar = uni.getSystemInfoSync().statusBarHeight || 20

function back() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else openTab('/pages/today/index')
}
</script>

<template>
  <view :style="{ paddingTop: safe ? statusBar + 'px' : '0px' }">
    <view class="page-header">
      <button v-if="showBack" class="page-back" @click="back">‹</button>
      <view class="page-header-copy">
        <text v-if="eyebrow" class="eyebrow">{{ eyebrow }}</text>
        <view class="h1">{{ title }}</view>
        <text v-if="caption" class="caption">{{ caption }}</text>
      </view>
      <slot name="actions" />
    </view>
  </view>
</template>
