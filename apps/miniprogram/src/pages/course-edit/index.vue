<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import {
  COURSE_COLORS,
  COURSE_ICON_COLORS,
  COURSE_ICON_OPTIONS,
  COURSE_TYPE_OPTIONS,
  WEEKDAY_SHORT,
  unusedCourseColor,
} from '@server-domain/constants'
import type { BillingMode, CourseDateSlot, CourseIcon, CoursePricingMode, CourseType } from '@server-domain/types'
import { busyIntervalsForDates, findBusyConflict, findScheduleConflicts } from '@server-domain/schedule'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useThemePage } from '@/composables/useThemePage'
import TimeField from '@/components/TimeField.vue'
import AppIcon from '@/components/AppIcon.vue'
import SelectField from '@/components/SelectField.vue'
import PageHeader from '@/components/PageHeader.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'
import DateDragGrid from '@/components/DateDragGrid.vue'

const store = useFamilyPage({ refresh: false })
const themeClass = useThemePage()
const courseId = ref('')
const saving = ref(false)
const errorText = ref('')
const slotError = ref('')
const slots = ref<CourseDateSlot[]>([])
const batchStart = ref('18:00')
const batchEnd = ref('19:00')
const editingSlot = ref<CourseDateSlot | null>(null)
const slotsOpen = ref(false)

const form = reactive({
  childIds: [] as string[],
  title: '',
  type: 'interest' as CourseType,
  teacher: '',
  location: '',
  icon: 'generic' as CourseIcon,
  color: COURSE_COLORS[0],
  pricingMode: 'prepaid' as CoursePricingMode,
  amount: '0',
  paymentStatus: 'unpaid' as 'paid' | 'unpaid',
  note: '',
})

const pricingPlans = [
  { value: 'prepaid', label: '一次性支付', caption: '报名或购买课包时支付总金额' },
  { value: 'usage', label: '按需计费', caption: '按实际次数或小时累计' },
  { value: 'free', label: '无需缴费', caption: '只记录课程安排' },
]
const usageUnits = [
  { value: 'per_session', label: '按次', caption: '每完成一节按单次价格计费' },
  { value: 'per_hour', label: '按小时', caption: '按课程实际时长计算' },
]

const existing = computed(() => store.snapshot.courses.find((course) => course.id === courseId.value))
const sortedSlots = computed(() => [...slots.value].sort((a, b) => a.date.localeCompare(b.date)))
const selectedDates = computed(() => sortedSlots.value.map((slot) => slot.date))
const paymentPlan = computed(() => (
  form.pricingMode === 'per_session' || form.pricingMode === 'per_hour' ? 'usage' : form.pricingMode
))
const amountLabel = computed(() => {
  if (form.pricingMode === 'prepaid') return '课程总金额'
  if (form.pricingMode === 'per_hour') return '每小时费用'
  return '单次费用'
})
const billingSummary = computed(() => {
  const amount = `¥${Math.max(0, Number(form.amount) || 0).toLocaleString('zh-CN')}`
  if (form.pricingMode === 'free') return '该课程无需缴费，只记录课程安排。'
  if (form.pricingMode === 'prepaid') {
    return `课程总费用 ${amount}，当前${form.paymentStatus === 'paid' ? '已支付' : '待支付'}。`
  }
  const unit = form.pricingMode === 'per_hour' ? '每小时' : '每完成 1 次'
  return `${unit}计费 ${amount}；取消未上的课次不计费。`
})
const batchConflict = computed(() => {
  if (!slots.value.length) return ''
  const hit = findBusyConflict(
    busyIntervalsForDates(
      store.overviewCourses,
      slots.value.map((slot) => slot.date),
      store.overviewScheduleExceptions,
      courseId.value || undefined,
      form.childIds,
    ),
    batchStart.value,
    batchEnd.value,
  )
  return hit ? `${hit.title} 已占用 ${hit.start}–${hit.end}` : ''
})

