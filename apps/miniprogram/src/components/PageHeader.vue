<script setup lang="ts">
import { openTab } from '@/utils/nav'
import { capsuleInset, statusBarHeight } from '@/utils/system'

defineProps<{
  eyebrow?: string
  title: string
  caption?: string
  showBack?: boolean
  safe?: boolean
}>()

const statusBar = statusBarHeight()
const capsuleRight = capsuleInset() + 6

function back() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else openTab('/pages/today/index')
}
</script>

<template>
  <view
    :class="{ 'page-header-fixed': safe }"
    :style="safe ? { paddingTop: statusBar + 'px', paddingRight: capsuleRight + 'px' } : {}"
  >
    <view class="page-header">
      <button hover-class="press-on" hover-stay-time="80" v-if="showBack" class="page-back" @click="back">‹</button>
      <view class="page-header-copy">
        <text v-if="eyebrow" class="eyebrow">{{ eyebrow }}</text>
        <view class="h1">{{ title }}</view>
        <text v-if="caption" class="caption">{{ caption }}</text>
      </view>
      <view v-if="$slots.actions" class="page-header-actions">
        <slot name="actions" />
      </view>
    </view>
  </view>
</template>
