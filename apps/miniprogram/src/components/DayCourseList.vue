<script setup lang="ts">
import { computed } from 'vue'
import { COURSE_TYPE_LABEL } from '@server-domain/constants'
import { courseCardFee } from '@server-domain/charges'
import { buildCourseBillLedger } from '@server-domain/courseBills'
import { courseScheduleProgress } from '@server-domain/courseSchedule'
import { money } from '@server-domain/billing'
import type { DayOccurrence } from '@server-domain/types'
import { useFamilyStore } from '@/stores/family'
import { occurrenceExpense } from '@/utils/view'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import { cardBackground, currentMixBase, deepTone, mix, tileBackground } from '@/utils/color'
import AppIcon from '@/components/AppIcon.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'

const props = withDefaults(defineProps<{
  title: string
  items: DayOccurrence[]
  actionLabel?: string
  readonly?: boolean
  hideFee?: boolean
}>(), {
  actionLabel: '新增',
  readonly: false,
  hideFee: false,
})

const emit = defineEmits<{
  add: []
  edit: [item: DayOccurrence]
}>()

const store = useFamilyStore()
const { isDark } = storeToRefs(useThemeStore())

function progress(item: DayOccurrence) {
  return courseScheduleProgress(item.course, item.date, store.overviewScheduleExceptions)
}

function startOf(item: DayOccurrence) {
  return item.exception?.startTime ?? item.course.recurrence.startTime
}

function endOf(item: DayOccurrence) {
  return item.exception?.endTime ?? item.course.recurrence.endTime
}

