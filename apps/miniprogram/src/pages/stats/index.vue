<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { calculateLearningStatistics } from '@server-domain/statistics'
import { money } from '@server-domain/billing'
import { useFamilyPage } from '@/composables/useFamilyPage'
import TabBar from '@/components/TabBar.vue'

const store = useFamilyPage()
const granularity = ref<'month' | 'year'>('month')
const anchor = ref(dayjs().format('YYYY-MM-DD'))

const stats = computed(() => calculateLearningStatistics(
  store.overviewCourses,
  store.overviewExpenses,
  store.overviewScheduleExceptions,
  dayjs(anchor.value),
  granularity.value,
  store.overviewCharges,
  store.snapshot.occurrenceRecords ?? [],
  store.overviewPayments,
))

const maxHours = computed(() => Math.max(1, ...stats.value.trend.map((item) => item.courseHours)))

function onPick(event: { detail: { value: string } }) {
  const value = event.detail.value
  anchor.value = granularity.value === 'year' ? `${value.slice(0, 4)}-01-01` : `${value.slice(0, 7)}-01`
}
</script>

<template>
  <view class="page">
    <view class="row">
      <view class="chip-row">
        <text class="chip" :class="{ active: granularity === 'month' }" @click="granularity = 'month'">按月</text>
        <text class="chip" :class="{ active: granularity === 'year' }" @click="granularity = 'year'">按年</text>
      </view>
      <picker :mode="'date'" :fields="granularity === 'year' ? 'year' : 'month'" :value="anchor" @change="onPick">
        <view class="control">{{ granularity === 'year' ? anchor.slice(0, 4) : anchor.slice(0, 7) }}</view>
      </picker>
    </view>

    <view class="card">
      <view class="row"><text>账单合计</text><text>{{ money(stats.periodTotal) }}</text></view>
      <view class="row"><text>已支付</text><text class="pay-paid">{{ money(stats.periodPaid) }}</text></view>
      <view class="row"><text>未支付</text><text class="pay-unpaid">{{ money(stats.periodUnpaid) }}</text></view>
      <view class="row"><text>预计</text><text>{{ money(stats.forecastExpense) }}</text></view>
    </view>

    <view class="card" @click="uni.navigateTo({ url: '/pages/bills/index' })">
      <view class="row">
        <text>本周账单</text>
        <text class="muted">查看</text>
      </view>
    </view>

    <view class="card">
      <text class="muted">课时趋势</text>
      <view v-for="point in stats.trend" :key="point.key" class="trend">
        <text class="trend-label">{{ point.label }}</text>
        <view class="bar" :style="{ width: `${Math.round((point.courseHours / maxHours) * 100)}%` }" />
      </view>
    </view>

    <view
      v-for="item in stats.courseStats"
      :key="item.course.id"
      class="card"
      @click="uni.navigateTo({ url: `/pages/course-bills/index?id=${item.course.id}` })"
    >
      <view class="row">
        <text class="title">{{ item.course.title }}</text>
        <text>{{ money(item.totalFee) }}</text>
      </view>
      <text class="muted">完成 {{ item.completedCount }}/{{ item.scheduledCount }} · 未付 {{ money(item.unpaidFee) }}</text>
    </view>
    <TabBar active="stats" />
  </view>
</template>

<style scoped>
.title { font-weight: 700; }
.trend {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
}
.trend-label {
  width: 72rpx;
  color: #8b93a5;
  font-size: 22rpx;
}
.bar {
  height: 12rpx;
  min-width: 8rpx;
  border-radius: 999rpx;
  background: #ff7a45;
}
</style>
