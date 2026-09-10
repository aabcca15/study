import type {
  AppSnapshot,
  BillingMode,
  CourseIcon,
  CourseType,
  ExpenseCategory,
  ExpenseStatus,
} from './types'

export const STORAGE_KEY = 'myhome.v1'

export const COURSE_TYPE_LABEL: Record<CourseType, string> = {
  school: '学校课程',
  interest: '兴趣班',
  online: '在线课堂',
}

export const BILLING_MODE_LABEL: Record<BillingMode, string> = {
  monthly: '按月结算',
  session: '单次结算',
  term: '按期结算',
  free: '无需缴费',
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending: '待结算',
  unpaid: '未结算',
  paid: '已结算',
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  school: '学校课程',
  interest: '兴趣班',
  online: '在线课堂',
  material: '学习用品',
  other: '其他',
}

export const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六']

export const COURSE_COLORS = [
  '#DDD8FF',
  '#FFE2D6',
  '#D9F1DF',
  '#DCE8FA',
  '#F1DDF4',
  '#E7E9EF',
]

export const COURSE_ICON_COLORS: Record<CourseIcon, string> = {
  school: '#DDD8FF',
  sport: '#D9F1DF',
  math: '#FFE2D6',
  reading: '#F1DDF4',
  music: '#FFF0C9',
  swimming: '#D8EFF3',
  english: '#DCE8FA',
  calligraphy: '#FFE7B8',
  generic: '#E7E9EF',
}

export const COURSE_ICON_OPTIONS: Array<{ value: CourseIcon; label: string }> = [
  { value: 'school', label: '学校' },
  { value: 'sport', label: '运动' },
  { value: 'math', label: '数学' },
  { value: 'reading', label: '阅读' },
  { value: 'music', label: '音乐' },
  { value: 'swimming', label: '游泳' },
  { value: 'english', label: '英语' },
  { value: 'calligraphy', label: '书法' },
  { value: 'generic', label: '通用' },
]

export function emptySnapshot(): AppSnapshot {
  return {
    version: 1,
    session: { role: 'parent', childId: '' },
    children: [],
    courses: [],
    expenses: [],
    goals: [],
    scheduleExceptions: [],
  }
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
