# 缺口与可优化项

改业务前先看这里，避免重复踩坑。每条格式：现状 → 问题 → 建议。改完把状态改成「已处理」并链到契约章节。能力是否落地见 [capability-map.md](capability-map.md)，接口与表见 [data-and-api.md](data-and-api.md)。

## 口径不一致（优先）

### 家庭视图 vs 孩子视图混用

- **现状**：今日 / 日历 / 统计用 `overview*`（家长=全家）。课程页、账单页、从课程生成账单用 `session.childId`。
- **问题**：家长在首页看到全家待付，进账单却只看到当前孩子；课程页切换孩子不影响首页。
- **建议**：产品拍板。推荐：课程档案、账单也提供「全家 | 某孩子」；`session.childId` 只做默认选中。后端用 `scope=family|child`。未拍板前不要把首页改回单孩子。

### 账单底栏高亮在「统计」

- 状态：部分已处理
- 现状：`/bills` 默认 `meta.tab=stats`。从今日「本周课程账单」进入使用 `?from=today`，底栏高亮今日。从统计「账单明细」进入仍高亮统计。
- 问题：账单没有独立 tab。
- 建议：不要再加第五个 tab，除非产品要独立「钱包」。

### 日历「新增」与今日「新增」不是同一件事

- 状态：已处理
- 现状：今日、日历课表「新增」与底栏快速新增共用 `AddOccurrenceSheet`，可多选日期、选已有课程或临时安排。新建长期预设仍在课程页和底栏「新增课程」。
- 问题：原先日历按钮进课程编辑页。
- 建议：保持课表组件只发 `add`，由页面传入选中日期。

## 领域模型缺口

### 规则排课被例外物化成 dates

- **现状**：`applyExceptionToCourse` 把 weekly/once 展开并 `stampCourseDates`，课程变成 `freq=dates`。`expandCourseToDates` 窗口约当前月起 12 个月。
- **问题**：取消/改一次课后，周规则丢失；超过窗口的课次展开不完整；后端若按 dates 存会膨胀。
- **建议**：课程主数据保留 `weekly|once|dates`；例外单独表。展开只在查询时做。接入后端时停止在写路径物化整份日期。本地可暂留物化，但新功能不要再依赖「保存后一定是 dates」。

### 完成课次没有签到

- 状态：第二阶段已处理本地确认
- 现状：家长可在课次编辑中确认已上 / 未上；未确认的过去课次标注待确认。统计完成次数过渡期仍按日期推断。
- 问题：原先无法区分「上了没」。
- 建议：后端接入后以 `OccurrenceRecord` 为准，不再只按日期。

### 目标、年级无 UI

- **现状**：`Goal` 有 seed 和 `addGoalProgress`；`grade` 有字段。
- **建议**：做目标页之前不要在后端单独铺一套复杂目标 API；年级可并进孩子资料 PATCH。未做功能不要在 H5 露出半截入口。

### 金额单位

- **现状**：前端 `amount` 为元。契约要求最小货币单位。
- **建议**：后端 API 一律 `amountMinor`；H5 接入层转换。禁止接口再收浮点元。

### 结课没有 archivedAt

- **现状**：只有 `archived` 布尔。统计无法知道哪天结的课。
- **建议**：后端加 `archivedAt`；历史统计用结课前课次。见契约「学习与费用统计」。

### 时间冲突只拦快速新增

- 状态：已处理
- **现状**：创建/保存课程、批量/逐日改时间、从预设加到某天、临时安排、课次改时间都走 `findScheduleConflicts` / `busyIntervalsForDates`，只与同一孩子的课次比时间。时间选择器置灰冲突时段。
- **建议**：保持按孩子隔离；服务端接入独立排课表后继续用同一判定。

### 快速新增的孩子归属

- **现状**：临时课写入 `session.childId`，弹层不能选孩子。
- **问题**：家庭视图下容易记到「课程页上次选中的孩子」身上。
- **建议**：弹层增加孩子多选，默认家庭全部或上次选择；API 强制传 `childIds`。

### 临时课程混入长期课程档案

- 状态：已处理本地分类与展示；独立后端实体待 V2
- 现状：快速临时安排写入 `Course.source=temporary`，费用使用 `Expense.category=temporary`；日程与总课时仍统计，但课程档案和常规课程费用明细不再逐条展示。
- 迁移：旧数据根据备注「通过快速新增创建的临时安排」补标并修正关联费用类别。
- 建议：后端按 [billing-model-v2.md](billing-model-v2.md) 迁移为独立单次日程，并保留旧 courseId 映射。

