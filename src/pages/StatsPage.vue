<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { money } from '@/services/billing'
import {
  calculateLearningStatistics,
  type StatisticsGranularity,
} from '@/services/statistics'
import CourseIcon from '@/components/CourseIcon.vue'
import TrendChart from '@/components/TrendChart.vue'

const store = useAppStore()
const granularity = ref<StatisticsGranularity>('year')
const anchor = ref(dayjs())
const chartColors = ['#6258df', '#ef956e', '#58ad82', '#619bd1', '#ce78ae', '#d7a83c']

const stats = computed(() =>
  calculateLearningStatistics(
    store.courses,
    store.expenses,
    store.scheduleExceptions,
    anchor.value,
    granularity.value,
  ),
)

const scopeLabel = computed(() =>
  granularity.value === 'year' ? `${anchor.value.year()} 年` : anchor.value.format('YYYY 年 M 月'),
)
const scopeCaption = computed(() => granularity.value === 'year' ? '年度总支出' : '月度总支出')
const completionRate = computed(() =>
  stats.value.scheduledCount
    ? Math.round((stats.value.completedCount / stats.value.scheduledCount) * 100)
    : 0,
)
const courseTrend = computed(() =>
  stats.value.trend.map((item) => ({ label: item.label, value: item.courseHours })),
)
const expenseTrend = computed(() =>
  stats.value.trend.map((item) => ({ label: item.label, value: item.expense })),
)
const feeBreakdown = computed(() => {
  const items = stats.value.courseStats
    .filter((item) => item.expense > 0)
    .map((item, index) => ({
      id: item.course.id,
      label: item.course.title,
      amount: item.expense,
      color: chartColors[index % chartColors.length],
    }))
  if (stats.value.unassignedExpense > 0) {
    items.push({
      id: 'unassigned',
      label: '其他支出',
      amount: stats.value.unassignedExpense,
      color: '#a6adbc',
    })
  }
  return items
})
const donutBackground = computed(() => {
  if (!stats.value.totalExpense || !feeBreakdown.value.length) return 'var(--line)'
  let cursor = 0
  const slices = feeBreakdown.value.map((item) => {
    const start = cursor
    cursor += (item.amount / stats.value.totalExpense) * 100
    return `${item.color} ${start}% ${cursor}%`
  })
  return `conic-gradient(${slices.join(',')})`
})

function shiftScope(direction: number) {
  anchor.value = granularity.value === 'year'
    ? anchor.value.add(direction, 'year')
    : anchor.value.add(direction, 'month')
}

function setGranularity(value: StatisticsGranularity) {
  granularity.value = value
  anchor.value = dayjs()
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return `${Number(hours.toFixed(hours >= 10 ? 0 : 1))}h`
}

function formatTrendHours(hours: number) {
  return `${Number(hours.toFixed(hours >= 10 ? 0 : 1))}h`
}
</script>

