import { markRaw } from 'vue'
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
import { callCloud, CloudError, NEED_FAMILY, NOT_MEMBER } from '@/cloud/call'
import { promptLogin } from '@/utils/login-prompt'
import {
  canInviteRole,
  canLeaveFamily,
  canRemoveMember,
  canViewBills,
  canWriteFamily,
  FAMILY_ROLE_LABEL,
  type FamilyInviteView,
  type FamilyMemberView,
  type InviteJoinPreview,
  type FamilyRole,
  type InviteRole,
} from '@/domain/family-account'

const LOGGED_KEY = 'myhome.mp.logged'

let inflight: Promise<unknown> | null = null
let snapshotJson = ''

/** 倒数第二个课程色从灰蓝、玫红换成 #DC5454，已保存的课跟着换，卡片渐变一起变。 */
const LEGACY_COURSE_COLORS: Record<string, string> = {
  '#7c8aa5': '#DC5454',
  '#e7e9ef': '#DC5454',
  '#ff3d9a': '#DC5454',
}

function withCurrentCourseColors(snapshot: AppSnapshot) {
  let changed = false
  const courses = snapshot.courses.map((course) => {
    const next = LEGACY_COURSE_COLORS[course.color?.toLowerCase()]
    if (!next || next === course.color) return course
    changed = true
    return { ...course, color: next }
  })
  return changed ? { ...snapshot, courses } : snapshot
}

/** 快照总是整体替换、从不就地修改，不需要深层响应式代理。 */
function frozen(snapshot: AppSnapshot) {
  return markRaw(snapshot)
}

function belongsToChild(course: Course, childId: string) {
  const ids = course.childIds?.length ? course.childIds : [course.childId]
  return ids.includes(childId)
}

export interface CloudMutation<T> {
  snapshot: AppSnapshot
  result: T
  version?: number
}

export interface CloudSession {
  openid: string
  familyId: string
  role?: FamilyRole
  displayName?: string
  nickName?: string
  avatarUrl?: string
  snapshot: AppSnapshot
  version?: number
}

type SyncResult = { changed: false } | { changed: true; session: CloudSession }

/** 创建、加入家庭时一起带上的称呼、微信昵称和头像，都可以不填。 */
export interface MemberProfile {
  displayName?: string
  nickName?: string
  avatarUrl?: string
}

/** 切页时最多这么久问一次云端，连续切 tab 不重复请求。 */
const SYNC_GAP_MS = 3000
let syncTask: Promise<unknown> | null = null
let syncedVersionAt = 0

export interface FamilyRoster {
  members: FamilyMemberView[]
  invites: FamilyInviteView[]
}

