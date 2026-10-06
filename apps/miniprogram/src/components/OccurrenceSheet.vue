<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DayOccurrence } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { useFamilyStore } from '@/stores/family'
import { occurrenceExpense } from '@/utils/view'
import TimeField from './TimeField.vue'

const props = defineProps<{
  item: DayOccurrence | null
}>()

const emit = defineEmits<{
  close: []
  cancelled: [item: DayOccurrence]
}>()

const store = useFamilyStore()
const startTime = ref('18:00')
const endTime = ref('19:00')
const amount = ref('0')
const paid = ref(false)
const saving = ref(false)

const expense = computed(() =>
  props.item ? occurrenceExpense(store.overviewExpenses, props.item.course, props.item.date) : undefined,
)
const locked = computed(() => expense.value?.status === 'paid')
const free = computed(() => {
  const course = props.item?.course
  return course?.billingPolicy?.pricingMode === 'free' || course?.billingMode === 'free'
})

watch(() => props.item, (item) => {
  if (!item) return
  startTime.value = item.exception?.startTime ?? item.course.recurrence.startTime
  endTime.value = item.exception?.endTime ?? item.course.recurrence.endTime
  const bill = occurrenceExpense(store.overviewExpenses, item.course, item.date)
  amount.value = String(bill?.amount ?? item.course.amount ?? 0)
  paid.value = bill?.status === 'paid'
}, { immediate: true })

async function save() {
  const item = props.item
  if (!item || saving.value) return
  if (endTime.value <= startTime.value) {
    showCloudError(new Error('结束时间要晚于开始时间'))
    return
  }
  saving.value = true
  try {
    const scheduledStart = item.exception?.startTime ?? item.course.recurrence.startTime
    const scheduledEnd = item.exception?.endTime ?? item.course.recurrence.endTime
    const timeChanged = startTime.value !== scheduledStart || endTime.value !== scheduledEnd
    if (timeChanged) {
      await store.upsertException({
        courseId: item.course.id,
        date: item.date,
        status: item.exception?.status === 'added' ? 'added' : 'rescheduled',
        startTime: startTime.value,
        endTime: endTime.value,
        title: item.course.title,
        location: item.course.location,
      })
    }
    if (!free.value && !locked.value) {
      await store.saveOccurrenceExpense(item.course.id, item.date, Number(amount.value) || 0, paid.value)
    }
    emit('close')
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

function cancelOnce() {
  const item = props.item
  if (!item) return
  uni.showModal({
    title: '取消这次课',
    content: '取消后可以从提示里撤销。',
    success: async (res) => {
      if (!res.confirm) return
      const snapshot = JSON.parse(JSON.stringify(item)) as DayOccurrence
      try {
        if (item.exception?.status === 'added') await store.dropOccurrence(item.course.id, item.date)
        else {
          await store.upsertException({
            courseId: item.course.id,
            date: item.date,
            status: 'cancelled',
          })
        }
        emit('cancelled', snapshot)
        emit('close')
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}
</script>

<template>
  <view v-if="item" class="mask" @click="emit('close')">
    <view class="sheet" @click.stop>
      <view class="sheet-head">
        <view>
          <text class="eyebrow">这次安排</text>
          <text class="sheet-title">{{ item.course.title }}</text>
        </view>
        <text class="close" @click="emit('close')">×</text>
      </view>
      <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
        <text class="muted">{{ item.date }}</text>
        <view class="row" style="margin-top: 16px">
          <view class="field" style="flex: 1">
            <text class="field-label">开始</text>
            <TimeField v-model="startTime" />
          </view>
          <view class="field" style="flex: 1">
            <text class="field-label">结束</text>
            <TimeField v-model="endTime" />
          </view>
        </view>
        <view v-if="!free" class="field">
          <text class="field-label">金额</text>
          <view class="money">
            <text>¥</text>
            <input v-model="amount" type="digit" placeholder-class="ph" :disabled="locked" />
          </view>
        </view>
        <view v-if="!free" class="row pay-row">
          <text>是否已支付</text>
          <switch :checked="paid" :disabled="locked" color="#ff7a45" @change="paid = Boolean($event.detail.value)" />
        </view>
      </scroll-view>
      <view class="sheet-foot action-row">
        <button class="btn danger" @click="cancelOnce">取消课程</button>
        <button class="btn" :disabled="saving" @click="save">{{ saving ? '保存中…' : '确认修改' }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
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
.pay-row { align-items: center; margin-bottom: 8px; }
.action-row { display: flex; gap: 10px; }
.action-row .btn { flex: 1; min-height: 48px; }
.action-row .btn.danger {
  color: #ed5d6e;
  background: var(--danger-soft);
  box-shadow: none;
}
</style>
