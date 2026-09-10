<script setup lang="ts">
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
    <div class="row">
      <div>
        <p class="muted">{{ CATEGORY_LABEL[expense.category] }} · {{ expense.period }}</p>
        <h3>{{ expense.title }}</h3>
        <p class="muted">应付 {{ expense.dueDate }}</p>
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
    </div>
  </article>
</template>

<style scoped>
.item h3 {
  margin: 2px 0 4px;
  font-size: 16px;
}
.right {
  text-align: right;
  display: grid;
  gap: 6px;
  justify-items: end;
}
.status-btn {
  border: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
}
</style>
