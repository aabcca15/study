export type Role = 'parent' | 'child'

export type CourseType = 'school' | 'interest' | 'online'

export type BillingMode = 'monthly' | 'session' | 'term' | 'free'

export type ExpenseStatus = 'pending' | 'unpaid' | 'paid'

export type ExpenseCategory = CourseType | 'material' | 'other'

export type CourseIcon =
  | 'school'
  | 'sport'
  | 'math'
  | 'reading'
  | 'music'
  | 'swimming'
  | 'english'
  | 'calligraphy'
  | 'generic'

export type ChildAvatarKey = 'boy-blue' | 'boy-cap' | 'girl-flower' | 'girl-bow'

export interface ChildProfile {
  id: string
  name: string
  grade: string
  avatarLabel: string
  avatarColor?: string
  /** 对应 `user_icon.png` 四宫格雪碧图中的一张圆形头像。 */
  avatarKey?: ChildAvatarKey
}

export interface Recurrence {
  freq: 'weekly' | 'once' | 'dates'
  byWeekday: number[]
  startDate: string
  endDate?: string
  startTime: string
  endTime: string
  dates?: CourseDateSlot[]
}

export interface CourseDateSlot {
  date: string
  startTime: string
  endTime: string
}

export interface Course {
  id: string
  childId: string
  childIds?: string[]
  title: string
  type: CourseType
  teacher: string
  location: string
  icon: CourseIcon
  color: string
  billingMode: BillingMode
  amount: number
  recurrence: Recurrence
  archived: boolean
  note: string
}

export interface Expense {
  id: string
  childId: string
  courseId?: string
  title: string
  category: ExpenseCategory
  billingMode: Exclude<BillingMode, 'free'>
  amount: number
  period: string
  dueDate: string
  status: ExpenseStatus
  paidAt?: string
  note: string
}

export interface Goal {
  id: string
  childId: string
  title: string
  targetCount: number
  doneCount: number
  period: string
  status: 'active' | 'done' | 'paused'
}

export interface ScheduleException {
  id: string
  childId: string
  courseId: string
  date: string
  status: 'cancelled' | 'rescheduled' | 'added'
  title?: string
  startTime?: string
  endTime?: string
  location?: string
  note?: string
}

export interface QuickArrangementInput {
  date: string
  title: string
  startTime: string
  endTime: string
  amount: number
  expenseStatus: ExpenseStatus
}

export interface SessionState {
  role: Role
  childId: string
}

export interface AppSnapshot {
  version: 1
  session: SessionState
  children: ChildProfile[]
  courses: Course[]
  expenses: Expense[]
  goals: Goal[]
  scheduleExceptions: ScheduleException[]
}

export interface DayOccurrence {
  id: string
  date: string
  course: Course
  exception?: ScheduleException
}
