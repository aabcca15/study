<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { COURSE_COLORS, COURSE_ICON_COLORS, COURSE_ICON_OPTIONS, WEEKDAY_SHORT } from '@/domain/constants'
import type { BillingMode, CourseDateSlot, CourseIcon as CourseIconName, CourseType } from '@/domain/types'
import { effectiveCourseSlots } from '@/services/courseSchedule'
import CourseIcon from '@/components/CourseIcon.vue'
import dayjs from 'dayjs'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const returnTo = computed(() => {
  const target = typeof route.query.returnTo === 'string' ? route.query.returnTo : '/'
  return target.startsWith('/') ? target : '/'
})
const existing = computed(() => store.snapshot.courses.find((course) => course.id === id.value))
const calendarMonth = ref(dayjs().startOf('month'))
const batchStartTime = ref(existing.value?.recurrence.startTime ?? '18:00')
const batchEndTime = ref(existing.value?.recurrence.endTime ?? '19:00')
const editingSlot = ref<CourseDateSlot | null>(null)
const formError = ref('')
const dragging = ref(false)
let dragMode: 'add' | 'remove' = 'add'
const dragVisited = new Set<string>()
let dragStartDate = ''
let dragStartX = 0
let dragStartY = 0
let didDrag = false

const form = reactive({
  childIds: [...(existing.value?.childIds?.length
    ? existing.value.childIds
    : [existing.value?.childId ?? store.child?.id].filter(Boolean))] as string[],
  title: existing.value?.title ?? '',
  type: (existing.value?.type ?? 'interest') as CourseType,
  teacher: existing.value?.teacher ?? '',
  location: existing.value?.location ?? '',
  icon: (existing.value?.icon ?? 'generic') as CourseIconName,
  color: existing.value?.color ?? COURSE_COLORS[0],
  billingMode: (existing.value?.billingMode ?? 'monthly') as BillingMode,
  amount: existing.value?.amount ?? 0,
  note: existing.value?.note ?? '',
})
const childSheet = ref(false)
const newChildName = ref('')
const childError = ref('')
const editingChildId = ref('')
const editingChildName = ref('')

const selectedChildren = computed(() =>
  store.snapshot.children.filter((child) => form.childIds.includes(child.id)),
)
const extraChildren = computed(() =>
  store.snapshot.children.filter((child) => !form.childIds.includes(child.id)),
)
const editingChild = computed(() =>
  store.snapshot.children.find((child) => child.id === editingChildId.value),
)

function toggleChild(childId: string) {
  const index = form.childIds.indexOf(childId)
  if (index >= 0) {
    if (form.childIds.length > 1) form.childIds.splice(index, 1)
    return
  }
  form.childIds.push(childId)
}

function selectCourseIcon(icon: CourseIconName) {
  const systemColors = new Set([
    ...COURSE_COLORS.map((color) => color.toUpperCase()),
    ...Object.values(COURSE_ICON_COLORS).map((color) => color.toUpperCase()),
  ])
  form.icon = icon
  if (systemColors.has(form.color.toUpperCase())) {
    form.color = COURSE_ICON_COLORS[icon]
  }
}

function addExistingChild(childId: string) {
  toggleChild(childId)
  childSheet.value = false
}

function openChildEditor(childId: string) {
  const child = store.snapshot.children.find((item) => item.id === childId)
  if (!child) return
  editingChildId.value = childId
  editingChildName.value = child.name
}

function saveChildName() {
  if (!editingChildId.value || !editingChildName.value.trim()) return
  store.updateChild({ id: editingChildId.value, name: editingChildName.value })
  editingChildId.value = ''
  editingChildName.value = ''
}

function deleteExistingChild(childId: string, childName: string) {
  childError.value = ''
  const confirmed = window.confirm(
    `确定删除“${childName}”吗？该孩子的课程安排、日历记录、账单和目标数据也会一并删除，此操作无法撤销。`,
  )
  if (!confirmed) return

  const result = store.removeChild(childId)
  if (result === 'last-child') {
    childError.value = '至少需要保留一个孩子'
    return
  }
  if (result === 'not-found') {
    childError.value = '该孩子已不存在'
    return
  }

  form.childIds = form.childIds.filter((id) => id !== childId)
}

