# 数据管理与接口设计

给 Node API 建表、拆资源和写接入层用。规则细节仍以 [backend-contracts.md](backend-contracts.md) 为准；能力对照 [capability-map.md](capability-map.md)；账号 [account-model.md](account-model.md)；计费分层 [billing-model-v2.md](billing-model-v2.md)。

## 设计原则

1. **家庭是租户**。所有业务表带 `familyId`；查询与缓存键必须含家庭（孩子端再含 `childProfileId`）。
2. **服务端不信任** 请求体里的 `role`、`familyId`、任意 `childId`。以令牌中的 `FamilyMember` 授权。
3. **页面过滤器 ≠ 权限**。`session.childId` 只是默认孩子偏好。
4. **写操作用业务语义接口**，不要让客户端提交整份 snapshot。
5. **金额只用整数分** `amountMinor`。本地仍是元，接入层 `Math.round(amount * 100)`。
6. **日期 `YYYY-MM-DD`、时间 `HH:mm`**，周期边界按家庭 `timezone`（默认 `Asia/Shanghai`）。
7. **破坏性写带幂等键**（删孩子、出账、支付、退款、快速安排）。
8. **查询时展开课次**，不要在写例外时把 `weekly` 物化成全量 `dates`。
9. 接入后前端只做确认与错误展示；级联、出账、冲突、统计以响应为准。

## 建议聚合根与表

所有业务表另含 `createdAt` `updatedAt` `version`（乐观锁）。金额列均为整数分。

```text
Account
Family                          timezone, createdByAccountId
FamilyMember                    accountId, familyId, role=parent|child, childProfileId?
AccountPreference               accountId, familyId, defaultChildId
LocalIdMap                      familyId, localId, resource, serverId   // 导入幂等

ChildProfile                    familyId, name, grade?, avatarKey, avatarLabel, avatarColor

Course                          familyId, source=preset|temporary, archived, archivedAt?
CourseChild                     courseId, childProfileId
CourseBillingPolicy             courseId, pricingMode, settlementCycle, packageUnits?, ...
Recurrence                      courseId, freq, byWeekday[], startDate, endDate?, startTime, endTime
CourseDateSlot                  courseId, date, startTime, endTime     // 仅 freq=dates
ScheduleException               familyId, courseId, date UK(courseId,date), status, times...

OccurrenceRecord                familyId, courseId, originDate, date, status, billable, actualMinutes
Charge                          familyId, childId, courseId, occurrenceId, amountMinor, status, source
Bill                            familyId, childId, courseId?, statementKey, period, dueDate, status, amountMinor
BillCharge                      billId, chargeId
Payment                         familyId, childId, billId, kind, amountMinor, paidAt, refundOfPaymentId?

Goal                            familyId, childId   // 可后置
AuditLog                        familyId, actorAccountId, action, payload
```

本地 `Expense` = 后端 `Bill`。不要再把应付、账单、支付合成一张表。

### 所有权

| 资源 | 属 | 备注 |
|---|---|---|
| ChildProfile / Goal | 家庭 + 孩子 | 删孩子带走独享数据 |
| Course | 家庭；通过 CourseChild 多孩 | 删一孩只解绑共享课 |
| ScheduleException / OccurrenceRecord | 课程（家庭内） | 自然键 `courseId + date` / `courseId + originDate` |
| Charge / Bill / Payment | 家庭 + 孩子 | Bill 可关联课程；已付 Bill 删课只解绑 |
| 日程 / 统计 | 无表，查询派生 | 必须在库内按授权过滤后再聚合 |

### 建议索引

- `CourseChild (childProfileId, courseId)`
- `ScheduleException (courseId, date)` 唯一
- `Bill (familyId, dueDate, status)`、`(familyId, childId, period)`、`statementKey` 唯一
- `Payment (billId, kind)`、`(familyId, paidAt)`
- `Charge (occurrenceId)`、`(billedExpenseId → billId)`
- `OccurrenceRecord (courseId, originDate)` 唯一

## 本地 `myhome.v1` → 表

| 快照字段 | 后端 |
|---|---|
| （整包） | 一个 Family + LocalIdMap |
| `session.childId` | AccountPreference.defaultChildId |
| `session.role` | 废弃，改 FamilyMember.role |
| `children[]` | ChildProfile |
| `courses[]` | Course + CourseChild + Recurrence + Policy + 可选 DateSlot |
| `scheduleExceptions[]` | ScheduleException（`childId` 仅冗余） |
| `occurrenceRecords[]` | OccurrenceRecord |
| `charges[]` | Charge（amount×100） |
| `expenses[]` | Bill |
| `payments[]` | Payment |
| `goals[]` | Goal（可后置） |
| `billingMigrationAudits[]` | 导入日志，不必独立长期资源 |

导入：`POST /api/families/import` 一次上传映射后的资源，按 `LocalIdMap` 幂等。已支付记录不得按新规则重算。

## HTTP 约定

- 前缀 `/api`。JSON。鉴权：Bearer 或 session cookie。
- 写：`If-Match` 或 body `version`；冲突 `409 *_VERSION_CONFLICT`。
- 列表分页：`cursor` + `limit`，不要默认倒整家全量。
- 错误体：`{ code, message, details? }`。`code` 用契约里的稳定枚举。
- 金额字段名一律 `amountMinor`。响应可另带 `amountYuan` 仅供展示，服务端仍以分为准。

## 接口目录

