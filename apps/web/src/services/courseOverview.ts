import dayjs from 'dayjs'
import type { Course, Expense, ScheduleException } from '@/domain/types'
import { effectiveCourseSlots } from '@/services/courseSchedule'

export type CourseLifecycle = 'active' | 'upcoming' | 'unscheduled' | 'ended' | 'completed'

export interface CourseLifecycleState {
  key: CourseLifecycle
  label: string
  inactive: boolean
}

export function getCourseLifecycle(
  course: Course,
  exceptions: ScheduleException[],
  today = dayjs().format('YYYY-MM-DD'),
): CourseLifecycleState {
  if (course.archived) return { key: 'completed', label: '已结课', inactive: true }

  const slots = effectiveCourseSlots(course, exceptions)
  if (!slots.length) return { key: 'unscheduled', label: '待排课', inactive: false }
  if (slots[0].date > today) return { key: 'upcoming', label: '待开课', inactive: false }
  if (slots[slots.length - 1].date < today) return { key: 'ended', label: '已结束', inactive: true }
  return { key: 'active', label: '进行中', inactive: false }
}

export type CourseBillingState = 'free' | 'unbilled' | 'pending' | 'open' | 'settled'

export interface CourseBillingSummary {
  key: CourseBillingState
  label: string
  openAmount: number
}

export function getCourseBillingSummary(
  course: Course,
  expenses: Expense[],
  period: string,
): CourseBillingSummary {
  if (course.billingMode === 'free') {
    return { key: 'free', label: '无需缴费', openAmount: 0 }
  }

  const bills = expenses.filter((item) => item.courseId === course.id && item.period === period)
  if (!bills.length) return { key: 'unbilled', label: '本期待出账', openAmount: 0 }

  const openAmount = bills
    .filter((item) => item.status === 'unpaid')
    .reduce((total, item) => total + item.amount, 0)

  if (bills.some((item) => item.status === 'unpaid')) {
    return { key: 'open', label: openAmount ? `待支付 ¥${openAmount.toLocaleString('zh-CN')}` : '待支付', openAmount }
  }
  if (bills.some((item) => item.status === 'pending')) {
    return { key: 'pending', label: '待结算', openAmount: 0 }
  }
  return { key: 'settled', label: '本期已结清', openAmount: 0 }
}
