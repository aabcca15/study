import dayjs from 'dayjs'
import type { Course, Expense, ScheduleException } from '@/domain/types'
import { occurrencesInRange } from '@/services/schedule'

export type StatisticsGranularity = 'year' | 'month'

export interface CourseStatistic {
  course: Course
  scheduledCount: number
  completedCount: number
  scheduledMinutes: number
  completedMinutes: number
  completion: number
  expense: number
}

export interface TrendPoint {
  key: string
  label: string
  courseHours: number
  expense: number
}

export interface LearningStatistics {
  totalExpense: number
  paidExpense: number
  openExpense: number
  scheduledCount: number
  completedCount: number
  scheduledMinutes: number
  courseStats: CourseStatistic[]
  trend: TrendPoint[]
  unassignedExpense: number
}

function minutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute)
  if (minutes < 0) minutes += 24 * 60
  return minutes
}

function expensesInRange(expenses: Expense[], startDate: string, endDate: string) {
  const startPeriod = startDate.slice(0, 7)
  const endPeriod = endDate.slice(0, 7)
  return expenses.filter((item) => item.period >= startPeriod && item.period <= endPeriod)
}

function createTrend(anchor: dayjs.Dayjs, granularity: StatisticsGranularity): TrendPoint[] {
  if (granularity === 'year') {
    return Array.from({ length: 12 }, (_, index) => ({
      key: `${anchor.year()}-${String(index + 1).padStart(2, '0')}`,
      label: `${index + 1}月`,
      courseHours: 0,
      expense: 0,
    }))
  }

  return Array.from({ length: anchor.daysInMonth() }, (_, index) => ({
    key: anchor.date(index + 1).format('YYYY-MM-DD'),
    label: String(index + 1),
    courseHours: 0,
    expense: 0,
  }))
}

export function calculateLearningStatistics(
  courses: Course[],
  expenses: Expense[],
  exceptions: ScheduleException[],
  anchor: dayjs.Dayjs,
  granularity: StatisticsGranularity,
): LearningStatistics {
  const start = (granularity === 'year' ? anchor.startOf('year') : anchor.startOf('month')).format('YYYY-MM-DD')
  const end = (granularity === 'year' ? anchor.endOf('year') : anchor.endOf('month')).format('YYYY-MM-DD')
  const today = dayjs().format('YYYY-MM-DD')
  const occurrences = occurrencesInRange(courses, start, end, exceptions)
  const scopedExpenses = expensesInRange(expenses, start, end)
  const trend = createTrend(anchor, granularity)
  const trendMap = new Map(trend.map((item) => [item.key, item]))
  const occurrenceMap = new Map<string, { count: number; completed: number; minutes: number; completedMinutes: number }>()

  for (const item of occurrences) {
    const minutes = minutesBetween(item.course.recurrence.startTime, item.course.recurrence.endTime)
    const current = occurrenceMap.get(item.course.id) ?? {
      count: 0,
      completed: 0,
      minutes: 0,
      completedMinutes: 0,
    }
    current.count += 1
    current.minutes += minutes
    if (item.date <= today) {
      current.completed += 1
      current.completedMinutes += minutes
    }
    occurrenceMap.set(item.course.id, current)

    const trendKey = granularity === 'year' ? item.date.slice(0, 7) : item.date
    const point = trendMap.get(trendKey)
    if (point) point.courseHours += minutes / 60
  }

  const expenseByCourse = new Map<string, number>()
  let unassignedExpense = 0
  for (const expense of scopedExpenses) {
    if (expense.courseId && courses.some((course) => course.id === expense.courseId)) {
      expenseByCourse.set(expense.courseId, (expenseByCourse.get(expense.courseId) ?? 0) + expense.amount)
    } else {
      unassignedExpense += expense.amount
    }

    const dueDateInScope = expense.dueDate >= start && expense.dueDate <= end
    const trendKey = granularity === 'year'
      ? expense.period
      : (dueDateInScope ? expense.dueDate : `${expense.period}-01`)
    const point = trendMap.get(trendKey)
    if (point) point.expense += expense.amount
  }

  const courseStats = courses.map((course) => {
    const schedule = occurrenceMap.get(course.id) ?? {
      count: 0,
      completed: 0,
      minutes: 0,
      completedMinutes: 0,
    }
    return {
      course,
      scheduledCount: schedule.count,
      completedCount: schedule.completed,
      scheduledMinutes: schedule.minutes,
      completedMinutes: schedule.completedMinutes,
      completion: schedule.count ? Math.round((schedule.completed / schedule.count) * 100) : 0,
      expense: expenseByCourse.get(course.id) ?? 0,
    }
  }).sort((a, b) => b.scheduledMinutes - a.scheduledMinutes || b.expense - a.expense)

  return {
    totalExpense: scopedExpenses.reduce((sum, item) => sum + item.amount, 0),
    paidExpense: scopedExpenses.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0),
    openExpense: scopedExpenses.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0),
    scheduledCount: occurrences.length,
    completedCount: occurrences.filter((item) => item.date <= today).length,
    scheduledMinutes: occurrences.reduce(
      (sum, item) => sum + minutesBetween(item.course.recurrence.startTime, item.course.recurrence.endTime),
      0,
    ),
    courseStats,
    trend: trend.map((item) => ({
      ...item,
      courseHours: Number(item.courseHours.toFixed(1)),
    })),
    unassignedExpense,
  }
}
