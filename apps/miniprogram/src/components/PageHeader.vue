<script setup lang="ts">
import { goBack } from '@/utils/nav'
import { capsuleInset, statusBarHeight } from '@/utils/system'

defineProps<{
  eyebrow?: string
  title: string
  caption?: string
  showBack?: boolean
  safe?: boolean
  /** 标题是日期区间这类较长内容时缩小字号，保证整行显示。 */
  compact?: boolean
}>()

const statusBar = statusBarHeight()
const capsuleRight = capsuleInset() + 6

function back() {
  goBack()
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
        <view class="h1" :class="{ 'h1-compact': compact }">{{ title }}</view>
        <text v-if="caption" class="caption">{{ caption }}</text>
      </view>
      <view v-if="$slots.actions" class="page-header-actions">
        <slot name="actions" />
      </view>
    </view>
  </view>
</template>
