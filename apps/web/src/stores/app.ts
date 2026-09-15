import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ChildAvatarKey,
  ChildProfile,
  Charge,
  Course,
  CourseDateSlot,
  Expense,
  Goal,
  OccurrenceAttendance,
  Payment,
  QuickArrangementInput,
  ScheduleException,
  SettlementCycle,
} from '@/domain/types'
import { childAvatarOption, COURSE_ICON_COLORS, createId } from '@/domain/constants'
import { loadSnapshot, resetSnapshot, saveSnapshot } from '@/data/storage'
import { currentPeriod } from '@/services/billing'
import {
  busyIntervalsOnDate,
  courseParticipantIds,
  coursesForParticipants,
  findBusyConflict,
  findScheduleConflicts,
  occurrencesOnDate,
  type ScheduleSlot,
} from '@/services/schedule'
import { applyExceptionToCourse, removeCourseSlot, restoreCourseSlot } from '@/services/courseSchedule'
import {
  chargeStatementKey,
  expectedUsageCharge,
  findChargeForOccurrence,
  mondayOf,
  occurrenceDateFromCharge,
  occurrenceIdFor,
  shouldAccrueUsage,
  statementLabel,
} from '@/services/charges'
import dayjs from 'dayjs'

export const useAppStore = defineStore('app', () => {
  const snapshot = ref(loadSnapshot())

  const persist = () => saveSnapshot(snapshot.value)

  const child = computed(
    () => snapshot.value.children.find((c) => c.id === snapshot.value.session.childId) ?? snapshot.value.children[0],
  )

  const childId = computed(() => child.value?.id ?? '')
  const isParentSession = computed(() => snapshot.value.session.role === 'parent')

  function belongsToChild(course: Course, targetChildId: string) {
    const assignedChildIds = course.childIds?.length ? course.childIds : [course.childId]
    return assignedChildIds.includes(targetChildId)
  }

  function coursesForChild(targetChildId: string, includeArchived = false) {
    return snapshot.value.courses.filter(
      (course) => belongsToChild(course, targetChildId) && (includeArchived || !course.archived),
    )
  }

  const courses = computed(() => coursesForChild(childId.value))

  const allCourses = computed(() => coursesForChild(childId.value, true))

  const expenses = computed(() =>
    snapshot.value.expenses.filter((e) => e.childId === childId.value),
  )

  const goals = computed(() => snapshot.value.goals.filter((g) => g.childId === childId.value))

  const scheduleExceptions = computed(() => {
    const visibleCourseIds = new Set(allCourses.value.map((course) => course.id))
    return snapshot.value.scheduleExceptions.filter((item) => visibleCourseIds.has(item.courseId))
  })

  const familyCourses = computed(() =>
    snapshot.value.courses.filter((course) => !course.archived),
  )

  const familyScheduleExceptions = computed(() => {
    const familyCourseIds = new Set(familyCourses.value.map((course) => course.id))
    return snapshot.value.scheduleExceptions.filter((item) => familyCourseIds.has(item.courseId))
  })

  const charges = computed(() =>
    snapshot.value.charges?.filter((item) => item.childId === childId.value) ?? [],
  )
  const payments = computed(() =>
    snapshot.value.payments?.filter((item) => item.childId === childId.value) ?? [],
  )
  const occurrenceRecords = computed(() => snapshot.value.occurrenceRecords ?? [])
  const overviewCharges = computed(() =>
    isParentSession.value ? snapshot.value.charges ?? [] : charges.value,
  )
  const overviewPayments = computed(() =>
    isParentSession.value ? snapshot.value.payments ?? [] : payments.value,
  )

  // 家长看全家聚合，未来孩子身份只看本人；页面不再各自复制角色判断。
  const overviewCourses = computed(() =>
    isParentSession.value ? familyCourses.value : courses.value,
  )
  const overviewExpenses = computed(() =>
    isParentSession.value ? snapshot.value.expenses : expenses.value,
  )
  const overviewScheduleExceptions = computed(() =>
    isParentSession.value ? familyScheduleExceptions.value : scheduleExceptions.value,
  )

  const todayItems = computed(() =>
    occurrencesOnDate(
      overviewCourses.value,
      dayjs().format('YYYY-MM-DD'),
      overviewScheduleExceptions.value,
    ),
  )

  const monthOpenAmount = computed(() =>
    overviewExpenses.value
      .filter((e) => e.period === currentPeriod() && e.status !== 'paid')
      .reduce((s, e) => s + e.amount, 0),
  )

  function upsertCourse(
    input: Omit<Course, 'id' | 'childId' | 'archived'> & { id?: string; childIds?: string[] },
  ) {
    const id = input.id ?? createId('course')
    const existingCourse = snapshot.value.courses.find((course) => course.id === id)
    const assignedChildIds = input.childIds?.length ? input.childIds : [childId.value]
    const next: Course = {
      ...input,
      id,
      childId: assignedChildIds[0],
      childIds: assignedChildIds,
      archived: existingCourse?.archived ?? false,
    }
    const idx = snapshot.value.courses.findIndex((c) => c.id === id)
    if (idx >= 0) snapshot.value.courses[idx] = { ...snapshot.value.courses[idx], ...next }
    else snapshot.value.courses.push(next)
    const saved = snapshot.value.courses.find((course) => course.id === id)
    if (saved) recomputeUnbilledChargesForCourse(saved)
    persist()
    return id
  }

  function findCourseScheduleConflicts(slots: ScheduleSlot[], exceptCourseId?: string, childIds?: string[]) {
    const participants = childIds?.length ? childIds : child.value ? [child.value.id] : []
    return findScheduleConflicts(
      slots,
      coursesForParticipants(overviewCourses.value, participants),
      overviewScheduleExceptions.value,
      exceptCourseId,
      participants,
    )
  }

  function archiveCourse(id: string) {
    const course = snapshot.value.courses.find((c) => c.id === id)
    if (course) course.archived = true
    persist()
  }

  function restoreCourse(id: string) {
    const course = snapshot.value.courses.find((c) => c.id === id)
    if (course) course.archived = false
    persist()
  }

  function removeCourse(id: string) {
    const course = findCourse(id)
    if (!course) return 'not-found' as const

    snapshot.value.courses = snapshot.value.courses.filter((item) => item.id !== id)
    snapshot.value.scheduleExceptions = snapshot.value.scheduleExceptions.filter(
      (item) => item.courseId !== id,
    )
    snapshot.value.occurrenceRecords = (snapshot.value.occurrenceRecords ?? []).filter(
      (item) => item.courseId !== id,
    )
    snapshot.value.charges = (snapshot.value.charges ?? []).filter((item) => item.courseId !== id)

    snapshot.value.expenses = snapshot.value.expenses.filter((item) => {
      if (item.courseId !== id) return true
      if (item.status === 'paid') {
        item.courseId = undefined
        item.chargeIds = []
        return true
      }
      return false
    })
    snapshot.value.payments = (snapshot.value.payments ?? []).filter((item) =>
      snapshot.value.expenses.some((expense) => expense.id === item.expenseId),
    )

    persist()
    return 'removed' as const
  }

  function updateChild(input: Pick<ChildProfile, 'id'> & Partial<Pick<ChildProfile, 'name' | 'avatarKey'>>) {
    const target = snapshot.value.children.find((item) => item.id === input.id)
    if (!target) return
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) return
      target.name = name
      target.avatarLabel = name.slice(0, 2)
    }
    if (input.avatarKey) {
      const option = childAvatarOption(input.avatarKey)
      target.avatarKey = option.key
      target.avatarColor = option.color
    }
    persist()
  }

  function addChild(name: string, avatarKey?: ChildAvatarKey) {
    const trimmed = name.trim()
    if (!trimmed) return ''
    const option = childAvatarOption(avatarKey)
    const id = createId('child')
    snapshot.value.children.push({
      id,
      name: trimmed,
      grade: '',
      avatarLabel: trimmed.slice(0, 2),
      avatarColor: option.color,
      avatarKey: option.key,
    })
    persist()
    return id
  }

  function removeChild(id: string) {
    const childIndex = snapshot.value.children.findIndex((item) => item.id === id)
    if (childIndex < 0) return 'not-found' as const
    if (snapshot.value.children.length <= 1) return 'last-child' as const

    const removedCourseIds = new Set<string>()
    snapshot.value.courses = snapshot.value.courses.flatMap((course) => {
      const assignedChildIds = course.childIds?.length ? course.childIds : [course.childId]
      if (!assignedChildIds.includes(id)) return [course]

      const remainingChildIds = assignedChildIds.filter((childId) => childId !== id)
      if (!remainingChildIds.length) {
        removedCourseIds.add(course.id)
        return []
      }

      return [{
        ...course,
        childId: remainingChildIds[0],
        childIds: remainingChildIds,
      }]
    })

    snapshot.value.scheduleExceptions = snapshot.value.scheduleExceptions
      .filter((item) => !removedCourseIds.has(item.courseId))
      .map((item) => {
        if (item.childId !== id) return item
        const course = snapshot.value.courses.find((candidate) => candidate.id === item.courseId)
        return { ...item, childId: course?.childIds?.[0] ?? course?.childId ?? '' }
      })
      .filter((item) => Boolean(item.childId))

    snapshot.value.expenses = snapshot.value.expenses.filter(
      (item) => item.childId !== id && (!item.courseId || !removedCourseIds.has(item.courseId)),
    )
    snapshot.value.charges = (snapshot.value.charges ?? []).filter(
      (item) => item.childId !== id && !removedCourseIds.has(item.courseId),
    )
    snapshot.value.occurrenceRecords = (snapshot.value.occurrenceRecords ?? []).filter(
      (item) => !removedCourseIds.has(item.courseId),
    )
    snapshot.value.payments = (snapshot.value.payments ?? []).filter((item) => item.childId !== id)
    snapshot.value.goals = snapshot.value.goals.filter((item) => item.childId !== id)
    snapshot.value.children.splice(childIndex, 1)

    if (snapshot.value.session.childId === id) {
      snapshot.value.session.childId = snapshot.value.children[0].id
    }

    persist()
    return 'removed' as const
  }

  function selectChild(id: string) {
    if (!snapshot.value.children.some((item) => item.id === id)) return
    snapshot.value.session.childId = id
    persist()
  }

  function findCourse(courseId: string) {
    return snapshot.value.courses.find((item) => item.id === courseId)
  }

  function findExpense(expenseId: string) {
    return snapshot.value.expenses.find((item) => item.id === expenseId)
  }

  function ensureBillingCollections() {
    if (!snapshot.value.charges) snapshot.value.charges = []
    if (!snapshot.value.occurrenceRecords) snapshot.value.occurrenceRecords = []
    if (!snapshot.value.payments) snapshot.value.payments = []
  }

  function upsertBilledAdjustment(original: Charge, amount: number, note: string) {
    ensureBillingCollections()
    const bill = original.billedExpenseId ? findExpense(original.billedExpenseId) : undefined
    const attachToOpenBill = bill && bill.status !== 'paid'
    const adjustments = snapshot.value.charges!.filter(
      (item) => item.adjustmentOfChargeId === original.id && item.status !== 'reversed',
    )
    const historicalAmount = attachToOpenBill
      ? 0
      : adjustments
        .filter((item) => item.status === 'billed')
        .reduce((sum, item) => sum + item.amount, 0)
    const effectiveAmount = Math.round((amount - historicalAmount) * 100) / 100
    const existing = adjustments.find((item) =>
      item.status === 'unbilled'
      || (attachToOpenBill && item.status === 'billed' && item.billedExpenseId === bill.id),
    )
    const previousAmount = existing?.amount ?? 0

    if (effectiveAmount === 0) {
      if (existing?.status === 'billed' && bill) {
        bill.amount = Math.max(0, Math.round((bill.amount - previousAmount) * 100) / 100)
        bill.chargeIds = bill.chargeIds?.filter((id) => id !== existing.id)
        bill.status = bill.amount === 0 ? 'void' : 'unpaid'
      }
      if (existing) existing.status = 'reversed'
      return
    }

    const next: Charge = {
      id: existing?.id ?? createId('chg_adjustment'),
      childId: original.childId,
      courseId: original.courseId,
      occurrenceId: original.occurrenceId,
      amount: effectiveAmount,
      status: attachToOpenBill ? 'billed' : 'unbilled',
      source: 'adjustment',
      billedExpenseId: attachToOpenBill ? bill.id : undefined,
      adjustmentOfChargeId: original.id,
      note,
    }

    if (attachToOpenBill) {
      bill.amount = Math.max(0, Math.round((bill.amount + effectiveAmount - previousAmount) * 100) / 100)
      bill.chargeIds = [...new Set([...(bill.chargeIds ?? []), next.id])]
      bill.status = bill.amount === 0 ? 'void' : 'unpaid'
    }

    if (existing) Object.assign(existing, next)
    else snapshot.value.charges!.push(next)
  }

  function waiveUnbilledCharge(occurrenceId: string) {
    ensureBillingCollections()
    const charge = findChargeForOccurrence(snapshot.value.charges ?? [], occurrenceId)
    if (charge?.status === 'unbilled') charge.status = 'waived'
    else if (charge?.status === 'billed') {
      upsertBilledAdjustment(charge, -charge.amount, '课次取消冲减')
    }
  }

  function upsertUnbilledUsageCharge(course: Course, date: string, startTime: string, endTime: string, actualMinutes?: number) {
    ensureBillingCollections()
    const occurrenceId = occurrenceIdFor(course.id, date)
    const computed = expectedUsageCharge(course, startTime, endTime, actualMinutes)
    if (computed.amount <= 0) {
      waiveUnbilledCharge(occurrenceId)
      return
    }
    const existing = findChargeForOccurrence(snapshot.value.charges ?? [], occurrenceId)
    if (existing?.status === 'billed') {
      upsertBilledAdjustment(
        existing,
        Math.round((computed.amount - existing.amount) * 100) / 100,
        '已出账课次时长或计价调整',
      )
      return
    }
    const next = {
      id: existing?.id ?? createId('chg'),
      childId: course.childIds?.[0] ?? course.childId,
      courseId: course.id,
      occurrenceId,
      amount: computed.amount,
      status: 'unbilled' as const,
      source: computed.source,
      estimated: computed.estimated,
      note: computed.estimated ? '按时长估算，确认实际分钟后可重算' : '由已完成课次自动计提',
    }
    if (existing) {
      const index = snapshot.value.charges!.findIndex((item) => item.id === existing.id)
      snapshot.value.charges![index] = { ...existing, ...next, id: existing.id }
    } else {
      snapshot.value.charges!.push(next)
    }
  }

  function syncUsageChargeForDate(course: Course, date: string, startTime: string, endTime: string) {
    const occurrenceId = occurrenceIdFor(course.id, date)
    const record = (snapshot.value.occurrenceRecords ?? []).find((item) => item.id === occurrenceId)
    if (shouldAccrueUsage(course, record?.status ?? 'scheduled', record?.billable ?? false)) {
      upsertUnbilledUsageCharge(course, date, startTime, endTime, record?.actualMinutes)
      return
    }
    waiveUnbilledCharge(occurrenceId)
  }

  function recomputeUnbilledChargesForCourse(course: Course) {
    ensureBillingCollections()
    if (!shouldAccrueUsage(course, 'completed', true) && course.billingPolicy?.pricingMode !== 'per_session' && course.billingPolicy?.pricingMode !== 'per_hour') {
      for (const charge of snapshot.value.charges ?? []) {
        if (charge.courseId === course.id && charge.status === 'unbilled') charge.status = 'waived'
      }
      return
    }
    for (const record of snapshot.value.occurrenceRecords ?? []) {
      if (record.courseId !== course.id) continue
      const startTime = course.recurrence.dates?.find((slot) => slot.date === record.date)?.startTime
        ?? course.recurrence.startTime
      const endTime = course.recurrence.dates?.find((slot) => slot.date === record.date)?.endTime
        ?? course.recurrence.endTime
      syncUsageChargeForDate(course, record.date, startTime, endTime)
    }
  }

  function setOccurrenceAttendance(
    courseId: string,
    date: string,
    status: OccurrenceAttendance,
    options: { billable?: boolean; actualMinutes?: number } = {},
  ) {
    const course = findCourse(courseId)
    if (!course) return
    ensureBillingCollections()
    const occurrenceId = occurrenceIdFor(courseId, date)
    const existingIndex = snapshot.value.occurrenceRecords!.findIndex((item) => item.id === occurrenceId)
    const existing = existingIndex >= 0 ? snapshot.value.occurrenceRecords![existingIndex] : undefined
    const slot = course.recurrence.dates?.find((item) => item.date === date)
    const exception = snapshot.value.scheduleExceptions.find(
      (item) => item.courseId === courseId && item.date === date,
    )
    const startTime = exception?.startTime ?? slot?.startTime ?? course.recurrence.startTime
    const endTime = exception?.endTime ?? slot?.endTime ?? course.recurrence.endTime
    const billable = options.billable ?? (status === 'completed')
    const next = {
      id: occurrenceId,
      courseId,
      originDate: existing?.originDate ?? date,
      date,
      status,
      billable,
      actualMinutes: options.actualMinutes ?? existing?.actualMinutes,
      confirmedAt: status === 'scheduled' ? undefined : dayjs().format('YYYY-MM-DD'),
    }
    if (existingIndex >= 0) snapshot.value.occurrenceRecords![existingIndex] = next
    else snapshot.value.occurrenceRecords!.push(next)

    syncUsageChargeForDate(course, date, startTime, endTime)
    persist()
  }

  function upsertScheduleException(
    input: Omit<ScheduleException, 'id' | 'childId'> & { id?: string },
    options: { persist?: boolean } = {},
  ) {
    const course = findCourse(input.courseId)
    const existingIndex = snapshot.value.scheduleExceptions.findIndex(
      (item) => item.courseId === input.courseId && item.date === input.date,
    )
    const existing = existingIndex >= 0 ? snapshot.value.scheduleExceptions[existingIndex] : undefined
    const next: ScheduleException = {
      ...existing,
      ...input,
      id: input.id ?? existing?.id ?? createId('exception'),
      childId: existing?.childId ?? course?.childIds?.[0] ?? course?.childId ?? childId.value,
    }
    if (existingIndex >= 0) snapshot.value.scheduleExceptions[existingIndex] = next
    else snapshot.value.scheduleExceptions.push(next)
    if (course) applyExceptionToCourse(course, next)
    if (course) {
      if (next.status === 'cancelled') {
        const record = (snapshot.value.occurrenceRecords ?? []).find(
          (item) => item.id === occurrenceIdFor(course.id, next.date),
        )
        if (record) record.status = 'cancelled'
        waiveUnbilledCharge(occurrenceIdFor(course.id, next.date))
      } else {
        syncUsageChargeForDate(
          course,
          next.date,
          next.startTime ?? course.recurrence.startTime,
          next.endTime ?? course.recurrence.endTime,
        )
      }
    }
    if (options.persist !== false) persist()
    return next
  }

  function removeScheduleException(courseId: string, date: string, options: { persist?: boolean } = {}) {
    snapshot.value.scheduleExceptions = snapshot.value.scheduleExceptions.filter(
      (item) => !(item.courseId === courseId && item.date === date),
    )
    if (options.persist !== false) persist()
  }

  function restoreOccurrenceSlot(courseId: string, slot: CourseDateSlot) {
    const course = findCourse(courseId)
    if (course) restoreCourseSlot(course, slot)
    removeScheduleException(courseId, slot.date, { persist: false })
    const record = (snapshot.value.occurrenceRecords ?? []).find(
      (item) => item.id === occurrenceIdFor(courseId, slot.date),
    )
    if (record && record.status === 'cancelled') {
      record.status = 'pending_confirmation'
      record.billable = false
    }
    if (course) syncUsageChargeForDate(course, slot.date, slot.startTime, slot.endTime)
    persist()
  }

  function dropOccurrenceSlot(courseId: string, date: string) {
    const course = findCourse(courseId)
    if (course) removeCourseSlot(course, date)
    removeScheduleException(courseId, date, { persist: false })
    waiveUnbilledCharge(occurrenceIdFor(courseId, date))
    persist()
  }

  function clearScheduleExceptionsForCourse(courseId: string) {
    snapshot.value.scheduleExceptions = snapshot.value.scheduleExceptions.filter(
      (item) => item.courseId !== courseId,
    )
    persist()
  }

  function ensurePaymentForExpense(expense: Expense) {
    ensureBillingCollections()
    if (expense.status !== 'paid') return
    const existing = snapshot.value.payments!.find(
      (payment) => payment.expenseId === expense.id && payment.kind === 'payment',
    )
    if (existing) return
    snapshot.value.payments!.push({
      id: createId('pay'),
      childId: expense.childId,
      expenseId: expense.id,
      kind: 'payment',
      amount: expense.amount,
      paidAt: expense.paidAt ?? dayjs().format('YYYY-MM-DD'),
      note: '账单确认支付',
    })
  }

  function upsertExpense(input: Omit<Expense, 'id' | 'childId'> & { id?: string }) {
    const id = input.id ?? createId('exp')
    const idx = snapshot.value.expenses.findIndex((e) => e.id === id)
    const existing = idx >= 0 ? snapshot.value.expenses[idx] : undefined
    const ownerChildId = existing?.childId ?? childId.value
    const next: Expense = { ...existing, ...input, id, childId: ownerChildId }
    if (existing?.status === 'paid') {
      next.status = 'paid'
      next.amount = existing.amount
      next.paidAt = existing.paidAt
    }
    if (idx >= 0) snapshot.value.expenses[idx] = next
    else snapshot.value.expenses.push(next)
    ensurePaymentForExpense(next)
    persist()
    return id
  }

  function billDueDate(cycle: SettlementCycle, statementKey: string) {
    const value = statementKey.slice(statementKey.lastIndexOf(':') + 1)
    if (cycle === 'monthly') return dayjs(`${value}-01`).add(1, 'month').date(8).format('YYYY-MM-DD')
    if (cycle === 'weekly') return dayjs(value).add(13, 'day').format('YYYY-MM-DD')
    return dayjs().format('YYYY-MM-DD')
  }

  function generateBillingStatements(period: string) {
    ensureBillingCollections()
    const created: string[] = []
    const updated: string[] = []
    const records = snapshot.value.occurrenceRecords ?? []
    const grouped = new Map<string, { course: Course; charges: Charge[] }>()

    for (const charge of charges.value) {
      if (charge.status !== 'unbilled') continue
      const date = occurrenceDateFromCharge(charge, records)
      if (!date.startsWith(period)) continue
      const course = findCourse(charge.courseId)
      if (!course || course.needsBillingReview) continue
      const cycle = course.billingPolicy?.settlementCycle
      if (!cycle || cycle === 'upfront') continue
      const key = chargeStatementKey(charge, course, records)
      const group = grouped.get(key) ?? { course, charges: [] }
      group.charges.push(charge)
      grouped.set(key, group)
    }

    for (const [baseKey, group] of grouped) {
      const cycle = group.course.billingPolicy?.settlementCycle ?? 'manual'
      const amount = Math.round(group.charges.reduce((sum, charge) => sum + charge.amount, 0) * 100) / 100
      if (amount <= 0) continue
      const existing = snapshot.value.expenses.find(
        (expense) => expense.statementKey === baseKey && expense.status !== 'paid',
      )
      const expenseId = existing?.id ?? createId('exp')
      const label = statementLabel(cycle, baseKey)
      if (existing) {
        existing.amount = Math.round((existing.amount + amount) * 100) / 100
        existing.chargeIds = [...new Set([...(existing.chargeIds ?? []), ...group.charges.map((item) => item.id)])]
        if (existing.amount > 0) existing.status = 'unpaid'
        updated.push(existing.id)
      } else {
        const previousCount = snapshot.value.expenses.filter(
          (expense) => expense.statementKey?.startsWith(baseKey),
        ).length
        const statementKey = previousCount ? `${baseKey}:supplement:${previousCount + 1}` : baseKey
        snapshot.value.expenses.push({
          id: expenseId,
          childId: childId.value,
          courseId: group.course.id,
          source: 'course_usage',
          title: `${group.course.title} · ${label}课次费`,
          category: group.course.type,
          billingMode: 'session',
          amount,
          period,
          dueDate: billDueDate(cycle, baseKey),
          status: 'unpaid',
          note: `${group.charges.length} 条待结算明细汇总`,
          chargeIds: group.charges.map((item) => item.id),
          statementKey,
        })
        created.push(expenseId)
      }
      for (const charge of group.charges) {
        charge.status = 'billed'
        charge.billedExpenseId = expenseId
      }
    }

    const periodStart = dayjs(`${period}-01`)
    const periodEnd = periodStart.endOf('month')
    for (const course of courses.value) {
      if (course.needsBillingReview || course.billingPolicy?.pricingMode !== 'fixed_period') continue
      const cycle = course.billingPolicy.settlementCycle
      const keys = cycle === 'weekly'
        ? [...new Set(
          Array.from({ length: periodStart.daysInMonth() }, (_, index) =>
            mondayOf(periodStart.date(index + 1).format('YYYY-MM-DD')),
          ),
        )]
        : cycle === 'monthly'
          ? [period]
          : []

      for (const value of keys) {
        const rangeStart = cycle === 'weekly' ? dayjs(value) : periodStart
        const rangeEnd = cycle === 'weekly' ? rangeStart.add(6, 'day') : periodEnd
        if (dayjs(course.recurrence.startDate).isAfter(rangeEnd, 'day')) continue
        if (course.recurrence.endDate && dayjs(course.recurrence.endDate).isBefore(rangeStart, 'day')) continue
        const statementKey = `${course.id}:fixed:${cycle}:${value}`
        if (snapshot.value.expenses.some((expense) => expense.statementKey === statementKey)) continue
        if (
          cycle === 'monthly'
          && snapshot.value.expenses.some((expense) =>
            expense.courseId === course.id
            && expense.period === period
            && expense.billingMode !== 'session'
            && expense.source !== 'course_usage',
          )
        ) continue
        const chargeId = createId('chg')
        const expenseId = createId('exp')
        snapshot.value.charges!.push({
          id: chargeId,
          childId: childId.value,
          courseId: course.id,
          occurrenceId: `period_${statementKey}`,
          amount: course.amount,
          status: 'billed',
          source: 'fixed_period',
          billedExpenseId: expenseId,
          note: '固定周期费用',
        })
        snapshot.value.expenses.push({
          id: expenseId,
          childId: childId.value,
          courseId: course.id,
          source: 'course_period',
          title: `${course.title} · ${statementLabel(cycle, statementKey)}固定费`,
          category: course.type,
          billingMode: cycle === 'monthly' ? 'monthly' : 'session',
          amount: course.amount,
          period,
          dueDate: billDueDate(cycle, statementKey),
          status: 'unpaid',
          note: '由固定周期计费规则生成',
          chargeIds: [chargeId],
          statementKey,
        })
        created.push(expenseId)
      }
    }

    persist()
    return { created: created.length, updated: updated.length }
  }

  function syncCourseUpfrontExpense(courseId: string, status: 'unpaid' | 'paid') {
    const course = findCourse(courseId)
    if (!course) return
    let existingIndex = snapshot.value.expenses.findIndex(
      (item) => item.courseId === courseId && item.source === 'course_upfront',
    )
    if (existingIndex < 0 && course.billingPolicy?.pricingMode === 'prepaid') {
      const legacyCandidates = snapshot.value.expenses
        .map((item, index) => ({ item, index }))
        .filter(
          ({ item }) => item.courseId === courseId
            && !item.source
            && item.billingMode === 'term',
        )
      if (legacyCandidates.length === 1) existingIndex = legacyCandidates[0].index
    }
    const existing = existingIndex >= 0 ? snapshot.value.expenses[existingIndex] : undefined

    if (course.billingPolicy?.pricingMode !== 'prepaid') {
      // 已支付记录属于历史支出，切换计费方式时不能静默删除。
      if (existing && existing.status !== 'paid') snapshot.value.expenses.splice(existingIndex, 1)
      persist()
      return
    }

    const paidAt = status === 'paid'
      ? (existing?.paidAt ?? dayjs().format('YYYY-MM-DD'))
      : undefined
    const amount = existing?.status === 'paid' && status === 'paid'
      ? existing.amount
      : Math.max(0, course.amount)
    const next: Expense = {
      id: existing?.id ?? createId('exp'),
      childId: course.childIds?.[0] ?? course.childId,
      courseId,
      source: 'course_upfront',
      title: `${course.title} · 一次性课程费`,
      category: course.type,
      billingMode: 'term',
      amount,
      period: (paidAt ?? dayjs().format('YYYY-MM-DD')).slice(0, 7),
      dueDate: paidAt ?? dayjs().format('YYYY-MM-DD'),
      status,
      paidAt,
      note: existing?.status === 'paid' && status === 'paid'
        ? existing.note
        : '由课程一次性支付设置同步',
    }
    if (existingIndex >= 0) snapshot.value.expenses[existingIndex] = next
    else snapshot.value.expenses.push(next)
    ensurePaymentForExpense(next)
    persist()
    return next.id
  }

  function addPresetOccurrence(courseId: string, date: string | string[]) {
    const course = snapshot.value.courses.find((item) => item.id === courseId)
    if (!course || course.archived) return { ok: false, reason: 'invalid' } as const
    const dates = [...new Set((Array.isArray(date) ? date : [date]).filter(Boolean))].sort()
    if (!dates.length) return { ok: false, reason: 'invalid' } as const

    const sample = course.recurrence.dates?.[0]
    const startTime = sample?.startTime ?? course.recurrence.startTime
    const endTime = sample?.endTime ?? course.recurrence.endTime
    const pending = dates.filter((day) =>
      !occurrencesOnDate(overviewCourses.value, day, overviewScheduleExceptions.value)
        .some((item) => item.course.id === courseId),
    )
    if (!pending.length) return { ok: false, reason: 'duplicate' } as const

    const [conflict] = findScheduleConflicts(
      pending.map((date) => ({ date, startTime, endTime })),
      overviewCourses.value,
      overviewScheduleExceptions.value,
      courseId,
      courseParticipantIds(course),
    )
    if (conflict) return { ok: false, reason: 'conflict', conflict } as const

    let added = 0
    for (const day of pending) {
      upsertScheduleException({
        courseId: course.id,
        date: day,
        status: 'added',
        startTime,
        endTime,
        title: course.title,
        location: course.location,
        note: '从课程预设添加',
      }, { persist: false })
      added += 1
    }
    persist()
    return added ? { ok: true } as const : { ok: false, reason: 'duplicate' } as const
  }

  function createQuickArrangement(input: QuickArrangementInput) {
    const title = input.title.trim()
    const dates = [...new Set((input.dates?.length ? input.dates : input.date ? [input.date] : []).filter(Boolean))].sort()
    if (!title || !dates.length || !input.startTime || !input.endTime || input.endTime <= input.startTime) {
      return { ok: false, reason: 'invalid' } as const
    }

    const ownerChildId = childId.value
    for (const day of dates) {
      const conflict = findBusyConflict(
        busyIntervalsOnDate(
          coursesForParticipants(overviewCourses.value, [ownerChildId]),
          day,
          overviewScheduleExceptions.value,
        ),
        input.startTime,
        input.endTime,
      )
      if (conflict) return { ok: false, reason: 'conflict', conflict } as const
    }

    const courseId = createId('course')
    const amount = Math.max(0, Number(input.amount) || 0)
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]
    snapshot.value.courses.push({
      id: courseId,
      childId: ownerChildId,
      childIds: [ownerChildId],
      source: 'temporary',
      title,
      type: 'interest',
      teacher: '',
      location: '',
      icon: 'generic',
      color: COURSE_ICON_COLORS.generic,
      billingPolicy: {
        pricingMode: amount > 0 ? 'per_session' : 'free',
        settlementCycle: 'manual',
      },
      needsBillingReview: false,
      billingMode: amount > 0 ? 'session' : 'free',
      amount,
      recurrence: {
        freq: dates.length === 1 ? 'once' : 'dates',
        byWeekday: [],
        startDate,
        endDate,
        startTime: input.startTime,
        endTime: input.endTime,
        dates: dates.map((date) => ({ date, startTime: input.startTime, endTime: input.endTime })),
      },
      archived: false,
      note: '通过快速新增创建的临时安排',
    })

    let expenseId: string | undefined
    if (amount > 0) {
      expenseId = createId('exp')
      snapshot.value.expenses.push({
        id: expenseId,
        childId: ownerChildId,
        courseId,
        source: 'temporary',
        title: `${title} · 单次费用`,
        category: 'temporary',
        billingMode: 'session',
        amount,
        period: startDate.slice(0, 7),
        dueDate: startDate,
        status: input.expenseStatus,
        paidAt: input.expenseStatus === 'paid' ? dayjs().format('YYYY-MM-DD') : undefined,
        note: '随快速新增安排创建',
      })
      ensurePaymentForExpense(snapshot.value.expenses[snapshot.value.expenses.length - 1])
    }

    persist()
    return { ok: true, courseId, expenseId } as const
  }

  function findOccurrenceExpense(courseId: string, date: string) {
    const sameDay = snapshot.value.expenses.find(
      (item) => item.courseId === courseId && item.status !== 'void' && item.dueDate === date,
    )
    if (sameDay) return sameDay
    const course = findCourse(courseId)
    if (course?.source === 'temporary') {
      return snapshot.value.expenses.find((item) => item.courseId === courseId && item.status !== 'void')
    }
    return undefined
  }

  function upsertOccurrenceExpense(courseId: string, date: string, input: { amount: number; paid: boolean }) {
    const course = findCourse(courseId)
    if (!course) return 'not-found' as const
    const amount = Math.round(Math.max(0, Number(input.amount) || 0) * 100) / 100
    let expense = findOccurrenceExpense(courseId, date)

    if (expense?.status === 'paid') return 'paid-immutable' as const

    if (!expense) {
      if (amount <= 0) {
        if (course.source === 'temporary') {
          course.amount = 0
          course.billingMode = 'free'
          course.billingPolicy = {
            pricingMode: 'free',
            settlementCycle: course.billingPolicy?.settlementCycle ?? 'manual',
          }
        }
        persist()
        return 'cleared' as const
      }
      const charge = findChargeForOccurrence(snapshot.value.charges ?? [], occurrenceIdFor(courseId, date))
      expense = {
        id: createId('exp'),
        childId: course.childId,
        courseId,
        source: course.source === 'temporary' ? 'temporary' : 'course_usage',
        title: `${course.title} · 单次费用`,
        category: course.source === 'temporary' ? 'temporary' : course.type,
        billingMode: 'session',
        amount,
        period: date.slice(0, 7),
        dueDate: date,
        status: 'unpaid',
        note: '课次费用',
        chargeIds: charge?.status === 'unbilled' ? [charge.id] : [],
      }
      snapshot.value.expenses.push(expense)
      if (charge?.status === 'unbilled') {
        charge.status = 'billed'
        charge.billedExpenseId = expense.id
        charge.amount = amount
      }
    } else if (amount <= 0) {
      const expenseId = expense.id
      snapshot.value.expenses = snapshot.value.expenses.filter((item) => item.id !== expenseId)
      for (const charge of snapshot.value.charges ?? []) {
        if (charge.billedExpenseId !== expenseId) continue
        charge.status = charge.source === 'fixed_period' ? 'reversed' : 'unbilled'
        charge.billedExpenseId = undefined
      }
      expense = undefined
    } else {
      expense.amount = amount
    }

    if (course.source === 'temporary') {
      course.amount = amount
      course.billingMode = amount > 0 ? 'session' : 'free'
      course.billingPolicy = {
        pricingMode: amount > 0 ? 'per_session' : 'free',
        settlementCycle: course.billingPolicy?.settlementCycle ?? 'manual',
      }
    }

    if (expense && input.paid && amount > 0) {
      expense.status = 'paid'
      expense.paidAt = dayjs().format('YYYY-MM-DD')
      ensurePaymentForExpense(expense)
    }

    persist()
    return 'updated' as const
  }

  function setExpenseStatus(id: string, status: Expense['status']) {
    const item = snapshot.value.expenses.find((e) => e.id === id)
    if (!item) return 'not-found' as const
    if (item.status === 'paid' && status !== 'paid') return 'paid-immutable' as const
    item.status = status
    item.paidAt = status === 'paid' ? dayjs().format('YYYY-MM-DD') : undefined
    ensurePaymentForExpense(item)
    persist()
    return 'updated' as const
  }

  function refundExpense(id: string, amount: number, note = '') {
    ensureBillingCollections()
    const expense = findExpense(id)
    if (!expense || expense.status !== 'paid') return { ok: false, reason: 'not-paid' } as const
    const payment = snapshot.value.payments!.find(
      (item) => item.expenseId === id && item.kind === 'payment',
    )
    if (!payment) return { ok: false, reason: 'payment-missing' } as const
    const refunded = snapshot.value.payments!
      .filter((item) => item.kind === 'refund' && item.refundOfPaymentId === payment.id)
      .reduce((sum, item) => sum + item.amount, 0)
    const value = Math.round(Math.max(0, Number(amount) || 0) * 100) / 100
    const remaining = Math.round((payment.amount - refunded) * 100) / 100
    if (value <= 0 || value > remaining) {
      return { ok: false, reason: 'invalid-amount', remaining } as const
    }

    const refund: Payment = {
      id: createId('refund'),
      childId: expense.childId,
      expenseId: expense.id,
      kind: 'refund',
      amount: value,
      paidAt: dayjs().format('YYYY-MM-DD'),
      refundOfPaymentId: payment.id,
      note: note.trim() || '账单退款',
    }
    snapshot.value.payments!.push(refund)

    let unapplied = value
    for (const adjustment of snapshot.value.charges!.filter((charge) => {
      if (charge.status !== 'unbilled' || charge.source !== 'adjustment') return false
      const original = charge.adjustmentOfChargeId
        ? snapshot.value.charges!.find((item) => item.id === charge.adjustmentOfChargeId)
        : undefined
      return original?.billedExpenseId === expense.id && charge.amount < 0
    })) {
      if (Math.abs(adjustment.amount) > unapplied) continue
      adjustment.status = 'billed'
      adjustment.billedExpenseId = expense.id
      expense.chargeIds = [...new Set([...(expense.chargeIds ?? []), adjustment.id])]
      unapplied = Math.round((unapplied - Math.abs(adjustment.amount)) * 100) / 100
    }

    persist()
    return { ok: true, refundId: refund.id, remaining: Math.round((remaining - value) * 100) / 100 } as const
  }

  function removeExpense(id: string) {
    const expense = findExpense(id)
    if (!expense) return 'not-found' as const
    if (expense.status === 'paid' || snapshot.value.payments?.some((item) => item.expenseId === id)) {
      return 'paid-immutable' as const
    }
    for (const charge of snapshot.value.charges ?? []) {
      if (charge.billedExpenseId !== id) continue
      charge.status = charge.source === 'fixed_period' ? 'reversed' : 'unbilled'
      charge.billedExpenseId = undefined
    }
    snapshot.value.expenses = snapshot.value.expenses.filter((e) => e.id !== id)
    persist()
    return 'removed' as const
  }

  function addGoalProgress(id: string, delta: number) {
    const goal = snapshot.value.goals.find((g: Goal) => g.id === id)
    if (!goal) return
    goal.doneCount = Math.max(0, Math.min(goal.targetCount, goal.doneCount + delta))
    if (goal.doneCount >= goal.targetCount) goal.status = 'done'
    persist()
  }

  function restoreDemo() {
    snapshot.value = resetSnapshot()
  }

  return {
    snapshot,
    child,
    courses,
    allCourses,
    expenses,
    goals,
    scheduleExceptions,
    isParentSession,
    overviewCourses,
    overviewExpenses,
    overviewScheduleExceptions,
    coursesForChild,
    todayItems,
    monthOpenAmount,
    overviewCharges,
    overviewPayments,
    occurrenceRecords,
    charges,
    payments,
    updateChild,
    addChild,
    removeChild,
    selectChild,
    findCourse,
    findExpense,
    findOccurrenceExpense,
    upsertCourse,
    findCourseScheduleConflicts,
    archiveCourse,
    restoreCourse,
    removeCourse,
    upsertScheduleException,
    removeScheduleException,
    restoreOccurrenceSlot,
    dropOccurrenceSlot,
    clearScheduleExceptionsForCourse,
    upsertExpense,
    syncCourseUpfrontExpense,
    generateBillingStatements,
    addPresetOccurrence,
    createQuickArrangement,
    upsertOccurrenceExpense,
    setOccurrenceAttendance,
    setExpenseStatus,
    refundExpense,
    removeExpense,
    addGoalProgress,
    restoreDemo,
  }
})
