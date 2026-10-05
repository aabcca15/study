import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type {
  AppSnapshot,
  Charge,
  ChildAvatarKey,
  ChildProfile,
  Course,
  Expense,
  ExpenseStatus,
  OccurrenceAttendance,
  Payment,
  ScheduleException,
} from '@server-domain/types'
import { emptySnapshot } from '@server-domain/constants'
import { callCloud } from '@/cloud/call'
import { clearDevSession } from '@/cloud/local'

const LOGGED_KEY = 'myhome.mp.logged'

function belongsToChild(course: Course, childId: string) {
  const ids = course.childIds?.length ? course.childIds : [course.childId]
  return ids.includes(childId)
}

export interface CloudMutation<T> {
  snapshot: AppSnapshot
  result: T
}

export interface CloudSession {
  openid: string
  familyId: string
  snapshot: AppSnapshot
}

export const useFamilyStore = defineStore('family', {
  state: () => ({
    ready: false,
    openid: '',
    familyId: '',
    snapshot: emptySnapshot() as AppSnapshot,
  }),
  getters: {
    child(state): ChildProfile | undefined {
      return state.snapshot.children.find((item) => item.id === state.snapshot.session.childId)
        ?? state.snapshot.children[0]
    },
    childId(): string {
      return this.child?.id ?? ''
    },
    allCourses(): Course[] {
      const id = this.childId
      return this.snapshot.courses.filter((course) => belongsToChild(course, id))
    },
    courses(): Course[] {
      return this.allCourses.filter((course) => !course.archived)
    },
    expenses(): Expense[] {
      const id = this.childId
      return this.snapshot.expenses.filter((item) => item.childId === id)
    },
    scheduleExceptions(): ScheduleException[] {
      const ids = new Set(this.allCourses.map((course) => course.id))
      return this.snapshot.scheduleExceptions.filter((item) => ids.has(item.courseId))
    },
    overviewCourses(state): Course[] {
      return state.snapshot.courses.filter((course) => !course.archived)
    },
    overviewExpenses(state): Expense[] {
      return state.snapshot.expenses
    },
    overviewScheduleExceptions(): ScheduleException[] {
      const ids = new Set(this.overviewCourses.map((course) => course.id))
      return this.snapshot.scheduleExceptions.filter((item) => ids.has(item.courseId))
    },
    overviewCharges(state): Charge[] {
      return state.snapshot.charges ?? []
    },
    overviewPayments(state): Payment[] {
      return state.snapshot.payments ?? []
    },
  },
  actions: {
    async dispatch<T>(action: string, payload?: Record<string, unknown>) {
      const data = await callCloud<CloudMutation<T>>(action, payload)
      if (JSON.stringify(data.snapshot) !== JSON.stringify(this.snapshot)) {
        this.snapshot = data.snapshot
      }
      this.ready = true
      return data.result
    },
    async login(childName = '小U', avatarKey?: ChildAvatarKey) {
      const data = await callCloud<CloudSession>('login', { childName, avatarKey })
      this.openid = data.openid
      this.familyId = data.familyId
      this.snapshot = data.snapshot
      this.ready = true
      uni.setStorageSync(LOGGED_KEY, '1')
    },
    logout() {
      this.ready = false
      this.openid = ''
      this.familyId = ''
      this.snapshot = emptySnapshot()
      uni.removeStorageSync(LOGGED_KEY)
      clearDevSession()
    },
    refresh() {
      const from = dayjs().startOf('month').format('YYYY-MM-DD')
      const to = dayjs().endOf('month').format('YYYY-MM-DD')
      return this.dispatch('snapshot', { from, to })
    },
    addChild(name: string, avatarKey?: ChildAvatarKey) {
      return this.dispatch<string>('addChild', { name, avatarKey })
    },
    updateChild(id: string, input: { name?: string; avatarKey?: ChildAvatarKey }) {
      return this.dispatch('updateChild', { id, ...input })
    },
    removeChild(id: string) {
      return this.dispatch('removeChild', { id })
    },
    selectChild(childId: string) {
      return this.dispatch('selectChild', { childId })
    },
    saveCourse(course: Record<string, unknown>, paymentStatus: 'paid' | 'unpaid') {
      return this.dispatch<string>('saveCourse', { course, paymentStatus })
    },
    archiveCourse(id: string) {
      return this.dispatch('archiveCourse', { id })
    },
    restoreCourse(id: string) {
      return this.dispatch('restoreCourse', { id })
    },
    removeCourse(id: string) {
      return this.dispatch('removeCourse', { id })
    },
    addOccurrences(courseId: string, dates: string[]) {
      return this.dispatch('addOccurrences', { courseId, dates })
    },
    quickArrangement(input: Record<string, unknown>) {
      return this.dispatch('quickArrangement', input)
    },
    upsertException(input: Record<string, unknown>) {
      return this.dispatch('upsertException', input)
    },
    restoreOccurrence(input: { courseId: string; date: string; startTime: string; endTime: string }) {
      return this.dispatch('restoreOccurrence', input)
    },
    dropOccurrence(courseId: string, date: string) {
      return this.dispatch('dropOccurrence', { courseId, date })
    },
    setAttendance(courseId: string, date: string, status: OccurrenceAttendance, billable: boolean) {
      return this.dispatch('attendance', { courseId, date, status, billable })
    },
    saveOccurrenceExpense(courseId: string, date: string, amount: number, paid: boolean) {
      return this.dispatch('occurrenceExpense', { courseId, date, amount, paid })
    },
    upsertExpense(input: Record<string, unknown>) {
      return this.dispatch('upsertExpense', input)
    },
    generateBills(period: string) {
      return this.dispatch('generateBills', { period })
    },
    setExpenseStatus(id: string, status: ExpenseStatus) {
      return this.dispatch('setExpenseStatus', { id, status })
    },
    refund(id: string, amount: number, note = '') {
      return this.dispatch('refund', { id, amount, note })
    },
    removeExpense(id: string) {
      return this.dispatch('removeExpense', { id })
    },
  },
})

export function hasLocalSession() {
  return uni.getStorageSync(LOGGED_KEY) === '1'
}
