import { CHILD_AVATAR_OPTIONS, STORAGE_KEY } from '@/domain/constants'
import type { AppSnapshot } from '@/domain/types'
import { createSeed } from './seed'
import { reconcileCoursesWithExceptions } from '@/services/courseSchedule'
import type { Course, CourseIcon } from '@/domain/types'

const LEGACY_COLORS: Record<string, string> = {
  '#c45c26': '#FF9A3D',
  '#3d6b5a': '#26C281',
  '#3b5b8a': '#7B61FF',
  '#8a4d6e': '#3E9BFF',
  '#b0892a': '#C265F0',
  '#cfc2ff': '#7B61FF',
  '#ffd85c': '#F0A92B',
  '#ff9998': '#FF6B8A',
  '#a9e6c7': '#26C281',
  '#9fd9ff': '#3E9BFF',
  '#f8b8de': '#C265F0',
  // 迁移上一版的浅色课程主色到新的饱和品牌色
  '#ddd8ff': '#7B61FF',
  '#ffe2d6': '#FF9A3D',
  '#d9f1df': '#26C281',
  '#dce8fa': '#3E9BFF',
  '#f1ddf4': '#C265F0',
  '#fff0c9': '#F0A92B',
  '#d8eff3': '#22C4CC',
  '#ffe7b8': '#F0A92B',
  '#e7e9ef': '#7C8AA5',
}

function inferCourseIcon(course: Course): CourseIcon {
  const text = `${course.title}${course.note}`.toLowerCase()
  if (/篮球|足球|运动|体能|羽毛球|乒乓|网球/.test(text)) return 'sport'
  if (/数学|奥数|思维|计算/.test(text)) return 'math'
  if (/语文|阅读|文学|写作/.test(text)) return 'reading'
  if (/音乐|钢琴|声乐|乐器|吉他/.test(text)) return 'music'
  if (/游泳|泳/.test(text)) return 'swimming'
  if (/英语|英文|外教|口语|english/.test(text)) return 'english'
  if (/书法|毛笔|硬笔/.test(text)) return 'calligraphy'
  if (course.type === 'school') return 'school'
  return 'generic'
}

export function loadSnapshot(): AppSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seed = createSeed()
    saveSnapshot(seed)
    return seed
  }
  try {
    const parsed = JSON.parse(raw) as AppSnapshot
    if (parsed.version !== 1) {
      const seed = createSeed()
      saveSnapshot(seed)
      return seed
    }
    let changed = false
    if (parsed.session.role !== 'parent' && parsed.session.role !== 'child') {
      parsed.session.role = 'parent'
      changed = true
    }
    const avatarColors = ['#5B8DEF', '#6EA0F0', '#FF8AAE', '#B388FF']
    for (const [index, child] of parsed.children.entries()) {
      const option = CHILD_AVATAR_OPTIONS[index % CHILD_AVATAR_OPTIONS.length]
      if (!child.avatarKey) {
        child.avatarKey = option.key
        changed = true
      }
      if (!child.avatarColor) {
        child.avatarColor = CHILD_AVATAR_OPTIONS.find((item) => item.key === child.avatarKey)?.color
          ?? avatarColors[index % avatarColors.length]
        changed = true
      }
    }
    if (!Array.isArray(parsed.scheduleExceptions)) {
      parsed.scheduleExceptions = []
      changed = true
    }
    for (const course of parsed.courses) {
      if (!Array.isArray(course.childIds) || !course.childIds.length) {
        course.childIds = [course.childId]
        changed = true
      }
      if (!course.icon) {
        course.icon = inferCourseIcon(course)
        changed = true
      }
      const migratedColor = LEGACY_COLORS[course.color.toLowerCase()]
      if (migratedColor) {
        course.color = migratedColor
        changed = true
      }
    }
    for (const child of parsed.children) {
      if (child.name === '小满' || child.name === 'xx同学') {
        child.name = 'Uday'
        child.avatarLabel = 'Ud'
        changed = true
      }
    }
    if (reconcileCoursesWithExceptions(parsed.courses, parsed.scheduleExceptions)) {
      changed = true
    }
    if (changed) saveSnapshot(parsed)
    return parsed
  } catch {
    const seed = createSeed()
    saveSnapshot(seed)
    return seed
  }
}

export function saveSnapshot(snapshot: AppSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function resetSnapshot() {
  const seed = createSeed()
  saveSnapshot(seed)
  return seed
}
