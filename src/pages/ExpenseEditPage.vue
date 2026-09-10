<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import type { BillingMode, ExpenseCategory, ExpenseStatus } from '@/domain/types'
import { currentPeriod } from '@/services/billing'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const existing = computed(() => store.expenses.find((e) => e.id === id.value))

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
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">账单</p>
        <h1>{{ id ? '编辑支出' : '记一笔支出' }}</h1>
      </div>
    </section>

    <form class="card" @submit.prevent="save">
      <div class="field">
        <label>名称</label>
        <input v-model="form.title" placeholder="例如 钢琴课本月学费" />
      </div>
      <div class="field">
        <label>关联课程</label>
        <select v-model="form.courseId">
          <option value="">不关联</option>
          <option v-for="course in store.courses" :key="course.id" :value="course.id">{{ course.title }}</option>
        </select>
      </div>
      <div class="field">
        <label>类型</label>
        <select v-model="form.category">
          <option value="interest">兴趣班</option>
          <option value="online">在线课堂</option>
          <option value="school">学校课程</option>
          <option value="material">学习用品</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="field">
        <label>结算方式</label>
        <select v-model="form.billingMode">
          <option value="monthly">按月结算</option>
          <option value="session">单次结算</option>
          <option value="term">按期结算</option>
        </select>
      </div>
      <div class="field">
        <label>金额</label>
        <input v-model.number="form.amount" type="number" min="0" />
      </div>
      <div class="field">
        <label>账期 / 应付日</label>
        <input v-model="form.period" type="month" />
        <input v-model="form.dueDate" type="date" style="margin-top: 8px" />
      </div>
      <div class="field">
        <label>状态</label>
        <select v-model="form.status">
          <option value="pending">待结算</option>
          <option value="unpaid">未结算</option>
          <option value="paid">已结算</option>
        </select>
      </div>
      <div class="field">
        <label>备注</label>
        <textarea v-model="form.note" rows="3" />
      </div>
      <button class="btn block" type="submit">保存</button>
      <button v-if="id" class="btn danger block" type="button" style="margin-top: 8px" @click="remove">删除</button>
    </form>
  </main>
</template>
