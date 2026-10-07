<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { WEEKDAY_SHORT } from '@server-domain/constants'
import { occurrencesOnDate } from '@server-domain/schedule'
import { billNetAmount, billsInDueRange, money } from '@server-domain/billing'
import { sumUnbilledCharges } from '@server-domain/charges'
import type { DayOccurrence } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useUiStore } from '@/stores/ui'
import { useThemePage } from '@/composables/useThemePage'
import { openTab, setTabCover, syncVisibleTab } from '@/utils/nav'
import { occurrenceDots, weekDates, weekLabel } from '@/utils/view'
import AppIcon from '@/components/AppIcon.vue'
import AppHeader from '@/components/AppHeader.vue'
import DayCourseList from '@/components/DayCourseList.vue'
import AddSheet from '@/components/AddSheet.vue'
import OccurrenceSheet from '@/components/OccurrenceSheet.vue'

const store = useFamilyPage()
const themeClass = useThemePage()
const ui = useUiStore()
const addOpen = ref(false)
const editing = ref<DayOccurrence | null>(null)
const cancelled = ref<DayOccurrence | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined
/** 页面常驻，进度环按“回到页面的时刻”计算，而不是首次打开的时刻。 */
const clock = ref(dayjs().format('HH:mm'))

onLoad((query) => {
  if (query?.add === '1') addOpen.value = true
  const app = getApp() as { globalData?: { openTodayAdd?: () => void } }
  app.globalData = app.globalData || {}
  app.globalData.openTodayAdd = () => {
    addOpen.value = true
  }
})

watch([addOpen, editing], () => {
  setTabCover(addOpen.value || Boolean(editing.value))
})

onShow(() => {
  clock.value = dayjs().format('HH:mm')
  syncVisibleTab(0)
  setTabCover(addOpen.value || Boolean(editing.value))
  const app = getApp() as { globalData?: { pendingAdd?: boolean } }
  if (app?.globalData?.pendingAdd) {
    app.globalData.pendingAdd = false
    addOpen.value = true
  }
  if (!ui.pendingAdd) return
  ui.pendingAdd = false
  addOpen.value = true
})

const days = computed(() => weekDates(ui.selectedDate))
const items = computed(() =>
  occurrencesOnDate(store.overviewCourses, ui.selectedDate, store.overviewScheduleExceptions)
    .slice()
    .sort((a, b) => a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)),
)
const weekBills = computed(() => billsInDueRange(store.overviewExpenses, days.value[0], days.value[6]))
const weekOpen = computed(() =>
  weekBills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0),
)
const weekSettledPercent = computed(() => {
  const total = weekBills.value.reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0)
  if (!total) return 0
  const paid = weekBills.value.filter((item) => item.status === 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0)
  return Math.round((paid / total) * 100)
})
const isThisWeek = computed(() => days.value[0] === weekDates(ui.today)[0])
const recordDates = computed(() => new Map((store.snapshot.occurrenceRecords ?? []).map((item) => [item.id, item.date])))
const weekUnbilled = computed(() => {
  const start = days.value[0]
  const end = days.value[6]
  return sumUnbilledCharges(store.overviewCharges, (charge) => {
    const recordDate = recordDates.value.get(charge.occurrenceId)
    const date = recordDate ?? charge.occurrenceId.slice(charge.occurrenceId.lastIndexOf('_') + 1)
    return date >= start && date <= end
  })
})
const dayDonePercent = computed(() => {
  const total = items.value.length
  if (!total) return 0
  const today = ui.today
  if (ui.selectedDate < today) return 100
  if (ui.selectedDate > today) return 0
  const now = clock.value
  const done = items.value.filter((item) => (item.exception?.endTime ?? item.course.recurrence.endTime) <= now).length
  return Math.round((done / total) * 100)
})

const dayViews = computed(() => days.value.map((date) => ({
  date,
  weekday: WEEKDAY_SHORT[dayjs(date).day()],
  num: Number(date.slice(8, 10)),
  colors: occurrenceDots(store.overviewCourses, date, store.overviewScheduleExceptions),
})))
const isToday = computed(() => ui.selectedDate === ui.today)
const selectedLabel = computed(() => dayjs(ui.selectedDate).format('M月D日'))

