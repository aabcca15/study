import cloud from 'wx-server-sdk'
import type { AppSnapshot, ChildAvatarKey } from '../../../../../server/src/domain/types'
import { createEmptyFamilySnapshot } from '../../../../../server/src/workspace/empty-snapshot'
import { applyFamilyAction, FamilyActionError } from '../../../../../server/src/workspace/family-actions'
import { createFamilyWorkspace } from '../../../../../server/src/workspace/family-workspace'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = () => db.collection('users')
const families = () => db.collection('families')

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
  if (!user) throw new FamilyActionError('UNAUTHENTICATED', '请先使用微信登录')
  return user
}

async function withFamily<T>(familyId: string, apply: (workspace: ReturnType<typeof createFamilyWorkspace>) => T | Promise<T>) {
  return db.runTransaction(async (transaction) => {
    const ref = transaction.collection('families').doc(familyId)
    const got = await ref.get()
    const raw = got.data as FamilyDoc | undefined
    if (!raw?.snapshotJson) throw new FamilyActionError('FAMILY_MISMATCH', '家庭不存在或无权访问')

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

async function login(openid: string, unionid: string, payload: Record<string, unknown>) {
  const existing = await findUser(openid)
  if (existing) {
    const data = await withFamily(existing.familyId, (workspace) => {
      applyFamilyAction(workspace, 'snapshot', {})
      return null
    })
    return { openid, familyId: existing.familyId, snapshot: data.snapshot }
  }

  const childName = String(payload.childName || '').trim().slice(0, 20) || '小U'
  const avatarKey = typeof payload.avatarKey === 'string' ? payload.avatarKey as ChildAvatarKey : undefined
  const snapshot = createEmptyFamilySnapshot(childName, avatarKey)
  const created = await families().add({
    data: {
      name: `${snapshot.children[0]?.name || '小U'}的家庭`,
      timezone: 'Asia/Shanghai',
      ownerOpenid: openid,
      snapshotJson: JSON.stringify(snapshot),
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
  const familyId = String(created._id || created.id || '')
  if (!familyId) throw new FamilyActionError('CLOUD_ERROR', '创建家庭失败')
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
  return withFamily(user.familyId, (workspace) => applyFamilyAction(workspace, action, payload))
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
    const code = error instanceof FamilyActionError ? error.code : 'CLOUD_ERROR'
    const message = error instanceof Error ? error.message : '云函数执行失败'
    return fail(code, message)
  }
}
