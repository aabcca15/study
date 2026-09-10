<script setup lang="ts">
import { computed } from 'vue'
import { COURSE_TYPE_LABEL } from '@/domain/constants'
import type { DayOccurrence } from '@/domain/types'
import CourseIcon from '@/components/CourseIcon.vue'

const props = defineProps<{
  item: DayOccurrence
  index: number
  progress: { completed: number; total: number; percent: number }
}>()
defineEmits<{ edit: [item: DayOccurrence] }>()

const cardStyle = computed(() => ({
  '--card-tint': props.item.course.color,
  '--delay': `${props.index * 70}ms`,
}))

function minutesOf(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const durationLabel = computed(() => {
  let minutes = minutesOf(props.item.course.recurrence.endTime) - minutesOf(props.item.course.recurrence.startTime)
  if (minutes < 0) minutes += 24 * 60
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${Number(hours.toFixed(1))}h`
})

const timeRange = computed(
  () => `${props.item.course.recurrence.startTime}–${props.item.course.recurrence.endTime}`,
)
</script>

<template>
  <article
    class="lesson-card"
    :style="cardStyle"
  >
    <div class="lesson-time">
      <i><CourseIcon :name="item.course.icon ?? 'generic'" /></i>
    </div>
    <div class="lesson-main">
      <span class="lesson-type">{{ COURSE_TYPE_LABEL[item.course.type] }}</span>
      <h3>{{ item.course.title }}</h3>
      <p>
        <span>{{ item.course.teacher || '老师待定' }}</span>
        <i />
        <span>{{ item.course.location || '地点待定' }}</span>
      </p>
      <div class="lesson-period">
        <strong>{{ durationLabel }}</strong>
        <span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l3 2" />
          </svg>
          {{ timeRange }}
        </span>
      </div>
      <small v-if="item.exception">{{ item.exception.status === 'added' ? '本次临时添加' : '本次安排已调整' }}</small>
    </div>
    <div class="lesson-actions">
      <button class="edit" type="button" aria-label="编辑本次课程" @click="$emit('edit', item)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.35" />
          <circle cx="12" cy="12" r="1.35" />
          <circle cx="12" cy="19" r="1.35" />
        </svg>
      </button>
    </div>
    <div class="course-progress">
      <div class="progress-copy">
        <span>课程进度</span>
        <b>{{ progress.completed }}/{{ progress.total }} 课时</b>
      </div>
      <div class="progress-track"><i :style="{ width: `${progress.percent}%` }" /></div>
    </div>
  </article>
</template>

<style scoped>
.lesson-card {
  --card-tint: #ddd8ff;
  --lesson-color: color-mix(in srgb, var(--card-tint) 52%, #222a3d);
  --card-ink: #1f2430;
  position: relative;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) 32px;
  column-gap: 13px;
  row-gap: 12px;
  align-items: start;
  min-height: 150px;
  padding: 14px;
  overflow: hidden;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: 0 9px 24px rgba(48, 58, 88, .055);
  animation: lesson-in 0.55s cubic-bezier(.2, .85, .25, 1) both;
  animation-delay: var(--delay);
}

.lesson-time {
  display: grid;
  grid-row: 1;
  align-self: stretch;
  min-height: 102px;
  place-items: center;
  border-radius: 16px;
  background: color-mix(in srgb, var(--card-tint) 55%, #fff);
}

.lesson-time i {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--lesson-color);
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
}

.lesson-time svg {
  width: 25px;
  height: 25px;
}

.lesson-main {
  grid-row: 1;
  grid-column: 2;
  min-width: 0;
  align-self: start;
  padding-top: 2px;
}

.lesson-type {
  display: inline-block;
  padding: 3px 8px;
  color: var(--lesson-color);
  border-radius: 7px;
  background: color-mix(in srgb, var(--card-tint) 42%, #fff);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .02em;
}

.lesson-main h3 {
  margin: 7px 0 5px;
  overflow: hidden;
  color: var(--card-ink);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-main p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.lesson-main p span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-main p i {
  width: 3px;
  height: 3px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 60%, transparent);
}

.lesson-main small {
  display: inline-block;
  margin-top: 6px;
  color: var(--lesson-color);
  font-size: 10px;
  font-weight: 650;
}

.lesson-period {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 9px;
  align-items: center;
  margin-top: 11px;
}

.lesson-period strong {
  color: var(--card-ink);
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -.03em;
}

.lesson-period span {
  display: flex;
  gap: 4px;
  align-items: center;
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}

.lesson-period svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.course-progress {
  grid-row: 2;
  grid-column: 1 / -1;
  padding-top: 11px;
  border-top: 1px solid var(--line);
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 10px;
}

.progress-copy b {
  color: color-mix(in srgb, var(--card-ink) 78%, transparent);
  font-weight: 700;
}

.progress-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--line) 82%, #fff);
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--lesson-color);
}

.lesson-actions {
  position: relative;
  z-index: 2;
  grid-row: 1;
  grid-column: 3;
  align-self: start;
}

.lesson-actions button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: color-mix(in srgb, var(--lesson-color) 55%, var(--muted));
  border: 0;
  border-radius: 50%;
  background: transparent;
  transition: transform .2s ease, color .2s ease, background .2s ease;
  -webkit-tap-highlight-color: transparent;
}

.lesson-actions button:hover {
  color: var(--lesson-color);
  background: color-mix(in srgb, var(--card-tint) 32%, #fff);
}

.lesson-actions button:active {
  transform: scale(.9);
}

.lesson-actions svg {
  width: 18px;
  fill: currentColor;
}

@keyframes lesson-in {
  from { opacity: 0; transform: translateY(16px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
