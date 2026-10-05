import cloud from 'wx-server-sdk'
import dayjs from 'dayjs'
import type { AppSnapshot, ChildAvatarKey, Expense, OccurrenceAttendance } from '../../../../../server/src/domain/types'
import { createEmptyFamilySnapshot } from '../../../../../server/src/workspace/empty-snapshot'
import { createFamilyWorkspace } from '../../../../../server/src/workspace/family-workspace'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = () => db.collection('users')
const families = () => db.collection('families')

class ActionError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

type FamilyDoc = {
  snapshotJson?: string
  version?: number
}

type UserDoc = {
  openid: string
  familyId: string
}

function fail(code: string, message: string) {
  return { ok: false as const, code, message }
}

function cloneSnapshot(snapshot: AppSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot
}

async function findUser(openid: string): Promise<UserDoc | null> {
  const found = await users().where({ openid }).limit(1).get()
  const user = found.data?.[0] as UserDoc | undefined
  if (!user?.familyId) return null
  return user
}

async function requireUser(openid: string) {
  const user = await findUser(openid)
  if (!user) throw new ActionError('UNAUTHENTICATED', '请先使用微信登录')
  return user
}

async function withFamily<T>(familyId: string, apply: (workspace: ReturnType<typeof createFamilyWorkspace>) => T | Promise<T>) {
  return db.runTransaction(async (transaction) => {
    const ref = transaction.collection('families').doc(familyId)
    const got = await ref.get()
    const raw = got.data as FamilyDoc | undefined
    if (!raw?.snapshotJson) throw new ActionError('FAMILY_MISMATCH', '家庭不存在或无权访问')

    const workspace = createFamilyWorkspace(JSON.parse(raw.snapshotJson) as AppSnapshot)
    const result = await apply(workspace)
    const nextJson = JSON.stringify(workspace.snapshot.value)
    if (nextJson !== raw.snapshotJson) {
      await ref.update({
        data: {
          snapshotJson: nextJson,
          version: (raw.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        },
      })
    }
    return {
      snapshot: JSON.parse(nextJson) as AppSnapshot,
      result: result ?? null,
    }
  })
}

function raiseObject(result: unknown) {
  if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== false) return result
  const reason = 'reason' in result ? String(result.reason) : ''
  if (reason === 'conflict') throw new ActionError('SCHEDULE_CONFLICT', '该孩子此时已有其他课程')
  if (reason === 'duplicate') throw new ActionError('OCCURRENCE_DUPLICATE', '所选日期都已有这门课')
  if (reason === 'invalid-amount') throw new ActionError('REFUND_EXCEEDS_PAYMENT', '退款金额应大于 0，且不超过剩余可退金额')
  if (reason === 'not-paid' || reason === 'payment-missing') throw new ActionError('REFUND_NOT_ALLOWED', '当前账单无法退款')
  throw new ActionError('INVALID_INPUT', '请完整填写后再保存')
}

function raiseCode(result: unknown, map: Record<string, [string, string]>) {
  if (typeof result === 'string' && map[result]) {
    const [code, message] = map[result]
    throw new ActionError(code, message)
  }
  return result
}

function billWindow(payload: Record<string, unknown>) {
  const from = typeof payload.from === 'string' ? payload.from : dayjs().startOf('month').format('YYYY-MM-DD')
  const to = typeof payload.to === 'string' ? payload.to : dayjs().endOf('month').format('YYYY-MM-DD')
  return { from, to }
}

function ensureRange(workspace: ReturnType<typeof createFamilyWorkspace>, from: string, to: string) {
  for (const course of workspace.snapshot.value.courses.filter((item) => !item.archived)) {
    const dates = course.recurrence.dates?.map((slot) => slot.date) ?? []
    if (dates.some((date) => date >= from && date <= to)) workspace.ensureCourseBilling(course)
  }
  workspace.ensureBillingForRange(from, to)
}

