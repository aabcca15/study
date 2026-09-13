<script setup lang="ts">
import dayjs from 'dayjs'
import { CATEGORY_LABEL, EXPENSE_STATUS_LABEL } from '@/domain/constants'
import type { Expense } from '@/domain/types'
import { money } from '@/services/billing'

defineProps<{
  expense: Expense
}>()

const emit = defineEmits<{
  status: [id: string]
}>()
</script>

<template>
  <article class="card item">
    <span class="expense-icon">¥</span>
    <div class="expense-copy">
        <p class="muted">{{ CATEGORY_LABEL[expense.category] }} · {{ dayjs(`${expense.period}-01`).format('YYYY年M月') }}</p>
        <h3>{{ expense.title }}</h3>
        <p class="muted due-date">应付 {{ dayjs(expense.dueDate).format('M月D日') }}</p>
    </div>
    <div class="right">
        <strong>{{ money(expense.amount) }}</strong>
        <button
          class="status-btn"
          :class="`status-${expense.status}`"
          type="button"
          @click.stop.prevent="emit('status', expense.id)"
        >
          {{ EXPENSE_STATUS_LABEL[expense.status] }}
        </button>
    </div>
    <span class="arrow">›</span>
  </article>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto 12px;
  gap: 11px;
  align-items: center;
  padding: 14px;
}
.expense-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  color: #fff;
  border-radius: 13px;
  background: var(--accent-gradient);
  box-shadow: 0 10px 20px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.35);
  font-weight: 800;
}
.expense-copy { min-width: 0; }
.expense-copy > p { font-size: 9px; }
.item h3 {
  margin: 3px 0 5px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right {
  text-align: right;
  display: grid;
  gap: 6px;
  justify-items: end;
}
.right > strong { font-size: 14px; font-variant-numeric: tabular-nums; }
.status-btn {
  padding: 3px 7px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 9px;
  font-weight: 700;
}
.arrow { color: var(--muted); font-size: 18px; }
</style>
