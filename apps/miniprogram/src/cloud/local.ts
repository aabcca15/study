import type { AppSnapshot, ChildAvatarKey } from '@server-domain/types'
import { createEmptyFamilySnapshot } from '../../../../server/src/workspace/empty-snapshot'
import { applyFamilyAction, FamilyActionError } from '../../../../server/src/workspace/family-actions'
import { createFamilyWorkspace } from '../../../../server/src/workspace/family-workspace'
import {
  canInviteRole,
  canRemoveMember,
  canWriteFamily,
  createInviteCode,
  defaultDisplayName,
  INVITE_MAX_USES,
  inviteExpiresAt,
  isAccountAction,
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
} from '@/domain/family-account'

export const DEV_SNAPSHOT_KEY = 'myhome.mp.dev.snapshot'
const DEV_ACCOUNT_KEY = 'myhome.mp.dev.account'
const DEV_OPENID = 'dev-tourist'
const DEV_FAMILY_ID = 'dev-family'

type StoredAccount = {
  users: FamilyMemberRecord[]
  invites: FamilyInviteRecord[]
}

function raise(code: string, message: string): never {
  throw new FamilyActionError(code, message)
}

export function hasDevSession() {
  return Boolean(uni.getStorageSync(DEV_SNAPSHOT_KEY))
}

export function clearDevSession() {
  uni.removeStorageSync(DEV_SNAPSHOT_KEY)
  uni.removeStorageSync(DEV_ACCOUNT_KEY)
}

function readSnapshot() {
  const raw = uni.getStorageSync(DEV_SNAPSHOT_KEY)
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as AppSnapshot
  } catch {
    return null
  }
}

function writeSnapshot(snapshot: AppSnapshot) {
  uni.setStorageSync(DEV_SNAPSHOT_KEY, JSON.stringify(snapshot))
}

function emptyAccount(): StoredAccount {
  return { users: [], invites: [] }
}

function readAccount(): StoredAccount {
  const raw = uni.getStorageSync(DEV_ACCOUNT_KEY)
  if (!raw || typeof raw !== 'string') return emptyAccount()
  try {
    const parsed = JSON.parse(raw) as StoredAccount
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
    }
  } catch {
    return emptyAccount()
  }
}

function writeAccount(account: StoredAccount) {
  uni.setStorageSync(DEV_ACCOUNT_KEY, JSON.stringify(account))
}

function childNameOf(payload: Record<string, unknown>) {
  return String(payload.childName || '').trim().slice(0, 20) || '小U'
}

function displayNameOf(payload: Record<string, unknown>, role: FamilyRole) {
  const name = String(payload.displayName || '').trim().slice(0, 16)
  return name || defaultDisplayName(role)
}

function currentUser(account = readAccount()) {
  return account.users.find((item) => item.openid === DEV_OPENID) || null
}

function requireUser() {
  const user = currentUser()
  if (!user) raise('UNAUTHENTICATED', '请先进入')
  return { account: readAccount(), user }
}

function requireSnapshot() {
  const snapshot = readSnapshot()
  if (!snapshot) raise('UNAUTHENTICATED', '请先进入')
  return snapshot
}

function sessionOf(user: FamilyMemberRecord, snapshot: AppSnapshot) {
  const role = normalizeRole(user.role)
  return {
    openid: user.openid,
    familyId: user.familyId,
    role,
    displayName: user.displayName || defaultDisplayName(role),
    snapshot: maskSnapshotForRole(JSON.parse(JSON.stringify(snapshot)) as AppSnapshot, role),
  }
}

function ensureOwner(snapshot: AppSnapshot, payload: Record<string, unknown>) {
  const account = readAccount()
  let user = currentUser(account)
  if (!user) {
    user = {
      openid: DEV_OPENID,
      familyId: DEV_FAMILY_ID,
      role: 'owner',
      displayName: displayNameOf(payload, 'owner'),
      createdAt: new Date().toISOString(),
    }
    account.users.push(user)
    writeAccount(account)
  }
  return sessionOf(user, snapshot)
}

function toMemberViews(users: FamilyMemberRecord[], openid: string): FamilyMemberView[] {
  const rank: Record<FamilyRole, number> = { owner: 0, parent: 1, viewer: 2 }
  return users
    .filter((item) => item.familyId === DEV_FAMILY_ID)
    .map((item) => {
      const role = normalizeRole(item.role)
      return {
        openid: item.openid,
        role,
        displayName: item.displayName || defaultDisplayName(role),
        self: item.openid === openid,
        createdAt: item.createdAt,
      }
    })
    .sort((left, right) => rank[left.role] - rank[right.role] || left.displayName.localeCompare(right.displayName, 'zh'))
}

function activeInvites(account: StoredAccount): FamilyInviteView[] {
  const now = Date.now()
  return account.invites
    .filter((invite) => invite.familyId === DEV_FAMILY_ID)
    .map((invite) => toInviteView(invite, now))
    .filter((invite) => !invite.expired)
    .sort((left, right) => left.expireAt.localeCompare(right.expireAt))
}