<template>
  <main class="page stats-page">
    <header class="stats-header">
      <div>
        <p class="eyebrow">学习数据</p>
        <h1>统计报告</h1>
      </div>
      <div class="scope-switch" aria-label="统计维度">
        <button
          type="button"
          :class="{ active: granularity === 'year' }"
          @click="setGranularity('year')"
        >年度</button>
        <button
          type="button"
          :class="{ active: granularity === 'month' }"
          @click="setGranularity('month')"
        >月度</button>
      </div>
    </header>

    <div class="scope-nav">
      <button type="button" aria-label="上一周期" @click="shiftScope(-1)">‹</button>
      <strong>{{ scopeLabel }}</strong>
      <button type="button" aria-label="下一周期" @click="shiftScope(1)">›</button>
    </div>

    <section class="total-card">
      <div class="total-head">
        <div>
          <span>{{ scopeCaption }}</span>
          <strong>{{ money(stats.totalExpense) }}</strong>
        </div>
        <div class="total-orbit"><i /><i /><i /></div>
      </div>
      <div class="total-metrics">
        <div><span>已支付</span><b>{{ money(stats.paidExpense) }}</b></div>
        <div><span>待支付</span><b>{{ money(stats.openExpense) }}</b></div>
        <div><span>完成率</span><b>{{ completionRate }}%</b></div>
      </div>
      <div class="bill-actions">
        <router-link to="/bills">账单明细</router-link>
        <router-link to="/bills/edit">＋ 记一笔</router-link>
      </div>
    </section>

    <section class="quick-metrics">
      <article>
        <span class="metric-icon purple">
          <svg viewBox="0 0 24 24"><path d="M8 3h8v4H8zM6 7h12v14H6zM9 11h6m-6 4h4"/></svg>
        </span>
        <div><small>课程安排</small><strong>{{ stats.scheduledCount }}<i>次</i></strong></div>
      </article>
      <article>
        <span class="metric-icon blue">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
        </span>
        <div><small>总课时</small><strong>{{ formatMinutes(stats.scheduledMinutes) }}</strong></div>
      </article>
    </section>

    <section class="report-section">
      <div class="section-head">
        <div><p>课程明细</p><h2>每门课程表现</h2></div>
        <span>{{ store.child?.name }} · {{ scopeLabel }}</span>
      </div>
      <div v-if="stats.courseStats.length" class="course-report-list">
        <article
          v-for="item in stats.courseStats"
          :key="item.course.id"
          class="course-report"
          :style="{
            '--course-color': item.course.color,
            '--course-progress': `${item.completion}%`,
          }"
        >
          <header>
            <span class="course-report-icon"><CourseIcon :name="item.course.icon" /></span>
            <div>
              <h3>{{ item.course.title }}</h3>
              <p>{{ item.completedCount }}/{{ item.scheduledCount }} 次已完成</p>
            </div>
            <div class="progress-ring"><b>{{ item.completion }}%</b></div>
          </header>
          <div class="course-values">
            <div><small>总课时</small><strong>{{ formatMinutes(item.scheduledMinutes) }}</strong></div>
            <div><small>已完成</small><strong>{{ formatMinutes(item.completedMinutes) }}</strong></div>
            <div><small>课程费用</small><strong>{{ money(item.expense) }}</strong></div>
          </div>
        </article>
      </div>
      <p v-else class="empty-report">当前周期暂无课程安排。</p>
    </section>

    <section class="trend-grid">
      <TrendChart
        title="课时趋势"
        :caption="granularity === 'year' ? '各月安排课时' : '每日安排课时'"
        :points="courseTrend"
        color="#6258df"
        :value-formatter="formatTrendHours"
      />
      <TrendChart
        title="费用趋势"
        :caption="granularity === 'year' ? '各月课程支出' : '按账单日期统计'"
        :points="expenseTrend"
        color="#ef956e"
        :value-formatter="money"
      />
    </section>

    <section class="fee-card">
      <div class="section-head">
        <div><p>费用结构</p><h2>课程支出占比</h2></div>
      </div>
      <div v-if="feeBreakdown.length" class="fee-content">
        <div class="donut" :style="{ background: donutBackground }">
          <div><small>总支出</small><strong>{{ money(stats.totalExpense) }}</strong></div>
        </div>
        <div class="fee-legend">
          <div v-for="item in feeBreakdown" :key="item.id">
            <i :style="{ background: item.color }" />
            <span>{{ item.label }}</span>
            <strong>{{ money(item.amount) }}</strong>
          </div>
        </div>
      </div>
      <p v-else class="empty-report">当前周期暂无费用记录。</p>
    </section>
  </main>
</template>

<style scoped>
.stats-page {
  padding-top: 24px;
}

.stats-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.stats-header h1 {
  font-size: 29px;
}

.scope-switch {
  display: flex;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
}

.scope-switch button {
  min-width: 48px;
  padding: 7px 10px;
  color: var(--muted);
  border: 0;
  border-radius: 10px;
  background: transparent;
  font-size: 11px;
}

.scope-switch button.active {
  color: var(--accent-text);
  background: var(--accent-soft);
  font-weight: 700;
}

.scope-nav {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  margin-bottom: 12px;
  text-align: center;
}

.scope-nav button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--paper);
  font-size: 22px;
}

.scope-nav button:last-child {
  justify-self: end;
}

.scope-nav strong {
  font-size: 13px;
}

.total-card {
  position: relative;
  margin-bottom: 12px;
  padding: 20px;
  overflow: hidden;
  color: #fff;
  border-radius: 26px;
  background: #6258df;
  box-shadow: 0 18px 38px rgba(81,71,216,.24);
}

.total-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.total-head span {
  color: rgba(255,255,255,.72);
  font-size: 11px;
}

.total-head strong {
  display: block;
  margin-top: 8px;
  font-size: 32px;
  letter-spacing: -.045em;
}

.total-orbit {
  position: relative;
  width: 58px;
  height: 45px;
  opacity: .55;
}

.total-orbit i {
  position: absolute;
  border: 2px solid rgba(255,255,255,.58);
  border-radius: 50%;
}

.total-orbit i:nth-child(1) { top: 0; right: 4px; width: 32px; height: 32px; }
.total-orbit i:nth-child(2) { right: 27px; bottom: 0; width: 23px; height: 23px; }
.total-orbit i:nth-child(3) { right: 0; bottom: 0; width: 17px; height: 17px; background: rgba(255,255,255,.28); }

