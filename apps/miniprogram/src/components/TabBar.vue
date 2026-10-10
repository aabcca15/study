<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import { useFamilyStore } from '@/stores/family'
import { useThemeStore } from '@/utils/wx-theme'
import { useUiStore } from '@/stores/ui'
import { openTab } from '@/utils/nav'

const props = defineProps<{
  active?: 'today' | 'calendar' | 'courses' | 'stats'
}>()

const ui = useUiStore()
const theme = useThemeStore()
const family = useFamilyStore()
const open = ref(false)
const travel = ref(false)
const ready = ref(false)
const box = ref({ left: 8, top: 8, width: 72, height: 50 })
const instance = getCurrentInstance()

const tabs = [
  { key: 'today', label: '今日', url: '/pages/today/index', icon: 'clock' },
  { key: 'calendar', label: '日历', url: '/pages/calendar/index', icon: 'calendar' },
  { key: 'courses', label: '课程', url: '/pages/courses/index', icon: 'book' },
  { key: 'stats', label: '统计', url: '/pages/stats/index', icon: 'bars' },
] as const

const leftTabs = tabs.slice(0, 2)
const rightTabs = tabs.slice(2)

const indicatorStyle = computed(() => ({
  left: `${box.value.left}px`,
  top: `${box.value.top}px`,
  width: `${box.value.width}px`,
  height: `${box.value.height}px`,
  opacity: ready.value ? 1 : 0,
}))

function measure() {
  nextTick(() => {
    const query = uni.createSelectorQuery().in(instance?.proxy)
    query.select('#glass-tabbar').boundingClientRect()
    query.select(`#glass-tab-${ui.tab}`).boundingClientRect()
    query.exec((result) => {
      const bar = result?.[0]
      const tab = result?.[1]
      if (!bar || !tab || Array.isArray(bar) || Array.isArray(tab) || !bar.width || !tab.width) return
      const next = {
        left: tab.left - bar.left,
        top: tab.top - bar.top,
        width: tab.width,
        height: tab.height,
      }
      const moved = Math.abs(next.left - box.value.left) > 4 || Math.abs(next.width - box.value.width) > 4
      box.value = next
      ready.value = true
      if (!moved) return
      travel.value = true
      setTimeout(() => {
        travel.value = false
      }, 220)
    })
  })
}

function go(key: typeof tabs[number]['key'], url: string) {
  open.value = false
  if (ui.tab === key) {
    const current = getCurrentPages().slice(-1)[0]?.route
    if (current && `/${current}` === url) return
  }
  ui.tab = key
  measure()
  openTab(url)
}

function toggleFab() {
  if (!family.canWrite) {
    uni.showToast({ icon: 'none', title: '家人只能查看课表' })
    return
  }
  open.value = !open.value
}

function openFamily() {
  open.value = false
  uni.navigateTo({ url: '/subpages/family/index' })
}

function quick(url: string) {
  if (!family.canWrite) {
    uni.showToast({ icon: 'none', title: '家人只能查看课表' })
    return
  }
  open.value = false
  if (url.startsWith('/pages/today')) {
    ui.pendingAdd = true
    ui.tab = 'today'
    openTab('/pages/today/index')
    return
  }
  uni.navigateTo({ url })
}

watch(() => props.active, (value) => {
  if (!value || value === ui.tab) return
  ui.tab = value
}, { immediate: true })

function measureSoon() {
  measure()
  setTimeout(measure, 280)
}

watch(() => ui.tab, () => measureSoon())

onMounted(measureSoon)
onShow(measureSoon)
</script>

