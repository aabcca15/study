import { STORAGE_KEY } from '@/domain/constants'
import type { AppSnapshot } from '@/domain/types'
import { createSeed } from './seed'
import { reconcileCoursesWithExceptions } from '@/services/courseSchedule'
import type { Course, CourseIcon } from '@/domain/types'

const LEGACY_COLORS: Record<string, string> = {
  '#c45c26': '#FFE2D6',
  '#3d6b5a': '#D9F1DF',
  '#3b5b8a': '#DDD8FF',
  '#8a4d6e': '#DCE8FA',
  '#b0892a': '#F1DDF4',
  '#cfc2ff': '#DDD8FF',
  '#ffd85c': '#FFF0C9',
  '#ff9998': '#FFE2D6',
  '#a9e6c7': '#D9F1DF',
  '#9fd9ff': '#DCE8FA',
  '#f8b8de': '#F1DDF4',
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
    const avatarColors = ['#7157D9', '#E7778A', '#3FAF8B']
    for (const [index, child] of parsed.children.entries()) {
      if (!child.avatarColor) {
        child.avatarColor = avatarColors[index % avatarColors.length]
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