function createChild() {
  childError.value = ''
  const id = store.addChild(newChildName.value)
  if (!id) {
    childError.value = '请填写孩子名字'
    return
  }
  form.childIds.push(id)
  newChildName.value = ''
  childSheet.value = false
}

function initialSlots(): CourseDateSlot[] {
  const course = existing.value
  if (!course) return []
  const exceptions = store.snapshot.scheduleExceptions.filter((item) => item.courseId === course.id)
  return effectiveCourseSlots(course, exceptions)
}

const slots = ref<CourseDateSlot[]>(initialSlots())
const isLegacySchedule = computed(
  () => Boolean(existing.value && existing.value.recurrence.freq !== 'dates'),
)

watch(id, () => {
  slots.value = initialSlots()
  const course = existing.value
  batchStartTime.value = course?.recurrence.startTime ?? '18:00'
  batchEndTime.value = course?.recurrence.endTime ?? '19:00'
  Object.assign(form, {
    childIds: [...(course?.childIds?.length
      ? course.childIds
      : [course?.childId ?? store.child?.id].filter(Boolean))] as string[],
    title: course?.title ?? '',
    type: (course?.type ?? 'interest') as CourseType,
    teacher: course?.teacher ?? '',
    location: course?.location ?? '',
    icon: (course?.icon ?? 'generic') as CourseIconName,
    color: course?.color ?? COURSE_COLORS[0],
    billingMode: (course?.billingMode ?? 'monthly') as BillingMode,
    amount: course?.amount ?? 0,
    note: course?.note ?? '',
  })
})
const sortedSlots = computed(() => [...slots.value].sort((a, b) => a.date.localeCompare(b.date)))
const monthSlots = computed(() =>
  sortedSlots.value.filter((slot) => dayjs(slot.date).isSame(calendarMonth.value, 'month')),
)
const calendarDays = computed(() => {
  const start = calendarMonth.value.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
})

function findSlot(date: string) {
  return slots.value.find((slot) => slot.date === date)
}

