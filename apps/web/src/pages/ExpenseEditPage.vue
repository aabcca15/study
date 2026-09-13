<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import type { BillingMode, ExpenseCategory, ExpenseStatus } from '@/domain/types'
import { currentPeriod } from '@/services/billing'
import PageHeader from '@/components/PageHeader.vue'
import AppDatePicker from '@/components/AppDatePicker.vue'
import AppSelect from '@/components/AppSelect.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const existing = computed(() => store.findExpense(id.value))
const editingChildId = computed(() => existing.value?.childId ?? store.child?.id ?? '')
const courseOptions = computed(() => [
  { value: '', label: '不关联' },
  ...store.coursesForChild(editingChildId.value, Boolean(existing.value))
    .map((course) => ({ value: course.id, label: course.title })),
])
const categoryOptions = [
  { value: 'interest', label: '兴趣班' },
  { value: 'online', label: '在线课堂' },
  { value: 'school', label: '学校课程' },
  { value: 'material', label: '学习用品' },
  { value: 'other', label: '其他' },
]
const expenseBillingOptions = [
  { value: 'monthly', label: '按月结算' },
  { value: 'session', label: '单次结算' },
  { value: 'term', label: '按期结算' },
]
const statusOptions = [
  { value: 'pending', label: '待结算' },
  { value: 'unpaid', label: '未结算' },
  { value: 'paid', label: '已结算' },
]

const form = reactive({
  title: existing.value?.title ?? '',
  category: (existing.value?.category ?? 'interest') as ExpenseCategory,
  billingMode: (existing.value?.billingMode ?? 'monthly') as Exclude<BillingMode, 'free'>,
  amount: existing.value?.amount ?? 0,
  period: existing.value?.period ?? currentPeriod(),
  dueDate: existing.value?.dueDate ?? dayjs().format('YYYY-MM-DD'),
  status: (existing.value?.status ?? 'unpaid') as ExpenseStatus,
  courseId: existing.value?.courseId ?? '',
  note: existing.value?.note ?? '',
})

function setCategory(value: string) { form.category = value as ExpenseCategory }
function setBillingMode(value: string) { form.billingMode = value as Exclude<BillingMode, 'free'> }
function setStatus(value: string) { form.status = value as ExpenseStatus }

function save() {
  if (!form.title.trim()) return
  store.upsertExpense({
    id: id.value || undefined,
    title: form.title.trim(),
    category: form.category,
    billingMode: form.billingMode,
    amount: Number(form.amount) || 0,
    period: form.period,
    dueDate: form.dueDate,
    status: form.status,
    courseId: form.courseId || undefined,
    note: form.note,
    paidAt: form.status === 'paid' ? dayjs().format('YYYY-MM-DD') : undefined,
  })
  router.push('/bills')
}

function remove() {
  if (!id.value) return
  store.removeExpense(id.value)
  router.push('/bills')
}
</script>

<template>
  <main class="page expense-editor">
    <PageHeader eyebrow="账单明细" :title="id ? '编辑支出' : '记一笔支出'" />

    <form class="expense-form" @submit.prevent="save">
      <section class="form-card">
        <div class="form-section-head">
          <span>01</span>
          <div><h2>基本信息</h2><p>记录这笔费用的用途和金额</p></div>
        </div>
      <div class="field">
        <label>名称</label>
        <input v-model="form.title" placeholder="例如 钢琴课本月学费" />
      </div>
      <div class="field">
        <label>关联课程</label>
        <AppSelect v-model="form.courseId" :options="courseOptions" aria-label="选择关联课程" />
      </div>
      <div class="field">
        <label>类型</label>
        <AppSelect :model-value="form.category" :options="categoryOptions" aria-label="选择支出类型" @update:model-value="setCategory" />
      </div>
      <div class="field">
        <label>结算方式</label>
        <AppSelect :model-value="form.billingMode" :options="expenseBillingOptions" aria-label="选择结算方式" @update:model-value="setBillingMode" />
      </div>
      <div class="field">
        <label>金额</label>
        <div class="money-input"><span>¥</span><input v-model.number="form.amount" type="number" min="0" /></div>
      </div>
      </section>

      <section class="form-card">
        <div class="form-section-head">
          <span>02</span>
          <div><h2>结算安排</h2><p>选择账期、应付日期和当前状态</p></div>
        </div>
      <div class="field">
        <label>账期</label>
        <AppDatePicker v-model="form.period" mode="month" aria-label="选择账期" />
      </div>
      <div class="field">
        <label>应付日</label>
        <AppDatePicker v-model="form.dueDate" mode="date" aria-label="选择应付日期" />
      </div>
      <div class="field">
        <label>状态</label>
        <AppSelect :model-value="form.status" :options="statusOptions" aria-label="选择账单状态" @update:model-value="setStatus" />
      </div>
      <div class="field">
        <label>备注</label>
        <textarea v-model="form.note" rows="3" placeholder="补充说明（选填）" />
      </div>
      </section>

      <div class="form-actions">
        <button class="save-expense" type="submit">保存账单</button>
        <button v-if="id" class="remove-expense" type="button" @click="remove">删除这笔账单</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.expense-editor { padding-top: 12px; }
.expense-form { display: grid; gap: 14px; }
.form-card {
  padding: 17px;
  border: 0;
  border-radius: 23px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}
.form-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 17px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--line);
}
.form-section-head > span {
  display: grid;
  width: 35px;
  height: 35px;
  place-items: center;
  color: var(--accent-text);
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 10px;
  font-weight: 800;
}
.form-section-head h2 { font-size: 15px; }
.form-section-head p { margin-top: 2px; color: var(--muted); font-size: 9px; }
.money-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}
.money-input span { padding-left: 13px; color: var(--accent-text); font-weight: 800; }
.money-input input { border: 0; background: transparent; }
.form-actions { display: grid; gap: 9px; margin-top: 2px; }
.save-expense,
.remove-expense {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  font-weight: 750;
}
.save-expense { color: #fff; background: var(--accent-gradient); box-shadow: 0 14px 26px -10px rgba(255,122,69,.7), inset 0 1px 0 rgba(255,255,255,.28); }
.remove-expense { color: #a44637; border: 1px solid color-mix(in srgb, #a44637 28%, var(--line)); background: color-mix(in srgb, #a44637 7%, var(--paper)); }
</style>
