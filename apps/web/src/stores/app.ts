import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ChildAvatarKey,
  ChildProfile,
  Course,
  CourseDateSlot,
  Expense,
  Goal,
  QuickArrangementInput,
  ScheduleException,
} from '@/domain/types'
import { childAvatarOption, COURSE_ICON_COLORS, createId } from '@/domain/constants'
import { loadSnapshot, resetSnapshot, saveSnapshot } from '@/data/storage'
import { currentPeriod } from '@/services/billing'
import { busyIntervalsOnDate, findBusyConflict, occurrencesOnDate } from '@/services/schedule'
import { applyExceptionToCourse, removeCourseSlot, restoreCourseSlot } from '@/services/courseSchedule'
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
    persist()
    return id
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
    persist()
  }

  function dropOccurrenceSlot(courseId: string, date: string) {
    const course = findCourse(courseId)
    if (course) removeCourseSlot(course, date)
    removeScheduleException(courseId, date, { persist: false })
    persist()
  }

  function clearScheduleExceptionsForCourse(courseId: string) {
    snapshot.value.scheduleExceptions = snapshot.value.scheduleExceptions.filter(
      (item) => item.courseId !== courseId,
    )
    persist()
  }

  function upsertExpense(input: Omit<Expense, 'id' | 'childId'> & { id?: string }) {
    const id = input.id ?? createId('exp')
    const idx = snapshot.value.expenses.findIndex((e) => e.id === id)
    const ownerChildId = idx >= 0 ? snapshot.value.expenses[idx].childId : childId.value
    const next: Expense = { ...input, id, childId: ownerChildId }
    if (idx >= 0) snapshot.value.expenses[idx] = next
    else snapshot.value.expenses.push(next)
    persist()
    return id
  }

  function createQuickArrangement(input: QuickArrangementInput) {
    const title = input.title.trim()
    if (!title || !input.date || !input.startTime || !input.endTime || input.endTime <= input.startTime) {
      return { ok: false, reason: 'invalid' } as const
    }

    // 同一天不允许与已有安排重叠，避免快速入口造出互相冲突的课次
    const conflict = findBusyConflict(
      busyIntervalsOnDate(overviewCourses.value, input.date, overviewScheduleExceptions.value),
      input.startTime,
      input.endTime,
    )
    if (conflict) return { ok: false, reason: 'conflict', conflict } as const

    const courseId = createId('course')
    const ownerChildId = childId.value
    const amount = Math.max(0, Number(input.amount) || 0)
    snapshot.value.courses.push({
      id: courseId,
      childId: ownerChildId,
      childIds: [ownerChildId],
      title,
      type: 'interest',
      teacher: '',
      location: '',
      icon: 'generic',
      color: COURSE_ICON_COLORS.generic,
      billingMode: amount > 0 ? 'session' : 'free',
      amount,
      recurrence: {
        freq: 'once',
        byWeekday: [],
        startDate: input.date,
        endDate: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        dates: [{ date: input.date, startTime: input.startTime, endTime: input.endTime }],
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
        title: `${title} · 单次费用`,
        category: 'interest',
        billingMode: 'session',
        amount,
        period: input.date.slice(0, 7),
        dueDate: input.date,
        status: input.expenseStatus,
        paidAt: input.expenseStatus === 'paid' ? dayjs().format('YYYY-MM-DD') : undefined,
        note: '随快速新增安排创建',
      })
    }

    persist()
    return { ok: true, courseId, expenseId } as const
  }

  function setExpenseStatus(id: string, status: Expense['status']) {
    const item = snapshot.value.expenses.find((e) => e.id === id)
    if (!item) return
    item.status = status
    item.paidAt = status === 'paid' ? dayjs().format('YYYY-MM-DD') : undefined
    persist()
  }

  function removeExpense(id: string) {
    snapshot.value.expenses = snapshot.value.expenses.filter((e) => e.id !== id)
    persist()
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
    updateChild,
    addChild,
    removeChild,
    selectChild,
    findExpense,
    upsertCourse,
    archiveCourse,
    restoreCourse,
    upsertScheduleException,
    removeScheduleException,
    restoreOccurrenceSlot,
    dropOccurrenceSlot,
    clearScheduleExceptionsForCourse,
    upsertExpense,
    createQuickArrangement,
    setExpenseStatus,
    removeExpense,
    addGoalProgress,
    restoreDemo,
  }
})
