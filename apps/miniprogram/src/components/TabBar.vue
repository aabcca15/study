<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  active: 'today' | 'calendar' | 'courses' | 'stats'
}>()

const open = ref(false)

const tabs = [
  { key: 'today', label: '今日', url: '/pages/today/index', icon: 'clock' },
  { key: 'calendar', label: '日历', url: '/pages/calendar/index', icon: 'cal' },
  { key: 'courses', label: '课程', url: '/pages/courses/index', icon: 'book' },
  { key: 'stats', label: '统计', url: '/pages/stats/index', icon: 'bars' },
] as const

function go(url: string) {
  open.value = false
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]?.route
  if (current && `/${current}` === url) return
  uni.reLaunch({ url })
}

function quick(url: string) {
  open.value = false
  if (url.startsWith('/pages/today')) uni.reLaunch({ url })
  else uni.navigateTo({ url })
}
</script>

<template>
  <view v-if="open" class="quick-backdrop" @click="open = false" />
  <view v-if="open" class="quick-menu">
    <button class="quick-item" @click="quick('/pages/today/index?add=1')">
      <text class="quick-badge accent">＋</text>
      <view>
        <text class="title">快速新增安排</text>
        <text class="desc">选择日期、已有课程或临时安排</text>
      </view>
    </button>
    <button class="quick-item" @click="quick('/pages/course-edit/index')">
      <text class="quick-badge amber">✦</text>
      <view>
        <text class="title">新增课程</text>
        <text class="desc">建立新的课程预设</text>
      </view>
    </button>
    <button class="quick-item" @click="quick('/pages/expense-edit/index')">
      <text class="quick-badge teal">¥</text>
      <view>
        <text class="title">记一笔账单</text>
        <text class="desc">登记一次课程费用</text>
      </view>
    </button>
  </view>

  <view class="tabbar">
    <button
      v-for="tab in tabs.slice(0, 2)"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === active }"
      @click="go(tab.url)"
    >
      <view class="tab-ico" :class="tab.icon" />
      <text v-if="tab.key === active" class="tab-label">{{ tab.label }}</text>
    </button>
    <view class="tabbar-center">
      <button class="tabbar-fab" :class="{ open }" @click="open = !open">＋</button>
    </view>
    <button
      v-for="tab in tabs.slice(2)"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === active }"
      @click="go(tab.url)"
    >
      <view class="tab-ico" :class="tab.icon" />
      <text v-if="tab.key === active" class="tab-label">{{ tab.label }}</text>
    </button>
  </view>
</template>
