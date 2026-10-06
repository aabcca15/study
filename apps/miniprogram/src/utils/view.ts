import dayjs from 'dayjs'
import type { Course, Expense, ScheduleException } from '@server-domain/types'
import { money } from '@server-domain/billing'
import { occurrencesOnDate } from '@server-domain/schedule'

export function mondayOf(date: string) {
  const day = dayjs(date)
  return day.subtract((day.day() + 6) % 7, 'day')
}

export function weekDates(date: string) {
  const monday = mondayOf(date)
  return Array.from({ length: 7 }, (_, index) => monday.add(index, 'day').format('YYYY-MM-DD'))
}

export function monthMatrix(month: string) {
  const anchor = dayjs(`${month}-01`)
  const offset = (anchor.day() + 6) % 7
  const cells: Array<string | null> = []
  for (let index = 0; index < offset; index += 1) cells.push(null)
  for (let day = 1; day <= anchor.daysInMonth(); day += 1) {
    cells.push(anchor.date(day).format('YYYY-MM-DD'))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function weekLabel(date: string) {
  const days = weekDates(date)
  const start = dayjs(days[0])
  const end = dayjs(days[6])
  if (start.month() === end.month()) return `${start.format('M月D日')}–${end.format('D日')}`
  return `${start.format('M月D日')}–${end.format('M月D日')}`
}

/** 一天一个点，颜色相同也分开画，方便看出当天有几节课。 */
export function occurrenceDots(
  courses: Course[],
  date: string,
  exceptions: ScheduleException[],
  limit = 4,
) {
  return occurrencesOnDate(courses, date, exceptions)
    .slice(0, limit)
    .map((item) => ({ id: item.id, color: item.course.color }))
}

export function occurrenceExpense(expenses: Expense[], course: Course, date: string) {
  const sameDay = expenses.find((item) => item.courseId === course.id && item.status !== 'void' && item.dueDate === date)
  if (sameDay) return sameDay
  if (course.source === 'temporary') {
    return expenses.find((item) => item.courseId === course.id && item.status !== 'void')
  }
  return undefined
}

export function payLabel(expenses: Expense[], course: Course, date: string) {
  if (course.billingPolicy?.pricingMode === 'free' || course.billingMode === 'free') return '无需缴费'
  const expense = occurrenceExpense(expenses, course, date)
  if (!expense) return ''
  return expense.status === 'paid' ? `已支付 ${money(expense.amount)}` : `未支付 ${money(expense.amount)}`
}

export { money }
