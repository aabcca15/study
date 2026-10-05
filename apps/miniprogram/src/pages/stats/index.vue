<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { calculateLearningStatistics } from '@server-domain/statistics'
import { money } from '@server-domain/billing'
import { useFamilyPage } from '@/composables/useFamilyPage'
import TabBar from '@/components/TabBar.vue'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'

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
  <view>
    <AppHeader />
    <view class="page">
      <PageHeader eyebrow="家庭统计" :title="granularity === 'year' ? anchor.slice(0, 4) + ' 年' : anchor.slice(0, 7)">
        <template #actions>
          <view class="nav">
            <button :class="{ on: granularity === 'month' }" @click="granularity = 'month'">月</button>
            <button :class="{ on: granularity === 'year' }" @click="granularity = 'year'">年</button>
          </view>
        </template>
      </PageHeader>
      <picker mode="date" :fields="granularity === 'year' ? 'year' : 'month'" :value="anchor" @change="onPick">
        <view class="control period">{{ granularity === 'year' ? anchor.slice(0, 4) + ' 年' : anchor.slice(0, 7) }}</view>
      </picker>

      <view class="metrics">
        <view class="card metric"><text>账单合计</text><text class="big">{{ money(stats.periodTotal) }}</text></view>
        <view class="card metric"><text>已支付</text><text class="big pay-paid">{{ money(stats.periodPaid) }}</text></view>
        <view class="card metric"><text>未支付</text><text class="big pay-unpaid">{{ money(stats.periodUnpaid) }}</text></view>
        <view class="card metric"><text>预计</text><text class="big">{{ money(stats.forecastExpense) }}</text></view>
      </view>

      <view class="card link" @click="uni.navigateTo({ url: '/pages/bills/index' })">
        <view class="row"><text>本周账单</text><text class="muted">查看 ›</text></view>
      </view>

      <view class="card">
        <text class="muted">课时趋势</text>
        <view v-for="point in stats.trend" :key="point.key" class="trend">
          <text class="trend-label">{{ point.label }}</text>
          <view class="bar" :style="{ width: Math.round((point.courseHours / maxHours) * 100) + '%' }" />
        </view>
      </view>

      <view
        v-for="item in stats.courseStats"
        :key="item.course.id"
        class="card course"
        :style="{ '--course-color': item.course.color }"
        @click="uni.navigateTo({ url: `/pages/course-bills/index?id=${item.course.id}` })"
      >
        <view class="tint" />
        <view class="row body">
          <text class="title">{{ item.course.title }}</text>
          <text>{{ money(item.totalFee) }}</text>
        </view>
        <text class="muted body">完成 {{ item.completedCount }}/{{ item.scheduledCount }} · 未付 {{ money(item.unpaidFee) }}</text>
      </view>
    </view>
    <TabBar active="stats" />
  </view>
</template>

<style scoped>
.nav { display: flex; padding: 3px; border-radius: 14px; background: #fff; box-shadow: var(--elev-sm); }
.nav button { width: 36px; height: 30px; border-radius: 11px; color: var(--muted); font-size: 12px; font-weight: 700; }
.nav button.on { color: var(--accent-text); background: var(--accent-soft); }
.period { margin-bottom: 14px; }
.metrics { display: flex; flex-wrap: wrap; gap: 10px; }
.metric { width: calc(50% - 5px); box-sizing: border-box; margin-bottom: 0; }
.metric text { display: block; color: var(--muted); font-size: 12px; }
.big { margin-top: 6px; color: var(--ink); font-size: 20px; font-weight: 800; }
.course { position: relative; overflow: hidden; }
.tint { position: absolute; inset: 0; background: var(--course-color); opacity: 0.12; }
.body { position: relative; }
.title { font-weight: 700; }
.trend { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.trend-label { width: 36px; color: var(--muted); font-size: 11px; }
.bar { height: 8px; min-width: 4px; border-radius: 999px; background: #ff7a45; }
</style>
