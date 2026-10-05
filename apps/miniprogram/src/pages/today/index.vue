<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad } from '@dcloudio/uni-app'
import { WEEKDAY_SHORT } from '@server-domain/constants'
import { occurrencesOnDate } from '@server-domain/schedule'
import { billsInDueRange, money } from '@server-domain/billing'
import type { DayOccurrence } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useUiStore } from '@/stores/ui'
import { weekDates, weekLabel } from '@/utils/view'
import TabBar from '@/components/TabBar.vue'
import AppHeader from '@/components/AppHeader.vue'
import DayCourseList from '@/components/DayCourseList.vue'
import AddSheet from '@/components/AddSheet.vue'
import OccurrenceSheet from '@/components/OccurrenceSheet.vue'

const store = useFamilyPage()
const ui = useUiStore()
const addOpen = ref(false)
const editing = ref<DayOccurrence | null>(null)
const cancelled = ref<DayOccurrence | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined

onLoad((query) => {
  if (query?.add === '1') addOpen.value = true
})

const days = computed(() => weekDates(ui.selectedDate))
const items = computed(() =>
  occurrencesOnDate(store.overviewCourses, ui.selectedDate, store.overviewScheduleExceptions)
    .slice()
    .sort((a, b) => a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)),
)
const weekBills = computed(() => billsInDueRange(store.overviewExpenses, days.value[0], days.value[6]))
const weekOpen = computed(() =>
  weekBills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0),
)
const weekSettledPercent = computed(() => {
  const total = weekBills.value.reduce((sum, item) => sum + item.amount, 0)
  if (!total) return 0
  const paid = weekBills.value.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0)
  return Math.round((paid / total) * 100)
})
const isThisWeek = computed(() => days.value[0] === weekDates(dayjs().format('YYYY-MM-DD'))[0])
const dayDonePercent = computed(() => {
  const total = items.value.length
  if (!total) return 0
  const today = dayjs().format('YYYY-MM-DD')
  if (ui.selectedDate < today) return 100
  if (ui.selectedDate > today) return 0
  const now = dayjs().format('HH:mm')
  const done = items.value.filter((item) => (item.exception?.endTime ?? item.course.recurrence.endTime) <= now).length
  return Math.round((done / total) * 100)
})

function colorsOf(date: string) {
  return [...new Set(occurrencesOnDate(store.overviewCourses, date, store.overviewScheduleExceptions).map((item) => item.course.color))].slice(0, 3)
}

function shiftWeek(delta: number) {
  ui.selectedDate = dayjs(ui.selectedDate).add(delta, 'week').format('YYYY-MM-DD')
}

function weekday(date: string) {
  return WEEKDAY_SHORT[dayjs(date).day()]
}

function rememberCancel(item: DayOccurrence) {
  cancelled.value = item
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    cancelled.value = null
  }, 4500)
}

async function undoCancel() {
  const item = cancelled.value
  if (!item) return
  const slot = {
    courseId: item.course.id,
    date: item.date,
    startTime: item.exception?.startTime ?? item.course.recurrence.startTime,
    endTime: item.exception?.endTime ?? item.course.recurrence.endTime,
  }
  try {
    if (item.exception?.status === 'added') {
      await store.upsertException({
        courseId: item.course.id,
        date: item.date,
        status: 'added',
        title: item.exception.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: item.exception.location,
        note: item.exception.note,
      })
    } else {
      await store.restoreOccurrence(slot)
    }
    cancelled.value = null
  } catch (error) {
    showCloudError(error)
  }
}
</script>

