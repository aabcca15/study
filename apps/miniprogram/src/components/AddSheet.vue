<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
  busyIntervalsForDates,
  courseParticipantIds,
  findBusyConflict,
  minutesBetween,
  nextAvailableEndTime,
  occurrencesOnDate,
  startTimeOptions,
} from '@server-domain/schedule'
import { showCloudError } from '@/cloud/call'
import { needFamily } from '@/utils/login-gate'
import { TEXT_LIMIT } from '@/domain/limits'
import { amountError, cleanText, formTip } from '@/utils/form'
import { useFamilyStore } from '@/stores/family'
import AppIcon from './AppIcon.vue'
import DateDragGrid from './DateDragGrid.vue'
import TimeField from './TimeField.vue'

const props = defineProps<{
  open: boolean
  date: string
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useFamilyStore()
const mode = ref<'preset' | 'temporary'>('preset')
const dates = ref<string[]>([])
const courseId = ref('')
const title = ref('')
const note = ref('')
const startTime = ref('09:00')
const endTime = ref('10:00')
const amount = ref('')
const paid = ref(false)
const saving = ref(false)
const pickerOpen = ref(false)

const sortedDates = computed(() => [...dates.value].filter(Boolean).sort())
const courses = computed(() => store.overviewCourses)
const selectedCourse = computed(() => courses.value.find((item) => item.id === courseId.value))
const busyChildIds = computed(() => {
  if (selectedCourse.value) return courseParticipantIds(selectedCourse.value)
  return store.child ? [store.child.id] : []
})
const busyIntervals = computed(() =>
  busyIntervalsForDates(
    store.overviewCourses,
    sortedDates.value.length ? sortedDates.value : [props.date],
    store.overviewScheduleExceptions,
    undefined,
    busyChildIds.value,
  ),
)
const conflict = computed(() => findBusyConflict(busyIntervals.value, startTime.value, endTime.value))
const dateLabel = computed(() => {
  const dates = sortedDates.value
  if (!dates.length) return '选择上课日期'
  const first = dayjs(dates[0])
  const last = dayjs(dates[dates.length - 1])
  if (dates.length === 1) return first.format('YYYY年M月D日')
  if (first.isSame(last, 'year')) return `${first.format('YYYY年M月D日')}–${last.format('M月D日')}`
  return `${first.format('YYYY年M月D日')}–${last.format('YYYY年M月D日')}`
})

function courseScheduledOnAllDates(id: string) {
  if (!sortedDates.value.length) return false
  return sortedDates.value.every((day) =>
    occurrencesOnDate(store.overviewCourses, day, store.overviewScheduleExceptions)
      .some((item) => item.course.id === id),
  )
}

function pickDefaultTimes(date: string) {
  const intervals = busyIntervalsForDates(
    store.overviewCourses,
    [date],
    store.overviewScheduleExceptions,
    undefined,
    busyChildIds.value,
  )
  const free = startTimeOptions(intervals).filter((item) => !item.disabled)
  const start = free.find((item) => item.value >= '09:00')?.value ?? free[0]?.value ?? '09:00'
  startTime.value = start
  endTime.value = nextAvailableEndTime(intervals, start, 60)
}

function resetForm() {
  mode.value = 'preset'
  dates.value = [props.date || dayjs().format('YYYY-MM-DD')]
  courseId.value = ''
  title.value = ''
  note.value = ''
  amount.value = ''
  paid.value = false
  pickerOpen.value = false
  pickDefaultTimes(dates.value[0])
}

watch(() => props.open, (open) => {
  if (open) resetForm()
}, { immediate: true })

function selectCourse(id: string) {
  if (courseScheduledOnAllDates(id)) return
  courseId.value = id
}

function setStart(value: string) {
  const duration = minutesBetween(startTime.value, endTime.value)
  startTime.value = value
  endTime.value = nextAvailableEndTime(busyIntervals.value, value, duration > 0 ? duration : 60)
}

function goCreateCourse() {
  emit('close')
  uni.navigateTo({ url: '/subpages/course-edit/index' })
}

async function submit() {
  if (saving.value || needFamily()) return
  const cleanTitle = cleanText(title.value, TEXT_LIMIT.courseTitle)
  if (!sortedDates.value.length) {
    formTip('请选择上课日期')
    return
  }
  if (mode.value === 'preset') {
    if (!courseId.value) {
      formTip('请选择一门课程')
      return
    }
    if (courseScheduledOnAllDates(courseId.value)) {
      formTip('所选日期都已有这门课')
      return
    }
  } else {
    if (!cleanTitle) {
      formTip('请填写计划名称')
      return
    }
    if (!startTime.value || !endTime.value || endTime.value <= startTime.value) {
      formTip('结束时间要晚于开始时间')
      return
    }
    if (conflict.value) {
      formTip(`所选日期中「${conflict.value.title}」已占用该时间段`)
      return
    }
    const amountProblem = amountError(amount.value, '费用')
    if (amountProblem) {
      formTip(amountProblem)
      return
    }
  }
  saving.value = true
  try {
    if (mode.value === 'preset') {
      await store.addOccurrences(courseId.value, sortedDates.value)
    } else {
      await store.quickArrangement({
        dates: sortedDates.value,
        title: cleanTitle,
        note: cleanText(note.value, TEXT_LIMIT.note),
        startTime: startTime.value,
        endTime: endTime.value,
        amount: Number(amount.value) || 0,
        expenseStatus: paid.value ? 'paid' : 'unpaid',
      })
    }
    emit('close')
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view v-if="open" class="mask" @click="emit('close')">
    <view class="sheet" @click.stop>
      <view class="handle" />
      <view class="add-head">
        <view class="add-icon"><AppIcon name="plus" tone="white" :size="22" /></view>
        <view class="add-copy">
          <text class="add-title">新增计划</text>
          <text class="add-caption">选一门已有课程，或临时加一项安排</text>
        </view>
        <text class="close press" hover-class="press-on" hover-stay-time="80" @click="emit('close')">×</text>
      </view>

      <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
        <view class="field">
          <text class="field-label">上课日期<text class="req">*</text></text>
          <view class="date-trigger press" hover-class="press-on" hover-stay-time="80" @click="pickerOpen = true">
            <text class="date-text">{{ dateLabel }}</text>
            <text class="date-count">{{ sortedDates.length ? `${sortedDates.length} 天` : '' }}</text>
          </view>
        </view>

        <view class="mode-tabs">
          <view class="mode-thumb" :class="{ right: mode === 'temporary' }" />
          <text class="mode-tab press" :class="{ on: mode === 'preset' }" hover-class="press-on" hover-stay-time="80" @click="mode = 'preset'">选择已有课程</text>
          <text class="mode-tab press" :class="{ on: mode === 'temporary' }" hover-class="press-on" hover-stay-time="80" @click="mode = 'temporary'">新增临时计划</text>
        </view>

        <template v-if="mode === 'preset'">
          <view v-if="courses.length" class="preset-list">
            <view
              v-for="course in courses"
              :key="course.id"
              class="preset press"
              :class="{ on: courseId === course.id, off: courseScheduledOnAllDates(course.id) }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="selectCourse(course.id)"
            >
              <view class="dot" :style="{ background: course.color }" />
              <view class="preset-copy">
                <text class="preset-name">{{ course.title }}</text>
                <text class="preset-meta">{{ course.recurrence.startTime }}–{{ course.recurrence.endTime }} · {{ course.teacher || '老师待定' }}</text>
              </view>
              <text class="preset-mark">{{ courseScheduledOnAllDates(course.id) ? '已计划' : (courseId === course.id ? '✓' : '') }}</text>
            </view>
          </view>
          <view v-else class="empty-course">
            <button hover-class="press-on" hover-stay-time="80" class="btn outline" @click="goCreateCourse">新增课程</button>
          </view>
        </template>

        <template v-else>
          <view class="field">
            <text class="field-label">计划名称<text class="req">*</text></text>
            <input v-model="title" :maxlength="TEXT_LIMIT.courseTitle" placeholder="请输入计划名称" placeholder-class="ph" />
          </view>
          <view class="field">
            <text class="field-label">备注</text>
            <input v-model="note" :maxlength="TEXT_LIMIT.note" placeholder="请输入备注信息" placeholder-class="ph" />
          </view>
          <view class="row">
            <view class="field" style="flex: 1">
              <text class="field-label">开始时间</text>
              <TimeField :model-value="startTime" @update:model-value="setStart" />
            </view>
            <view class="field" style="flex: 1">
              <text class="field-label">结束时间</text>
              <TimeField v-model="endTime" />
            </view>
          </view>
          <view v-if="busyIntervals.length" class="busy">
            <text v-for="busy in busyIntervals" :key="`${busy.start}-${busy.title}`">{{ busy.start }}–{{ busy.end }} {{ busy.title }}</text>
          </view>
          <view class="field">
            <text class="field-label">费用</text>
            <view class="money">
              <text>¥</text>
              <input v-model="amount" type="digit" :maxlength="TEXT_LIMIT.amount" placeholder="0" placeholder-class="ph" />
            </view>
          </view>
          <view class="row pay-row">
            <text>是否已支付</text>
            <switch :checked="paid" color="#ff7a45" @change="paid = Boolean($event.detail.value)" />
          </view>
        </template>
      </scroll-view>

      <view class="sheet-foot">
        <button hover-class="press-on" hover-stay-time="80" class="btn block" :disabled="saving" @click="submit">{{ saving ? '保存中…' : '确认' }}</button>
      </view>
    </view>
  </view>
  <view v-if="pickerOpen" class="mask picker-mask" @click="pickerOpen = false">
    <view class="sheet picker-sheet" @click.stop>
      <view class="sheet-head">
        <text class="sheet-title">选择上课日期</text>
        <text class="close press" hover-class="press-on" hover-stay-time="80" @click="pickerOpen = false">×</text>
      </view>
      <text class="tip">点选或按住滑动，可连续多选、取消。</text>
      <DateDragGrid :selected="dates" @update:selected="dates = $event" />
      <view class="sheet-foot">
        <button hover-class="press-on" hover-stay-time="80" class="btn block" @click="pickerOpen = false">完成 · {{ dates.length }} 天</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.handle {
  width: 38px;
  height: 4px;
  margin: 2px auto 12px;
  border-radius: 99px;
  background: var(--line);
}
.add-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.add-icon {
  display: flex;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 10px 20px -10px rgba(255, 122, 69, 0.7);
}
.add-copy { flex: 1; min-width: 0; }
.add-title { display: block; color: var(--ink); font-size: 20px; font-weight: 800; letter-spacing: -0.03em; }
.add-caption { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
.sheet-title { font-size: 22px; }
.close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  text-align: center;
  line-height: 34px;
  font-size: 22px;
}
.mode-tabs {
  position: relative;
  display: flex;
  margin-bottom: 14px;
  padding: 4px;
  border-radius: 16px;
  background: var(--surface-2);
}
.mode-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: 39px;
  border-radius: 12px;
  background: var(--accent-soft);
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.mode-thumb.right { transform: translateX(100%); }
.mode-tab {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  height: 39px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition: color 0.3s ease;
}
.mode-tab.on { color: var(--accent-text); }
.mode-tab.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.94);
}
.preset-meta, .busy text {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.preset {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 12px;
  border-radius: 16px;
  background: var(--surface-2);
}
.preset.on { box-shadow: inset 0 0 0 1.5px #ff7a45; background: var(--accent-soft); }
.preset.off { opacity: 0.45; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.preset-copy { flex: 1; min-width: 0; }
.preset-name { display: block; font-weight: 700; }
.preset-mark { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.empty-course { padding: 4px 0 16px; }
.btn.outline {
  width: 100%;
  height: 44px;
  color: var(--accent-text);
  background: transparent;
  box-shadow: inset 0 0 0 1.5px #ff7a45;
  font-weight: 700;
}
.money {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 14px;
  background: var(--field-bg);
  box-shadow: inset 0 0 0 1px var(--line);
}
.money input { flex: 1; height: 44px; }
.busy { margin-bottom: 12px; }
.pay-row { align-items: center; margin-bottom: 8px; }
.date-trigger {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 13px;
  border-radius: 14px;
  color: var(--ink);
  background: var(--field-bg);
  box-shadow: inset 0 0 0 1px var(--line);
}
.date-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.date-count { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.picker-mask { z-index: 12000; }
.picker-sheet { padding-bottom: calc(16px + var(--safe-bottom)); }
</style>
