import cloud from 'wx-server-sdk'
import type { AppSnapshot, ChildAvatarKey } from '../../../../../server/src/domain/types'
import { createEmptyFamilySnapshot } from '../../../../../server/src/workspace/empty-snapshot'
import { applyFamilyAction, FamilyActionError } from '../../../../../server/src/workspace/family-actions'
import { createFamilyWorkspace } from '../../../../../server/src/workspace/family-workspace'
import {
  canInviteRole,
  canRemoveMember,
  canWriteFamily,
  createInviteCode,
  defaultDisplayName,
  INVITE_MAX_USES,
  inviteExpiresAt,
  isInviteActive,
  isWorkspaceReadAction,
  maskSnapshotForRole,
  normalizeInviteCode,
  normalizeInviteRole,
  normalizeRole,
  toInviteView,
  type FamilyInviteRecord,
  type FamilyInviteView,
  type FamilyMemberRecord,
  type FamilyMemberView,
  type FamilyRole,
} from '../../../src/domain/family-account'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = () => db.collection('users')
const families = () => db.collection('families')
const invites = () => db.collection('invites')
const command = db.command

type FamilyDoc = {
  snapshotJson?: string
  version?: number
  ownerOpenid?: string
}

type UserDoc = FamilyMemberRecord & {
  _id?: string
  unionid?: string
}

function fail(code: string, message: string) {
  return { ok: false as const, code, message }
}

function cloneSnapshot(snapshot: AppSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot
}

function raise(code: string, message: string): never {
  throw new FamilyActionError(code, message)
}

function displayNameOf(payload: Record<string, unknown>, role: FamilyRole) {
  const name = String(payload.displayName || '').trim().slice(0, 16)
  return name || defaultDisplayName(role)
}

async function findUser(openid: string): Promise<UserDoc | null> {
  const found = await users().where({ openid }).limit(1).get()
  const user = found.data?.[0] as UserDoc | undefined
  if (!user?.familyId) return null
  return {
    ...user,
    _id: user._id ? String(user._id) : undefined,
    role: normalizeRole(user.role),
    displayName: user.displayName || defaultDisplayName(normalizeRole(user.role)),
  }
}

async function requireUser(openid: string) {
  const user = await findUser(openid)
  if (!user) raise('UNAUTHENTICATED', '请先使用微信登录')
  return user
}

async function loadFamilyDoc(familyId: string) {
  const got = await families().doc(familyId).get()
  const raw = got.data as FamilyDoc | undefined
  if (!raw?.snapshotJson) raise('FAMILY_MISMATCH', '家庭不存在或无权访问')
  return raw
}

async function loadSnapshot(familyId: string) {
  return JSON.parse((await loadFamilyDoc(familyId)).snapshotJson as string) as AppSnapshot
}

function sessionOf(user: UserDoc, snapshot: AppSnapshot) {
  const role = normalizeRole(user.role)
  return {
    openid: user.openid,
    familyId: user.familyId,
    role,
    displayName: user.displayName || defaultDisplayName(role),
    snapshot: maskSnapshotForRole(cloneSnapshot(snapshot), role),
  }
}

