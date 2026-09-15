# 课程费用模型 V2（目标方案）

> 状态：四阶段已落地：计费规则与统计口径、课次确认与 Charge、周/月/手动汇总出账、冲减与退款、课包余额、实际时长确认与预算预测。实施时必须保留 `myhome.v1` 历史账单，不得用新规则重算已支付记录。

## 产品目标

家长只需要在创建课程时说明「怎么收费、什么时候结算、是否已支付」，之后由系统依据实际课次维护待结算金额。页面必须明确区分：

1. **实际支出**：已经发生支付的金额，按 `paidAt` 进入支出统计。
2. **待支付**：已生成正式账单但尚未付款的金额。
3. **待结算**：课程已经完成、费用已累计，但尚未汇总成正式账单。
4. **预计费用**：未来安排按当前计价规则推算，仅用于预算，不计入支出或待支付。

不得再把四者合并称为「总支出」。

## 课程计费设置

### 计价方式 `pricingMode`

- `free`：免费。
- `prepaid`：一次性预付或课包；金额表示报名/课包总价。
- `per_session`：按次；金额表示每个有效完成课次的单价。
- `per_hour`：按小时；金额表示每 60 分钟单价。
- `fixed_period`：按周期固定收费；金额表示每周或每月固定金额。

当前 H5 已实现以上选择与字段显隐，数据保存于 `Course.billingPolicy`；`Course.billingMode` / `amount` 暂留用于兼容旧页面和历史数据。

### 结算周期 `settlementCycle`

- `upfront`：报名时或指定日期一次结算，主要用于 `prepaid`。
- `weekly`：按自然周汇总已完成课次。
- `monthly`：按自然月汇总已完成课次。
- `manual`：结算日期未知，由家长手动把待结算明细生成账单。

计价方式和结算周期必须是两个独立字段。例如「按次收费 + 每月结算」与「按小时收费 + 手动结算」都应能表达。

### 可选设置

- `unitAmountMinor`：按次、按小时或固定周期的单价，整数分。
- `prepaidAmountMinor`：一次性预付总额，整数分。
- `packageUnits` / `packageUnit=session|minute`：可选课包总次数或总分钟。未填写则只记总价，不追踪余额。确认 `completed` 且 `billable=true` 后才消耗；取消或记为未上会恢复剩余权益，不改历史支付。
- `dueRule`：固定应付日或出账后 N 天到期；允许未知。
- `effectiveFrom` / `effectiveTo`：计价规则有效期；改价时新增版本，不覆盖历史。

## 课次事实

排课只是计划，费用必须依据课次事实。目标课次状态：

- `scheduled`：未来或尚未确认，不形成待结算费用。
- `completed`：实际完成，形成费用明细。
- `cancelled`：未上课取消，默认不计费。
- `no_show`：缺席；默认不计费，可人工设为收费。
- `pending_confirmation`：已过结束时间但尚未确认。过渡期可按日期自动推断完成，但 UI 必须标注「待确认」。

改期必须沿用同一个稳定的 `occurrenceId`，只改变日期/时间，不能被识别为「取消一节 + 新增一节」而重复计费。

## 费用明细、账单与支付

三层数据必须分离：

1. `Charge`（费用明细）：由一次课、一个周期固定费或人工调整产生；状态 `unbilled | billed | waived | reversed`。
2. `Bill`（账单）：汇总一组 Charge；状态 `draft | unpaid | paid | void`。
3. `Payment`（支付记录）：真实资金流，记录金额、支付日和退款；统计真实支出以 Payment 为准。

本地过渡期继续使用 `Expense` 表达 Bill，并以 `chargeIds` / `statementKey` 关联 Charge；`Payment` 已独立保存支付与退款流水。统计按 Payment 的 `paidAt` 计算净支出；后端不得把三层合并为同一实体。

## 自动计算规则

### 按次

`课次费用 = unitAmountMinor`

仅 `completed` 且 `billable=true` 的课次形成 Charge。

### 按小时

`课次费用 = round(actualMinutes × unitAmountMinor / 60)`

`actualMinutes` 优先使用家长在课次确认中填写的实际分钟；没有时用最终排课时长并标记为估算。改实际分钟只重算未出账 Charge，已出账走调整项。

### 一次性预付

保存课程时根据支付状态创建一笔一次性账单：

- 已支付：同时创建 Payment，进入实际支出。
- 未支付：创建 unpaid Bill，进入待支付。
- 仅记录课程但不记账：允许稍后补录，不得自动假设已付。

后续取消课次不修改历史支付；有课包数量时只恢复可用次数/分钟。

当前本地实现由 `syncCourseUpfrontExpense()` 创建或更新 `source=course_upfront` 的 Expense。切换计费方式时只移除未支付的一次性账单，已支付记录作为历史支出保留。课包余额由 `OccurrenceRecord` 实时推导，不单独落库。

### 固定周期

每个周期最多生成一笔固定费用；周期内课次增减默认不改变金额。需要按实际次数变动的课程必须选择 `per_session`，避免「按月结算」和「月费固定」混淆。

### 本地汇总出账

- 费用页按当前查看周覆盖的月份自动调用 `generateBillingStatements`，按 `settlementCycle` 分组：`weekly` 按自然周、`monthly` 按自然月、`manual` 按账单所属账期汇总。
- 账单直接进入 `unpaid`；同一 `statementKey` 最多一笔未支付账单。已有未支付账单时追加新 Charge，已支付后产生的新增费用生成补充账单。
- 固定周期课程按周/月生成 `fixed_period` Charge 和对应账单；旧版同课程同月账单存在时不重复生成。
- 汇总在 Store 单次持久化中完成；Charge 与账单同时成功或都不写入。