.total-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 20px;
}

.total-metrics div {
  padding: 10px;
  border-radius: 14px;
  background: rgba(255,255,255,.11);
}

.total-metrics span,
.total-metrics b {
  display: block;
}

.total-metrics span {
  margin-bottom: 5px;
  color: rgba(255,255,255,.65);
  font-size: 9px;
}

.total-metrics b {
  font-size: 12px;
}

.bill-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.bill-actions a {
  padding: 8px 12px;
  color: #fff;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 12px;
  background: rgba(255,255,255,.1);
  font-size: 10px;
  font-weight: 650;
}

.quick-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 28px;
}

.quick-metrics article {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.metric-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 13px;
}

.metric-icon.purple { color: #6258df; background: #efedff; }
.metric-icon.blue { color: #4f89bd; background: #e9f3fc; }

.metric-icon svg {
  width: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.quick-metrics small,
.quick-metrics strong {
  display: block;
}

.quick-metrics small {
  margin-bottom: 3px;
  color: var(--muted);
  font-size: 9px;
}

.quick-metrics strong {
  font-size: 18px;
}

.quick-metrics strong i {
  margin-left: 2px;
  color: var(--muted);
  font-size: 9px;
  font-style: normal;
}

.report-section,
.trend-grid,
.fee-card {
  margin-bottom: 28px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-head p {
  margin: 0 0 3px;
  color: var(--accent-text);
  font-size: 10px;
  font-weight: 700;
}

.section-head h2 {
  font-size: 19px;
}

.section-head > span {
  color: var(--muted);
  font-size: 10px;
}

.course-report-list {
  display: grid;
  grid-auto-columns: min(82vw, 310px);
  grid-auto-flow: column;
  gap: 11px;
  padding: 2px 1px 10px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.course-report-list::-webkit-scrollbar {
  display: none;
}

.course-report {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--course-color) 40%, var(--line));
  border-radius: 23px;
  background: color-mix(in srgb, var(--course-color) 17%, var(--paper));
  box-shadow: 0 10px 25px rgba(48,58,88,.055);
  scroll-snap-align: start;
}

.course-report header {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 50px;
  gap: 10px;
  align-items: center;
}

.course-report-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: color-mix(in srgb, var(--course-color) 52%, #293043);
  border-radius: 14px;
  background: color-mix(in srgb, var(--course-color) 52%, #fff);
}

.course-report-icon svg {
  width: 22px;
  height: 22px;
}

.course-report h3 {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-report header p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 9px;
}

.progress-ring {
  position: relative;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(
    color-mix(in srgb, var(--course-color) 55%, #4f5670) var(--course-progress),
    color-mix(in srgb, var(--course-color) 20%, #fff) 0
  );
}

.progress-ring::after {
  position: absolute;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--course-color) 10%, var(--paper));
  content: "";
}

.progress-ring b {
  position: relative;
  z-index: 1;
  font-size: 9px;
}

.course-values {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 17px;
  padding-top: 13px;
  border-top: 1px solid color-mix(in srgb, var(--course-color) 42%, var(--line));
}

.course-values small,
.course-values strong {
  display: block;
}

.course-values small {
  margin-bottom: 5px;
  color: var(--muted);
  font-size: 8px;
}

.course-values strong {
  font-size: 13px;
}

.trend-grid {
  display: grid;
  gap: 12px;
}

.fee-card {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.fee-content {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.donut {
  display: grid;
  width: 132px;
  height: 132px;
  padding: 17px;
  place-items: center;
  border-radius: 50%;
}

.donut > div {
  display: grid;
  width: 100%;
  height: 100%;
  place-content: center;
  text-align: center;
  border-radius: 50%;
  background: var(--paper);
}

.donut small,
.donut strong {
  display: block;
}

.donut small {
  color: var(--muted);
  font-size: 8px;
}

.donut strong {
  margin-top: 3px;
  font-size: 14px;
}

.fee-legend {
  display: grid;
  gap: 9px;
}

.fee-legend > div {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  font-size: 10px;
}

.fee-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.fee-legend span {
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fee-legend strong {
  font-size: 10px;
}

.empty-report {
  margin: 0;
  padding: 30px 18px;
  color: var(--muted);
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 20px;
  font-size: 11px;
}

@media (max-width: 360px) {
  .stats-header {
    align-items: flex-start;
  }

  .stats-header h1 {
    font-size: 25px;
  }

  .scope-switch button {
    min-width: 42px;
    padding-inline: 8px;
  }

  .fee-content {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 12px;
  }

  .donut {
    width: 112px;
    height: 112px;
  }
}
</style>
