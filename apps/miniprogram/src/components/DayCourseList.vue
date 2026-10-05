<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { COURSE_TYPE_LABEL } from '@server-domain/constants'
import { courseCardFee } from '@server-domain/charges'
import { buildCourseBillLedger } from '@server-domain/courseBills'
import { courseScheduleProgress } from '@server-domain/courseSchedule'
import { money } from '@server-domain/billing'
import type { DayOccurrence } from '@server-domain/types'
import { useFamilyStore } from '@/stores/family'
import { occurrenceExpense } from '@/utils/view'
import { cardBackground, deepTone, mix, tileBackground } from '@/utils/color'
import AppIcon from '@/components/AppIcon.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'

const props = withDefaults(defineProps<{
  title: string
  items: DayOccurrence[]
  actionLabel?: string
}>(), {
  actionLabel: '新增',
})

const emit = defineEmits<{
  add: []
  edit: [item: DayOccurrence]
}>()

const store = useFamilyStore()

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
  return buildCourseBillLedger(item.course, store.overviewExpenses, store.overviewScheduleExceptions, store.overviewCharges)
}

const todayLabel = computed(() => dayjs().format('YYYY-MM-DD'))

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
</script>

<template>
  <view class="schedule">
    <view class="schedule-head">
      <text class="schedule-title">{{ title }}</text>
      <button class="add" @click="emit('add')">
        <AppIcon name="plus" tone="accent" :size="14" />
        <text>{{ actionLabel }}</text>
      </button>
    </view>

    <view v-if="items.length" class="lesson-list">
      <view v-for="(item, index) in items" :key="item.id" class="timeline-entry">
        <view class="timeline-marker" :class="{ last: index === items.length - 1 }" :style="{ color: item.course.color }">
          <text>{{ startOf(item) }}</text>
          <view class="timeline-dot" :style="{ background: item.course.color }" />
          <view v-if="participants(item).length" class="timeline-faces">
            <ChildAvatar v-for="child in participants(item)" :key="child.id" :avatar-key="child.avatarKey" :size="26" />
          </view>
        </view>
        <view class="lesson-card" :style="cardStyle(item)">
          <view class="lesson-row">
            <view class="lesson-time" :style="tileStyle(item)">
              <AppIcon :key="courseIcon(item)" :name="courseIcon(item)" tone="white" :size="26" />
            </view>
            <view class="lesson-main">
              <view class="lesson-copy">
                <text class="lesson-type" :style="{ color: deepTone(item.course.color), background: mix(item.course.color, '#ffffff', 0.82) }">{{ COURSE_TYPE_LABEL[item.course.type] }}</text>
                <text class="lesson-name">{{ item.course.title }}</text>
                <view class="lesson-meta">
                  <text>{{ item.course.teacher || '老师待定' }}</text>
                  <view class="dot" />
                  <text>{{ item.course.location || '地点待定' }}</text>
                </view>
                <view class="lesson-period">
                  <text class="dur">{{ duration(item) }}</text>
                  <view class="range">
                    <AppIcon name="clock" tone="muted" :size="12" />
                    <text>{{ startOf(item) }}–{{ endOf(item) }}</text>
                  </view>
                </view>
                <text v-if="item.exception" class="adjust" :style="{ color: item.course.color }">
                  {{ item.exception.status === 'added' ? '本次临时添加' : '本次安排已调整' }}
                </text>
              </view>
              <view class="fee-row">
                <text class="fee">{{ feeOf(item).label }}</text>
                <text
                  v-if="feeOf(item).paid !== undefined"
                  class="pay-pill"
                  :class="feeOf(item).paid ? 'paid' : 'unpaid'"
                >{{ feeOf(item).paid ? '本次已付' : '本次未付' }}</text>
                <text v-if="totals(item)" class="fee-totals">已付 {{ money(totals(item)!.paid) }} · 未付 {{ money(totals(item)!.unpaid) }}</text>
              </view>
            </view>
            <button class="more" @click="emit('edit', item)">
              <AppIcon name="dots" tone="muted" :size="18" />
            </button>
          </view>
          <view class="course-progress">
            <view class="progress-copy">
              <text>课程进度</text>
              <text>{{ progress(item).completed }}/{{ progress(item).total }} 课时</text>
            </view>
            <view class="progress-track" :style="{ background: mix(item.course.color, '#eceef4', 0.86) }">
              <view :style="{ width: progress(item).percent + '%', background: tileBackground(item.course.color) }" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <button class="empty-add" @click="emit('add')"><AppIcon name="plus" tone="accent" :size="22" /></button>
      <text class="empty-title">{{ title.includes('今日') || items.length === 0 && todayLabel ? '这一天没有课程' : '这一天没有课程' }}</text>
      <text class="empty-desc">计划有变化也没关系，好好享受空闲时间。</text>
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
.timeline-entry { display: flex; gap: 10px; margin-bottom: 12px; }
.timeline-marker { position: relative; width: 52px; padding-top: 16px; font-size: 10px; font-weight: 800; }
.timeline-faces { display: flex; flex-direction: column; gap: 4px; margin-top: 28px; }
.timeline-marker::after {
  content: "";
  position: absolute;
  top: 35px;
  right: 3px;
  bottom: -18px;
  width: 2px;
  background: rgba(123, 97, 255, 0.25);
}
.timeline-marker.last::after { bottom: 20px; }
.timeline-dot {
  position: absolute;
  top: 30px;
  right: 0;
  width: 7px;
  height: 7px;
  border: 2px solid var(--bg);
  border-radius: 50%;
}
.lesson-card {
  flex: 1;
  min-width: 0;
  padding: 14px;
  overflow: hidden;
  border-radius: 22px;
}
.lesson-row { display: flex; gap: 10px; align-items: flex-start; }
.lesson-time {
  display: flex;
  width: 54px;
  min-height: 102px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4);
}
.lesson-main { display: flex; flex: 1; gap: 8px; justify-content: space-between; min-width: 0; }
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
  font-size: 17px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-meta { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
.lesson-meta text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lesson-meta .dot { width: 3px; height: 3px; flex: 0 0 auto; border-radius: 50%; background: #c5cad6; }
.range { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 9px; }
.lesson-period { display: flex; flex-wrap: wrap; gap: 5px 9px; align-items: center; margin-top: 11px; }
.dur { font-size: 15px; font-weight: 750; }
.adjust { display: block; margin-top: 6px; font-size: 10px; font-weight: 650; }
.fee-row { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.fee { font-size: 15px; font-weight: 750; }
.pay-pill { padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 750; }
.pay-pill.paid { color: var(--paid); background: var(--paid-soft); }
.pay-pill.unpaid { color: var(--unpaid); background: var(--unpaid-soft); }
.fee-totals { max-width: 118px; color: var(--muted); font-size: 9px; text-align: right; }
.more {
  display: flex;
  width: 32px;
  height: 32px;
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
  background: #fff;
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