<template>
  <view class="quick-backdrop" :class="{ show: open, dark: theme.isDark }" @click="open = false" />
  <view class="quick-menu" :class="{ show: open, dark: theme.isDark }">
    <button hover-class="press-on" hover-stay-time="80" class="quick-item" @click="quick('/pages/today/index?add=1')">
      <text class="quick-badge accent">＋</text>
      <view>
        <text class="title">快速新增安排</text>
        <text class="desc">选择日期、已有课程或临时安排</text>
      </view>
    </button>
    <button hover-class="press-on" hover-stay-time="80" class="quick-item" @click="quick('/subpages/course-edit/index')">
      <text class="quick-badge amber">✦</text>
      <view>
        <text class="title">新增课程</text>
        <text class="desc">建立新的课程预设</text>
      </view>
    </button>
    <button hover-class="press-on" hover-stay-time="80" class="quick-item" @click="quick('/subpages/expense-edit/index')">
      <text class="quick-badge teal">¥</text>
      <view>
        <text class="title">记一笔账单</text>
        <text class="desc">登记一次课程费用</text>
      </view>
    </button>
    <button hover-class="press-on" hover-stay-time="80" class="quick-item" @click="openFamily">
      <view class="quick-badge violet"><AppIcon name="family" tone="white" :size="22" /></view>
      <view>
        <text class="title">邀请家人</text>
        <text class="desc">邀请家长或家人一起看课表</text>
      </view>
    </button>
  </view>

  <view id="glass-tabbar" class="tabbar" :class="{ dark: theme.isDark }">
    <view class="indicator" :class="{ travel }" :style="indicatorStyle" />
    <view
      v-for="tab in leftTabs"
      :id="'glass-tab-' + tab.key"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === ui.tab }"
      hover-class="press-on"
      hover-stay-time="80"
      @click="go(tab.key, tab.url)"
    >
      <AppIcon :name="tab.icon" :tone="tab.key === ui.tab ? 'accent' : 'muted'" :size="21" />
      <text class="tab-label">{{ tab.label }}</text>
    </view>
    <view class="tabbar-center">
      <button hover-class="press-on" hover-stay-time="80" class="tabbar-fab" :class="{ open }" @click="toggleFab">
        <text class="fab-mark">＋</text>
      </button>
    </view>
    <view
      v-for="tab in rightTabs"
      :id="'glass-tab-' + tab.key"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === ui.tab }"
      hover-class="press-on"
      hover-stay-time="80"
      @click="go(tab.key, tab.url)"
    >
      <AppIcon :name="tab.icon" :tone="tab.key === ui.tab ? 'accent' : 'muted'" :size="21" />
      <text class="tab-label">{{ tab.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.tabbar {
  position: fixed;
  z-index: 900;
  left: 50%;
  bottom: calc(10px + var(--safe-bottom));
  transform: translateX(-50%);
  width: calc(100% - 24px);
  max-width: 432px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 30px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 0 rgba(255, 255, 255, 0.35),
    0 18px 40px -18px rgba(25, 31, 58, 0.38);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
}

.indicator {
  position: absolute;
  z-index: 0;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(130% 100% at 24% 4%, rgba(255,255,255,.98) 0%, rgba(255,255,255,.72) 34%, rgba(255,255,255,.28) 68%, rgba(255,255,255,.12) 100%),
    linear-gradient(160deg, rgba(243,248,255,.92) 0%, rgba(255,255,255,.4) 46%, rgba(223,234,250,.78) 100%);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,1),
    inset 0 -1px 1px rgba(255,255,255,.9),
    inset 0 0 0 1px rgba(255,255,255,.85),
    0 10px 20px -12px rgba(40, 52, 88, 0.28);
  pointer-events: none;
  transition: left .48s cubic-bezier(.22,.8,.28,1), top .48s cubic-bezier(.22,.8,.28,1), width .48s cubic-bezier(.22,.8,.28,1), height .48s cubic-bezier(.22,.8,.28,1), transform .22s cubic-bezier(.2,.8,.2,1), opacity .2s ease;
}

.indicator.travel {
  transform: scaleX(1.08) scaleY(0.9);
}

.tab {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: #8c93a3;
  background: transparent;
  transition: transform 0.46s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.tab.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.94);
}

