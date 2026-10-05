<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { buildCourseBillLedger } from '@server-domain/courseBills'
import { money } from '@server-domain/billing'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'

const store = useFamilyPage()
const courseId = ref('')

onLoad((query) => {
  courseId.value = typeof query?.id === 'string' ? query.id : ''
})

const course = computed(() => store.snapshot.courses.find((item) => item.id === courseId.value))
const ledger = computed(() => {
  if (!course.value) return null
  return buildCourseBillLedger(
    course.value,
    store.overviewExpenses,
    store.overviewScheduleExceptions,
    store.overviewCharges,
  )
})

async function markPaid(expenseId?: string) {
  if (!expenseId) return
  try {
    await store.setExpenseStatus(expenseId, 'paid')
  } catch (error) {
    showCloudError(error)
  }
}
</script>

<template>
  <view class="page edit">
    <view v-if="!course" class="empty">课程不存在</view>
    <template v-else-if="ledger">
      <view class="h1">{{ course.title }}</view>
      <view class="card">
        <view class="row"><text>合计</text><text>{{ money(ledger.total) }}</text></view>
        <view class="row"><text>已支付</text><text class="pay-paid">{{ money(ledger.paid) }}</text></view>
        <view class="row"><text>未支付</text><text class="pay-unpaid">{{ money(ledger.unpaid) }}</text></view>
      </view>
      <view v-for="day in ledger.days" :key="day.key" class="card">
        <view class="row">
          <text>{{ day.date }} {{ day.weekdayLabel }}</text>
          <text :class="day.payState === 'paid' ? 'pay-paid' : 'pay-unpaid'">{{ day.payLabel }}</text>
        </view>
        <text class="muted">{{ day.startTime }}–{{ day.endTime }} · {{ day.amountLabel }}</text>
        <button
          v-if="day.payState === 'unpaid' && day.expenseId"
          class="btn ghost"
          style="margin-top: 16rpx"
          @click="markPaid(day.expenseId)"
        >标记已支付</button>
      </view>
    </template>
  </view>
</template>

<style scoped>
.edit { padding-bottom: 48rpx; }
</style>