function shiftWeek(delta: number) {
  ui.selectedDate = dayjs(ui.selectedDate).add(delta, 'week').format('YYYY-MM-DD')
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
  <view class="theme-root" :class="themeClass">
    <AppHeader />
    <view class="page today-page">
      <view class="week-picker">
        <view class="week-toolbar">
          <button @click="shiftWeek(-1)"><AppIcon name="chevron-left" tone="muted" :size="18" /></button>
          <text>{{ isThisWeek ? '本周' : weekLabel(ui.selectedDate) }}</text>
          <button @click="shiftWeek(1)"><AppIcon name="chevron-right" tone="muted" :size="18" /></button>
        </view>
        <view class="date-strip">
          <button
            v-for="day in dayViews"
            :key="day.date"
            :class="{ active: day.date === ui.selectedDate, today: day.date === ui.today }"
            @click="ui.selectedDate = day.date"
          >
            <text>{{ day.weekday }}</text>
            <text class="num">{{ day.num }}</text>
            <view class="course-dots">
              <view v-for="dot in day.colors" :key="dot.id" :style="{ background: dot.color }" />
            </view>
          </button>
        </view>
      </view>

      <view class="overview">
        <view class="overview-card" @click="openTab('/pages/calendar/index')">
          <view class="overview-head">
            <view class="mark"><AppIcon name="calendar" tone="white" :size="15" /></view>
            <text>{{ isToday ? '今日课程' : selectedLabel + '课程' }}</text>
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
            <view class="mark bill"><AppIcon name="bill" tone="white" :size="15" /></view>
            <text>本周课程账单</text>
            <text class="more">›</text>
          </view>
          <view class="overview-body">
            <view>
              <text class="big">{{ money(weekOpen) }}</text>
              <text class="muted">{{ weekBills.length }} 笔账单{{ weekUnbilled ? ' · 待结算 ' + money(weekUnbilled) : '' }}</text>
            </view>
            <view class="overview-ring" :style="{ '--ring': weekSettledPercent + '%' }">
              <text>{{ weekSettledPercent }}%</text>
            </view>
          </view>
        </view>
      </view>

      <DayCourseList
        :title="isToday ? '今日安排' : selectedLabel + '安排'"
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
  </view>
</template>

<style scoped>
.today-page { padding-top: 8px; }
.week-picker {
  margin-bottom: 20px;
  padding: 12px 10px 10px;
  border-radius: 24px;
  background: linear-gradient(170deg, var(--paper) 0%, var(--accent-soft) 100%);
  box-shadow: var(--elev-md), var(--glow-top);
}
.week-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.week-toolbar button {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
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
.course-dots { display: flex; min-height: 6px; justify-content: center; gap: 2px; margin-top: 5px; }
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
  background: linear-gradient(150deg, var(--accent-soft) 0%, var(--paper) 62%);
  box-shadow: var(--elev-md), var(--glow-top);
}
.overview-card.is-bill {
  background: linear-gradient(150deg, var(--unpaid-soft) 0%, var(--paper) 62%);
  box-shadow: var(--elev-md), var(--glow-top);
}
.overview-head { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 700; }
.overview-head text:nth-child(2) { flex: 1; }
.mark {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: linear-gradient(140deg, #ff9a62, #e95331);
  box-shadow: 0 6px 14px -6px rgba(255, 122, 69, 0.75), inset 0 1px 0 rgba(255,255,255,.45);
}
.mark.bill { background: linear-gradient(140deg, #ff8ea3, #d93d59); box-shadow: 0 6px 14px -6px rgba(255, 95, 121, 0.75), inset 0 1px 0 rgba(255,255,255,.45); }
.more { font-size: 15px; }
.overview-body { display: flex; align-items: flex-end; justify-content: space-between; }
.big { display: block; color: var(--ink); font-size: 22px; font-weight: 800; letter-spacing: -0.04em; }
.overview-ring {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: conic-gradient(from 210deg, #e95331 0deg, #ff7a45 var(--ring), var(--ring-rest) var(--ring));
  box-shadow: 0 8px 16px -8px rgba(255, 122, 69, 0.7);
  font-size: 9px;
  font-weight: 800;
  color: #e95331;
}
.is-bill .overview-ring {
  background: conic-gradient(from 210deg, #d93d59 0deg, #ff5f79 var(--ring), var(--ring-rest-bill) var(--ring));
  box-shadow: 0 8px 16px -8px rgba(255, 95, 121, 0.7);
  color: #d93d59;
}
.overview-ring text {
  width: 33px;
  height: 33px;
  border-radius: 50%;
  background: var(--paper);
  text-align: center;
  line-height: 33px;
  box-shadow: inset 0 1px 3px rgba(25, 31, 58, 0.08);
}
</style>
