<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad } from '@dcloudio/uni-app'
import { billNetAmount, money, refundedAmountOf } from '@server-domain/billing'
import { CATEGORY_LABEL } from '@server-domain/constants'
import type { ExpenseCategory } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { denyViewerBills } from '@/composables/useFamilyRole'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { useThemePage } from '@/composables/useThemePage'
import DateField from '@/components/DateField.vue'
import SelectField from '@/components/SelectField.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage({ refresh: false })
const themeClass = useThemePage()
const expenseId = ref('')
const saving = ref(false)
const refundAmount = ref('')
const refundNote = ref('')
const form = reactive({
  title: '',
  category: 'other' as ExpenseCategory,
  amount: '',
  date: dayjs().format('YYYY-MM-DD'),
})

const categoryOptions = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}))

onLoad((query) => {
  if (denyViewerBills()) return
  expenseId.value = typeof query?.id === 'string' ? query.id : ''
})

const existing = computed(() => store.snapshot.expenses.find((item) => item.id === expenseId.value))
const paid = computed(() => existing.value?.status === 'paid')
const payments = computed(() =>
  (store.snapshot.payments ?? [])
    .filter((item) => item.expenseId === expenseId.value)
    .slice()
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id)),
)
const refundedTotal = computed(() => refundedAmountOf(expenseId.value, store.snapshot.payments ?? []))
const netPaid = computed(() => existing.value ? billNetAmount(existing.value, store.snapshot.payments ?? []) : 0)
const refundable = computed(() => {
  const received = payments.value.filter((item) => item.kind === 'payment').reduce((sum, item) => sum + item.amount, 0)
  return Math.max(0, Math.round((received - refundedTotal.value) * 100) / 100)
})

async function create() {
  if (!form.title.trim()) {
    showCloudError(new Error('请填写名称'))
    return
  }
  if (!(Number(form.amount) > 0)) {
    showCloudError(new Error('请填写金额'))
    return
  }
  saving.value = true
  try {
    await store.upsertExpense({
      title: form.title.trim(),
      category: form.category,
      billingMode: 'session',
      amount: Number(form.amount) || 0,
      period: form.date.slice(0, 7),
      dueDate: form.date,
      status: 'paid',
      paidAt: form.date,
      note: '',
    })
    uni.navigateBack()
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

async function markPaid() {
  if (!expenseId.value) return
  try {
    await store.setExpenseStatus(expenseId.value, 'paid')
  } catch (error) {
    showCloudError(error)
  }
}

async function refund() {
  if (!expenseId.value) return
  const value = Number(refundAmount.value) || 0
  if (value <= 0 || value > refundable.value) {
    showCloudError(new Error(`退款金额应大于 0，且不超过 ${money(refundable.value)}`))
    return
  }
  try {
    await store.refund(expenseId.value, value, refundNote.value.trim())
    refundAmount.value = ''
    refundNote.value = ''
    uni.showToast({ icon: 'none', title: '退款已记录' })
  } catch (error) {
    showCloudError(error)
  }
}

function remove() {
  if (!expenseId.value) return
  uni.showModal({
    title: '删除账单',
    content: '已支付账单不能删除。',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeExpense(expenseId.value)
        uni.navigateBack()
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}
</script>

<template>
  <view class="theme-root page edit sub" :class="themeClass">
    <PageHeader safe show-back :title="expenseId ? '账单详情' : '记一笔支出'" />
    <template v-if="!expenseId">
      <text class="muted">记到当前孩子 {{ store.child?.name || '' }}，并直接记为已支付。</text>
      <view class="field">
        <text class="field-label">名称</text>
        <input v-model="form.title" placeholder="例如：买书" placeholder-class="ph" />
      </view>
      <view class="field">
        <text class="field-label">类型</text>
        <SelectField v-model="form.category" :options="categoryOptions" />
      </view>
      <view class="field">
        <text class="field-label">金额</text>
        <input v-model="form.amount" type="digit" placeholder-class="ph" />
      </view>
      <view class="field">
        <text class="field-label">日期</text>
        <DateField v-model="form.date" />
      </view>
      <button class="btn block" :disabled="saving" @click="create">保存</button>
    </template>

    <template v-else-if="existing">
      <view class="h1">{{ existing.title }}</view>
      <view class="card">
        <view class="row"><text>账单金额</text><text>{{ money(existing.amount) }}</text></view>
        <view v-if="paid" class="row">
          <text>实际支付</text>
          <text class="pay-paid">{{ money(netPaid) }}</text>
        </view>
        <view v-if="refundedTotal" class="row">
          <text>已退金额</text>
          <text class="refund-amount">−{{ money(refundedTotal) }}</text>
        </view>
        <view class="row"><text>日期</text><text>{{ existing.dueDate }}</text></view>
        <view class="row">
          <text>状态</text>
          <text :class="paid ? 'pay-paid' : 'pay-unpaid'">{{ paid ? (refundedTotal >= existing.amount ? '已退完' : '已支付') : '未支付' }}</text>
        </view>
      </view>
      <button v-if="!paid" class="btn block" @click="markPaid">标记已支付</button>
      <view v-else class="card refund-card">
        <text class="section">支付与退款</text>
        <view v-if="payments.length" class="history">
          <view v-for="item in payments" :key="item.id" class="history-row">
            <view class="history-copy">
              <text>{{ item.kind === 'payment' ? '支付' : '退款' }}</text>
              <text class="muted">{{ item.paidAt }}{{ item.note && item.kind === 'refund' ? ' · ' + item.note : '' }}</text>
            </view>
            <text :class="item.kind === 'refund' ? 'refund-amount' : 'pay-paid'">
              {{ item.kind === 'refund' ? '−' : '+' }}{{ money(item.amount) }}
            </text>
          </view>
        </view>
        <view class="row remain">
          <text>剩余可退</text>
          <text class="refundable">{{ money(refundable) }}</text>
        </view>
        <template v-if="refundable > 0">
          <view class="field">
            <text class="field-label">退款金额</text>
            <view class="money">
              <text>¥</text>
              <input v-model="refundAmount" type="digit" placeholder-class="ph" />
            </view>
          </view>
          <view class="field">
            <text class="field-label">备注</text>
            <input v-model="refundNote" placeholder="选填" placeholder-class="ph" />
          </view>
          <button class="btn ghost block refund-btn" @click="refund">记录退款</button>
        </template>
        <text v-else class="muted tip">该账单已全部退款，实际消费已扣减。</text>
      </view>
      <button v-if="!paid" class="btn danger block" style="margin-top: 16rpx" @click="remove">删除未付账单</button>
    </template>
    <view v-else class="empty">账单不存在</view>
  </view>
</template>

<style scoped>
.edit { padding-bottom: 48rpx; }
.section { display: block; margin-bottom: 12px; color: var(--ink); font-size: 16px; font-weight: 800; }
.history { margin-bottom: 12px; }
.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.history-copy { flex: 1; min-width: 0; }
.history-copy text { display: block; }
.history-copy .muted { margin-top: 3px; font-size: 11px; }
.remain { margin-bottom: 12px; }
.refundable { color: var(--accent-text); font-weight: 800; }
.refund-amount { color: var(--unpaid); font-weight: 800; }
.refund-btn { color: var(--unpaid); }
.tip { display: block; margin-top: 4px; }
.empty { padding: 28px 8px; color: var(--muted); text-align: center; }
</style>
