import dayjs from 'dayjs'
import type { Expense, ExpenseCategory, ExpenseStatus } from '@/domain/types'

export function money(n: number) {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`
}

export function filterByPeriod(expenses: Expense[], period: string) {
  return expenses.filter((item) => item.period === period)
}

export function filterByYear(expenses: Expense[], year: number) {
  return expenses.filter((item) => item.period.startsWith(`${year}-`))
}

export function sumByStatus(expenses: Expense[], status: ExpenseStatus) {
  return expenses.filter((item) => item.status === status).reduce((s, i) => s + i.amount, 0)
}

export function groupByCategory(expenses: Expense[]) {
  const map = new Map<ExpenseCategory, number>()
  for (const item of expenses) {
    map.set(item.category, (map.get(item.category) ?? 0) + item.amount)
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount }))
}

export function groupByMonth(expenses: Expense[], year: number) {
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    amount: 0,
    paid: 0,
    open: 0,
  }))
  for (const item of expenses) {
    if (!item.period.startsWith(`${year}-`)) continue
    const idx = Number(item.period.slice(5, 7)) - 1
    if (idx < 0 || idx > 11) continue
    buckets[idx].amount += item.amount
    if (item.status === 'paid') buckets[idx].paid += item.amount
    else buckets[idx].open += item.amount
  }
  return buckets
}

export function currentPeriod() {
  return dayjs().format('YYYY-MM')
}