## 账单

### 课程「查看账单」进本周全家账单

- 状态：已处理
- 现状：课程卡「查看账单 / 去支付」进入 `/courses/:id/bills`，按上课日列出该课费用与支付状态，顶部为总金额、已支付、未支付。
- 问题：原先跳到 `/bills` 只看本周全家账单，对不上这门课。
- 建议：保持课程账单与本周账单分离。
- 相关代码：`services/courseBills.ts`、`pages/CourseBillsPage.vue`。

### 课程金额、账单和真实支出混为一层

- 状态：已处理（第四阶段）
- 现状：课程录入使用 `billingPolicy`，预付课可追踪课包次数或分钟；确认上课生成 Charge，按小时可填实际分钟；按周/月/手动汇总为 Expense 兼容账单；真实支出按 Payment 与 Refund 净额统计；费用/统计页展示预计费用。
- 已解决：完成、取消、改期联动未出账金额；已出账取消生成负数调整；已支付账单保留原支付并可记录退款；课包按确认课次消耗并可恢复；历史升级写入 `billingMigrationAudits`。
- 相关代码：`domain/types.ts`、`services/charges.ts`、`services/packages.ts`、`services/forecast.ts`、`stores/app.ts`、`pages/BillsPage.vue`。

### 取消、补课与新增课次不联动费用

- 状态：已处理
- 现状：确认已上生成 unbilled Charge；取消未出账课次置为 waived；改时间重算未出账金额；已出账后通过 adjustment 修正，已支付后由 Refund 留痕。

### 从课程生成账单在客户端循环 upsert

- 状态：本地已处理；后端待接入
- 现状：费用页按当前查看周自动对覆盖月份调用 `generateBillingStatements()`，一次性汇总 Charge 与固定周期费用并持久化；`statementKey` 防重复。
- 后端替换：`POST /api/bills/generate { period, childId, idempotencyKey }` 在服务端事务执行。

### pending / unpaid 文案

- 状态：已处理
- 现状：Expense 三态已改为「待出账 / 待支付 / 已支付」，账单卡状态不再点击循环，进入明细后明确修改。
- 待结算由 `Charge.status=unbilled` 独立展示；系统汇总账单直接进入待支付。

### 课程单价不会自动出账

- **现状**：除切换账期自动汇总和快速新增（金额>0 当场建 session 账单）外，改课程金额不会产生账单。
- **建议**：这是正确分离（课程金额 ≠ 应付）。文档和课程卡「本期待出账」需保持这个意思。

## 账号与同步

- 状态：部分已处理
- 现状：H5 已接 NestJS，账号+密码注册/登录，家庭数据在服务端 SQLite。前端 token 在 `myhome.tokens`。
- 未做：短信/微信登录、多家长邀请、孩子端、从旧 `myhome.v1` 导入、刷新令牌。
- 见 [account-model.md](account-model.md)。

## 代码卫生（低优先级）

- 状态：部分已处理
- 已删除 Vite 模板残留 `counter.ts` / `style.css`，以及未使用的旧 `CourseCard.vue`。
- `apps/web/src/data/storage.ts` 仍保留给未来 `myhome.v1` 导入，当前 H5 不再读写。
- `restoreDemo` 无入口。
- `ScheduleException.childId` 与「例外按课程生效」重复，共享课改期对所有孩子生效；后端以 `courseId+date` 唯一，`childId` 仅冗余。

## 一期数据通路（2026-09 复查）

- 状态：已处理（snapshot 一期）
- **现状**：业务增删改查都走 `/api`。Token 在 `myhome.tokens`；主题在 `myhome.theme`。前端不再读写 `myhome.v1`。Store 写操作一律 `mutate → 语义接口 → 服务端返回整份 snapshot`。
- **覆盖**：孩子、课程、排课例外、加课/临时安排、课次费用/出勤、账单支付/退款/删除、一次性课费、出账。目标 `addGoalProgress` 仍是空实现（无页面）。
- **未拆表**：家庭数据仍在 Family.`snapshotJson`。契约里的独立 `/analytics` `/schedule/busy` 尚未单独暴露；冲突与统计仍在服务端 workspace / 前端派生，但写入已在服务端执行。
- **已优化**：同家庭写操作串行，避免并发覆盖；快照未变化不写库；相同账期跳过重复出账；H5 合并重复 snapshot 请求，切日不再整包重拉。

## 记录模板

```markdown
### [标题]
- 状态：开放 | 已处理
- 现状：
- 问题：
- 建议：
- 相关代码：
```
