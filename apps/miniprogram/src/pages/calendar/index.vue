<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { occurrencesOnDate } from '@server-domain/schedule'
import type { DayOccurrence } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useUiStore } from '@/stores/ui'
import { monthMatrix } from '@/utils/view'
import TabBar from '@/components/TabBar.vue'
import DayCourseList from '@/components/DayCourseList.vue'
import AddSheet from '@/components/AddSheet.vue'
import OccurrenceSheet from '@/components/OccurrenceSheet.vue'
import DateField from '@/components/DateField.vue'

const store = useFamilyPage()
const ui = useUiStore()
const cursor = ref(dayjs().format('YYYY-MM'))
const addOpen = ref(false)
const editing = ref<DayOccurrence | null>(null)
const cancelled = ref<DayOccurrence | null>(null)

const cells = computed(() => monthMatrix(cursor.value))
const items = computed(() =>
  occurrencesOnDate(store.overviewCourses, ui.selectedDate, store.overviewScheduleExceptions),
)

function marked(date: string) {
  return occurrencesOnDate(store.overviewCourses, date, store.overviewScheduleExceptions).length > 0
}

function shiftMonth(delta: number) {
  cursor.value = dayjs(`${cursor.value}-01`).add(delta, 'month').format('YYYY-MM')
}

function pick(date: string) {
  ui.selectedDate = date
  cursor.value = date.slice(0, 7)
}

function jump(date: string) {
  if (!date) return
  pick(date)
}

async function undoCancel() {
  const item = cancelled.value
  if (!item) return
  try {
    if (item.exception?.status === 'added') {
      await store.upsertException({
        courseId: item.course.id,
        date: item.date,
        status: 'added',
        startTime: item.exception.startTime,
        endTime: item.exception.endTime,
        title: item.exception.title,
        location: item.exception.location,
      })
    } else {
      await store.restoreOccurrence({
        courseId: item.course.id,
        date: item.date,
        startTime: item.exception?.startTime ?? item.course.recurrence.startTime,
        endTime: item.exception?.endTime ?? item.course.recurrence.endTime,
      })
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
      <button class="nav" @click="shiftMonth(-1)">上月</button>
      <DateField :model-value="`${cursor}-01`" @update:model-value="jump" />
      <button class="nav" @click="shiftMonth(1)">下月</button>
    </view>
    <view class="weekdays">
      <text v-for="label in ['一', '二', '三', '四', '五', '六', '日']" :key="label">{{ label }}</text>
    </view>
    <view class="grid">
      <view
        v-for="(date, index) in cells"
        :key="index"
        class="cell"
        :class="{ on: date === ui.selectedDate, empty: !date }"
        @click="date && pick(date)"
      >
        <text v-if="date">{{ dayjs(date).date() }}</text>
        <text v-if="date && marked(date)" class="dot">●</text>
      </view>
    </view>

    <view class="row" style="margin: 12rpx 0 20rpx">
      <text class="h1" style="font-size: 34rpx">{{ dayjs(ui.selectedDate).format('M月D日') }}</text>
      <button class="btn ghost" @click="addOpen = true">添加</button>
    </view>
    <DayCourseList :items="items" @edit="editing = $event" />

    <view v-if="cancelled" class="undo">
      <text>已取消这次课</text>
      <button class="undo-btn" @click="undoCancel">撤销</button>
    </view>
    <AddSheet :open="addOpen" :date="ui.selectedDate" @close="addOpen = false" />
    <OccurrenceSheet :item="editing" @close="editing = null" @cancelled="cancelled = $event" />
    <TabBar active="calendar" />
  </view>
</template>

<style scoped>
.nav, .undo-btn {
  background: transparent;
  color: #e85b2a;
}
.weekdays, .grid {
  display: flex;
  flex-wrap: wrap;
  text-align: center;
}
.weekdays text, .cell {
  width: 14.28%;
}
.weekdays {
  margin-top: 16rpx;
  color: #8b93a5;
  font-size: 22rpx;
}
.cell {
  height: 84rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.cell.on {
  color: #e85b2a;
  font-weight: 700;
}
.dot {
  color: #ff7a45;
  font-size: 16rpx;
  line-height: 1;
}
</style>
