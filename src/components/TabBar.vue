<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useHomeDate } from '@/composables/useHomeDate'

const route = useRoute()
const router = useRouter()
const { isViewingToday, goToToday } = useHomeDate()

const tabs = [
  { to: '/', key: 'today', label: '今日', icon: 'home' },
  { to: '/calendar', key: 'calendar', label: '日历', icon: 'calendar' },
  { to: '/courses', key: 'courses', label: '课程', icon: 'course' },
  { to: '/stats', key: 'stats', label: '统计', icon: 'stats' },
]

function isActive(key: string) {
  if (key === 'today') return route.path === '/' && isViewingToday.value
  return route.meta.tab === key
}

function onTabClick(event: MouseEvent, key: string, to: string) {
  event.preventDefault()
  if (key === 'today') goToToday()
  if (route.path !== to) router.push(to)
}
</script>

<template>
  <nav class="tabbar">
    <a
      v-for="tab in tabs"
      :key="tab.key"
      :href="tab.to"
      :class="{ active: isActive(tab.key) }"
      @click="onTabClick($event, tab.key, tab.to)"
    >
      <svg v-if="tab.icon === 'home'" viewBox="0 0 24 24"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9Z" /></svg>
      <svg v-else-if="tab.icon === 'calendar'" viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm2-2v4m10-4v4M4 10h16M8 14h2m4 0h2m-8 3h2m4 0h2" /></svg>
      <svg v-else-if="tab.icon === 'course'" viewBox="0 0 24 24"><path d="M4 5.5c3-.8 5.7-.2 8 1.8v12c-2.3-2-5-2.6-8-1.8v-12Zm16 0c-3-.8-5.7-.2-8 1.8v12c2.3-2 5-2.6 8-1.8v-12Z" /></svg>
      <svg v-else viewBox="0 0 24 24"><path d="M5 20V10h3v10H5Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z" /></svg>
      <span>{{ tab.label }}</span>
    </a>
  </nav>
</template>