function applyDateSelection(date: string) {
  if (dragVisited.has(date)) return
  dragVisited.add(date)
  const index = slots.value.findIndex((slot) => slot.date === date)
  if (dragMode === 'remove') {
    if (index >= 0) slots.value.splice(index, 1)
    return
  }
  if (index < 0) {
    slots.value.push({
      date,
      startTime: batchStartTime.value,
      endTime: batchEndTime.value,
    })
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  event.preventDefault()
  if (!didDrag && Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 6) {
    didDrag = true
    if (dragMode === 'remove') applyDateSelection(dragStartDate)
  }
  if (!didDrag) return
  const target = document.elementFromPoint(event.clientX, event.clientY)
  const button = target?.closest<HTMLElement>('[data-course-date]')
  const date = button?.dataset.courseDate
  if (date && dayjs(date).isSame(calendarMonth.value, 'month')) applyDateSelection(date)
}

function stopDragging() {
  if (dragging.value && dragMode === 'remove' && !didDrag) {
    const slot = findSlot(dragStartDate)
    if (slot) openSlot(slot)
  }
  dragging.value = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', stopDragging)
  document.removeEventListener('pointercancel', stopDragging)
}

function startSelecting(date: string, event: PointerEvent) {
  if (!dayjs(date).isSame(calendarMonth.value, 'month')) return
  event.preventDefault()
  dragVisited.clear()
  dragMode = findSlot(date) ? 'remove' : 'add'
  dragStartDate = date
  dragStartX = event.clientX
  dragStartY = event.clientY
  didDrag = false
  dragging.value = true
  if (dragMode === 'add') applyDateSelection(date)
  document.addEventListener('pointermove', onPointerMove, { passive: false })
  document.addEventListener('pointerup', stopDragging, { once: true })
  document.addEventListener('pointercancel', stopDragging, { once: true })
}

function applyBatchTime() {
  for (const slot of slots.value) {
    slot.startTime = batchStartTime.value
    slot.endTime = batchEndTime.value
  }
}

function saveSlotTime() {
  if (!editingSlot.value) return
  const target = findSlot(editingSlot.value.date)
  if (target) {
    target.startTime = editingSlot.value.startTime
    target.endTime = editingSlot.value.endTime
  }
  editingSlot.value = null
}

function openSlot(slot: CourseDateSlot) {
  editingSlot.value = { ...slot }
}

function save() {
  formError.value = ''
  if (!form.title.trim()) {
    formError.value = '请填写课程名称'
    return
  }
  if (!slots.value.length) {
    formError.value = '请至少在日历中选择一个上课日期'
    return
  }
  if (!form.childIds.length) {
    formError.value = '请至少选择一个孩子'
    return
  }
  const dates = sortedSlots.value
  const savedId = store.upsertCourse({
    id: id.value || undefined,
    childIds: [...form.childIds],
    title: form.title.trim(),
    type: form.type,
    teacher: form.teacher.trim(),
    location: form.location.trim(),
    icon: form.icon,
    color: form.color,
    billingMode: form.billingMode,
    amount: Number(form.amount) || 0,
    recurrence: {
      freq: 'dates',
      byWeekday: [],
      startDate: dates[0].date,
      endDate: dates[dates.length - 1].date,
      startTime: batchStartTime.value,
      endTime: batchEndTime.value,
      dates,
    },
    note: form.note,
  })
  store.clearScheduleExceptionsForCourse(savedId)
  router.push(returnTo.value)
}

function archive() {
  if (!id.value) return
  store.archiveCourse(id.value)
  router.push(returnTo.value)
}

onBeforeUnmount(stopDragging)
</script>

<template>
  <main class="page course-editor">
    <div class="course-child-context" aria-label="当前上课孩子">
      <button
        v-for="child in selectedChildren"
        :key="child.id"
        class="context-child"
        type="button"
        :aria-label="`编辑孩子${child.name}`"
        @click="openChildEditor(child.id)"
      >
        <i :style="{ '--avatar-color': child.avatarColor }">{{ child.avatarLabel }}</i>
        <span>{{ child.name }}</span>
      </button>
      <button class="context-add" type="button" aria-label="添加上课孩子" @click="childSheet = true">+</button>
    </div>

    <section class="editor-hero">
      <div>
        <p>{{ id ? '课程维护' : '创建课程预设' }}</p>
        <h1>{{ id ? `编辑${existing?.title ?? '课程'}` : '新增课程' }}</h1>
      </div>
      <span>{{ slots.length }} 次课</span>
    </section>

    <form @submit.prevent="save">
      <section class="editor-card basic-card">
        <div class="section-heading">
          <span>01</span>
          <div><h2>课程信息</h2><p>这些信息会作为快速排课的预设</p></div>
        </div>
        <div class="field">
          <label>课程名称</label>
          <input v-model="form.title" placeholder="例如 钢琴课 / 外教口语" />
        </div>
        <div class="two-fields">
          <div class="field">
            <label>类型</label>
            <select v-model="form.type">
              <option value="school">学校课程</option>
              <option value="interest">兴趣班</option>
              <option value="online">在线课堂</option>
            </select>
          </div>
          <div class="field">
            <label>老师</label>
            <input v-model="form.teacher" placeholder="老师姓名" />
          </div>
        </div>
        <div class="field">
          <label>上课地点</label>
          <input v-model="form.location" placeholder="线下地点或在线平台" />
        </div>
        <div class="two-fields">
          <div class="field">
            <label>结算方式</label>
            <select v-model="form.billingMode">
              <option value="monthly">按月结算</option>
              <option value="session">单次结算</option>
              <option value="term">按期结算</option>
              <option value="free">无需缴费</option>
            </select>
          </div>
          <div v-if="form.billingMode !== 'free'" class="field">
            <label>金额</label>
            <input v-model.number="form.amount" type="number" min="0" />
          </div>
        </div>
      </section>

      <section class="editor-card calendar-card">
        <div class="section-heading">
          <span>02</span>
          <div><h2>选择上课日期</h2><p>按住并拖动，可连续多选或取消</p></div>
        </div>
        <div class="legacy-tip">
          {{ isLegacySchedule
            ? '原来的每周规则会在今日调整或保存后展开为具体日期。'
            : '今日取消、改时间或补课会同步到这门课，次数和日历会一起更新。' }}
        </div>
        <div class="calendar-nav">
          <button type="button" aria-label="上个月" @click="calendarMonth = calendarMonth.subtract(1, 'month')">‹</button>
          <strong>{{ calendarMonth.format('YYYY年 M月') }}</strong>
          <button type="button" aria-label="下个月" @click="calendarMonth = calendarMonth.add(1, 'month')">›</button>
        </div>
        <div class="calendar-week">
          <span v-for="day in WEEKDAY_SHORT" :key="day">{{ day }}</span>
        </div>
        <div class="date-grid" :class="{ dragging }">
          <button
            v-for="day in calendarDays"
            :key="day.format('YYYY-MM-DD')"
            type="button"
            :data-course-date="day.format('YYYY-MM-DD')"
            :disabled="!day.isSame(calendarMonth, 'month')"
            :class="{
              selected: Boolean(findSlot(day.format('YYYY-MM-DD'))),
              today: day.isSame(dayjs(), 'day'),
            }"
            @pointerdown="startSelecting(day.format('YYYY-MM-DD'), $event)"
            @click.prevent
          >
            <span>{{ day.date() }}</span>
            <i v-if="findSlot(day.format('YYYY-MM-DD'))" />
          </button>
        </div>
        <div class="calendar-summary">
          <span>本月已选 <b>{{ monthSlots.length }}</b> 天</span>
          <span>全部共 <b>{{ slots.length }}</b> 次课</span>
        </div>
      </section>

      <section class="editor-card time-card">
        <div class="section-heading">
          <span>03</span>
          <div><h2>批量设置时间</h2><p>应用到当前已选的全部日期</p></div>
        </div>
        <div class="time-range">
          <label><span>开始</span><input v-model="batchStartTime" type="time" /></label>
          <i>→</i>
          <label><span>结束</span><input v-model="batchEndTime" type="time" /></label>
        </div>
        <button class="apply-time" type="button" :disabled="!slots.length" @click="applyBatchTime">
          应用到已选 {{ slots.length }} 个日期
        </button>
      </section>

      <section v-if="slots.length" class="editor-card selected-card">
        <div class="section-heading">
          <span>04</span>
          <div><h2>逐日调整</h2><p>点击某个日期，单独修改当天时间</p></div>
        </div>
        <div class="slot-list">
          <button v-for="slot in sortedSlots" :key="slot.date" type="button" @click="openSlot(slot)">
            <span>
              <b>{{ dayjs(slot.date).format('M月D日') }}</b>
              <small>{{ dayjs(slot.date).format('dddd') }}</small>
            </span>
            <strong>{{ slot.startTime }}–{{ slot.endTime }}</strong>
            <i>›</i>
          </button>
        </div>
      </section>

      <section class="editor-card extra-card">
        <div class="field">
          <label>课程图标</label>
          <div class="icon-options" role="radiogroup" aria-label="课程图标">
            <button
              v-for="option in COURSE_ICON_OPTIONS"
              :key="option.value"
              type="button"
              :class="{ active: form.icon === option.value }"
              :aria-label="`选择${option.label}图标`"
              :aria-pressed="form.icon === option.value"
              @click="selectCourseIcon(option.value)"
            >
              <CourseIcon :name="option.value" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
        <div class="field">
          <label>课程颜色</label>
          <div class="colors" role="radiogroup" aria-label="课程颜色">
            <button
              v-for="color in COURSE_COLORS"
              :key="color"
              type="button"
              :style="{ background: color }"
              :class="{ active: form.color === color }"
              :aria-label="`选择颜色${color}`"
              :aria-pressed="form.color === color"
              @click="form.color = color"
            />
            <label class="custom-color" aria-label="自定义课程颜色">
              <input v-model="form.color" type="color" />
              <span>＋</span>
            </label>
          </div>
          <small class="color-tip">选择 6 种系统配色，或使用“＋”自定义颜色</small>
        </div>
        <div class="field">
          <label>备注</label>
          <textarea v-model="form.note" rows="3" placeholder="课程说明或注意事项" />
        </div>
      </section>

      <p v-if="formError" class="form-error">{{ formError }}</p>
      <div class="save-bar">
        <button class="save-button" type="submit">保存当前课程</button>
        <button v-if="id" class="archive-button" type="button" @click="archive">归档</button>
      </div>
    </form>

    <Transition name="fade">
      <div v-if="childSheet" class="slot-overlay" @click.self="childSheet = false">
        <section class="slot-sheet">
          <i class="sheet-handle" />
          <div class="slot-title">
            <div>
              <p>多孩子</p>
              <h2>添加上课孩子</h2>
            </div>
            <button type="button" @click="childSheet = false">×</button>
          </div>
          <div v-if="extraChildren.length" class="extra-children">
            <p>选择已有孩子</p>
            <div
              v-for="child in extraChildren"
              :key="child.id"
              class="extra-child-row"
            >
              <button class="choose-existing" type="button" @click="addExistingChild(child.id)">
                <i :style="{ '--avatar-color': child.avatarColor }">{{ child.avatarLabel }}</i>
                <span>{{ child.name }}</span>
              </button>
              <button
                class="delete-child"
                type="button"
                :aria-label="`删除孩子${child.name}`"
                @click="deleteExistingChild(child.id, child.name)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
                </svg>
              </button>
            </div>
          </div>
          <label class="new-child-field">
            <span>新建孩子</span>
            <input v-model="newChildName" maxlength="8" placeholder="输入名字，例如 晨晨" />
          </label>
          <button class="save-button" type="button" @click="createChild">添加并选中</button>
          <p v-if="childError" class="slot-tip">{{ childError }}</p>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="editingChild" class="slot-overlay" @click.self="editingChildId = ''">
        <section class="slot-sheet child-name-sheet">
          <i class="sheet-handle" />
          <div class="slot-title">
            <div>
              <p>孩子资料</p>
              <h2>编辑名称</h2>
            </div>
            <button type="button" @click="editingChildId = ''">×</button>
          </div>
          <div class="child-name-preview">
            <i :style="{ '--avatar-color': editingChild.avatarColor }">{{ editingChild.avatarLabel }}</i>
            <label>
              <span>孩子名称</span>
              <input v-model="editingChildName" maxlength="8" placeholder="Uday" @keyup.enter="saveChildName" />
            </label>
          </div>
          <button class="save-button" type="button" :disabled="!editingChildName.trim()" @click="saveChildName">
            保存名称
          </button>
          <button
            v-if="form.childIds.length > 1"
            class="remove-from-course"
            type="button"
            @click="toggleChild(editingChild.id); editingChildId = ''"
          >
            从当前课程移除
          </button>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="editingSlot" class="slot-overlay" @click.self="editingSlot = null">
        <section class="slot-sheet">
          <i class="sheet-handle" />
          <div class="slot-title">
            <div>
              <p>单独调整</p>
              <h2>{{ dayjs(editingSlot.date).format('M月D日 dddd') }}</h2>
            </div>
            <button type="button" @click="editingSlot = null">×</button>
          </div>
          <div class="time-range single">
            <label><span>开始</span><input v-model="editingSlot.startTime" type="time" /></label>
            <i>→</i>
            <label><span>结束</span><input v-model="editingSlot.endTime" type="time" /></label>
          </div>
          <button class="save-button" type="button" @click="saveSlotTime">保存当天时间</button>
          <p class="slot-tip">只修改这一天，不影响当前课程的其他已选日期。</p>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.course-editor {
  padding-top: 10px;
}