export const useFamilyStore = defineStore('family', {
  state: () => ({
    ready: false,
    openid: '',
    familyId: '',
    role: 'owner' as FamilyRole,
    displayName: '',
    nickName: '',
    avatarUrl: '',
    /** 云端家庭文档的版本号，任何人改了课表都会 +1，用来判断本机数据是不是最新的。 */
    version: 0,
    /** 家人只在本机切换正在看的孩子，不写进全家共用的快照。 */
    preferredChildId: '',
    snapshot: frozen(emptySnapshot() as AppSnapshot),
    syncedAt: 0,
    rangeMonth: '',
  }),
  getters: {
    roleLabel(state): string {
      return FAMILY_ROLE_LABEL[state.role]
    },
    canWrite(): boolean {
      return canWriteFamily(this.role)
    },
    canViewBills(): boolean {
      return canViewBills(this.role)
    },
    canInviteParent(): boolean {
      return canInviteRole(this.role, 'parent')
    },
    canInviteViewer(): boolean {
      return canInviteRole(this.role, 'viewer')
    },
    canManageMembers(): boolean {
      return this.role === 'owner'
    },
    canLeave(): boolean {
      return canLeaveFamily(this.role)
    },
    child(state): ChildProfile | undefined {
      const preferred = state.preferredChildId
      const id = state.snapshot.children.some((item) => item.id === preferred)
        ? preferred
        : state.snapshot.session.childId
      return state.snapshot.children.find((item) => item.id === id)
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
    /** 所有视图都跟着快照重新计算；内容没变就不替换，避免白白重绘。 */
    applySnapshot(snapshot: AppSnapshot) {
      snapshot = withCurrentCourseColors(snapshot)
      const json = JSON.stringify(snapshot)
      if (json !== snapshotJson) {
        snapshotJson = json
        this.snapshot = frozen(snapshot)
      }
      this.syncedAt = Date.now()
    },
    applySession(data: CloudSession) {
      this.openid = data.openid
      this.familyId = data.familyId
      this.role = data.role || 'owner'
      this.displayName = data.displayName || FAMILY_ROLE_LABEL[this.role]
      this.nickName = data.nickName || ''
      this.avatarUrl = data.avatarUrl || ''
      if (canWriteFamily(this.role)) this.preferredChildId = ''
      this.applySnapshot(data.snapshot)
      if (data.version) this.version = data.version
      this.rangeMonth = ''
      this.ready = true
      uni.setStorageSync(LOGGED_KEY, '1')
    },
    async dispatch<T>(action: string, payload?: Record<string, unknown>) {
      if (needsFamily()) {
        promptLogin()
        throw new CloudError('请先创建家庭', NEED_FAMILY)
      }
      let data: CloudMutation<T>
      try {
        data = await callCloud<CloudMutation<T>>(action, payload)
      } catch (error) {
        if (error instanceof CloudError && error.code === NOT_MEMBER) this.logout()
        throw error
      }
      this.applySnapshot(data.snapshot)
      if (data.version) this.version = data.version
      this.ready = true
      return data.result
    },
    /**
     * 问云端家庭数据有没有被别人改过。没变只回一个标记，变了才带回完整快照。
     * 跨月时走 refresh，顺带生成本月账期。被移出时抛 NOT_MEMBER 并回到未登录状态。
     */
    sync(force = false) {
      if (!this.ready) return Promise.resolve(false)
      if (this.rangeMonth !== dayjs().format('YYYY-MM')) return this.refresh().then(() => true)
      if (syncTask) return syncTask
      if (!force && Date.now() - syncedVersionAt < SYNC_GAP_MS) return Promise.resolve(false)
      syncedVersionAt = Date.now()
      syncTask = callCloud<SyncResult>('sync', { version: this.version, familyId: this.familyId, role: this.role })
        .then((data) => {
          this.syncedAt = Date.now()
          if (!data.changed) return false
          const month = this.rangeMonth
          this.applySession(data.session)
          this.rangeMonth = month
          return true
        })
        .catch((error) => {
          if (error instanceof CloudError && error.code === NOT_MEMBER) this.logout()
          throw error
        })
        .finally(() => {
          syncTask = null
        })
      return syncTask
    },
    async login(childName = '小U', avatarKey?: ChildAvatarKey, profile: MemberProfile = {}) {
      this.applySession(await callCloud<CloudSession>('login', { childName, avatarKey, ...profile }))
    },
    /** 这个微信号已经有家庭时直接进入。没有家庭时不创建，回到登录页让用户自己选。 */
    async resume() {
      this.applySession(await callCloud<CloudSession>('login', { resume: true }))
    },
    async joinFamily(code: string, profile: MemberProfile = {}) {
      this.applySession(await callCloud<CloudSession>('joinFamily', { code, ...profile }))
    },
    /** 退出后这台手机回到没有家庭的状态，可以继续浏览或重新创建、加入。 */
    async leaveFamily() {
      await callCloud('leaveFamily')
      this.logout()
    },
    previewInvite(code: string) {
      return callCloud<InviteJoinPreview>('previewInvite', { code })
    },
    listMembers() {
      return this.dispatch<FamilyRoster>('listMembers')
    },
    createInvite(role: InviteRole) {
      return this.dispatch<FamilyInviteView>('createInvite', { role })
    },
    removeMember(openid: string) {
      return this.dispatch('removeMember', { openid })
    },
    canRemove(member: FamilyMemberView) {
      return canRemoveMember(this.role, member.role, member.self)
    },
    logout() {
      this.ready = false
      this.openid = ''
      this.familyId = ''
      this.role = 'owner'
      this.displayName = ''
      this.nickName = ''
      this.avatarUrl = ''
      this.version = 0
      this.preferredChildId = ''
      snapshotJson = ''
      this.snapshot = frozen(emptySnapshot())
      this.syncedAt = 0
      this.rangeMonth = ''
      uni.removeStorageSync(LOGGED_KEY)
    },
    refresh() {
      if (inflight) return inflight
      const month = dayjs().format('YYYY-MM')
      const from = dayjs().startOf('month').format('YYYY-MM-DD')
      const to = dayjs().endOf('month').format('YYYY-MM-DD')
      inflight = this.dispatch('snapshot', { from, to })
        .then((result) => {
          this.rangeMonth = month
          return result
        })
        .finally(() => {
          inflight = null
        })
      return inflight
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
      if (!this.snapshot.children.some((item) => item.id === childId)) {
        return Promise.reject(new Error('孩子不存在'))
      }
      if (!this.canWrite) {
        this.preferredChildId = childId
        return Promise.resolve(childId)
      }
      this.preferredChildId = ''
      return this.dispatch<string>('selectChild', { childId })
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
    updateCourseNote(courseId: string, note: string) {
      return this.dispatch('updateCourseNote', { courseId, note })
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

/** 既没有家庭、本机也没有登录记录：写操作要先创建家庭。 */
export function needsFamily() {
  return !useFamilyStore().ready && !hasLocalSession()
}
