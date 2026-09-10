import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ChildProfile, Course, CourseDateSlot, Expense, Goal, ScheduleException } from '@/domain/types'
import { createId } from '@/domain/constants'
import { loadSnapshot, resetSnapshot, saveSnapshot } from '@/data/storage'
import { currentPeriod } from '@/services/billing'
import { occurrencesOnDate } from '@/services/schedule'
import { applyExceptionToCourse, removeCourseSlot, restoreCourseSlot } from '@/services/courseSchedule'
import dayjs from 'dayjs'

export const useAppStore = defineStore('app', () => {
  const snapshot = ref(loadSnapshot())

  const persist = () => saveSnapshot(snapshot.value)

  const child = computed(
    () => snapshot.value.children.find((c) => c.id === snapshot.value.session.childId) ?? snapshot.value.children[0],
  )

  const childId = computed(() => child.value?.id ?? '')

  function belongsToChild(course: Course, targetChildId: string) {
    const assignedChildIds = course.childIds?.length ? course.childIds : [course.childId]
    return assignedChildIds.includes(targetChildId)
  }

  const courses = computed(() =>
    snapshot.value.courses.filter(
      (course) => belongsToChild(course, childId.value) && !course.archived,
    ),
  )

  const allCourses = computed(() =>
    snapshot.value.courses.filter((course) => belongsToChild(course, childId.value)),
  )

  const expenses = computed(() =>
    snapshot.value.expenses.filter((e) => e.childId === childId.value),
  )

  const goals = computed(() => snapshot.value.goals.filter((g) => g.childId === childId.value))

  const scheduleExceptions = computed(() => {
    const visibleCourseIds = new Set(allCourses.value.map((course) => course.id))
    return snapshot.value.scheduleExceptions.filter((item) => visibleCourseIds.has(item.courseId))
  })

  const todayItems = computed(() =>
    occurrencesOnDate(
      courses.value,
      dayjs().format('YYYY-MM-DD'),
      scheduleExceptions.value,
    ),
  )

  const monthOpenAmount = computed(() =>
    expenses.value
      .filter((e) => e.period === currentPeriod() && e.status !== 'paid')
      .reduce((s, e) => s + e.amount, 0),
  )

  function upsertCourse(
    input: Omit<Course, 'id' | 'childId' | 'archived'> & { id?: string; childIds?: string[] },
  ) {
    const id = input.id ?? createId('course')
    const assignedChildIds = input.childIds?.length ? input.childIds : [childId.value]
    const next: Course = {
      ...input,
      id,
      childId: assignedChildIds[0],
      childIds: assignedChildIds,
      archived: false,
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

  function updateChild(input: Pick<ChildProfile, 'id' | 'name'>) {
    const target = snapshot.value.children.find((item) => item.id === input.id)
    if (!target) return
    const name = input.name.trim()
    if (!name) return
    target.name = name
    target.avatarLabel = name.slice(0, 2)
    persist()
  }

  function addChild(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return ''
    const colors = ['#7157D9', '#E7778A', '#3FAF8B', '#E9A23B', '#4C8DDE']
    const id = createId('child')
    snapshot.value.children.push({
      id,
      name: trimmed,
      grade: '',
      avatarLabel: trimmed.slice(0, 2),
      avatarColor: colors[snapshot.value.children.length % colors.length],
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

  function upsertScheduleException(
    input: Omit<ScheduleException, 'id' | 'childId'> & { id?: string },
    options: { persist?: boolean } = {},
  ) {
    const existingIndex = snapshot.value.scheduleExceptions.findIndex(
      (item) => item.courseId === input.courseId && item.date === input.date,
    )
    const existing = existingIndex >= 0 ? snapshot.value.scheduleExceptions[existingIndex] : undefined
    const next: ScheduleException = {
      ...existing,
      ...input,
      id: input.id ?? existing?.id ?? createId('exception'),
      childId: childId.value,
    }
    if (existingIndex >= 0) snapshot.value.scheduleExceptions[existingIndex] = next
    else snapshot.value.scheduleExceptions.push(next)
    const course = findCourse(input.courseId)
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
    const next: Expense = { ...input, id, childId: childId.value }
    const idx = snapshot.value.expenses.findIndex((e) => e.id === id)
    if (idx >= 0) snapshot.value.expenses[idx] = next
    else snapshot.value.expenses.push(next)
    persist()
    return id
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
    todayItems,
    monthOpenAmount,
    updateChild,
    addChild,
    removeChild,
    selectChild,
    upsertCourse,
    archiveCourse,
    upsertScheduleException,
    removeScheduleException,
    restoreOccurrenceSlot,
    dropOccurrenceSlot,
    clearScheduleExceptionsForCourse,
    upsertExpense,
    setExpenseStatus,
    removeExpense,
    addGoalProgress,
    restoreDemo,
  }
})
