import type { AppSnapshot } from '@server-domain/types'

export type FamilyRole = 'owner' | 'parent' | 'viewer'
export type InviteRole = 'parent' | 'viewer'

export interface FamilyMemberRecord {
  openid: string
  familyId: string
  role: FamilyRole
  displayName: string
  createdAt: string
}

export interface FamilyInviteRecord {
  code: string
  familyId: string
  createdBy: string
  role: InviteRole
  expireAt: string
  maxUses: number
  usedCount: number
  createdAt: string
}

export interface FamilyMemberView {
  openid: string
  role: FamilyRole
  displayName: string
  self: boolean
  createdAt: string
}

export interface FamilyInviteView {
  code: string
  role: InviteRole
  expireAt: string
  maxUses: number
  usedCount: number
  expired: boolean
}

export const FAMILY_ROLE_LABEL: Record<FamilyRole, string> = {
  owner: '创建者',
  parent: '家长',
  viewer: '家人',
}

export const INVITE_ROLE_HINT: Record<InviteRole, string> = {
  parent: '可编辑课表、账单共同管理',
  viewer: '只可查看课表信息 方便接送',
}

export const INVITE_MAX_USES = 10
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const WORKSPACE_READ_ACTIONS = new Set(['snapshot'])

export function isWorkspaceReadAction(action: string) {
  return WORKSPACE_READ_ACTIONS.has(action)
}

export function canWriteFamily(role: FamilyRole) {
  return role === 'owner' || role === 'parent'
}

export function canViewBills(role: FamilyRole) {
  return role === 'owner' || role === 'parent'
}

export function canInviteRole(actor: FamilyRole, target: InviteRole) {
  if (actor === 'owner') return target === 'parent' || target === 'viewer'
  if (actor === 'parent') return target === 'viewer'
  return false
}

export function canRemoveMember(actor: FamilyRole, target: FamilyRole, self: boolean) {
  return actor === 'owner' && !self && target !== 'owner'
}

export function normalizeRole(role: string | undefined, isOwner = false): FamilyRole {
  if (role === 'owner' || role === 'parent' || role === 'viewer') return role
  return isOwner ? 'owner' : 'parent'
}

export function normalizeInviteRole(role: unknown): InviteRole {
  return role === 'parent' ? 'parent' : 'viewer'
}

export function defaultDisplayName(role: FamilyRole) {
  return FAMILY_ROLE_LABEL[role]
}

export function createInviteCode() {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
  }
  return code
}

export function normalizeInviteCode(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
}

export function formatInviteCode(code: string) {
  const normalized = normalizeInviteCode(code)
  return normalized.length === 6 ? `${normalized.slice(0, 3)} ${normalized.slice(3)}` : normalized
}

export function inviteExpiresAt(from = Date.now()) {
  return new Date(from + INVITE_TTL_MS).toISOString()
}

export function isInviteActive(invite: Pick<FamilyInviteRecord, 'expireAt' | 'usedCount' | 'maxUses'>, now = Date.now()) {
  return Date.parse(invite.expireAt) > now && invite.usedCount < invite.maxUses
}

export function toInviteView(invite: FamilyInviteRecord, now = Date.now()): FamilyInviteView {
  return {
    code: invite.code,
    role: invite.role,
    expireAt: invite.expireAt,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    expired: !isInviteActive(invite, now),
  }
}

export function maskSnapshotForRole(snapshot: AppSnapshot, role: FamilyRole): AppSnapshot {
  if (canViewBills(role)) return snapshot
  const next = JSON.parse(JSON.stringify(snapshot)) as AppSnapshot
  next.expenses = []
  next.payments = []
  next.charges = []
  return next
}