function applyWorkspace(action: string, payload: Record<string, unknown>, role: FamilyRole) {
  const current = requireSnapshot()
  if (!canWriteFamily(role) && !isWorkspaceReadAction(action)) {
    raise('SCOPE_FORBIDDEN', '家人只能查看课表和地点')
  }
  if (!canWriteFamily(role) && action === 'snapshot') {
    return { snapshot: maskSnapshotForRole(current, role), result: null }
  }
  const workspace = createFamilyWorkspace(current)
  const result = applyFamilyAction(workspace, action, payload)
  const snapshot = JSON.parse(JSON.stringify(workspace.snapshot.value)) as AppSnapshot
  writeSnapshot(snapshot)
  return { snapshot: maskSnapshotForRole(snapshot, role), result: result ?? null }
}

function createInvite(payload: Record<string, unknown>) {
  const { account, user } = requireUser()
  const role = normalizeInviteRole(payload.role)
  if (!canInviteRole(user.role, role)) raise('INVITE_FORBIDDEN', '没有邀请这个角色的权限')
  let code = createInviteCode()
  while (account.invites.some((item) => item.code === code)) code = createInviteCode()
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
  account.invites.push(record)
  writeAccount(account)
  return { snapshot: maskSnapshotForRole(requireSnapshot(), user.role), result: toInviteView(record) }
}

function listMembers() {
  const { account, user } = requireUser()
  return {
    snapshot: maskSnapshotForRole(requireSnapshot(), user.role),
    result: {
      members: toMemberViews(account.users, user.openid),
      invites: activeInvites(account),
    },
  }
}

function removeMember(payload: Record<string, unknown>) {
  const { account, user } = requireUser()
  const targetOpenid = String(payload.openid || '')
  const target = account.users.find((item) => item.openid === targetOpenid && item.familyId === user.familyId)
  if (!target) raise('MEMBER_NOT_FOUND', '该成员已不在家庭中')
  if (!canRemoveMember(user.role, normalizeRole(target.role), target.openid === user.openid)) {
    if (target.openid === user.openid) raise('CANNOT_REMOVE_SELF', '不能移除自己')
    if (target.role === 'owner') raise('CANNOT_REMOVE_OWNER', '不能移除创建者')
    raise('MEMBER_REMOVE_FORBIDDEN', '只有创建者可以移除成员')
  }
  account.users = account.users.filter((item) => item.openid !== targetOpenid)
  writeAccount(account)
  return { snapshot: maskSnapshotForRole(requireSnapshot(), user.role), result: null }
}

function joinFamily(payload: Record<string, unknown>) {
  const code = normalizeInviteCode(String(payload.code || ''))
  const account = readAccount()
  const invite = account.invites.find((item) => item.code === code)
  if (!invite) raise('INVITE_INVALID', '邀请码无效或已失效')
  if (!isInviteActive(invite)) {
    if (Date.parse(invite.expireAt) <= Date.now()) raise('INVITE_EXPIRED', '邀请已过期，请让家长重新生成')
    raise('INVITE_USED_UP', '邀请已用完，请让家长重新生成')
  }
  const snapshot = requireSnapshot()
  let user = currentUser(account)
  const role = normalizeInviteRole(invite.role)
  const displayName = displayNameOf(payload, role)
  if (user?.familyId === invite.familyId) {
    user.role = role
    user.displayName = displayName
    invite.usedCount += 1
    writeAccount(account)
    return sessionOf(user, snapshot)
  }
  if (user?.role === 'owner' && account.users.filter((item) => item.familyId === user.familyId).length > 1) {
    raise('OWNER_HAS_MEMBERS', '请先让其他成员退出后再加入别的家庭')
  }
  if (user) {
    user.familyId = invite.familyId
    user.role = role
    user.displayName = displayName
  } else {
    user = {
      openid: DEV_OPENID,
      familyId: invite.familyId,
      role,
      displayName,
      createdAt: new Date().toISOString(),
    }
    account.users.push(user)
  }
  invite.usedCount += 1
  writeAccount(account)
  return sessionOf(user, snapshot)
}

function devSetRole(payload: Record<string, unknown>) {
  const { account, user } = requireUser()
  const role = normalizeRole(String(payload.role || ''), payload.role === 'owner')
  user.role = role
  if (!user.displayName) user.displayName = defaultDisplayName(role)
  writeAccount(account)
  return {
    snapshot: maskSnapshotForRole(requireSnapshot(), role),
    result: { role, displayName: user.displayName },
  }
}

export function callLocal<T>(action: string, payload: Record<string, unknown> = {}): T {
  if (action === 'login') {
    let snapshot = readSnapshot()
    if (!snapshot) {
      const avatarKey = typeof payload.avatarKey === 'string' ? payload.avatarKey as ChildAvatarKey : undefined
      snapshot = createEmptyFamilySnapshot(childNameOf(payload), avatarKey)
      writeSnapshot(snapshot)
    }
    return ensureOwner(snapshot, payload) as T
  }
  if (action === 'joinFamily') return joinFamily(payload) as T
  if (action === 'createInvite') return createInvite(payload) as T
  if (action === 'listMembers') return listMembers() as T
  if (action === 'removeMember') return removeMember(payload) as T
  if (action === 'devSetRole') return devSetRole(payload) as T
  if (isAccountAction(action)) raise('INVALID_ACTION', '不支持的操作')

  const user = currentUser()
  if (!user) raise('UNAUTHENTICATED', '请先进入')
  return applyWorkspace(action, payload, normalizeRole(user.role)) as T
}