## 排课变更对费用的影响

- 新增未来课次：只增加预计费用。
- 完成课次：生成或更新 unbilled Charge。
- 取消未完成课次：预计费用归零，不生成 Charge。
- 取消已完成但未出账课次：原 Charge 标记 `waived` 或生成反向明细。
- 已出账后取消：生成负数调整项，进入原账单或下期账单；不得静默删除账单。
- 已支付后退款：保留原 Payment，新增 Refund；实际支出统计显示净额并可追溯。
- 改期：同一 `occurrenceId` 更新日期和时长；若尚未出账则重算，已出账则走调整项。
- 从预设加到某天：按课程计价规则参与预计与完成后计费，不能只新增日程。

## 临时课程

- 临时安排使用单次日程，不强制创建长期 `Course` 档案。
- 费用类别增加 `temporary`（展示「临时课程」）。
- 可选择免费、已支付、待支付；按小时临时课可输入小时单价。
- 同名临时安排反复出现时提供「保存为课程预设」，由用户主动转为 Course。
- 取消未支付且未完成的临时安排时同步撤销未出账费用；已支付时保留支出并提示记录退款。

## 页面信息架构

### 课程录入

先选计价方式，再展示对应字段：

- 一次性预付：总价、是否已支付、支付/应付日期、可选课包次数或小时。
- 按次：每次单价、每周/每月/手动结算、应付规则。
- 按小时：小时单价、结算周期、时长确认方式。
- 固定周期：每周或每月固定费、应付规则。

保存按钮上方展示自然语言摘要，例如：

> 每完成 1 次计费 ¥120，每月汇总，次月 8 日前支付；取消未上课程不计费。

### 今日与日历

课次卡展示：

- `¥120/次 · 未上不计费`
- `¥200/小时 · 本次预计 ¥300`
- `课包已支付 · 剩余 8/20 次`
- `本次 ¥120 已计入待结算`

取消确认必须说明金额影响。

### 费用页

顶部分为「已支付、待支付、待结算、预计」四个互斥口径；账单状态不能通过点击卡片循环切换，必须使用有文案的明确操作。

### 统计页

- 主指标「实际支出」只汇总 Payment，按支付日期归属。
- 待支付与待结算单独展示，不混入实际支出。
- 增加「课程成本」视图：按课程聚合实际支付，也可查看已消耗课包价值。
- 临时课程单列，仍计入教育总支出。
- 课时必须使用课次最终/实际起止时间，不能始终使用课程模板时间。

## 历史数据迁移

本地 `myhome.v1` 保持 `AppSnapshot.version = 1`，另用 `billingSchemaVersion` 做幂等升级。当前目标版本为 `4`。

### 原则

1. **不重算历史资金**：已支付 Expense 原样保留，支付日优先 `paidAt`，缺省回填 `dueDate`，只用于统计归属，不生成新 Payment 实体。
2. **不补造历史课次账单**：`session` 课不会按过去课次批量生成 Expense；第二阶段也不为推断完成的课次批量生成 Charge。
3. **规则可推断、语义需确认**：`free` / `session` 可可靠映射；`monthly` / `term` 写入 `needsBillingReview=true`，用户保存后才清除。
4. **三层分离逐步迁移**：补齐 `charges=[]`、`occurrenceRecords=[]`、`payments=[]`；未支付 Expense 仍视为 Bill，不反推 Charge。
5. **幂等、可回滚**：已有 `billingPolicy` 不覆盖；原始 `billingMode` / `amount` / Expense id 保持不变。

### 课程映射

1. 现有 `billingMode=free` → `pricingMode=free`，`settlementCycle=manual`。
2. 现有 `billingMode=session` → `pricingMode=per_session`，`amount` 作为每次单价；默认 `settlementCycle=manual`。
3. 现有 `billingMode=monthly|term` 无法可靠判断是固定费还是结算周期；迁移为 `needsBillingReview=true`，并给可编辑默认值（`monthly`→固定月费，`term`→一次性预付）。编辑页显示明确提示，用户保存后才标记已确认。
4. 现有 `Expense.status=paid` 继续作为已支付账单；`paidAt` 缺失时回填 `dueDate`。
5. 现有未支付 Expense 迁移为未支付账单，不反推 Charge。
6. 快速新增产生的 `freq=once` 且备注为临时安排的课程补标 `source=temporary`，保留 `courseId` 与账单关系。
7. 第二阶段：不为历史课次写入 `OccurrenceRecord`。过去课次 UI 显示「待确认」，家长确认已上后才生成 `unbilled` Charge。
8. 第三阶段：为历史 `status=paid` Expense 幂等创建 `pay_legacy_{expenseId}` Payment 镜像，金额与支付日原样复制；统计切换为 Payment 后不会重复计算 Expense。退款只新增 `kind=refund` 流水，不修改原支付。
9. 第四阶段：不推断 `packageUnits` / `packageUnit`。未填写课包的预付课只保留总价，不追踪余额。确认上课后才按课次或实际分钟消耗课包；取消已确认课次恢复剩余权益，不改历史支付。写入 `billingMigrationAudits`，记录保留的已支付账单和仍待确认课程。

迁移必须幂等，并保留原始记录用于回滚和审计。
