import dayjs from 'dayjs'
import type { Course, DayOccurrence, ScheduleException } from '@/domain/types'

export function occurrencesInRange(
  courses: Course[],
  start: string,
  end: string,
  exceptions: ScheduleException[] = [],
): DayOccurrence[] {
  const startDay = dayjs(start).startOf('day')
  const endDay = dayjs(end).endOf('day')
  const list: DayOccurrence[] = []

  function addOccurrence(course: Course, date: string, startTime: string, endTime: string) {
    const exception = exceptions.find((item) => item.courseId === course.id && item.date === date)
    if (exception?.status === 'cancelled') return
    const effectiveCourse = {
      ...course,
      title: exception?.title ?? course.title,
      location: exception?.location ?? course.location,
      note: exception?.note ?? course.note,
      recurrence: {
        ...course.recurrence,
        startTime: exception?.startTime ?? startTime,
        endTime: exception?.endTime ?? endTime,
      },
    }
    list.push({
      id: `${course.id}_${date}`,
      date,
      course: effectiveCourse,
      exception,
    })
  }

  for (const course of courses) {
    if (course.archived) continue
    if (course.recurrence.freq === 'dates') {
      for (const slot of course.recurrence.dates ?? []) {
        const slotDate = dayjs(slot.date)
        if (slotDate.isBefore(startDay, 'day') || slotDate.isAfter(endDay, 'day')) continue
        addOccurrence(course, slot.date, slot.startTime, slot.endTime)
      }
      continue
    }
    const recStart = dayjs(course.recurrence.startDate)
    const recEnd = course.recurrence.endDate ? dayjs(course.recurrence.endDate) : null
    let cursor = startDay.isAfter(recStart) ? startDay : recStart

    while (!cursor.isAfter(endDay)) {
      const inWindow = !recEnd || !cursor.isAfter(recEnd)
      const weekdayMatch =
        course.recurrence.freq === 'once'
          ? cursor.isSame(recStart, 'day')
          : course.recurrence.byWeekday.includes(cursor.day())

      if (inWindow && weekdayMatch) {
        const date = cursor.format('YYYY-MM-DD')
        addOccurrence(
          course,
          date,
          course.recurrence.startTime,
          course.recurrence.endTime,
        )
      }
      cursor = cursor.add(1, 'day')
    }
  }

  for (const exception of exceptions) {
    if (exception.status !== 'added') continue
    const date = dayjs(exception.date)
    if (date.isBefore(startDay, 'day') || date.isAfter(endDay, 'day')) continue
    if (list.some((item) => item.id === `${exception.courseId}_${exception.date}`)) continue
    const course = courses.find((item) => item.id === exception.courseId)
    if (!course || course.archived) continue
    list.push({
      id: `${course.id}_${exception.date}`,
      date: exception.date,
      exception,
      course: {
        ...course,
        title: exception.title ?? course.title,
        location: exception.location ?? course.location,
        note: exception.note ?? course.note,
        recurrence: {
          ...course.recurrence,
          startTime: exception.startTime ?? course.recurrence.startTime,
          endTime: exception.endTime ?? course.recurrence.endTime,
        },
      },
    })
  }

  return list.sort((a, b) => {
    const t = a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)
    if (t !== 0) return t
    return a.course.title.localeCompare(b.course.title, 'zh-CN')
  })
}

export function occurrencesOnDate(
  courses: Course[],
  date: string,
  exceptions: ScheduleException[] = [],
) {
  return occurrencesInRange(courses, date, date, exceptions)
}