认证与家庭邀请见 [account-model.md](account-model.md)#建议认证 API。下面按聚合根列出业务接口；规则与错误码在 [backend-contracts.md](backend-contracts.md) 对应节。

### 家庭与偏好

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/families/current` | 家庭、成员、孩子、时区 |
| POST | `/api/families` | 首个家长建家庭 |
| POST | `/api/families/import` | 导入本机快照 |
| PATCH | `/api/me/preferences` | `{ defaultChildId }` |

### 孩子

| 方法 | 路径 | 用途 |
|---|---|---|
| GET/POST | `/api/children` | 列表 / 创建 `{ name, avatarKey }` |
| PATCH | `/api/children/{id}` | 姓名、头像、年级 |
| DELETE | `/api/children/{id}` | 级联删除，`204` |
| GET | `/api/children/{id}/courses` | 该孩课程 + lifecycle + billingSummary |

### 课程

| 方法 | 路径 | 用途 |
|---|---|---|
| GET/POST | `/api/courses` | 列表（query: `childId?` `includeCompleted`）/ 创建 |
| PUT | `/api/courses/{id}` | 主数据 |
| DELETE | `/api/courses/{id}` | 删课，保留已付账单 |
| PUT | `/api/courses/{id}/slots` | dates 整表替换 |
| PUT | `/api/courses/{id}/children` | 共享孩子 |
| PATCH | `/api/courses/{id}/lifecycle` | `{ status: active\|completed }` |
| PUT | `/api/courses/{id}/exceptions/{date}` | 写入例外 |
| DELETE | `/api/courses/{id}/exceptions/{date}` | 恢复规则课次 |

### 日程

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/schedule` | `scope=family\|child\|self&start&end&childId?` 展开课次 |
| GET | `/api/schedule/busy` | `childId&date` 占用区间（冲突与置灰） |
| POST | `/api/quick-arrangements` | 临时安排；课程+可选账单一事务 |
| POST | `/api/courses/{id}/occurrences` | 已有课加到若干日（`added` 例外） |
| PATCH | `/api/occurrences/{occurrenceId}` | 改本次时间 / 确认出勤 / 取消 |

`occurrenceId` 稳定：`courseId + originDate`，改期不换 ID。

### 账单与支付

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/bills` | `scope&childId?&from&to&status?&courseId?`（本周用 dueDate 落周） |
| POST | `/api/bills` | 记一笔（已付） |
| GET | `/api/bills/{id}` | 详情 |
| DELETE | `/api/bills/{id}` | 仅未付 |
| POST | `/api/bills/generate` | `{ period, childId?, idempotencyKey }` |
| POST | `/api/bills/{id}/status` | 标记已支付 |
| POST | `/api/bills/{id}/refunds` | 退款 |
| GET | `/api/courses/{id}/bills` | 课程台账：total / paid / unpaid / days[] |

家长展示层只区分已支付 / 未支付。`pending`（待出账）留给系统与统计，不在课次行循环切换。

### 统计

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/analytics/learning` | `scope&granularity=month\|year&anchor=` |

响应：`summary`、`courses[]`、`trend[]`、`expenseBreakdown[]`、`timezone`、`generatedAt`。前端不再自己聚全家数据。

## 与 Store 的替换关系

| 本地 | 后端 |
|---|---|
| `addChild` `updateChild` `removeChild` | children API |
| `selectChild` | 先留本地；跨设备再 preferences |
| `upsertCourse` `archiveCourse` `restoreCourse` `removeCourse` | courses + lifecycle |
| `addPresetOccurrence` | `POST .../occurrences` |
| `createQuickArrangement` | `POST /quick-arrangements` |
| `upsertScheduleException` `restoreOccurrenceSlot` `dropOccurrenceSlot` | exceptions / occurrences |
| `upsertOccurrenceExpense` `setOccurrenceAttendance` | occurrence + charge |
| `upsertExpense` `setExpenseStatus` `removeExpense` `refundExpense` | bills |
| `generateBillingStatements` | `POST /bills/generate` |
| `syncCourseUpfrontExpense` | 创建/更新课程事务内 |
| `calculateLearningStatistics` | `GET /analytics/learning` |
| `buildCourseBillLedger` | `GET /courses/{id}/bills` |
| `findScheduleConflicts` | 写接口内校验；读 busy 给选择器 |

## 常见错误码

`401 UNAUTHENTICATED`  
`403 SCOPE_FORBIDDEN` `403 FAMILY_MISMATCH` `403 *_FORBIDDEN`  
`404 *_NOT_FOUND` `404 INVITE_NOT_FOUND`  
`409 LAST_CHILD_NOT_DELETABLE` `409 SCHEDULE_CONFLICT` `409 *_VERSION_CONFLICT`  
`409 BILL_ALREADY_GENERATED` `409 PAID_BILL_IMMUTABLE` `409 IDEMPOTENCY_CONFLICT`  
`400 INVALID_CHILD_IDS` `400 INVALID_TIME_RANGE` `400 INVALID_AMOUNT` `400 REFUND_EXCEEDS_PAYMENT`  
`410 INVITE_EXPIRED` `429 SMS_RATE_LIMITED`

## 一期明确不做

- 老师 / 机构账号、孩子互看、社交
- 未绑定家庭的云同步
- 把 Goal 做成独立复杂服务
- 接口继续收浮点「元」
- 客户端传课程/费用全集让服务端「代算」统计