.course-child-context {
  position: absolute;
  z-index: 12;
  top: 12px;
  right: max(18px, calc((100vw - 480px) / 2 + 18px));
  display: flex;
  width: min(300px, calc(100vw - 92px));
  gap: 7px;
  justify-content: flex-end;
  overflow-x: auto;
  scrollbar-width: none;
}

.course-child-context::-webkit-scrollbar {
  display: none;
}

.context-child {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  gap: 7px;
  align-items: center;
  padding: 4px 10px 4px 4px;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--paper);
  box-shadow: 0 7px 18px rgba(48,58,88,.07);
}

.context-child i,
.extra-children i,
.child-name-preview > i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 50%;
  background: var(--avatar-color, #7157d9);
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

.context-child span {
  max-width: 76px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-add {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0;
  color: var(--accent-text);
  border: 1px dashed color-mix(in srgb, var(--accent) 34%, var(--line));
  border-radius: 50%;
  background: var(--accent-soft);
  font-size: 22px;
  line-height: 1;
}

.editor-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18px;
}

.editor-hero p {
  margin: 0 0 4px;
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
}

.editor-hero h1 {
  font-size: 26px;
}

.editor-hero > span {
  padding: 7px 11px;
  color: #7048df;
  border-radius: 12px;
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}

.editor-card {
  margin-bottom: 13px;
  padding: 17px;
  border: 1px solid rgba(108, 78, 171, .08);
  border-radius: 25px;
  background: rgba(255,255,255,.9);
  box-shadow: 0 15px 38px rgba(65, 48, 109, .08);
}

.extra-children {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.extra-children p,
.new-child-field span {
  color: #8e8799;
  font-size: 11px;
}

.extra-child-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extra-child-row .choose-existing {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  color: #352f42;
  text-align: left;
  border: 0;
  border-radius: 16px;
  background: #f8f6fb;
}

.extra-child-row .choose-existing span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extra-child-row .delete-child {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  color: #b4485a;
  border: 1px solid #f1dde1;
  border-radius: 14px;
  background: #fdf3f4;
  transition: transform .2s ease, background .2s ease;
}

.extra-child-row .delete-child:active {
  background: #f9e5e8;
  transform: scale(.92);
}

.extra-child-row .delete-child svg {
  width: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.new-child-field {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.new-child-field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e7e2ef;
  border-radius: 14px;
  background: #faf9fc;
}

.child-name-sheet {
  max-width: 420px;
}

.child-name-preview {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 20px 0 16px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #faf9fc;
}

.child-name-preview > i {
  width: 46px;
  height: 46px;
  font-size: 12px;
}

.child-name-preview label {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 5px;
}

.child-name-preview label span {
  color: var(--muted);
  font-size: 10px;
}

.child-name-preview input {
  width: 100%;
  padding: 4px 0;
  color: var(--ink);
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 17px;
  font-weight: 700;
}

.remove-from-course {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  color: #8b8494;
  border: 0;
  background: transparent;
  font-size: 12px;
}

.section-heading {
  display: flex;
  gap: 11px;
  align-items: center;
  margin-bottom: 17px;
}

.section-heading > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 11px;
  font-weight: 750;
}

.section-heading h2 {
  font-size: 17px;
}

.section-heading p {
  margin: 3px 0 0;
  color: #9c96a6;
  font-size: 11px;
}

.two-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.legacy-tip {
  margin: -4px 0 14px;
  padding: 10px 12px;
  color: #7657ba;
  border-radius: 13px;
  background: #f2edff;
  font-size: 11px;
  line-height: 1.5;
}

.calendar-nav {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  margin-bottom: 15px;
  text-align: center;
}

.calendar-nav button {
  width: 36px;
  height: 36px;
  color: #655e73;
  border: 0;
  border-radius: 12px;
  background: #f3f0f8;
  font-size: 24px;
}

.calendar-nav strong {
  font-size: 15px;
}

.calendar-week,
.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.calendar-week {
  margin-bottom: 6px;
  color: #a19aaa;
  text-align: center;
  font-size: 10px;
}

.date-grid {
  touch-action: none;
  user-select: none;
}

.date-grid button {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  padding: 0;
  place-items: center;
  color: #514a5e;
  border: 0;
  border-radius: 13px;
  background: #f8f6fb;
  transition: color .16s ease, background .16s ease, transform .16s ease;
}

.date-grid button:disabled {
  visibility: hidden;
}

.date-grid button.selected {
  color: #fff;
  background: var(--accent);
  box-shadow: 0 6px 14px rgba(81,71,216,.24);
  transform: scale(.96);
}

.date-grid button.today:not(.selected) {
  color: var(--accent);
  outline: 1px solid color-mix(in srgb, var(--accent) 45%, #fff);
}

.date-grid button span {
  font-size: 12px;
  font-weight: 650;
}

.date-grid button i {
  position: absolute;
  bottom: 5px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
}

.calendar-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  color: #96909f;
  border-top: 1px solid #eeeaf4;
  font-size: 11px;
}

.calendar-summary b {
  color: #7047e8;
}

.time-range {
  display: grid;
  grid-template-columns: 1fr 22px 1fr;
  gap: 7px;
  align-items: end;
}

.time-range label {
  display: grid;
  gap: 6px;
}

.time-range label span {
  color: #8e8799;
  font-size: 11px;
}

.time-range input {
  width: 100%;
  padding: 11px 8px;
  color: #352f42;
  border: 1px solid #e7e2ef;
  border-radius: 13px;
  background: #faf9fc;
}

.time-range > i {
  padding-bottom: 12px;
  color: #aaa3b4;
  text-align: center;
  font-style: normal;
}

.apply-time {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  color: #7048df;
  border: 0;
  border-radius: 14px;
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}

.apply-time:disabled {
  opacity: .45;
}

.slot-list {
  display: grid;
  max-height: 280px;
  gap: 7px;
  overflow: auto;
}

.slot-list button {
  display: grid;
  grid-template-columns: 1fr auto 16px;
  gap: 10px;
  align-items: center;
  padding: 11px 12px;
  color: #352f42;
  text-align: left;
  border: 0;
  border-radius: 15px;
  background: #f8f6fb;
}

.slot-list span b,
.slot-list span small {
  display: block;
}

.slot-list span b {
  font-size: 12px;
}

.slot-list span small {
  margin-top: 3px;
  color: #9a94a3;
  font-size: 10px;
}

.slot-list > button > strong {
  color: #7048df;
  font-size: 12px;
}

.slot-list > button > i {
  color: #aaa3b3;
  font-size: 20px;
  font-style: normal;
}

.icon-options {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.icon-options button {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 9px 4px 7px;
  place-items: center;
  color: #81798d;
  border: 1px solid #e9e4f0;
  border-radius: 14px;
  background: #faf9fc;
  transition: color .2s ease, border .2s ease, background .2s ease, transform .2s ease;
}

.icon-options button:active {
  transform: scale(.92);
}

.icon-options button.active {
  color: #7048df;
  border-color: #8b64ee;
  background: #f0eaff;
}

.icon-options svg {
  width: 21px;
  height: 21px;
}

.icon-options span {
  font-size: 9px;
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
}

.colors button {
  width: 30px;
  height: 30px;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #e3deeb;
  transition: transform .2s ease, box-shadow .2s ease;
}

.colors button.active {
  box-shadow: 0 0 0 2px #423b4e;
  transform: scale(1.1);
}

.custom-color {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  overflow: hidden;
  place-items: center;
  color: #706879;
  border: 1px dashed #aaa2b5;
  border-radius: 50%;
  background: #f7f5fa;
  cursor: pointer;
}

.custom-color input {
  position: absolute;
  width: 50px;
  height: 50px;
  padding: 0;
  opacity: 0;
  cursor: pointer;
}

.custom-color span {
  font-size: 19px;
  line-height: 1;
}

.color-tip {
  color: #9a93a4;
  font-size: 10px;
}

.form-error {
  margin: 10px 4px;
  color: #e55365;
  font-size: 12px;
}

.save-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 9px;
  margin-top: 16px;
}

.save-button,
.archive-button {
  min-height: 48px;
  padding: 0 18px;
  color: #fff;
  border: 0;
  border-radius: 16px;
  background: var(--accent);
  box-shadow: 0 10px 22px rgba(81,71,216,.22);
  font-weight: 750;
}

.archive-button {
  color: #b4485a;
  background: #fdf1f3;
  box-shadow: none;
}

.slot-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 18px;
  background: rgba(31,25,45,.36);
  backdrop-filter: blur(7px);
}

.slot-sheet {
  width: min(100%, 480px);
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom, 0px));
  border-radius: 29px;
  background: #fff;
  box-shadow: 0 25px 70px rgba(37,25,69,.3);
  animation: sheet-up .35s cubic-bezier(.2,.8,.2,1) both;
}

.sheet-handle {
  display: block;
  width: 38px;
  height: 5px;
  margin: 0 auto 18px;
  border-radius: 99px;
  background: #d9d4e3;
}

.slot-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.slot-title p {
  margin: 0 0 3px;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}

.slot-title h2 {
  font-size: 21px;
}

.slot-title button {
  width: 34px;
  height: 34px;
  color: #716a7d;
  border: 0;
  border-radius: 50%;
  background: #f0edf5;
  font-size: 21px;
}

.time-range.single {
  margin-bottom: 16px;
}

.slot-sheet .save-button {
  width: 100%;
}

.slot-tip {
  margin: 11px 0 0;
  color: #9891a3;
  text-align: center;
  font-size: 11px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .22s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes sheet-up {
  from { opacity: 0; transform: translateY(50px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 380px) {
  .two-fields {
    grid-template-columns: 1fr;
  }
}
</style>