onLoad((query) => {
  courseId.value = typeof query?.id === 'string' ? query.id : ''
  const course = store.snapshot.courses.find((item) => item.id === courseId.value)
  form.childIds = course?.childIds?.length
    ? [...course.childIds]
    : [course?.childId || store.childId].filter(Boolean)
  form.title = course?.title ?? ''
  form.type = course?.type ?? 'interest'
  form.teacher = course?.teacher ?? ''
  form.location = course?.location ?? ''
  form.icon = course?.icon ?? 'generic'
  form.color = course?.color ?? unusedCourseColor(store.snapshot.courses)
  form.pricingMode = course?.billingPolicy?.pricingMode === 'fixed_period'
    ? 'per_session'
    : course?.billingPolicy?.pricingMode
      ?? (course?.billingMode === 'free' ? 'free' : course?.billingMode === 'session' ? 'per_session' : 'prepaid')
  form.amount = String(course?.amount ?? 0)
  form.note = course?.note ?? ''
  slots.value = [...(course?.recurrence.dates ?? [])]
  batchStart.value = course?.recurrence.startTime ?? '18:00'
  batchEnd.value = course?.recurrence.endTime ?? '19:00'
  const upfront = store.snapshot.expenses.find((item) =>
    item.courseId === courseId.value && (item.source === 'course_upfront' || item.billingMode === 'term'),
  )
  form.paymentStatus = upfront?.status === 'paid' ? 'paid' : 'unpaid'
})

function toggleChild(id: string) {
  form.childIds = form.childIds.includes(id)
    ? form.childIds.filter((item) => item !== id)
    : [...form.childIds, id]
}

function choosePlan(value: string) {
  if (value === 'usage') {
    if (form.pricingMode !== 'per_session' && form.pricingMode !== 'per_hour') form.pricingMode = 'per_session'
    return
  }
  form.pricingMode = value as CoursePricingMode
}

function setUsageUnit(value: string) {
  form.pricingMode = value as CoursePricingMode
}

function onSelectedDates(dates: string[]) {
  const current = new Map(slots.value.map((slot) => [slot.date, slot]))
  slots.value = dates.map((date) => current.get(date) ?? {
    date,
    startTime: batchStart.value,
    endTime: batchEnd.value,
  }).sort((left, right) => left.date.localeCompare(right.date))
}

function applyBatchTime() {
  if (batchEnd.value <= batchStart.value) {
    errorText.value = '结束时间要晚于开始时间'
    return
  }
  if (batchConflict.value) {
    errorText.value = batchConflict.value
    return
  }
  errorText.value = ''
  slots.value = slots.value.map((slot) => ({
    ...slot,
    startTime: batchStart.value,
    endTime: batchEnd.value,
  }))
}

function openSlot(slot: CourseDateSlot) {
  slotError.value = ''
  editingSlot.value = { ...slot }
}

function saveSlotTime() {
  const slot = editingSlot.value
  if (!slot) return
  if (slot.endTime <= slot.startTime) {
    slotError.value = '结束时间要晚于开始时间'
    return
  }
  slots.value = slots.value.map((item) => item.date === slot.date ? { ...slot } : item)
  editingSlot.value = null
}

function billingMode(): BillingMode {
  if (form.pricingMode === 'free') return 'free'
  if (form.pricingMode === 'prepaid') return 'term'
  return 'session'
}