.tab.active {
  color: var(--accent-text);
  font-weight: 700;
}

.tab-label {
  max-width: 0;
  margin-left: 0;
  overflow: hidden;
  opacity: 0;
  font-size: 10px;
  white-space: nowrap;
  transition: max-width .28s ease, margin-left .28s ease, opacity .2s ease;
}

.tab.active .tab-label {
  max-width: 42px;
  margin-left: 6px;
  opacity: 1;
}

.tabbar-center {
  position: relative;
  z-index: 1;
  width: 74px;
  display: flex;
  justify-content: center;
}

.tabbar-fab {
  position: relative;
  display: flex;
  width: 50px;
  height: 50px;
  margin-top: -28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow:
    0 0 0 5px rgba(255, 255, 255, 0.55),
    0 0 0 8px rgba(255, 255, 255, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 14px 26px -8px rgba(255, 122, 69, 0.75);
  backdrop-filter: blur(8px);
  transition: transform 0.46s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow .24s ease;
}
.tabbar-fab.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.92);
}

.tabbar-fab.open {
  transform: rotate(135deg) scale(0.96);
}
.tabbar-fab.open.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: rotate(135deg) scale(0.88);
}

.fab-mark {
  font-size: 30px;
  font-weight: 300;
  line-height: 1;
}

.quick-backdrop {
  position: fixed;
  z-index: 880;
  inset: 0;
  background: rgba(24, 28, 44, 0.18);
  opacity: 0;
  pointer-events: none;
  transition: opacity .24s ease;
}

.quick-backdrop.show {
  opacity: 1;
  pointer-events: auto;
}

.quick-menu {
  position: fixed;
  z-index: 950;
  left: 50%;
  bottom: calc(104px + var(--safe-bottom));
  width: min(268px, calc(100% - 48px));
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), var(--elev-lg);
  backdrop-filter: blur(18px) saturate(160%);
  opacity: 0;
  transform: translateX(-50%) translateY(14px) scale(.92);
  pointer-events: none;
  transition: opacity .24s ease, transform .3s cubic-bezier(.2,.8,.2,1);
}

.quick-menu.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
  pointer-events: auto;
}

.quick-item {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 9px;
  text-align: left;
  border-radius: 18px;
  background: transparent;
  color: var(--ink);
}

.quick-badge {
  display: flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
}

.quick-badge.accent { background: linear-gradient(135deg, #ffb45c, #f15a36); }
.quick-badge.amber { background: linear-gradient(140deg, #ffce6b, #f5a524); }
.quick-badge.teal { background: linear-gradient(140deg, #58d8bd, #1fa98c); }
.quick-badge.violet { background: linear-gradient(140deg, #9a86ff, #6a4ee8); }

.quick-item text { display: block; }
.quick-item .title { font-size: 13px; font-weight: 700; }
.quick-item .desc { margin-top: 3px; color: var(--muted); font-size: 10px; }

.tabbar.dark {
  background: rgba(28, 34, 48, 0.72);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 18px 40px -18px rgba(0, 0, 0, 0.55);
}
.tabbar.dark .indicator {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.06) 50%, rgba(255, 255, 255, 0.12) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.36), inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 10px 20px -12px rgba(0, 0, 0, 0.55);
}
.tabbar.dark .tab { color: #8d94a5; }
.tabbar.dark .tab.active { color: #ffb08d; }
.tabbar.dark .tabbar-fab {
  box-shadow: 0 0 0 5px rgba(16, 19, 27, 0.72), 0 0 0 8px rgba(16, 19, 27, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 14px 26px -8px rgba(255, 122, 69, 0.55);
}
.quick-menu.dark {
  background: rgba(28, 34, 48, 0.82);
  border-color: rgba(255, 255, 255, 0.08);
}
.quick-backdrop.dark { background: rgba(8, 10, 16, 0.45); }
</style>
