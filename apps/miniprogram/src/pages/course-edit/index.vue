<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  COURSE_COLORS,
  COURSE_ICON_COLORS,
  COURSE_ICON_OPTIONS,
  COURSE_TYPE_OPTIONS,
  unusedCourseColor,
} from '@server-domain/constants'
import type { BillingMode, CourseDateSlot, CourseIcon, CoursePricingMode, CourseType } from '@server-domain/types'
import { findScheduleConflicts } from '@server-domain/schedule'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import DateField from '@/components/DateField.vue'
import TimeField from '@/components/TimeField.vue'
import AppIcon from '@/components/AppIcon.vue'
import SelectField from '@/components/SelectField.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage({ refresh: false })
const courseId = ref('')
const saving = ref(false)
const errorText = ref('')
const slots = ref<CourseDateSlot[]>([])
const draftDate = ref('')
const batchStart = ref('18:00')
const batchEnd = ref('19:00')

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

const pricingOptions = [
  { value: 'prepaid', label: '一次性支付' },
  { value: 'per_session', label: '按次计费' },
  { value: 'per_hour', label: '按小时计费' },
  { value: 'free', label: '无需缴费' },
]

const amountLabel = computed(() => {
  if (form.pricingMode === 'prepaid') return '课程总金额'
  if (form.pricingMode === 'per_hour') return '每小时费用'
  return '单次费用'
})

onLoad((query) => {
  courseId.value = typeof query?.id === 'string' ? query.id : ''
  const existing = store.snapshot.courses.find((course) => course.id === courseId.value)
  form.childIds = existing?.childIds?.length
    ? [...existing.childIds]
    : [existing?.childId || store.childId].filter(Boolean)
  form.title = existing?.title ?? ''
  form.type = existing?.type ?? 'interest'
  form.teacher = existing?.teacher ?? ''
  form.location = existing?.location ?? ''
  form.icon = existing?.icon ?? 'generic'
  form.color = existing?.color ?? unusedCourseColor(store.snapshot.courses)
  form.pricingMode = existing?.billingPolicy?.pricingMode === 'fixed_period'
    ? 'per_session'
    : existing?.billingPolicy?.pricingMode
      ?? (existing?.billingMode === 'free' ? 'free' : existing?.billingMode === 'session' ? 'per_session' : 'prepaid')
  form.amount = String(existing?.amount ?? 0)
  form.note = existing?.note ?? ''
  slots.value = [...(existing?.recurrence.dates ?? [])]
  batchStart.value = existing?.recurrence.startTime ?? '18:00'
  batchEnd.value = existing?.recurrence.endTime ?? '19:00'
  const upfront = store.snapshot.expenses.find((item) =>
    item.courseId === courseId.value && (item.source === 'course_upfront' || item.billingMode === 'term'),
  )
  form.paymentStatus = upfront?.status === 'paid' ? 'paid' : 'unpaid'
})

function toggleChild(event: { detail: { value: string[] } }) {
  form.childIds = event.detail.value
}

function addSlot() {
  if (!draftDate.value) return
  if (slots.value.some((slot) => slot.date === draftDate.value)) return
  slots.value = [...slots.value, {
    date: draftDate.value,
    startTime: batchStart.value,
    endTime: batchEnd.value,
  }].sort((a, b) => a.date.localeCompare(b.date))
}

function removeSlot(date: string) {
  slots.value = slots.value.filter((slot) => slot.date !== date)
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

function onIcon(value: string) {
  pickIcon(value as CourseIcon)
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
  <view class="page edit sub">
    <PageHeader safe show-back :title="courseId ? '编辑课程' : '新增课程'" />
    <view class="field">
      <text class="field-label">课程名称</text>
      <input v-model="form.title" maxlength="40" placeholder="例如：钢琴" />
    </view>
    <view class="field">
      <text class="field-label">上课孩子</text>
      <checkbox-group @change="toggleChild">
        <label v-for="child in store.snapshot.children" :key="child.id" class="check">
          <checkbox :value="child.id" :checked="form.childIds.includes(child.id)" color="#ff7a45" />
          <text>{{ child.name }}</text>
        </label>
      </checkbox-group>
    </view>
    <view class="field">
      <text class="field-label">类型</text>
      <SelectField v-model="form.type" :options="COURSE_TYPE_OPTIONS" />
    </view>
    <view class="field">
      <text class="field-label">老师</text>
      <input v-model="form.teacher" placeholder="选填" />
    </view>
    <view class="field">
      <text class="field-label">地点</text>
      <input v-model="form.location" placeholder="选填" />
    </view>
    <view class="field">
      <text class="field-label">图标</text>
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
      <text class="field-label">颜色</text>
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
      <text class="field-label">计费</text>
      <SelectField v-model="form.pricingMode" :options="pricingOptions" />
    </view>
    <view v-if="form.pricingMode !== 'free'" class="field">
      <text class="field-label">{{ amountLabel }}</text>
      <input v-model="form.amount" type="digit" />
    </view>
    <view v-if="form.pricingMode === 'prepaid'" class="row" style="margin-bottom: 20rpx">
      <text>一次性费用已支付</text>
      <switch :checked="form.paymentStatus === 'paid'" color="#ff7a45" @change="form.paymentStatus = $event.detail.value ? 'paid' : 'unpaid'" />
    </view>
    <view class="field">
      <text class="field-label">默认上课时间</text>
      <view class="row">
        <TimeField v-model="batchStart" />
        <TimeField v-model="batchEnd" />
      </view>
    </view>
    <view class="field">
      <text class="field-label">上课日期</text>
      <view class="chip-row">
        <text v-for="slot in slots" :key="slot.date" class="chip active" @click="removeSlot(slot.date)">
          {{ slot.date }} {{ slot.startTime }}–{{ slot.endTime }} ×
        </text>
      </view>
      <DateField v-model="draftDate" placeholder="选择日期后加入" />
      <button class="btn ghost" style="margin-top: 12rpx" @click="addSlot">加入这一天</button>
    </view>
    <view class="field">
      <text class="field-label">备注</text>
      <textarea v-model="form.note" maxlength="200" />
    </view>
    <text v-if="errorText" class="pay-unpaid">{{ errorText }}</text>
    <button class="btn block" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存课程' }}</button>
  </view>
</template>

<style scoped>
.edit {
  padding-bottom: 48rpx;
}
.check {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-right: 20rpx;
  margin-bottom: 12rpx;
}
.swatch {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
}
.swatch.on {
  box-shadow: 0 0 0 4rpx #fff, 0 0 0 8rpx #ff7a45;
}
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
.icon-option.on {
  color: #7048df;
  border-color: #8b64ee;
  background: #f0eaff;
}
</style>