function duration(item: DayOccurrence) {
  const [sh, sm] = startOf(item).split(':').map(Number)
  const [eh, em] = endOf(item).split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

function feeOf(item: DayOccurrence) {
  const course = item.course
  const expense = course.billingPolicy?.pricingMode === 'prepaid' || course.billingMode === 'term'
    ? store.snapshot.expenses.find((bill) =>
      bill.courseId === course.id && bill.status !== 'void' && (bill.source === 'course_upfront' || bill.billingMode === 'term'),
    )
    : occurrenceExpense(store.overviewExpenses, course, item.date)
  return courseCardFee(course, expense)
}

function totals(item: DayOccurrence) {
  if (item.course.billingPolicy?.pricingMode === 'free' || item.course.billingMode === 'free') return null
  return buildCourseBillLedger(item.course, store.overviewExpenses, store.overviewScheduleExceptions, store.overviewCharges, store.overviewPayments)
}

function participants(item: DayOccurrence) {
  if (store.snapshot.children.length <= 1) return []
  const assigned = item.course.childIds?.length ? item.course.childIds : [item.course.childId]
  return store.snapshot.children.filter((child) => assigned.includes(child.id))
}

function courseIcon(item: DayOccurrence) {
  const live = store.snapshot.courses.find((course) => course.id === item.course.id)
  return live?.icon || item.course.icon || 'generic'
}

function cardStyle(item: DayOccurrence) {
  const tint = item.course.color
  return {
    background: cardBackground(tint),
    boxShadow: `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -16px ${mix(tint, '#191f3a', 0.58)}, inset 0 1px 0 rgba(255,255,255,.9)`,
  }
}

function tileStyle(item: DayOccurrence) {
  const tint = item.course.color
  return {
    background: tileBackground(tint),
    boxShadow: `0 10px 20px -10px ${mix(tint, '#191f3a', 0.3)}, inset 0 1px 0 rgba(255,255,255,.4)`,
  }
}

/** 每张卡片的账单、进度只算一次；缓存的页面在数据变化时也只重算一遍。 */
const rows = computed(() => {
  const paper = currentMixBase()
  const dark = isDark.value
  return props.items.map((item) => {
  const color = item.course.color
  const done = progress(item)
  return {
    item,
    start: startOf(item),
    end: endOf(item),
    duration: duration(item),
    fee: feeOf(item),
    totals: totals(item),
    progress: done,
    faces: participants(item),
    icon: courseIcon(item),
    cardStyle: cardStyle(item),
    tileStyle: tileStyle(item),
    typeStyle: { color: deepTone(color), background: mix(color, paper, dark ? 0.72 : 0.82) },
    trackStyle: { background: mix(color, dark ? '#2a3142' : '#eceef4', 0.86) },
    fillStyle: {
      width: done.percent + '%',
      background: `linear-gradient(90deg, ${mix(color, paper, 0.28)} 0%, ${deepTone(color)} 100%)`,
    },
    startStyle: { color: deepTone(color) },
    endStyle: { color: mix(color, paper, dark ? 0.42 : 0.36) },
    lineStyle: {
      background: `linear-gradient(180deg, ${deepTone(color)} 0%, ${mix(color, paper, dark ? 0.68 : 0.58)} 100%)`,
    },
    dotStyle: {
      background: deepTone(color),
      boxShadow: `0 0 0 2px ${mix(color, paper, 0.55)}`,
    },
  }
})
})
</script>

<template>
  <view class="schedule">
    <view class="schedule-head">
      <text class="schedule-title">{{ title }}</text>
      <button v-if="!readonly" class="add" @click="emit('add')">
        <AppIcon name="plus" tone="accent" :size="14" />
        <text>{{ actionLabel }}</text>
      </button>
    </view>

    <view v-if="rows.length" class="lesson-list">
      <view v-for="(row, index) in rows" :key="row.item.id" class="timeline-entry">
        <view class="timeline-marker">
          <view class="timeline-times">
            <text class="timeline-start" :style="row.startStyle">{{ row.start }}</text>
            <text class="timeline-end" :style="row.endStyle">{{ row.end }}</text>
          </view>
          <view class="timeline-rail">
            <view class="timeline-line" :class="{ last: index === rows.length - 1 }" :style="row.lineStyle" />
            <view class="timeline-dot" :style="row.dotStyle" />
            <view v-if="row.faces.length" class="timeline-faces">
              <ChildAvatar v-for="child in row.faces" :key="child.id" :avatar-key="child.avatarKey" :size="26" />
            </view>
          </view>
        </view>
        <view class="lesson-card" :style="row.cardStyle">
          <view class="lesson-body">
            <view class="lesson-time" :style="row.tileStyle">
              <AppIcon :key="row.icon" :name="row.icon" tone="white" :size="26" />
            </view>
            <view class="lesson-copy">
              <text class="lesson-type" :style="row.typeStyle">{{ COURSE_TYPE_LABEL[row.item.course.type] }}</text>
              <text class="lesson-name">{{ row.item.course.title }}</text>
              <view class="lesson-meta">
                <text>{{ row.item.course.teacher || '老师待定' }}</text>
                <view class="dot" />
                <text>{{ row.item.course.location || '地点待定' }}</text>
              </view>
              <view class="lesson-period">
                <text class="dur">{{ row.duration }}</text>
                <view class="range">
                  <AppIcon name="clock" tone="muted" :size="12" />
                  <text>{{ row.start }}–{{ row.end }}</text>
                </view>
              </view>
              <text v-if="row.item.exception" class="adjust" :style="{ color: row.item.course.color }">
                {{ row.item.exception.status === 'added' ? '本次临时添加' : '本次安排已调整' }}
              </text>
            </view>
            <view class="lesson-side">
              <button class="more" @click="emit('edit', row.item)">
                <AppIcon name="dots" tone="muted" :size="18" />
              </button>
              <view v-if="!hideFee" class="fee-row">
                <text class="fee">{{ row.fee.label }}</text>
                <text
                  v-if="row.fee.paid !== undefined"
                  class="pay-pill"
                  :class="row.fee.paid ? 'paid' : 'unpaid'"
                >{{ row.fee.paid ? '本次已付' : '本次未付' }}</text>
                <text v-if="row.totals" class="fee-totals">已付 {{ money(row.totals.paid) }} · 未付 {{ money(row.totals.unpaid) }}</text>
              </view>
            </view>
          </view>
          <view class="course-progress">
            <view class="progress-copy">
              <text>课程进度</text>
              <text>{{ row.progress.completed }}/{{ row.progress.total }} 课时</text>
            </view>
            <view class="progress-track" :style="row.trackStyle">
              <view :style="row.fillStyle" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <button v-if="!readonly" class="empty-add" @click="emit('add')"><AppIcon name="plus" tone="accent" :size="22" /></button>
      <text class="empty-title">这一天没有课程</text>
      <text class="empty-desc">{{ readonly ? '今天没有需要接送的安排。' : '计划有变化也没关系，好好享受空闲时间。' }}</text>
    </view>
  </view>
</template>

<style scoped>
.schedule { margin-bottom: 28px; }
.schedule-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.schedule-title { font-size: 19px; font-weight: 800; letter-spacing: -0.025em; }
.add {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  color: var(--accent-text);
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}
.timeline-entry { display: flex; align-items: stretch; gap: 8px; margin-bottom: 12px; }
.timeline-marker {
  display: flex;
  width: 52px;
  flex: 0 0 auto;
  align-items: stretch;
  padding-top: 2px;
}
.timeline-times {
  display: flex;
  width: 36px;
  flex-direction: column;
  justify-content: space-between;
  padding: 1px 3px 2px 0;
}
.timeline-start, .timeline-end {
  width: 100%;
  font-size: 9px;
  letter-spacing: -0.04em;
  line-height: 1;
  text-align: right;
}
.timeline-start { font-weight: 800; }
.timeline-end { font-weight: 650; }
.timeline-rail { position: relative; flex: 1; width: 12px; min-width: 12px; }
.timeline-line {
  position: absolute;
  top: 7px;
  bottom: -12px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  border-radius: 999px;
}
.timeline-line.last { bottom: 10px; }
.timeline-dot {
  position: absolute;
  z-index: 1;
  top: 1px;
  left: 50%;
  width: 7px;
  height: 7px;
  margin-left: -5.5px;
  border: 2px solid var(--bg);
  border-radius: 50%;
}
.timeline-faces {
  position: absolute;
  z-index: 2;
  top: 18px;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transform: translateX(-50%);
}
.lesson-card {
  flex: 1;
  min-width: 0;
  padding: 14px;
  overflow: hidden;
  border-radius: 22px;
}
.lesson-body { display: flex; align-items: flex-start; gap: 10px; }
.lesson-time {
  display: flex;
  width: 54px;
  min-height: 102px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4);
}
.lesson-copy { min-width: 0; flex: 1; }
.lesson-type {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 700;
}
.lesson-name {
  display: block;
  margin: 7px 0 5px;
  overflow: hidden;
  color: var(--ink);
  font-size: 17px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
.lesson-meta text { min-width: 0; line-height: 1.35; }
.lesson-meta .dot { width: 3px; height: 3px; flex: 0 0 auto; border-radius: 50%; background: var(--faint); }
.range { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 9px; }
.lesson-period { display: flex; flex-wrap: wrap; gap: 5px 9px; align-items: center; margin-top: 11px; }
.dur { font-size: 15px; font-weight: 750; }
.adjust { display: block; margin-top: 6px; font-size: 10px; font-weight: 650; }
.lesson-side {
  display: flex;
  width: 78px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.fee-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  text-align: right;
}
.fee { font-size: 15px; font-weight: 750; white-space: nowrap; }
.pay-pill { padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 750; }
.pay-pill.paid { color: var(--paid); background: var(--paid-soft); }
.pay-pill.unpaid { color: var(--unpaid); background: var(--unpaid-soft); }
.fee-totals { color: var(--muted); font-size: 9px; line-height: 1.35; text-align: right; }
.more {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}
.course-progress { margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--line); }
.progress-copy { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--muted); font-size: 10px; }
.progress-track { height: 5px; border-radius: 999px; overflow: hidden; }
.progress-track view { height: 100%; border-radius: 999px; }
.empty-state {
  padding: 28px 20px 24px;
  text-align: center;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md);
}
.empty-add {
  display: flex;
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed rgba(255, 122, 69, 0.45);
  border-radius: 14px;
  background: var(--accent-soft);
}
.empty-title { display: block; font-size: 17px; font-weight: 700; }
.empty-desc { display: block; margin-top: 8px; color: var(--muted); font-size: 12px; }
</style>
