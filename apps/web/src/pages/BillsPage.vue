<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import ExpenseCard from '@/components/ExpenseCard.vue'
import { CATEGORY_LABEL, COURSE_TYPE_LABEL, EXPENSE_STATUS_LABEL } from '@/domain/constants'
import { money, currentPeriod, groupByCategory, sumByStatus } from '@/services/billing'
import type { ExpenseStatus } from '@/domain/types'
import PageHeader from '@/components/PageHeader.vue'
import AppDatePicker from '@/components/AppDatePicker.vue'

const store = useAppStore()
const period = ref(currentPeriod())
const status = ref<'all' | ExpenseStatus>('all')

const list = computed(() =>
  store.expenses
    .filter((e) => e.period === period.value)
    .filter((e) => status.value === 'all' || e.status === status.value)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
)

const scoped = computed(() => store.expenses.filter((e) => e.period === period.value))
const paid = computed(() => sumByStatus(scoped.value, 'paid'))
const unpaid = computed(() => sumByStatus(scoped.value, 'unpaid'))
const pending = computed(() => sumByStatus(scoped.value, 'pending'))
const cats = computed(() => groupByCategory(scoped.value))

function cycleStatus(id: string) {
  const item = store.expenses.find((e) => e.id === id)
  if (!item) return
  const order: ExpenseStatus[] = ['pending', 'unpaid', 'paid']
  store.setExpenseStatus(id, order[(order.indexOf(item.status) + 1) % order.length])
}

function generateFromCourses() {
  for (const course of store.courses) {
    if (course.billingMode === 'free' || course.billingMode === 'session') continue
    const exists = store.expenses.some(
      (e) => e.courseId === course.id && e.period === period.value && e.billingMode !== 'session',
    )
    if (exists) continue
    store.upsertExpense({
      courseId: course.id,
      title: `${course.title} · ${period.value}学费`,
      category: course.type,
      billingMode: course.billingMode,
      amount: course.amount,
      period: period.value,
      dueDate: dayjs(period.value + '-08').format('YYYY-MM-DD'),
      status: 'pending',
      note: `由${COURSE_TYPE_LABEL[course.type]}自动生成`,
    })
  }
}
</script>

<template>
  <main class="page bills-page">
    <PageHeader eyebrow="支出账单" title="本月要付什么">
      <template #actions>
        <router-link class="add-expense" to="/bills/edit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          记一笔
        </router-link>
      </template>
    </PageHeader>

    <section class="filters">
      <div class="field">
        <label>账期</label>
        <AppDatePicker v-model="period" mode="month" aria-label="选择账期" />
      </div>
      <div class="chips">
        <button type="button" :class="{ on: status === 'all' }" @click="status = 'all'">全部</button>
        <button type="button" :class="{ on: status === 'pending' }" @click="status = 'pending'">待结算</button>
        <button type="button" :class="{ on: status === 'unpaid' }" @click="status = 'unpaid'">未结算</button>
        <button type="button" :class="{ on: status === 'paid' }" @click="status = 'paid'">已结算</button>
      </div>
    </section>

    <section class="stats card">
      <div class="mini">
        <p class="muted">{{ EXPENSE_STATUS_LABEL.pending }}</p>
        <strong class="status-pending">{{ money(pending) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">{{ EXPENSE_STATUS_LABEL.unpaid }}</p>
        <strong class="status-unpaid">{{ money(unpaid) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">{{ EXPENSE_STATUS_LABEL.paid }}</p>
        <strong class="status-paid">{{ money(paid) }}</strong>
      </div>
    </section>

    <section class="card cats">
      <h2>按类型</h2>
      <p v-if="!cats.length" class="muted">这个月还没有支出记录。</p>
      <div v-for="item in cats" :key="item.category" class="row cat">
        <span>{{ CATEGORY_LABEL[item.category] }}</span>
        <strong>{{ money(item.amount) }}</strong>
      </div>
    </section>

    <button class="generate-action" type="button" @click="generateFromCourses">
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7zM10 8h4m-4 4h4m-4 4h2" /></svg>
      </span>
      <b>从课程生成月结账单</b>
      <small>单次课请手动记一笔</small>
      <i>›</i>
    </button>

    <section class="bill-list-section">
      <div class="list-title"><div><small>账单明细</small><h2>{{ list.length }} 笔记录</h2></div></div>
      <div class="list">
      <router-link
        v-for="bill in list"
        :key="bill.id"
        :to="`/bills/edit/${bill.id}`"
        class="link-wrap"
      >
        <ExpenseCard :expense="bill" @status="cycleStatus" />
      </router-link>
      </div>
      <p v-if="!list.length" class="empty-bills">当前筛选下暂无账单。</p>
      <p class="muted hint">点击状态可依次切换；点击卡片编辑明细。</p>
    </section>
  </main>
</template>

<style scoped>
.bills-page { padding-top: 24px; }

.add-expense {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  color: #fff;
  border-radius: 13px;
  background: var(--accent);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.7);
  font-size: 11px;
  font-weight: 750;
}
.add-expense svg { width: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; }

.filters {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
  padding: 15px;
  border: 0;
  border-radius: 22px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 8%, #fff) 0%, var(--paper) 68%);
  box-shadow: var(--elev-sm), var(--glow-top);
}
.chips {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.chips button {
  border: 0;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
  border-radius: 999px;
  padding: 8px 4px;
  color: var(--muted);
  font-size: 10px;
}
.chips button.on {
  background: var(--accent-gradient);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.7), inset 0 1px 0 rgba(255,255,255,.28);
  color: #fff;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
  margin-bottom: 14px;
}
.mini { min-width: 0; padding: 2px 12px; text-align: center; border-left: 1px solid var(--line); }
.mini:first-child { padding-left: 0; border-left: 0; }
.mini:last-child { padding-right: 0; }
.mini p { margin-bottom: 5px; font-size: 10px; }
.mini strong {
  display: block;
  overflow: hidden;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cats {
  margin-bottom: 14px;
}
.cats h2 {
  font-size: 16px;
  margin-bottom: 8px;
}
.cat {
  padding: 6px 0;
  border-top: 1px solid var(--line);
}
.generate-action {
  display: grid;
  width: 100%;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  gap: 2px 10px;
  align-items: center;
  margin: 0 0 24px;
  padding: 13px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 18px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}
.generate-action > span {
  display: grid;
  width: 38px;
  height: 38px;
  grid-row: 1 / 3;
  place-items: center;
  color: #fff;
  border-radius: 12px;
  background: var(--accent-gradient);
  box-shadow: 0 10px 20px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.35);
}
.generate-action svg { width: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; }
.generate-action b { font-size: 12px; }
.generate-action small { color: var(--muted); font-size: 9px; }
.generate-action i { grid-row: 1 / 3; grid-column: 3; color: var(--muted); font-size: 20px; font-style: normal; }

.list-title { margin-bottom: 11px; }
.list-title small { color: var(--muted); font-size: 10px; }
.list-title h2 { margin-top: 2px; font-size: 18px; }
.bill-list-section { margin-bottom: 18px; }
.empty-bills { padding: 28px; color: var(--muted); text-align: center; border: 1px dashed var(--line); border-radius: 20px; font-size: 12px; }
.link-wrap + .link-wrap { margin-top: 10px; }
.link-wrap :deep(.item) { box-shadow: var(--elev-sm), var(--glow-top); }
.hint { margin: 10px 3px 0; font-size: 10px; }

@media (max-width: 360px) {
  .chips { grid-template-columns: repeat(2, 1fr); }
}
</style>
