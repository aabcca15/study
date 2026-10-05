<script setup lang="ts">
const props = defineProps<{
  active: 'today' | 'calendar' | 'courses' | 'stats'
}>()

const tabs = [
  { key: 'today', label: '今日', url: '/pages/today/index' },
  { key: 'calendar', label: '日历', url: '/pages/calendar/index' },
  { key: 'plus', label: '', url: '' },
  { key: 'courses', label: '课程', url: '/pages/courses/index' },
  { key: 'stats', label: '统计', url: '/pages/stats/index' },
] as const

function open(url: string) {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]?.route
  if (current && `/${current}` === url) return
  uni.reLaunch({ url })
}

function openPlus() {
  uni.showActionSheet({
    itemList: ['快速安排', '新增课程', '记一笔'],
    success(res) {
      if (res.tapIndex === 0) uni.reLaunch({ url: '/pages/today/index?add=1' })
      if (res.tapIndex === 1) uni.navigateTo({ url: '/pages/course-edit/index' })
      if (res.tapIndex === 2) uni.navigateTo({ url: '/pages/expense-edit/index' })
    },
  })
}
</script>

<template>
  <view class="tabbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === active, 'tab-plus': tab.key === 'plus' }"
      @click="tab.key === 'plus' ? openPlus() : open(tab.url)"
    >
      {{ tab.key === 'plus' ? '+' : tab.label }}
    </button>
  </view>
</template>