async function login(openid: string, unionid: string, payload: Record<string, unknown>) {
  const existing = await findUser(openid)
  if (existing) {
    const { from, to } = billWindow({})
    const data = await withFamily(existing.familyId, (workspace) => {
      ensureRange(workspace, from, to)
      return null
    })
    return { openid, familyId: existing.familyId, snapshot: data.snapshot }
  }

  const childName = String(payload.childName || '').trim().slice(0, 20)
  const snapshot = createEmptyFamilySnapshot(childName || '小树')
  const created = await families().add({
    data: {
      name: `${snapshot.children[0]?.name || '小树'}的家庭`,
      timezone: 'Asia/Shanghai',
      ownerOpenid: openid,
      snapshotJson: JSON.stringify(snapshot),
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
  const familyId = String(created._id || created.id || '')
  if (!familyId) throw new ActionError('CLOUD_ERROR', '创建家庭失败')
  await users().add({
    data: {
      openid,
      unionid,
      familyId,
      createdAt: new Date().toISOString(),
    },
  })
  return { openid, familyId, snapshot: cloneSnapshot(snapshot) }
}

async function dispatch(openid: string, action: string, payload: Record<string, unknown>) {
  const user = await requireUser(openid)
  const familyId = user.familyId

  switch (action) {
    case 'snapshot':
      return withFamily(familyId, (workspace) => {
        const { from, to } = billWindow(payload)
        ensureRange(workspace, from, to)
        return null
      })
    case 'addChild':
      return withFamily(familyId, (workspace) => {
        const id = workspace.addChild(String(payload.name || ''), payload.avatarKey as ChildAvatarKey | undefined)
        if (!id) throw new ActionError('INVALID_CHILD_NAME', '请先填写孩子名字')
        return id
      })
    case 'updateChild':
      return withFamily(familyId, (workspace) => {
        workspace.updateChild({
          id: String(payload.id || ''),
          name: typeof payload.name === 'string' ? payload.name : undefined,
          avatarKey: payload.avatarKey as ChildAvatarKey | undefined,
        })
        return null
      })
    case 'removeChild':
      return withFamily(familyId, (workspace) => raiseCode(workspace.removeChild(String(payload.id || '')), {
        'not-found': ['CHILD_NOT_FOUND', '该孩子已不存在'],
        'last-child': ['LAST_CHILD_NOT_DELETABLE', '至少需要保留一个孩子'],
      }))
    case 'selectChild':
      return withFamily(familyId, (workspace) => {
        const childId = String(payload.childId || '')
        if (!workspace.snapshot.value.children.some((item) => item.id === childId)) {
          throw new ActionError('CHILD_NOT_FOUND', '孩子不存在')
        }
        workspace.selectChild(childId)
        return childId
      })
    case 'saveCourse':
      return withFamily(familyId, (workspace) => {
        const course = payload.course as Parameters<ReturnType<typeof createFamilyWorkspace>['upsertCourse']>[0]
        if (!course?.title?.trim() || !course.recurrence?.dates?.length) {
          throw new ActionError('INVALID_INPUT', '请填写课程名称并至少选择一个上课日期')
        }
        const dates = course.recurrence.dates
        const [conflict] = workspace.findCourseScheduleConflicts(dates, course.id, course.childIds)
        if (conflict) throw new ActionError('SCHEDULE_CONFLICT', `与「${conflict.title}」时间重叠`)
        const id = workspace.upsertCourse(course)
        const paymentStatus = payload.paymentStatus === 'paid' ? 'paid' : 'unpaid'
        workspace.syncCourseUpfrontExpense(id, paymentStatus)
        workspace.clearScheduleExceptionsForCourse(id)
        return id
      })
    case 'archiveCourse':
      return withFamily(familyId, (workspace) => workspace.archiveCourse(String(payload.id || '')))
    case 'restoreCourse':
      return withFamily(familyId, (workspace) => workspace.restoreCourse(String(payload.id || '')))
    case 'removeCourse':
      return withFamily(familyId, (workspace) => raiseCode(workspace.removeCourse(String(payload.id || '')), {
        'not-found': ['COURSE_NOT_FOUND', '课程不存在'],
      }))
    case 'addOccurrences':
      return withFamily(familyId, (workspace) => raiseObject(
        workspace.addPresetOccurrence(String(payload.courseId || ''), payload.dates as string[]),
      ))
    case 'quickArrangement':
      return withFamily(familyId, (workspace) => raiseObject(workspace.createQuickArrangement({
        dates: payload.dates as string[] | undefined,
        date: typeof payload.date === 'string' ? payload.date : undefined,
        title: String(payload.title || ''),
        startTime: String(payload.startTime || ''),
        endTime: String(payload.endTime || ''),
        amount: Number(payload.amount) || 0,
        expenseStatus: payload.expenseStatus === 'paid' ? 'paid' : 'unpaid',
      })))
    case 'upsertException':
      return withFamily(familyId, (workspace) => workspace.upsertScheduleException(payload as never))
    case 'restoreOccurrence':
      return withFamily(familyId, (workspace) => workspace.restoreOccurrenceSlot(String(payload.courseId || ''), {
        date: String(payload.date || ''),
        startTime: String(payload.startTime || ''),
        endTime: String(payload.endTime || ''),
      }))
    case 'dropOccurrence':
      return withFamily(familyId, (workspace) => {
        workspace.dropOccurrenceSlot(String(payload.courseId || ''), String(payload.date || ''))
        return null
      })
    case 'attendance':
      return withFamily(familyId, (workspace) => workspace.setOccurrenceAttendance(
        String(payload.courseId || ''),
        String(payload.date || ''),
        payload.status as OccurrenceAttendance,
        {
          billable: Boolean(payload.billable),
          actualMinutes: payload.actualMinutes == null ? undefined : Number(payload.actualMinutes),
        },
      ))
    case 'occurrenceExpense':
      return withFamily(familyId, (workspace) => raiseCode(
        workspace.upsertOccurrenceExpense(String(payload.courseId || ''), String(payload.date || ''), {
          amount: Number(payload.amount) || 0,
          paid: Boolean(payload.paid),
        }),
        {
          'not-found': ['COURSE_NOT_FOUND', '课程不存在'],
          'paid-immutable': ['PAID_BILL_IMMUTABLE', '已支付账单不能改金额'],
        },
      ))
    case 'upsertExpense':
      return withFamily(familyId, (workspace) => workspace.upsertExpense(payload as Omit<Expense, 'id' | 'childId'> & { id?: string }))
    case 'generateBills':
      return withFamily(familyId, (workspace) => {
        const period = String(payload.period || '')
        if (!/^\d{4}-\d{2}$/.test(period)) throw new ActionError('INVALID_PERIOD', '账期格式应为 YYYY-MM')
        return workspace.generateBillingStatements(period)
      })
    case 'setExpenseStatus':
      return withFamily(familyId, (workspace) => raiseCode(
        workspace.setExpenseStatus(String(payload.id || ''), payload.status as Expense['status']),
        {
          'not-found': ['BILL_NOT_FOUND', '账单不存在'],
          'paid-immutable': ['PAID_BILL_IMMUTABLE', '已支付账单不能改回未支付'],
        },
      ))
    case 'refund':
      return withFamily(familyId, (workspace) => raiseObject(
        workspace.refundExpense(String(payload.id || ''), Number(payload.amount) || 0, String(payload.note || '')),
      ))
    case 'removeExpense':
      return withFamily(familyId, (workspace) => raiseCode(workspace.removeExpense(String(payload.id || '')), {
        'not-found': ['BILL_NOT_FOUND', '账单不存在'],
        'paid-immutable': ['PAID_BILL_IMMUTABLE', '已支付账单不能删除'],
      }))
    default:
      throw new ActionError('UNKNOWN_ACTION', '不支持的操作')
  }
}

export async function main(event: { action?: string; payload?: Record<string, unknown> }) {
  const context = cloud.getWXContext()
  const openid = context.OPENID || ''
  if (!openid) return fail('UNAUTHENTICATED', '请在微信内打开小程序')

  try {
    const action = event?.action || ''
    if (action === 'login') {
      const data = await login(openid, context.UNIONID || '', event.payload ?? {})
      return { ok: true as const, data }
    }
    const data = await dispatch(openid, action, event.payload ?? {})
    return { ok: true as const, data }
  } catch (error) {
    const code = error instanceof ActionError ? error.code : 'CLOUD_ERROR'
    const message = error instanceof Error ? error.message : '云函数执行失败'
    return fail(code, message)
  }
}
