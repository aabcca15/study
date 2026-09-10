<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import TodayCourseCard from '@/components/TodayCourseCard.vue'
import { money } from '@/services/billing'
import { currentPeriod } from '@/services/billing'
import type { DayOccurrence } from '@/domain/types'
import { occurrencesOnDate } from '@/services/schedule'
import { useTheme } from '@/composables/useTheme'
import { useHomeDate } from '@/composables/useHomeDate'
import { courseScheduleProgress } from '@/services/courseSchedule'

const store = useAppStore()
const { isDark, toggleTheme } = useTheme()
const { view } = useHomeDate()
const today = dayjs()
const editing = ref<DayOccurrence | null>(null)
const cancelling = ref<DayOccurrence | null>(null)
const recentlyCancelled = ref<DayOccurrence | null>(null)
const fabOpen = ref(false)
const addingPreset = ref(false)
const selectedCourseId = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const editForm = reactive({
  title: '',
  startTime: '',
  endTime: '',
  location: '',
  note: '',
})

const greeting = computed(() => {
  const h = today.hour()
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const weekDays = computed(() => {
  const anchor = today.add(view.weekOffset, 'week')
  const monday = anchor.subtract((anchor.day() + 6) % 7, 'day')
  return Array.from({ length: 7 }, (_, index) => monday.add(index, 'day'))
})
const weekRange = computed(() => {
  const days = weekDays.value
  const start = days[0]
  const end = days[6]
  return start.month() === end.month()
    ? `${start.format('M月D日')}–${end.format('D日')}`
    : `${start.format('M月D日')}–${end.format('M月D日')}`
})

function dateCourseColors(date: string) {
  const colors = occurrencesOnDate(store.courses, date, store.scheduleExceptions)
    .map((item) => item.course.color)
  return [...new Set(colors)].slice(0, 3)
}

const selectedDay = computed(() => dayjs(view.selectedDate))
const selectedItems = computed(() =>
  [...occurrencesOnDate(store.courses, view.selectedDate, store.scheduleExceptions)].sort((a, b) => {
    const time = a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)
    if (time !== 0) return time
    return a.course.recurrence.endTime.localeCompare(b.course.recurrence.endTime)
  }),
)
const scheduledCourseIds = computed(
  () => new Set(selectedItems.value.map((item) => item.course.id)),
)

function courseProgress(item: DayOccurrence) {
  return courseScheduleProgress(item.course, view.selectedDate, store.scheduleExceptions)
}

const openBills = computed(() =>
  store.expenses
    .filter((item) => item.period === currentPeriod() && item.status !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 2),
)

function openEdit(item: DayOccurrence) {
  editing.value = item
  Object.assign(editForm, {
    title: item.course.title,
    startTime: item.course.recurrence.startTime,
    endTime: item.course.recurrence.endTime,
    location: item.course.location,
    note: item.exception?.note ?? '',
  })
}

function saveTodayChange() {
  if (!editing.value || !editForm.title.trim()) return
  store.upsertScheduleException({
    courseId: editing.value.course.id,
    date: editing.value.date,
    status: editing.value.exception?.status === 'added' ? 'added' : 'rescheduled',
    title: editForm.title.trim(),
    startTime: editForm.startTime,
    endTime: editForm.endTime,
    location: editForm.location.trim(),
    note: editForm.note.trim(),
  })
  editing.value = null
}

function requestCancelFromEdit() {
  if (!editing.value) return
  cancelling.value = editing.value
  editing.value = null
}

function confirmCancel() {
  if (!cancelling.value) return
  const item = cancelling.value
  if (item.exception?.status === 'added') {
    store.dropOccurrenceSlot(item.course.id, item.date)
  } else {
    store.upsertScheduleException({
      courseId: item.course.id,
      date: item.date,
      status: 'cancelled',
    })
  }
  recentlyCancelled.value = item
  cancelling.value = null
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    recentlyCancelled.value = null
  }, 4500)
}

