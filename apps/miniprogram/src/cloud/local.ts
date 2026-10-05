import type { AppSnapshot, ChildAvatarKey } from '@server-domain/types'
import { createEmptyFamilySnapshot } from '../../../../server/src/workspace/empty-snapshot'
import { applyFamilyAction, FamilyActionError } from '../../../../server/src/workspace/family-actions'
import { createFamilyWorkspace } from '../../../../server/src/workspace/family-workspace'

export const DEV_SNAPSHOT_KEY = 'myhome.mp.dev.snapshot'
const DEV_OPENID = 'dev-tourist'
const DEV_FAMILY_ID = 'dev-family'

export function hasDevSession() {
  return Boolean(uni.getStorageSync(DEV_SNAPSHOT_KEY))
}

export function clearDevSession() {
  uni.removeStorageSync(DEV_SNAPSHOT_KEY)
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

function childNameOf(payload: Record<string, unknown>) {
  return String(payload.childName || '').trim().slice(0, 20) || '小U'
}

export function callLocal<T>(action: string, payload: Record<string, unknown> = {}): T {
  if (action === 'login') {
    let snapshot = readSnapshot()
    if (!snapshot) {
      const avatarKey = typeof payload.avatarKey === 'string' ? payload.avatarKey as ChildAvatarKey : undefined
      snapshot = createEmptyFamilySnapshot(childNameOf(payload), avatarKey)
      writeSnapshot(snapshot)
    }
    return {
      openid: DEV_OPENID,
      familyId: DEV_FAMILY_ID,
      snapshot,
    } as T
  }

  const current = readSnapshot()
  if (!current) throw new FamilyActionError('UNAUTHENTICATED', '请先进入')
  const workspace = createFamilyWorkspace(current)
  const result = applyFamilyAction(workspace, action, payload)
  const snapshot = JSON.parse(JSON.stringify(workspace.snapshot.value)) as AppSnapshot
  writeSnapshot(snapshot)
  return { snapshot, result: result ?? null } as T
}
