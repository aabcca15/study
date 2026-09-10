<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import ExpenseCard from '@/components/ExpenseCard.vue'
import { BILLING_MODE_LABEL, CATEGORY_LABEL, COURSE_TYPE_LABEL, EXPENSE_STATUS_LABEL } from '@/domain/constants'
import { money, currentPeriod, groupByCategory, sumByStatus } from '@/services/billing'
import type { ExpenseStatus } from '@/domain/types'

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
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">支出账单</p>
        <h1>本月要付什么</h1>
      </div>
      <router-link class="btn accent" to="/bills/edit">记一笔</router-link>
    </section>

    <section class="filters card">
      <div class="field">
        <label>账期</label>
        <input v-model="period" type="month" />
      </div>
      <div class="chips">
        <button type="button" :class="{ on: status === 'all' }" @click="status = 'all'">全部</button>
        <button type="button" :class="{ on: status === 'pending' }" @click="status = 'pending'">待结算</button>
        <button type="button" :class="{ on: status === 'unpaid' }" @click="status = 'unpaid'">未结算</button>
        <button type="button" :class="{ on: status === 'paid' }" @click="status = 'paid'">已结算</button>
      </div>
    </section>

    <section class="stats">
      <div class="card mini">
        <p class="muted">{{ EXPENSE_STATUS_LABEL.pending }}</p>
        <strong class="status-pending">{{ money(pending) }}</strong>
      </div>
      <div class="card mini">
        <p class="muted">{{ EXPENSE_STATUS_LABEL.unpaid }}</p>
        <strong class="status-unpaid">{{ money(unpaid) }}</strong>
      </div>
      <div class="card mini">
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

    <div class="row actions">
      <button class="btn ghost" type="button" @click="generateFromCourses">从课程生成月结账单</button>
      <span class="muted">单次课请手动记一笔</span>
    </div>

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
    <p class="muted hint">点金额旁状态可切换：待结算 → 未结算 → 已结算。点卡片可编辑。</p>
    <p class="muted hint">{{ BILLING_MODE_LABEL.monthly }}与{{ BILLING_MODE_LABEL.session }}都可在这里分开看。</p>
  </main>
</template>

<style scoped>
.filters {
  margin-bottom: 12px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chips button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
}
.chips button.on {
  background: var(--ink);
  color: #fffaf3;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.mini strong {
  font-size: 16px;
}
.cats {
  margin-bottom: 12px;
}
.cats h2 {
  font-size: 16px;
  margin-bottom: 8px;
}
.cat {
  padding: 6px 0;
  border-top: 1px solid var(--line);
}
.actions {
  margin: 8px 0 14px;
  align-items: center;
}
.link-wrap {
  display: block;
}
.hint {
  margin-top: 10px;
}
</style>