function undoCancel() {
  const item = recentlyCancelled.value
  if (!item) return
  const slot = {
    date: item.date,
    startTime: item.exception?.startTime ?? item.course.recurrence.startTime,
    endTime: item.exception?.endTime ?? item.course.recurrence.endTime,
  }
  if (item.exception?.status === 'added') {
    store.upsertScheduleException({
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
    store.restoreOccurrenceSlot(item.course.id, slot)
  }
  recentlyCancelled.value = null
  window.clearTimeout(toastTimer)
}

function openPresetPicker() {
  fabOpen.value = false
  selectedCourseId.value = ''
  addingPreset.value = true
}

function changeWeek(step: number) {
  view.weekOffset += step
  view.selectedDate = dayjs(view.selectedDate).add(step, 'week').format('YYYY-MM-DD')
}

function selectDate(date: string) {
  view.selectedDate = date
}

function addPresetToDate() {
  const course = store.courses.find((item) => item.id === selectedCourseId.value)
  if (!course || scheduledCourseIds.value.has(course.id)) return
  const sample = course.recurrence.dates?.[0]
  store.upsertScheduleException({
    courseId: course.id,
    date: view.selectedDate,
    status: 'added',
    startTime: sample?.startTime ?? course.recurrence.startTime,
    endTime: sample?.endTime ?? course.recurrence.endTime,
    title: course.title,
    location: course.location,
    note: '从课程预设添加',
  })
  addingPreset.value = false
}
</script>

<template>
  <main class="page today-page">
    <header class="app-header">
      <div>
        <p>{{ greeting }}，</p>
        <h1>
          <i
            v-if="store.child"
            :style="{ '--avatar-color': store.child.avatarColor }"
          >{{ store.child.avatarLabel }}</i>
          {{ store.child?.name }}!
        </h1>
      </div>
      <div class="header-right">
        <div v-if="store.snapshot.children.length > 1" class="child-switcher" aria-label="切换孩子">
          <button
            v-for="child in store.snapshot.children"
            :key="child.id"
            type="button"
            :class="{ active: store.child?.id === child.id }"
            :style="{ '--avatar-color': child.avatarColor }"
            :aria-label="`查看${child.name}的课程`"
            @click="store.selectChild(child.id)"
          >{{ child.avatarLabel }}</button>
        </div>
        <div class="header-actions">
          <button type="button" aria-label="消息">
          <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 20h4" /></svg>
          <i />
          </button>
          <button
            class="theme-toggle"
            type="button"
            :aria-label="isDark ? '切换到白天模式' : '切换到夜间模式'"
            :aria-pressed="isDark"
            @click="toggleTheme"
          >
            <svg v-if="!isDark" viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/></svg>
          </button>
        </div>
      </div>
    </header>

    <section class="week-picker" aria-label="周日期选择">
      <div class="week-toolbar">
        <button type="button" aria-label="上一周" @click="changeWeek(-1)">
          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span>{{ view.weekOffset === 0 ? '本周' : weekRange }}</span>
        <button type="button" aria-label="下一周" @click="changeWeek(1)">
          <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div class="date-strip">
        <button
          v-for="date in weekDays"
          :key="date.format('YYYY-MM-DD')"
          type="button"
          :aria-label="`查看${date.format('M月D日')}安排`"
          :class="{
            active: date.format('YYYY-MM-DD') === view.selectedDate,
            today: date.isSame(today, 'day'),
          }"
          @click="selectDate(date.format('YYYY-MM-DD'))"
        >
          <span>{{ date.format('dd') }}</span>
          <strong>{{ date.date() }}</strong>
          <span class="course-dots" aria-hidden="true">
            <i
              v-for="color in dateCourseColors(date.format('YYYY-MM-DD'))"
              :key="color"
              :style="{ background: color }"
            />
          </span>
        </button>
      </div>
    </section>

    <section class="overview">
      <div class="overview-main">
        <span>{{ selectedDay.isSame(today, 'day') ? '今日课程' : `${selectedDay.format('M月D日')}课程` }}</span>
        <strong>{{ selectedItems.length }}</strong>
        <small>节安排</small>
        <router-link class="overview-calendar" to="/calendar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm2-2v4m10-4v4M4 10h16"/>
          </svg>
          完整日历
          <b>›</b>
        </router-link>
      </div>
      <router-link class="overview-bill" to="/bills">
        <span>本月待支付</span>
        <strong>{{ money(store.monthOpenAmount) }}</strong>
        <small>查看账单 <b>›</b></small>
      </router-link>
    </section>

    <section class="content-block">
      <div class="section-title">
        <div>
          <h2>今日安排</h2>
        </div>
        <div class="section-actions">
          <button type="button" @click="openPresetPicker">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            新增
          </button>
        </div>
      </div>
      <TransitionGroup v-if="selectedItems.length" name="lesson-list" tag="div" class="lesson-list">
        <div
          v-for="(item, index) in selectedItems"
          :key="item.id"
          class="timeline-entry"
        >
          <div
            class="timeline-marker"
            :class="{ last: index === selectedItems.length - 1 }"
            :style="{ '--timeline-color': item.course.color }"
          >
            <time>{{ item.course.recurrence.startTime }}</time>
            <i />
          </div>
          <TodayCourseCard
            :item="item"
            :index="index"
            :progress="courseProgress(item)"
            @edit="openEdit"
          />
        </div>
      </TransitionGroup>
      <div v-else class="empty-state">
        <div>✦</div>
        <h3>这一天没有课程</h3>
        <p>计划有变化也没关系，好好享受空闲时间。</p>
        <button type="button" @click="openPresetPicker">从课程预设添加</button>
      </div>
    </section>

    <section v-if="openBills.length" class="content-block bill-block">
      <div class="section-title">
        <div>
          <h2>待处理账单</h2>
          <p>别错过结算日期</p>
        </div>
        <router-link to="/bills">查看全部</router-link>
      </div>
      <router-link v-for="bill in openBills" :key="bill.id" :to="`/bills/edit/${bill.id}`" class="bill-row">
        <span class="bill-icon">¥</span>
        <div>
          <strong>{{ bill.title }}</strong>
          <small>{{ bill.dueDate }} 前结算</small>
        </div>
        <b>{{ money(bill.amount) }}</b>
      </router-link>
    </section>

    <div class="quick-add" :class="{ open: fabOpen }">
      <Transition name="fab-menu">
        <div v-if="fabOpen" class="quick-menu">
          <button type="button" @click="openPresetPicker">
            <span class="purple">＋</span>
            <div><strong>新增日期安排</strong><small>从现有课程预设选择</small></div>
          </button>
          <router-link :to="{ path: '/courses/edit', query: { returnTo: '/' } }" @click="fabOpen = false">
            <span class="yellow">✦</span>
            <div><strong>新增课程</strong><small>建立新的课程预设</small></div>
          </router-link>
          <router-link to="/courses" @click="fabOpen = false">
            <span class="green">⌘</span>
            <div><strong>维护课程</strong><small>编辑、归档课程预设</small></div>
          </router-link>
        </div>
      </Transition>
      <button
        class="fab"
        type="button"
        :aria-label="fabOpen ? '收起新增菜单' : '展开新增菜单'"
        :aria-expanded="fabOpen"
        @click="fabOpen = !fabOpen"
      >
        <span>＋</span>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="addingPreset" class="overlay" @click.self="addingPreset = false">
        <section class="sheet preset-sheet">
          <i class="sheet-handle" />
          <div class="sheet-title">
            <div>
              <p>新增到 {{ selectedDay.format('M月D日 dddd') }}</p>
              <h2>选择课程预设</h2>
            </div>
            <button type="button" @click="addingPreset = false">×</button>
          </div>
          <p class="preset-tip">老师、时间和地点将自动带入，添加后仍可单独调整这一次安排。</p>
          <div v-if="store.courses.length" class="preset-list">
            <button
              v-for="course in store.courses"
              :key="course.id"
              type="button"
              :disabled="scheduledCourseIds.has(course.id)"
              :class="{ selected: selectedCourseId === course.id }"
              @click="selectedCourseId = course.id"
            >
              <i :style="{ background: course.color }" />
              <div>
                <strong>{{ course.title }}</strong>
                <small>{{ course.recurrence.startTime }}–{{ course.recurrence.endTime }} · {{ course.teacher || '老师待定' }}</small>
              </div>
              <span v-if="scheduledCourseIds.has(course.id)">已安排</span>
              <b v-else>{{ selectedCourseId === course.id ? '✓' : '' }}</b>
            </button>
          </div>
          <div v-else class="preset-empty">
            <p>还没有课程预设，请先新增课程。</p>
            <router-link :to="{ path: '/courses/edit', query: { returnTo: '/' } }">新增课程</router-link>
          </div>
          <button
            v-if="store.courses.length"
            class="sheet-submit"
            type="button"
            :disabled="!selectedCourseId"
            @click="addPresetToDate"
          >
            添加到 {{ selectedDay.format('M月D日') }}
          </button>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="editing" class="overlay" @click.self="editing = null">
        <section class="sheet">
          <i class="sheet-handle" />
          <div class="sheet-title">
            <div>
              <p>仅修改今天</p>
              <h2>调整课程安排</h2>
            </div>
            <button type="button" @click="editing = null">×</button>
          </div>
          <div class="field">
            <label>课程名称</label>
            <input v-model="editForm.title" />
          </div>
          <div class="time-fields">
            <div class="field">
              <label>开始时间</label>
              <input v-model="editForm.startTime" type="time" />
            </div>
            <div class="field">
              <label>结束时间</label>
              <input v-model="editForm.endTime" type="time" />
            </div>
          </div>
          <div class="field">
            <label>上课地点</label>
            <input v-model="editForm.location" placeholder="线下地点或在线平台" />
          </div>
          <div class="field">
            <label>调整说明</label>
            <textarea v-model="editForm.note" rows="2" placeholder="例如：老师临时调整时间" />
          </div>
          <button class="sheet-submit" type="button" @click="saveTodayChange">保存今日调整</button>
          <button class="sheet-delete" type="button" @click="requestCancelFromEdit">取消这一次课程</button>
          <p class="sheet-tip">周期课程保持不变，只会修改 {{ dayjs(editing.date).format('M月D日') }} 这一次安排。</p>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="cancelling" class="overlay dialog-overlay" @click.self="cancelling = null">
        <section class="confirm-dialog">
          <div class="confirm-icon">!</div>
          <h2>取消这一次课程？</h2>
          <p>“{{ cancelling.course.title }}”将从 {{ dayjs(cancelling.date).format('M月D日') }} 安排移除，不会删除之后的周期课程。</p>
          <div>
            <button type="button" @click="cancelling = null">暂不取消</button>
            <button class="danger" type="button" @click="confirmCancel">确认取消</button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="recentlyCancelled" class="toast">
        <span>已取消“{{ recentlyCancelled.course.title }}”</span>
        <button type="button" @click="undoCancel">撤销</button>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.today-page {
  padding-top: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  animation: page-in .45s ease both;
}

.app-header p {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 13px;
}

.app-header h1 {
  display: flex;
  margin: 0;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -.045em;
}

.app-header h1 i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border: 0;
  border-radius: 12px;
  background: var(--avatar-color, #7157d9);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.child-switcher {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
}

.child-switcher button {
  display: grid;
  width: 32px;
  height: 32px;
  margin-left: -8px;
  padding: 0;
  place-items: center;
  color: #fff;
  border: 3px solid var(--bg);
  border-radius: 50%;
  color: color-mix(in srgb, var(--avatar-color, #7157d9) 72%, #2b3040);
  background: color-mix(in srgb, var(--avatar-color, #7157d9) 20%, #fff);
  font-size: 8px;
  font-weight: 800;
  transition: transform .2s ease, box-shadow .2s ease;
}

.child-switcher button.active {
  z-index: 2;
  color: #fff;
  background: var(--avatar-color, #7157d9);
  transform: scale(1.06);
}

.header-actions {
  display: flex;
  gap: 9px;
}

.header-actions button,
.header-actions a {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 9px 22px rgba(62, 45, 104, .1);
  transition: transform .2s ease;
}

.header-actions button:active,
.header-actions a:active {
  transform: scale(.9);
}

.header-actions svg {
  width: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.header-actions i {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #ff5e67;
}

.week-picker {
  margin-bottom: 20px;
  padding: 12px 10px 10px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--shadow);
  animation: page-in .5s .05s ease both;
}

.week-toolbar {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  margin-bottom: 5px;
  text-align: center;
}

.week-toolbar button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 0;
  border-radius: 11px;
  background: transparent;
  transition: transform .2s ease, background .2s ease;
}

.week-toolbar button:active {
  transform: scale(.88);
  background: var(--accent-soft);
}

.week-toolbar button:last-child {
  justify-self: end;
}

.week-toolbar svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.week-toolbar span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 650;
}

.date-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.date-strip button {
  display: grid;
  height: 62px;
  padding: 0;
  place-items: center;
  align-content: center;
  color: var(--muted);
  border: 0;
  border-radius: 16px;
  background: transparent;
  transition: transform .25s ease, background .25s ease;
}

.date-strip span {
  font-size: 11px;
}

.date-strip strong {
  margin-top: 4px;
  color: var(--ink);
  font-size: 15px;
}

.date-strip button.active {
  color: #fff;
  background: #5147d8;
  box-shadow: 0 8px 18px rgba(81,71,216,.24);
}

.date-strip button.active strong {
  color: #fff;
}

.date-strip .course-dots {
  display: flex;
  min-height: 6px;
  gap: 3px;
  align-items: center;
  margin-top: 5px;
  font-size: 0;
}

.date-strip .course-dots i {
  width: 6px;
  height: 6px;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(42,48,71,.15);
}

.date-strip button.active .course-dots i {
  box-shadow: 0 0 0 1px rgba(255,255,255,.7);
}

.overview {
  display: grid;
  grid-template-columns: 1.08fr .92fr;
  gap: 11px;
  margin-bottom: 28px;
  animation: page-in .55s .1s ease both;
}

.overview-main,
.overview-bill {
  position: relative;
  min-height: 132px;
  padding: 18px;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid var(--line);
  background: var(--paper);
  box-shadow: 0 10px 26px rgba(48, 58, 88, .06);
}

.overview-main {
  color: #1f2430;
}

.overview-bill {
  color: #1f2430;
}

.overview span,
.overview small {
  display: block;
  font-size: 12px;
}

.overview-main > span,
.overview-bill > span {
  color: var(--muted);
}

.overview strong {
  display: inline-block;
  margin-top: 14px;
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -.045em;
}

.overview-main > small {
  display: inline;
  margin-left: 5px;
  color: var(--muted);
}

.overview-calendar {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  min-height: 40px;
  gap: 5px;
  align-items: center;
  padding: 0 2px;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}

.overview-calendar svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.overview-calendar b {
  font-size: 15px;
  line-height: 1;
}

.overview-bill > strong {
  display: block;
  font-size: 25px;
}

.overview-bill > small {
  position: absolute;
  right: 18px;
  bottom: 16px;
  color: var(--accent-text);
  font-weight: 650;
}

.overview-bill b {
  font-size: 15px;
}

.bubble {
  display: none;
}

.content-block {
  margin-bottom: 28px;
}

.section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 13px;
}

.section-title h2 {
  color: var(--ink);
  font-size: 19px;
  letter-spacing: -.025em;
}

.section-title p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.section-title a {
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 650;
}

.section-actions {
  display: flex;
  gap: 7px;
}

.section-actions button,
.section-actions a {
  display: flex;
  min-height: 32px;
  gap: 4px;
  align-items: center;
  padding: 6px 9px;
  color: #7048df;
  border: 0;
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 10px;
  font-weight: 700;
  transition: transform .2s ease, background .2s ease;
}

.section-actions button:active,
.section-actions a:active {
  transform: scale(.92);
}

.section-actions svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.lesson-list {
  position: relative;
  display: grid;
  gap: 12px;
}

.timeline-entry {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
}

.timeline-marker {
  position: relative;
  min-height: 100%;
  padding-top: 16px;
  color: var(--muted);
  text-align: left;
}

.timeline-marker::after {
  position: absolute;
  top: 34px;
  right: 3px;
  bottom: -18px;
  width: 1px;
  background: var(--line);
  content: "";
}

.timeline-marker.last::after {
  bottom: 20px;
}

.timeline-marker time {
  display: block;
  padding-right: 10px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: -.02em;
}

.timeline-marker i {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: 0;
  width: 7px;
  height: 7px;
  border: 2px solid var(--bg);
  border-radius: 50%;
  background: color-mix(in srgb, var(--timeline-color) 65%, #687087);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--timeline-color) 35%, transparent);
}

.lesson-list-leave-active {
  position: absolute;
  width: 100%;
}

.lesson-list-leave-to {
  opacity: 0;
  transform: translateX(-28px) scale(.96);
}

.lesson-list-move,
.lesson-list-leave-active {
  transition: all .35s cubic-bezier(.2,.8,.2,1);
}

.empty-state {
  padding: 32px 20px;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.empty-state div {
  display: grid;
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  place-items: center;
  color: #fff;
  border-radius: 16px;
  background: #5147d8;
}

.empty-state h3 { font-size: 17px; }
.empty-state p { margin: 8px 0 16px; color: var(--muted); font-size: 12px; }
.empty-state a,
.empty-state button { display: inline-block; padding: 9px 16px; color: #fff; border: 0; border-radius: 13px; background: #5147d8; font-size: 13px; }

.bill-block {
  animation: page-in .55s .24s ease both;
}

.bill-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  margin-bottom: 9px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--paper);
  transition: transform .2s ease;
}

.bill-row:active { transform: scale(.98); }
.bill-icon { display: grid; width: 42px; height: 42px; place-items: center; color: #b4485a; border-radius: 13px; background: #fdeef0; font-weight: 750; }
.bill-row div { min-width: 0; }
.bill-row div strong { display: block; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.bill-row small { display: block; margin-top: 4px; color: var(--muted); font-size: 11px; }
.bill-row > b { color: var(--ink); font-size: 14px; }

.quick-add {
  position: fixed;
  z-index: 35;
  right: max(18px, calc((100vw - 480px) / 2 + 18px));
  bottom: calc(102px + env(safe-area-inset-bottom, 0px));
  display: grid;
  justify-items: end;
  gap: 12px;
}

.fab {
  display: grid;
  width: 56px;
  height: 56px;
  padding: 0;
  place-items: center;
  color: #fff;
  border: 0;
  border-radius: 50%;
  background: #5147d8;
  box-shadow: 0 12px 26px rgba(81,71,216,.32);
  transition: transform .32s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease;
}

.fab span {
  font-size: 32px;
  font-weight: 300;
  line-height: 1;
  transform: translateY(-1px);
  transition: transform .32s cubic-bezier(.2,.8,.2,1);
}

.quick-add.open .fab {
  box-shadow: 0 10px 24px rgba(89,49,205,.28);
}

.quick-add.open .fab span {
  transform: translateY(-1px) rotate(45deg);
}

.fab:active {
  transform: scale(.9);
}

.quick-menu {
  display: grid;
  width: 238px;
  gap: 7px;
  padding: 9px;
  border: 1px solid rgba(113,84,175,.1);
  border-radius: 24px;
  background: rgba(255,255,255,.94);
  box-shadow: 0 22px 55px rgba(45,31,83,.2);
  backdrop-filter: blur(18px);
  transform-origin: right bottom;
}

.quick-menu button,
.quick-menu a {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 11px;
  align-items: center;
  padding: 9px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 17px;
  background: transparent;
  transition: background .2s ease, transform .2s ease;
}

.quick-menu button:active,
.quick-menu a:active {
  background: #f4f1fb;
  transform: scale(.98);
}

.quick-menu > * > span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #fff;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
}

.quick-menu span.purple { background: #5147d8; }
.quick-menu span.yellow { color: #8a6510; background: #ffd77a; }
.quick-menu span.green { background: #4bb37f; }
.quick-menu strong { display: block; font-size: 13px; }
.quick-menu small { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; }

.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: opacity .24s ease, transform .3s cubic-bezier(.2,.8,.2,1);
}

.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(.9);
}

.preset-sheet {
  max-height: min(88vh, 720px);
}

.preset-tip {
  margin: -8px 0 16px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}

.preset-list {
  display: grid;
  gap: 9px;
  margin-bottom: 18px;
}

.preset-list > button {
  display: grid;
  grid-template-columns: 5px minmax(0,1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 11px 13px 11px 0;
  overflow: hidden;
  color: var(--ink);
  text-align: left;
  border: 1px solid #ebe7f3;
  border-radius: 18px;
  background: #fff;
  transition: border .2s ease, background .2s ease, transform .2s ease;
}

.preset-list > button:not(:disabled):active {
  transform: scale(.98);
}

.preset-list > button.selected {
  border-color: #7b50ee;
  background: #f6f2ff;
}

.preset-list > button:disabled {
  cursor: default;
  opacity: .48;
}

.preset-list > button > i {
  width: 5px;
  height: 46px;
  border-radius: 0 6px 6px 0;
}

.preset-list div {
  min-width: 0;
}

.preset-list strong {
  display: block;
  font-size: 14px;
}

.preset-list small {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-list span {
  color: var(--muted);
  font-size: 11px;
}

.preset-list b {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  color: #fff;
  border: 1px solid #ded8e8;
  border-radius: 50%;
  background: #fff;
}

.preset-list button.selected b {
  border-color: var(--accent-text);
  background: #5147d8;
}

.preset-empty {
  padding: 24px;
  text-align: center;
  border-radius: 18px;
  background: #f5f2fb;
}

.preset-empty p { margin: 0 0 12px; color: #8f889a; font-size: 13px; }
.preset-empty a { display: inline-block; padding: 9px 15px; color: #fff; border-radius: 12px; background: #5147d8; font-size: 12px; }
.sheet-submit:disabled { cursor: default; opacity: .45; box-shadow: none; }

.overlay {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 18px;
  background: rgba(30, 24, 45, .34);
  backdrop-filter: blur(7px);
}

.sheet {
  width: min(100%, 480px);
  max-height: 90vh;
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom, 0px));
  overflow: auto;
  border-radius: 31px;
  background: #fbfaff;
  box-shadow: 0 25px 70px rgba(37,25,69,.3);
  animation: sheet-up .42s cubic-bezier(.18,.86,.22,1) both;
}

.sheet-handle {
  display: block;
  width: 38px;
  height: 5px;
  margin: 0 auto 18px;
  border-radius: 99px;
  background: #d9d4e3;
}

.sheet-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.sheet-title p { margin: 0 0 3px; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.sheet-title h2 { font-size: 22px; }
.sheet-title button { width: 34px; height: 34px; color: #6f687a; border: 0; border-radius: 50%; background: #eeebf5; font-size: 22px; }

.time-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sheet-submit {
  width: 100%;
  padding: 14px;
  color: #fff;
  border: 0;
  border-radius: 16px;
  background: #5147d8;
  box-shadow: 0 10px 22px rgba(81,71,216,.24);
  font-weight: 700;
}

.sheet-submit:active { transform: scale(.98); }

.sheet-delete {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  color: #b4485a;
  border: 0;
  border-radius: 16px;
  background: #fdf1f3;
  font-weight: 650;
}

.sheet-delete:active { transform: scale(.98); }

.sheet-tip { margin: 12px 0 0; color: var(--muted); text-align: center; font-size: 11px; }

.dialog-overlay { align-items: center; }
.confirm-dialog { width: min(100%, 330px); padding: 25px 20px 18px; text-align: center; border-radius: 27px; background: #fff; box-shadow: 0 25px 70px rgba(37,25,69,.3); animation: dialog-in .3s cubic-bezier(.2,.85,.25,1) both; }
.confirm-icon { display: grid; width: 50px; height: 50px; margin: 0 auto 14px; place-items: center; color: #f05b6d; border-radius: 17px; background: #fff0f2; font-size: 23px; font-weight: 800; }
.confirm-dialog h2 { font-size: 20px; }
.confirm-dialog p { margin: 10px 0 20px; color: #8d8799; font-size: 13px; line-height: 1.6; }
.confirm-dialog > div:last-child { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.confirm-dialog button { padding: 12px 8px; color: #5e576a; border: 0; border-radius: 14px; background: #f2eff7; font-weight: 650; }
.confirm-dialog button.danger { color: #fff; background: #ed5d6e; }

.toast {
  position: fixed;
  z-index: 60;
  left: 50%;
  bottom: calc(94px + env(safe-area-inset-bottom, 0px));
  display: flex;
  width: min(calc(100% - 36px), 410px);
  align-items: center;
  justify-content: space-between;
  padding: 13px 15px;
  color: #fff;
  border-radius: 17px;
  background: rgba(37,32,49,.94);
  box-shadow: 0 12px 30px rgba(31,24,47,.25);
  transform: translateX(-50%);
  font-size: 13px;
}

.toast button { color: #b99fff; border: 0; background: transparent; font-weight: 750; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all .32s cubic-bezier(.2,.8,.2,1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 18px); }

@keyframes page-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sheet-up {
  from { opacity: 0; transform: translateY(70px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes dialog-in {
  from { opacity: 0; transform: scale(.88); }
  to { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
</style>
