<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { occurrencesOnDate } from '@server-domain/schedule'
import type { DayOccurrence } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useUiStore } from '@/stores/ui'
import { setTabCover } from '@/utils/nav'
import { monthMatrix } from '@/utils/view'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'
import DayCourseList from '@/components/DayCourseList.vue'
import AddSheet from '@/components/AddSheet.vue'
import OccurrenceSheet from '@/components/OccurrenceSheet.vue'

const store = useFamilyPage()
const ui = useUiStore()
const cursor = ref(dayjs().format('YYYY-MM'))
const addOpen = ref(false)
const editing = ref<DayOccurrence | null>(null)
const cancelled = ref<DayOccurrence | null>(null)

watch([addOpen, editing], () => {
  setTabCover(addOpen.value || Boolean(editing.value))
})

onShow(() => {
  setTabCover(addOpen.value || Boolean(editing.value))
})

const cells = computed(() => monthMatrix(cursor.value))
const items = computed(() =>
  occurrencesOnDate(store.overviewCourses, ui.selectedDate, store.overviewScheduleExceptions),
)

function colorsOf(date: string) {
  return [...new Set(occurrencesOnDate(store.overviewCourses, date, store.overviewScheduleExceptions).map((item) => item.course.color))].slice(0, 3)
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
  <view>
    <AppHeader />
    <view class="page">
      <PageHeader eyebrow="课程日历" :title="dayjs(cursor + '-01').format('YYYY年M月')">
        <template #actions>
          <view class="nav">
            <button @click="shiftMonth(-1)">‹</button>
            <button class="today" @click="cursor = dayjs().format('YYYY-MM'); ui.selectedDate = dayjs().format('YYYY-MM-DD')">今</button>
            <button @click="shiftMonth(1)">›</button>
          </view>
        </template>
      </PageHeader>
      <view class="card cal">
        <view class="week">
          <text v-for="label in ['一', '二', '三', '四', '五', '六', '日']" :key="label">{{ label }}</text>
        </view>
        <view class="days">
          <button
            v-for="(date, index) in cells"
            :key="index"
            class="day"
            :class="{ muted: date && date.slice(0, 7) !== cursor, today: date === dayjs().format('YYYY-MM-DD'), on: date === ui.selectedDate }"
            @click="date && pick(date)"
          >
            <text>{{ date ? dayjs(date).date() : '' }}</text>
            <view class="dots">
              <view v-for="color in (date ? colorsOf(date) : [])" :key="color" :style="{ background: color }" />
            </view>
          </button>
        </view>
      </view>
      <DayCourseList
        :title="dayjs(ui.selectedDate).format('M月D日') + '安排'"
        :items="items"
        @add="addOpen = true"
        @edit="editing = $event"
      />
      <view v-if="cancelled" class="undo">
        <text>已取消“{{ cancelled.course.title }}”</text>
        <button @click="undoCancel">撤销</button>
      </view>
      <AddSheet :open="addOpen" :date="ui.selectedDate" @close="addOpen = false" />
      <OccurrenceSheet :item="editing" @close="editing = null" @cancelled="cancelled = $event" />
    </view>
  </view>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  padding: 3px;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--elev-sm);
}
.nav button {
  width: 32px;
  height: 30px;
  color: var(--muted);
  border-radius: 11px;
  font-size: 16px;
  font-weight: 700;
}
.nav .today {
  width: 38px;
  color: var(--accent-text);
  background: var(--accent-soft);
  font-size: 12px;
}
.cal { margin-bottom: 18px; }
.week, .days { display: flex; flex-wrap: wrap; text-align: center; }
.week text, .day { width: 14.28%; }
.week { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
.day {
  height: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 14px;
}
.day.muted { color: #c5cad6; }
.day.today { font-weight: 700; }
.day.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 700; }
.dots { display: flex; gap: 2px; min-height: 5px; margin-top: 2px; }
.dots view { width: 4px; height: 4px; border-radius: 50%; }
</style>