async function withFamily<T>(familyId: string, apply: (workspace: ReturnType<typeof createFamilyWorkspace>) => T | Promise<T>) {
  return db.runTransaction(async (transaction) => {
    const ref = transaction.collection('families').doc(familyId)
    const got = await ref.get()
    const raw = got.data as FamilyDoc | undefined
    if (!raw?.snapshotJson) raise('FAMILY_MISMATCH', '家庭不存在或无权访问')

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

async function countFamilyMembers(familyId: string) {
  const counted = await users().where({ familyId }).count()
  return counted.total || 0
}

async function listFamilyUsers(familyId: string) {
  const found = await users().where({ familyId }).limit(50).get()
  return (found.data || []) as UserDoc[]
}

async function persistUserRole(user: UserDoc, role: FamilyRole, displayName: string) {
  if (!user._id) return
  if (user.role === role && user.displayName === displayName) return
  await users().doc(user._id).update({
    data: { role, displayName },
  })
  user.role = role
  user.displayName = displayName
}

async function login(openid: string, unionid: string, payload: Record<string, unknown>) {
  const existing = await findUser(openid)
  if (existing) {
    const family = await loadFamilyDoc(existing.familyId)
    const role = normalizeRole(existing.role, family.ownerOpenid === openid)
    const displayName = existing.displayName || defaultDisplayName(role)
    await persistUserRole(existing, role, displayName)
    if (canWriteFamily(role)) {
      const data = await withFamily(existing.familyId, (workspace) => {
        applyFamilyAction(workspace, 'snapshot', {})
        return null
      })
      return sessionOf({ ...existing, role, displayName }, data.snapshot)
    }
    return sessionOf({ ...existing, role, displayName }, JSON.parse(family.snapshotJson as string) as AppSnapshot)
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
  if (!familyId) raise('CLOUD_ERROR', '创建家庭失败')
  const displayName = displayNameOf(payload, 'owner')
  await users().add({
    data: {
      openid,
      unionid,
      familyId,
      role: 'owner',
      displayName,
      createdAt: new Date().toISOString(),
    },
  })
  return sessionOf({
    openid,
    familyId,
    role: 'owner',
    displayName,
    createdAt: new Date().toISOString(),
  }, snapshot)
}

async function findInvite(code: string): Promise<FamilyInviteRecord | null> {
  const normalized = normalizeInviteCode(code)
  if (!normalized) return null
  try {
    const got = await invites().doc(normalized).get()
    const invite = got.data as FamilyInviteRecord | undefined
    if (!invite?.familyId || !invite.code) return null
    return invite
  } catch {
    return null
  }
}

async function createInvite(user: UserDoc, payload: Record<string, unknown>) {
  const role = normalizeInviteRole(payload.role)
  if (!canInviteRole(user.role, role)) raise('INVITE_FORBIDDEN', '没有邀请这个角色的权限')
  let code = createInviteCode()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const exists = await findInvite(code)
    if (!exists) break
    code = createInviteCode()
  }
  const record: FamilyInviteRecord = {
    code,
    familyId: user.familyId,
    createdBy: user.openid,
    role,
    expireAt: inviteExpiresAt(),
    maxUses: INVITE_MAX_USES,
    usedCount: 0,
    createdAt: new Date().toISOString(),
  }
  await invites().doc(code).set({
    data: record,
  })
  return toInviteView(record)
}

async function listFamilyInvites(familyId: string): Promise<FamilyInviteView[]> {
  const found = await invites().where({ familyId }).limit(50).get()
  const now = Date.now()
  return ((found.data || []) as FamilyInviteRecord[])
    .map((invite) => toInviteView(invite, now))
    .filter((invite) => !invite.expired)
    .sort((left, right) => left.expireAt.localeCompare(right.expireAt))
}

function toMemberViews(records: UserDoc[], openid: string): FamilyMemberView[] {
  const rank: Record<FamilyRole, number> = { owner: 0, parent: 1, viewer: 2 }
  return records
    .map((item) => {
      const role = normalizeRole(item.role)
      return {
        openid: item.openid,
        role,
        displayName: item.displayName || defaultDisplayName(role),
        self: item.openid === openid,
        createdAt: item.createdAt || '',
      }
    })
    .sort((left, right) => rank[left.role] - rank[right.role] || left.displayName.localeCompare(right.displayName, 'zh'))
}

async function listMembers(user: UserDoc) {
  const [members, inviteViews] = await Promise.all([
    listFamilyUsers(user.familyId),
    listFamilyInvites(user.familyId),
  ])
  return {
    members: toMemberViews(members, user.openid),
    invites: inviteViews,
  }
}

async function removeMember(actor: UserDoc, payload: Record<string, unknown>) {
  const targetOpenid = String(payload.openid || '')
  if (!targetOpenid) raise('INVALID_INPUT', '请选择要移除的成员')
  const members = await listFamilyUsers(actor.familyId)
  const target = members.find((item) => item.openid === targetOpenid)
  if (!target) raise('MEMBER_NOT_FOUND', '该成员已不在家庭中')
  const targetRole = normalizeRole(target.role)
  if (!canRemoveMember(actor.role, targetRole, target.openid === actor.openid)) {
    if (target.openid === actor.openid) raise('CANNOT_REMOVE_SELF', '不能移除自己')
    if (targetRole === 'owner') raise('CANNOT_REMOVE_OWNER', '不能移除创建者')
    raise('MEMBER_REMOVE_FORBIDDEN', '只有创建者可以移除成员')
  }
  if (target._id) await users().doc(String(target._id)).remove()
  return null
}

async function joinFamily(openid: string, unionid: string, payload: Record<string, unknown>) {
  const code = normalizeInviteCode(String(payload.code || ''))
  const invite = await findInvite(code)
  if (!invite) raise('INVITE_INVALID', '邀请码无效或已失效')
  if (!isInviteActive(invite)) {
    if (Date.parse(invite.expireAt) <= Date.now()) raise('INVITE_EXPIRED', '邀请已过期，请让家长重新生成')
    raise('INVITE_USED_UP', '邀请已用完，请让家长重新生成')
  }

  const existing = await findUser(openid)
  if (existing?.familyId === invite.familyId) {
    const snapshot = await loadSnapshot(existing.familyId)
    return sessionOf(existing, snapshot)
  }
  if (existing && existing.role === 'owner' && await countFamilyMembers(existing.familyId) > 1) {
    raise('OWNER_HAS_MEMBERS', '请先让其他成员退出后再加入别的家庭')
  }

  const role = normalizeInviteRole(invite.role)
  const displayName = displayNameOf(payload, role)
  const now = new Date().toISOString()
  if (existing?._id) {
    await users().doc(existing._id).update({
      data: {
        familyId: invite.familyId,
        role,
        displayName,
      },
    })
  } else {
    await users().add({
      data: {
        openid,
        unionid,
        familyId: invite.familyId,
        role,
        displayName,
        createdAt: now,
      },
    })
  }
  await invites().doc(invite.code).update({
    data: {
      usedCount: command.inc(1),
    },
  })
  const snapshot = await loadSnapshot(invite.familyId)
  return sessionOf({
    openid,
    familyId: invite.familyId,
    role,
    displayName,
    createdAt: existing?.createdAt || now,
  }, snapshot)
}

async function dispatchWorkspace(user: UserDoc, action: string, payload: Record<string, unknown>) {
  if (!canWriteFamily(user.role) && !isWorkspaceReadAction(action)) {
    raise('SCOPE_FORBIDDEN', '家人只能查看课表和地点')
  }
  if (!canWriteFamily(user.role) && action === 'snapshot') {
    return {
      snapshot: maskSnapshotForRole(await loadSnapshot(user.familyId), user.role),
      result: null,
    }
  }
  const data = await withFamily(user.familyId, (workspace) => applyFamilyAction(workspace, action, payload))
  return {
    snapshot: maskSnapshotForRole(data.snapshot, user.role),
    result: data.result,
  }
}

async function dispatchAccount(user: UserDoc, action: string, payload: Record<string, unknown>) {
  if (action === 'createInvite') {
    const result = await createInvite(user, payload)
    return { snapshot: maskSnapshotForRole(await loadSnapshot(user.familyId), user.role), result }
  }
  if (action === 'listMembers') {
    const result = await listMembers(user)
    return { snapshot: maskSnapshotForRole(await loadSnapshot(user.familyId), user.role), result }
  }
  if (action === 'removeMember') {
    await removeMember(user, payload)
    return { snapshot: maskSnapshotForRole(await loadSnapshot(user.familyId), user.role), result: null }
  }
  raise('INVALID_ACTION', '不支持的操作')
}

export async function main(event: { action?: string; payload?: Record<string, unknown> }) {
  const context = cloud.getWXContext()
  const openid = context.OPENID || ''
  if (!openid) return fail('UNAUTHENTICATED', '请在微信内打开小程序')

  try {
    const action = event?.action || ''
    const payload = event.payload ?? {}
    if (action === 'login') {
      return { ok: true as const, data: await login(openid, context.UNIONID || '', payload) }
    }
    if (action === 'joinFamily') {
      return { ok: true as const, data: await joinFamily(openid, context.UNIONID || '', payload) }
    }
    if (action === 'devSetRole') raise('INVALID_ACTION', '正式环境不能切换角色')
    const user = await requireUser(openid)
    if (action === 'createInvite' || action === 'listMembers' || action === 'removeMember') {
      return { ok: true as const, data: await dispatchAccount(user, action, payload) }
    }
    return { ok: true as const, data: await dispatchWorkspace(user, action, payload) }
  } catch (error) {
    const code = error instanceof FamilyActionError ? error.code : 'CLOUD_ERROR'
    const message = error instanceof Error ? error.message : '云函数执行失败'
    return fail(code, message)
  }
}
