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
  <view class="page">
    <view class="row">
      <view>
        <view class="h1">{{ dayjs(ui.selectedDate).format('M月D日') }}</view>
        <text class="muted">{{ weekLabel(ui.selectedDate) }}</text>
      </view>
      <button class="btn ghost" @click="addOpen = true">添加</button>
    </view>

    <view class="row week">
      <button class="nav" @click="shiftWeek(-1)">上周</button>
      <view class="days">
        <view
          v-for="date in days"
          :key="date"
          class="day"
          :class="{ on: date === ui.selectedDate }"
          @click="ui.selectedDate = date"
        >
          <text>{{ weekday(date) }}</text>
          <text class="num">{{ dayjs(date).format('D') }}</text>
        </view>
      </view>
      <button class="nav" @click="shiftWeek(1)">下周</button>
    </view>

    <view class="card" @click="uni.navigateTo({ url: '/pages/bills/index?from=today' })">
      <view class="row">
        <text>本周待支付</text>
        <text class="pay-unpaid">{{ money(weekOpen) }}</text>
      </view>
      <text class="muted">点开查看全家账单</text>
    </view>

    <DayCourseList :items="items" @edit="editing = $event" />

    <view v-if="cancelled" class="undo">
      <text>已取消这次课</text>
      <button class="undo-btn" @click="undoCancel">撤销</button>
    </view>

    <AddSheet :open="addOpen" :date="ui.selectedDate" @close="addOpen = false" />
    <OccurrenceSheet :item="editing" @close="editing = null" @cancelled="rememberCancel" />
    <TabBar active="today" />
  </view>
</template>

<style scoped>
.week {
  margin: 20rpx 0;
  align-items: stretch;
}
.days {
  flex: 1;
  display: flex;
  justify-content: space-between;
}
.day, .nav {
  background: transparent;
  color: #8b93a5;
  font-size: 22rpx;
}
.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx;
}
.day.on {
  color: #e85b2a;
  font-weight: 700;
}
.num {
  font-size: 28rpx;
}
.undo-btn {
  color: #ffb45c;
  background: transparent;
}
</style>