<template>
  <view>
    <AppHeader />
    <view class="page today-page">
      <view class="week-picker">
        <view class="week-toolbar">
          <button @click="shiftWeek(-1)">‹</button>
          <text>{{ isThisWeek ? '本周' : weekLabel(ui.selectedDate) }}</text>
          <button @click="shiftWeek(1)">›</button>
        </view>
        <view class="date-strip">
          <button
            v-for="date in days"
            :key="date"
            :class="{ active: date === ui.selectedDate, today: date === dayjs().format('YYYY-MM-DD') }"
            @click="ui.selectedDate = date"
          >
            <text>{{ weekday(date) }}</text>
            <text class="num">{{ dayjs(date).date() }}</text>
            <view class="course-dots">
              <view v-for="color in colorsOf(date)" :key="color" :style="{ background: color }" />
            </view>
          </button>
        </view>
      </view>

      <view class="overview">
        <view class="overview-card" @click="uni.reLaunch({ url: '/pages/calendar/index' })">
          <view class="overview-head">
            <text class="mark">历</text>
            <text>{{ ui.selectedDate === dayjs().format('YYYY-MM-DD') ? '今日课程' : dayjs(ui.selectedDate).format('M月D日') + '课程' }}</text>
            <text class="more">›</text>
          </view>
          <view class="overview-body">
            <view>
              <text class="big">{{ items.length }}</text>
              <text class="muted">节安排</text>
            </view>
            <view class="overview-ring" :style="{ '--ring': dayDonePercent + '%' }">
              <text>{{ dayDonePercent }}%</text>
            </view>
          </view>
        </view>
        <view class="overview-card is-bill" @click="uni.navigateTo({ url: '/pages/bills/index?from=today' })">
          <view class="overview-head">
            <text class="mark">账</text>
            <text>本周课程账单</text>
            <text class="more">›</text>
          </view>
          <view class="overview-body">
            <view>
              <text class="big">{{ money(weekOpen) }}</text>
              <text class="muted">{{ weekBills.length }} 笔账单</text>
            </view>
            <view class="overview-ring" :style="{ '--ring': weekSettledPercent + '%' }">
              <text>{{ weekSettledPercent }}%</text>
            </view>
          </view>
        </view>
      </view>

      <DayCourseList
        :title="ui.selectedDate === dayjs().format('YYYY-MM-DD') ? '今日安排' : dayjs(ui.selectedDate).format('M月D日') + '安排'"
        :items="items"
        @add="addOpen = true"
        @edit="editing = $event"
      />

      <view v-if="cancelled" class="undo">
        <text>已取消“{{ cancelled.course.title }}”</text>
        <button @click="undoCancel">撤销</button>
      </view>
      <AddSheet :open="addOpen" :date="ui.selectedDate" @close="addOpen = false" />
      <OccurrenceSheet :item="editing" @close="editing = null" @cancelled="rememberCancel" />
    </view>
    <TabBar active="today" />
  </view>
</template>

<style scoped>
.today-page { padding-top: 8px; }
.week-picker {
  margin-bottom: 20px;
  padding: 12px 10px 10px;
  border-radius: 24px;
  background: linear-gradient(170deg, #fff 0%, #fff6f1 100%);
  box-shadow: var(--elev-md), inset 0 1px 0 rgba(255,255,255,.9);
}
.week-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.week-toolbar button {
  width: 32px;
  height: 32px;
  color: var(--muted);
  font-size: 20px;
}
.week-toolbar text { color: var(--muted); font-size: 11px; font-weight: 650; }
.date-strip { display: flex; gap: 4px; }
.date-strip button {
  flex: 1;
  height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border-radius: 16px;
  font-size: 11px;
}
.date-strip .num { margin-top: 4px; color: var(--ink); font-size: 15px; font-weight: 700; }
.date-strip button.active {
  color: #fff;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 14px 26px -10px rgba(255,122,69,.75);
}
.date-strip button.active .num { color: #fff; }
.course-dots { display: flex; min-height: 6px; gap: 3px; margin-top: 5px; }
.course-dots view { width: 6px; height: 6px; border-radius: 50%; }
.overview { display: flex; gap: 11px; margin-bottom: 28px; }
.overview-card {
  flex: 1;
  min-height: 118px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 15px;
  border-radius: 24px;
  background: linear-gradient(150deg, #fff1ea 0%, #fff 62%);
  box-shadow: var(--elev-md);
}
.overview-card.is-bill { background: linear-gradient(150deg, #ffe8ee 0%, #fff 62%); }
.overview-head { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 700; }
.overview-head text:nth-child(2) { flex: 1; }
.mark {
  width: 24px;
  height: 24px;
  border-radius: 9px;
  color: #fff;
  background: linear-gradient(140deg, #ff9a62, #e95331);
  text-align: center;
  line-height: 24px;
  font-size: 11px;
}
.is-bill .mark { background: linear-gradient(140deg, #ff8ea3, #d93d59); }
.more { font-size: 15px; }
.overview-body { display: flex; align-items: flex-end; justify-content: space-between; }
.big { display: block; font-size: 22px; font-weight: 800; letter-spacing: -0.04em; }
.overview-ring {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: conic-gradient(#ff7a45 var(--ring), #f3e4dc var(--ring));
  font-size: 10px;
  font-weight: 700;
}
.is-bill .overview-ring { background: conic-gradient(#ff5f79 var(--ring), #f8e4e8 var(--ring)); }
.overview-ring text {
  width: 33px;
  height: 33px;
  border-radius: 50%;
  background: #fff;
  text-align: center;
  line-height: 33px;
}
</style>