async function save() {
  errorText.value = ''
  if (!form.title.trim()) {
    errorText.value = '请填写课程名称'
    return
  }
  if (!form.childIds.length) {
    errorText.value = '请至少选择一个孩子'
    return
  }
  if (!slots.value.length) {
    errorText.value = '请至少选择一个上课日期'
    return
  }
  if (slots.value.some((slot) => slot.endTime <= slot.startTime)) {
    errorText.value = '结束时间要晚于开始时间'
    return
  }
  if (form.pricingMode !== 'free' && !(Number(form.amount) > 0)) {
    errorText.value = `请填写${amountLabel.value}`
    return
  }
  const dates = [...slots.value].sort((a, b) => a.date.localeCompare(b.date))
  const [conflict] = findScheduleConflicts(
    dates,
    store.overviewCourses,
    store.overviewScheduleExceptions,
    courseId.value || undefined,
    form.childIds,
  )
  if (conflict) {
    errorText.value = `${conflict.date} 与「${conflict.title}」时间重叠`
    return
  }
  saving.value = true
  try {
    await store.saveCourse({
      id: courseId.value || undefined,
      childIds: [...form.childIds],
      title: form.title.trim(),
      type: form.type,
      teacher: form.teacher.trim(),
      location: form.location.trim(),
      icon: form.icon,
      color: form.color,
      needsBillingReview: false,
      billingPolicy: {
        pricingMode: form.pricingMode,
        settlementCycle: form.pricingMode === 'prepaid' ? 'upfront' : 'manual',
      },
      billingMode: billingMode(),
      amount: form.pricingMode === 'free' ? 0 : Number(form.amount) || 0,
      recurrence: {
        freq: 'dates',
        byWeekday: [],
        startDate: dates[0].date,
        endDate: dates[dates.length - 1].date,
        startTime: batchStart.value,
        endTime: batchEnd.value,
        dates,
      },
      note: form.note,
    }, form.paymentStatus)
    uni.navigateBack()
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

async function archive() {
  if (!courseId.value || saving.value) return
  saving.value = true
  try {
    if (existing.value?.archived) await store.restoreCourse(courseId.value)
    else await store.archiveCourse(courseId.value)
    uni.navigateBack()
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

function pickIcon(icon: CourseIcon) {
  form.icon = icon
  form.color = unusedCourseColor(store.snapshot.courses, {
    preferred: COURSE_ICON_COLORS[icon],
    exceptId: courseId.value || undefined,
  })
}
</script>

<template>
  <view class="theme-root" :class="themeClass">
  <view class="page edit sub">
    <PageHeader safe show-back :title="courseId ? '课程编辑' : '新增课程'">
      <template #actions>
        <text class="lesson-count">{{ slots.length }} 次课</text>
      </template>
    </PageHeader>

    <view class="participants">
      <text class="participants-title">选择参与这门课程的孩子</text>
      <view class="child-row">
        <view
          v-for="child in store.snapshot.children"
          :key="child.id"
          class="child-pick"
          :class="{ on: form.childIds.includes(child.id) }"
          @click="toggleChild(child.id)"
        >
          <ChildAvatar :avatar-key="child.avatarKey" :size="52" />
          <text>{{ child.name }}</text>
        </view>
      </view>
    </view>

    <view class="editor-card">
      <view class="section-heading">
        <text>01</text>
        <view>
          <text class="h2">课程信息</text>
          <text class="hint">这些信息会作为快速排课的预设</text>
        </view>
      </view>
      <view class="field">
        <text class="field-label">课程名称</text>
        <input v-model="form.title" maxlength="40" placeholder="例如 钢琴课 / 外教口语" />
      </view>
      <view class="row">
        <view class="field" style="flex: 1">
          <text class="field-label">类型</text>
          <SelectField v-model="form.type" :options="COURSE_TYPE_OPTIONS" />
        </view>
        <view class="field" style="flex: 1">
          <text class="field-label">老师</text>
          <input v-model="form.teacher" placeholder="老师姓名" />
        </view>
      </view>
      <view class="field">
        <text class="field-label">上课地点</text>
        <input v-model="form.location" placeholder="线下地点或在线平台" />
      </view>

      <view class="billing">
        <text class="bill-title">课程费用</text>
        <text class="hint">先选择收费方式，系统会提示需要填写的金额</text>
        <view class="plan-list">
          <view
            v-for="option in pricingPlans"
            :key="option.value"
            class="plan"
            :class="{ on: paymentPlan === option.value }"
            @click="choosePlan(option.value)"
          >
            <text class="plan-name">{{ option.label }}</text>
            <text class="hint">{{ option.caption }}</text>
          </view>
        </view>
        <view v-if="paymentPlan === 'usage'" class="unit-row">
          <text
            v-for="option in usageUnits"
            :key="option.value"
            class="unit"
            :class="{ on: form.pricingMode === option.value }"
            @click="setUsageUnit(option.value)"
          >{{ option.label }}</text>
        </view>
        <view v-if="form.pricingMode !== 'free'" class="field">
          <text class="field-label">{{ amountLabel }}</text>
          <view class="money">
            <text>¥</text>
            <input v-model="form.amount" type="digit" />
          </view>
        </view>
        <view v-if="form.pricingMode === 'prepaid'" class="row pay-row">
          <text>是否已支付</text>
          <switch :checked="form.paymentStatus === 'paid'" color="#ff7a45" @change="form.paymentStatus = $event.detail.value ? 'paid' : 'unpaid'" />
        </view>
        <text class="summary">{{ billingSummary }}</text>
      </view>
    </view>

    <view class="editor-card">
      <view class="section-heading">
        <text>02</text>
        <view>
          <text class="h2">选择上课日期</text>
          <text class="hint">点选或按住滑动，可连续多选、取消</text>
        </view>
      </view>
      <DateDragGrid :selected="selectedDates" @update:selected="onSelectedDates" />
      <text class="hint">已选 {{ slots.length }} 个日期</text>
    </view>

    <view class="editor-card">
      <view class="section-heading">
        <text>03</text>
        <view>
          <text class="h2">批量设置时间</text>
          <text class="hint">应用到当前已选的全部日期</text>
        </view>
      </view>
      <view class="row">
        <view class="field" style="flex: 1">
          <text class="field-label">开始</text>
          <TimeField v-model="batchStart" />
        </view>
        <view class="field" style="flex: 1">
          <text class="field-label">结束</text>
          <TimeField v-model="batchEnd" />
        </view>
      </view>
      <text class="hint" :class="{ warn: batchConflict }">{{ batchConflict || '选择日期后，可一次改完全部上课时间。' }}</text>
      <button class="btn ghost block" :disabled="!slots.length || !!batchConflict" @click="applyBatchTime">
        应用到已选 {{ slots.length }} 个日期
      </button>
    </view>

    <view v-if="sortedSlots.length" class="editor-card">
      <view class="section-heading slot-toggle" @click="slotsOpen = !slotsOpen">
        <text>04</text>
        <view class="slot-toggle-copy">
          <text class="h2">逐日调整</text>
          <text class="hint">{{ slotsOpen ? '点击某个日期，单独修改当天时间' : `已选 ${sortedSlots.length} 个日期，展开后可单独调整` }}</text>
        </view>
        <view class="slot-caret" :class="{ open: slotsOpen }">
          <AppIcon name="chevron-right" tone="muted" :size="16" />
        </view>
      </view>
      <view v-if="slotsOpen" class="slot-panel">
        <view
          v-for="slot in sortedSlots"
          :key="slot.date"
          class="slot"
          @click="openSlot(slot)"
        >
          <view>
            <text class="slot-date">{{ dayjs(slot.date).format('M月D日') }}</text>
            <text class="hint">周{{ WEEKDAY_SHORT[dayjs(slot.date).day()] }}</text>
          </view>
          <text class="slot-time">{{ slot.startTime }}–{{ slot.endTime }}</text>
          <text class="slot-more">›</text>
        </view>
      </view>
    </view>

    <view class="editor-card">
      <view class="field">
        <text class="field-label">课程图标</text>
        <view class="icon-options">
          <view
            v-for="option in COURSE_ICON_OPTIONS"
            :key="option.value"
            class="icon-option"
            :class="{ on: form.icon === option.value }"
            @click="pickIcon(option.value)"
          >
            <AppIcon :name="option.value" :tone="form.icon === option.value ? 'violet' : 'ink'" :size="21" />
            <text>{{ option.label }}</text>
          </view>
        </view>
      </view>
      <view class="field">
        <text class="field-label">课程颜色</text>
        <view class="chip-row">
          <view
            v-for="color in COURSE_COLORS"
            :key="color"
            class="swatch"
            :class="{ on: form.color.toUpperCase() === color.toUpperCase() }"
            :style="{ background: color }"
            @click="form.color = color"
          />
        </view>
      </view>
      <view class="field">
        <text class="field-label">备注</text>
        <textarea v-model="form.note" maxlength="200" placeholder="课程说明或注意事项" />
      </view>
    </view>

    <text v-if="errorText" class="form-error">{{ errorText }}</text>
  </view>

  <view class="save-dock">
    <button class="btn block" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存当前课程' }}</button>
    <button v-if="courseId" class="btn ghost block" style="margin-top: 8px" @click="archive">
      {{ existing?.archived ? '恢复课程' : '标记已结课' }}
    </button>
  </view>

  <view v-if="editingSlot" class="mask" @click="editingSlot = null">
    <view class="sheet" @click.stop>
      <view class="sheet-head">
        <view>
          <text class="eyebrow">单独调整</text>
          <text class="sheet-title">{{ dayjs(editingSlot.date).format('M月D日') }}</text>
        </view>
        <text class="close" @click="editingSlot = null">×</text>
      </view>
      <view class="row">
        <view class="field" style="flex: 1">
          <text class="field-label">开始</text>
          <TimeField v-model="editingSlot.startTime" />
        </view>
        <view class="field" style="flex: 1">
          <text class="field-label">结束</text>
          <TimeField v-model="editingSlot.endTime" />
        </view>
      </view>
      <text v-if="slotError" class="form-error">{{ slotError }}</text>
      <view class="sheet-foot">
        <button class="btn block" @click="saveSlotTime">保存当天时间</button>
        <text class="hint">只修改这一天，不影响其他已选日期。</text>
      </view>
    </view>
  </view>
  </view>
</template>

<style scoped>
.edit.sub { padding-bottom: 148px; }
.lesson-count { color: var(--muted); font-size: 12px; font-weight: 700; }
.participants {
  margin-bottom: 14px;
  padding: 15px 14px 12px;
  border-radius: 22px;
  background: linear-gradient(150deg, #fff1ea 0%, #fff 68%);
  box-shadow: var(--elev-sm);
}
.participants-title { display: block; margin-bottom: 12px; color: var(--muted); text-align: center; font-size: 12px; font-weight: 650; }
.child-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.child-pick { display: flex; width: 76px; flex-direction: column; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.child-pick.on { color: var(--ink); }
.child-pick.on :deep(.child-face) { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #ff7a45; }
.editor-card {
  margin-bottom: 12px;
  padding: 16px 14px;
  border-radius: 22px;
  background: #fff;
  box-shadow: var(--elev-sm);
}
.section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.slot-toggle { margin-bottom: 0; }
.slot-toggle-copy { flex: 1; min-width: 0; }
.slot-caret {
  display: flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  transform: rotate(90deg);
  transition: transform 0.22s ease;
}
.slot-caret.open { transform: rotate(-90deg); }
.slot-panel { margin-top: 8px; }
.section-heading > text {
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 800;
}
.h2 { display: block; font-size: 16px; font-weight: 800; }
.hint { display: block; color: var(--muted); font-size: 12px; }
.hint.warn, .form-error { color: var(--unpaid); }
.billing { margin-top: 4px; }
.bill-title { display: block; font-weight: 800; }
.plan-list { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.plan { padding: 12px; border-radius: 16px; background: #f7f8fc; }
.plan.on { background: #fff7f2; box-shadow: inset 0 0 0 1.5px #ff7a45; }
.plan-name { display: block; font-weight: 700; }
.unit-row { display: flex; gap: 8px; margin-bottom: 12px; }
.unit { display: flex; flex: 1; align-items: center; justify-content: center; min-height: 40px; padding: 10px 0; border-radius: 12px; background: #f7f8fc; font-weight: 700; line-height: 1; }
.unit.on { background: #fff7f2; box-shadow: inset 0 0 0 1.5px #ff7a45; }
.pay-row { align-items: center; margin-bottom: 8px; }
.summary { margin-top: 4px; color: var(--muted); font-size: 12px; }
.slot { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-top: 1px solid var(--line); }
.slot-date { display: block; font-weight: 700; }
.slot-time { margin-left: auto; font-weight: 700; }
.slot-more { color: var(--muted); font-size: 18px; }
.icon-options { display: flex; flex-wrap: wrap; gap: 8px; }
.icon-option {
  display: flex;
  width: calc(20% - 7px);
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 9px 2px 7px;
  border: 1px solid #e9e4f0;
  border-radius: 14px;
  background: #f7f6fb;
  color: #81798d;
  font-size: 10px;
}
.icon-option.on { color: #7048df; border-color: #8b64ee; background: #f0eaff; }
.swatch { width: 28px; height: 28px; border-radius: 50%; }
.swatch.on { box-shadow: 0 0 0 3px #fff, 0 0 0 5px #ff7a45; }
.form-error { display: block; margin-bottom: 8px; }
.save-dock {
  position: fixed;
  z-index: 40;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  background: rgba(243, 244, 251, 0.96);
}
.eyebrow { display: block; color: var(--accent-text); font-size: 11px; font-weight: 700; }
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
</style>
