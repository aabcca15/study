<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { showCloudError } from '@/cloud/call'
import { useFamilyStore } from '@/stores/family'
import DateField from './DateField.vue'
import TimeField from './TimeField.vue'
import SelectField from './SelectField.vue'

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
const startTime = ref('18:00')
const endTime = ref('19:00')
const amount = ref('0')
const paid = ref(false)
const saving = ref(false)

const courseOptions = computed(() =>
  store.overviewCourses
    .filter((course) => course.source !== 'temporary')
    .map((course) => ({ value: course.id, label: course.title })),
)

watch(() => props.open, (open) => {
  if (!open) return
  mode.value = courseOptions.value.length ? 'preset' : 'temporary'
  dates.value = [props.date || dayjs().format('YYYY-MM-DD')]
  courseId.value = courseOptions.value[0]?.value ?? ''
  title.value = ''
  startTime.value = '18:00'
  endTime.value = '19:00'
  amount.value = '0'
  paid.value = false
})

function addDate(value: string) {
  if (!value || dates.value.includes(value)) return
  dates.value = [...dates.value, value].sort()
}

function removeDate(value: string) {
  dates.value = dates.value.filter((item) => item !== value)
}

async function submit() {
  if (saving.value) return
  saving.value = true
  try {
    if (mode.value === 'preset') {
      if (!courseId.value) throw new Error('请选择课程')
      await store.addOccurrences(courseId.value, dates.value)
    } else {
      await store.quickArrangement({
        dates: dates.value,
        title: title.value.trim(),
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
      <view class="sheet-head">
        <text class="sheet-title">添加安排</text>
        <text class="muted" @click="emit('close')">关闭</text>
      </view>

      <view class="chip-row" style="margin-bottom: 20rpx">
        <text class="chip" :class="{ active: mode === 'preset' }" @click="mode = 'preset'">已有课程</text>
        <text class="chip" :class="{ active: mode === 'temporary' }" @click="mode = 'temporary'">临时安排</text>
      </view>

      <view class="field">
        <text class="field-label">日期</text>
        <view class="chip-row">
          <text v-for="item in dates" :key="item" class="chip active" @click="removeDate(item)">{{ item }} ×</text>
        </view>
        <DateField model-value="" placeholder="再加一天" @update:model-value="addDate" />
      </view>

      <template v-if="mode === 'preset'">
        <view v-if="!courseOptions.length" class="empty">还没有长期课程，可以先记一笔临时安排。</view>
        <view v-else class="field">
          <text class="field-label">课程</text>
          <SelectField v-model="courseId" :options="courseOptions" />
        </view>
      </template>
      <template v-else>
        <view class="field">
          <text class="field-label">名称</text>
          <input v-model="title" placeholder="例如：临时钢琴课" />
        </view>
        <view class="row">
          <view class="field" style="flex: 1">
            <text class="field-label">开始</text>
            <TimeField v-model="startTime" />
          </view>
          <view class="field" style="flex: 1">
            <text class="field-label">结束</text>
            <TimeField v-model="endTime" />
          </view>
        </view>
        <view class="field">
          <text class="field-label">金额</text>
          <input v-model="amount" type="digit" />
        </view>
        <view class="row" style="margin-bottom: 20rpx">
          <text>已支付</text>
          <switch :checked="paid" color="#ff7a45" @change="paid = Boolean($event.detail.value)" />
        </view>
      </template>

      <button class="btn block" :disabled="saving" @click="submit">{{ saving ? '保存中…' : '保存' }}</button>
    </view>
  </view>
</template>
