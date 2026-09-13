import type {
  AppSnapshot,
  BillingMode,
  ChildAvatarKey,
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

// 课程主色使用饱和品牌色，界面按需派生浅色底与渐变。
export const COURSE_COLORS = [
  '#7B61FF',
  '#FF6B8A',
  '#26C281',
  '#3E9BFF',
  '#C265F0',
  '#FF9A3D',
  '#22C4CC',
  '#7C8AA5',
]

export const COURSE_ICON_COLORS: Record<CourseIcon, string> = {
  school: '#7B61FF',
  sport: '#26C281',
  math: '#FF9A3D',
  reading: '#FF6B8A',
  music: '#C265F0',
  swimming: '#22C4CC',
  english: '#3E9BFF',
  calligraphy: '#F0A92B',
  generic: '#7C8AA5',
}

export const CHILD_AVATAR_OPTIONS: Array<{
  key: ChildAvatarKey
  label: string
  color: string
}> = [
  { key: 'boy-blue', label: '蓝衣男孩', color: '#5B8DEF' },
  { key: 'boy-cap', label: '白帽男孩', color: '#6EA0F0' },
  { key: 'girl-flower', label: '粉衣女孩', color: '#FF8AAE' },
  { key: 'girl-bow', label: '紫衣女孩', color: '#B388FF' },
]

export const DEFAULT_CHILD_AVATAR = CHILD_AVATAR_OPTIONS[0]

export function childAvatarOption(key?: ChildAvatarKey) {
  return CHILD_AVATAR_OPTIONS.find((item) => item.key === key) ?? DEFAULT_CHILD_AVATAR
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
