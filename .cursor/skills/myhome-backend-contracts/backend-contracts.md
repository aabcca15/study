# 后端业务契约

## 当前数据源

- 本地键：`myhome.v1`
- 数据结构：`AppSnapshot`
- 类型来源：`apps/web/src/domain/types.ts`
- 本地业务入口：`apps/web/src/stores/app.ts`
- 迁移原则：保持现有 ID；日期使用 `YYYY-MM-DD`，时间使用 `HH:mm`；金额确认单位后统一使用整数最小货币单位。

## 实体与关系

- `ChildProfile`：孩子档案。
- `Course`：通过 `childIds` 与孩子建立多对多关系；`childId` 是兼容旧数据的主孩子字段。
- `ScheduleException`：属于课程和日期，当前按课程生效。
- `Expense`：属于孩子，可选关联课程。
- `Goal`：属于孩子。
- `SessionState.childId`：当前前端选中的孩子，不应作为后端数据所有权依据。

## 登录角色与数据视野

### 当前产品口径

- 当前 H5 是家长端。家长查看“今日”“日历”“学习统计”时，默认使用家庭作用域，包含其有权管理的全部孩子。
- `SessionState.childId` 只服务课程管理、账单录入等需要明确孩子上下文的操作，不能用来过滤家长首页、家庭日历或家庭统计。
- 家庭日程将全部有效课程合并后按时间排序。共享课程只保留一份课程和课次，不得因 `childIds` 有多个值而重复展示。
- 家庭统计汇总全家课程和全家账单；共享课程的排课只计算一次，费用仍按实际 `Expense` 记录逐笔汇总。
- 后期孩子端属于独立角色视图：孩子登录后，“今日”“日历”“学习统计”只能读取本人关联的课程与本人费用/统计，不提供切换其他孩子或家庭聚合能力。
- 前端当前由 Store 的 `overviewCourses`、`overviewExpenses`、`overviewScheduleExceptions` 集中实现角色作用域。页面不得自行按当前头像拼装权限逻辑。

### 服务端权限与 API

- 身份令牌必须包含可验证的账户角色、家庭 ID；孩子身份还要绑定孩子 ID。服务端不得信任客户端传入的 `role`、`familyId` 或任意 `childId`。
- 家长接口建议支持 `scope=family|child`；家长端今日、日历、统计默认 `scope=family`。按孩子管理时，`scope=child&childId=...` 必须校验家庭归属。
- 孩子身份强制 `scope=self`，即使请求传入 `family` 或其他 `childId` 也必须拒绝，返回 `403 SCOPE_FORBIDDEN`。
- 建议日程 API：`GET /api/schedule?scope=family|child|self&start=YYYY-MM-DD&end=YYYY-MM-DD&childId={optional}`。
- 家庭聚合响应中的课程应携带参与孩子摘要（孩子 ID、名称、`avatarKey`、头像颜色），供课程卡和时间轴显示圆形雪碧图头像。
- 所有作用域查询都要在数据库查询和缓存键层面包含授权家庭/孩子，不能先读取全量数据再仅依赖客户端过滤。

## 删除孩子

### 业务规则

删除孩子必须是原子操作：

1. 系统至少保留一个孩子；删除最后一个孩子返回业务冲突。
2. 对仅属于被删除孩子的课程执行物理删除。
3. 对多人共享课程只移除该孩子的关联，并将兼容字段 `childId` 更新为剩余孩子的第一个 ID。
4. 删除已移除课程的全部排课例外，因此这些课程不再出现在日历。
5. 共享课程及其排课例外继续保留，不影响其他孩子。
6. 删除该孩子的账单和目标；删除引用已移除课程的孤立账单。
7. 当前会话选中被删除孩子时，前端切换到剩余第一个孩子。

### 建议 API

`DELETE /api/children/{childId}`

请求头应携带家庭/监护人身份和幂等键。成功返回 `204 No Content`。

错误：

- `404 CHILD_NOT_FOUND`
- `409 LAST_CHILD_NOT_DELETABLE`
- `403 CHILD_DELETE_FORBIDDEN`

### 服务端事务

在同一数据库事务内：

1. 加锁读取孩子及其课程关联。
2. 校验家庭权限和“至少保留一个孩子”约束。
3. 删除独享课程、对应排课例外及孤立账单。
4. 删除共享课程关系并修正兼容主孩子字段。
5. 删除孩子账单、目标和孩子档案。
6. 写入审计日志后提交。

并发请求必须通过事务锁或乐观版本防止两个孩子同时被删除后留下空家庭。

### 前端接入替换点

- 当前实现：`useAppStore().removeChild(id)`
- 接入后：调用删除 API，成功后重新拉取家庭快照或规范化更新本地缓存。
- 页面只负责二次确认和展示服务端错误，不复制级联规则。

## 孩子资料与课程上下文

### 业务规则

- 新家庭默认创建一个名为 `Uday` 的孩子，用户可随时改名。
- 孩子头像来自 `user_icon.png` 四宫格雪碧图，字段为 `ChildProfile.avatarKey`：`boy-blue` | `boy-cap` | `girl-flower` | `girl-bow`。展示用 CSS `background-size` + `background-position` 裁成圆形，不拆图、不另存切片。
- `avatarLabel` 仍由名称前两字生成，仅作无头像数据的回退文字；`avatarColor` 跟随所选雪碧图角色，用于描边和高亮，不再作为主展示。
- 创建孩子必须选择四套头像之一；已有孩子可更换头像。服务端应校验 `avatarKey` 枚举，非法值回退到 `boy-blue`。
- 新建课程只有一个孩子时默认关联该孩子；有多个孩子时只默认关联家庭孩子列表中的第一个，其他孩子必须由用户主动选择后才建立多人课程关系。该默认值只用于初始化表单，服务端仍须校验最终提交的 `childIds`。
- 当前孩子切换属于用户界面会话状态，不改变课程所有权。
- 课程列表必须按孩子权限和课程关联关系过滤，不能只依赖前端筛选。

### 建议 API

- `PATCH /api/children/{childId}`：修改名称、`avatarKey` 等资料。
- `POST /api/children`：创建孩子，请求包含 `name` 与 `avatarKey`。
- `GET /api/children`：读取当前家庭下可管理的孩子。
- `GET /api/children/{childId}/courses`：读取指定孩子可见课程。
- `PUT /api/courses/{courseId}/children`：更新课程关联的孩子 ID 集合。

资料更新建议携带记录版本或 `If-Match`，冲突返回 `409 CHILD_VERSION_CONFLICT`。课程关联更新必须校验所有孩子均属于当前家庭。

`myhome.v1` 中缺少 `avatarKey` 的孩子按家庭孩子列表下标循环分配四套雪碧图；已有 `avatarLabel` 继续保留作回退。

### 前端接入替换点

- `useAppStore().updateChild(input)` 替换为孩子资料更新 API。
- `useAppStore().selectChild(id)` 可继续保留为本地会话状态；需要跨设备同步时再接入用户偏好 API。
- `store.courses` 的本地筛选替换为按孩子查询课程；切换孩子时取消旧请求并避免旧响应覆盖新结果。
- `upsertCourse()` 中的 `childIds` 由服务端校验并持久化。

## 课程生命周期与结算状态

### 两类状态必须分离

- 课程生命周期表示教学安排：`进行中`、`待开课`、`待排课`、`已结束`、`已结课`。
- 当前本地模型以 `Course.archived=true` 表示家长手动“标记已结课”；`已结束`由最后一个有效课次早于家庭时区当天自动推导，不额外写入持久化状态。
- `待开课`表示首个有效课次晚于今天；`待排课`表示没有有效课次。自动推导状态随排课变化实时更新。
- 已结束和已结课课程继续保留在课程档案中，但不再进入今日、日历及未来课次展开。编辑已结课课程不能隐式恢复，必须由明确的“恢复课程”操作改变状态。
- 费用状态按课程、账期关联的 `Expense` 推导：免费课程为“无需缴费”；无本期账单为“本期待出账”；只有 `pending` 为“待结算”；存在 `unpaid` 为“待支付”；本期账单全部 `paid` 为“本期已结清”。
- 课程单价不是应付余额。去支付必须进入实际账单，不允许仅根据 `Course.amount` 直接标记结清。
- 标记结课或恢复课程均不修改、不删除历史账单、排课例外和历史统计；恢复后也不自动补造已删除课次。

### 建议 API 与并发要求

- `PATCH /api/courses/{courseId}/lifecycle`，请求 `{ status: "active" | "completed", version }`，用于恢复或标记结课。
- `GET /api/children/{childId}/courses?includeCompleted=true&period=YYYY-MM`，响应附带服务端统一计算的 `lifecycle`、`progress` 和 `billingSummary`。
- `GET /api/bills?childId={id}&courseId={optional}&period=YYYY-MM`，作为课程卡“查看账单/去支付”的目标。
- 真正支付操作应创建支付单并使用幂等键；支付回调原子更新支付单与账单状态，前端不能直接把第三方支付结果当作成功。
- 生命周期更新必须校验课程归属、记录操作者与时间，并使用版本号或 `If-Match` 防止多人同时编辑覆盖；冲突返回 `409 COURSE_VERSION_CONFLICT`。
- 建议错误码：`404 COURSE_NOT_FOUND`、`403 COURSE_UPDATE_FORBIDDEN`、`409 COURSE_VERSION_CONFLICT`、`409 BILL_NOT_PAYABLE`。

### 前端接入替换点

- 当前生命周期展示入口：`getCourseLifecycle()`；本期结算摘要入口：`getCourseBillingSummary()`。
- 当前状态写操作：`archiveCourse()` / `restoreCourse()`；接入后替换为生命周期 API，成功后使用响应刷新课程卡。
- 当前“去支付”进入账单页；接入支付渠道后必须先读取可支付账单并创建支付单。

## 快速新增单次安排

### 业务规则

- 首页课程区的“新增”固定使用当前查看日期，只负责从已有课程预设添加一次安排。
- 底栏“快速新增安排”是跨页入口，必须允许用户单独选择日期；既可从已有课程预设添加，也可创建临时单次课程。
- 临时安排至少包含课程名称、日期、开始时间和结束时间，结束时间必须晚于开始时间。
- 同一天内临时安排不能与该日已有课次（含 `ScheduleException` 生效后的时间）重叠：`newStart < existingEnd && newEnd > existingStart` 即视为冲突，需拒绝创建。判定基于展开后的有效课次，被取消的课次不占用时间。
- 时间选择器按 15 分钟粒度提供 06:00–22:45 候选；落在已有课次内的开始时间、以及会跨过已有课次的结束时间都置灰不可选，客户端不得把冲突时间提交给服务端。
- 客户端不做「静默禁用」：确认按钮不可点时必须给出原因（缺名称、时间顺序错误或时间冲突）。
- 临时安排按 `Course.recurrence.freq=once` 建模，并保存唯一的 `CourseDateSlot`；不能只在页面状态中生成一个没有课程归属的课次。
- 金额为 0 时课程使用 `billingMode=free` 且不创建账单；金额大于 0 时课程使用 `billingMode=session`，同时创建关联该课程的单次 `Expense`。
- 快速入口的结算状态当前只提供“未结算”（`unpaid`）和“已结算”（`paid`）；已结算账单必须写入 `paidAt`，课程生命周期不能因账单状态改变。
- 家长家庭视图下创建临时安排时，数据归属于当前会话选中的孩子；从已有共享课程添加安排时继续沿用课程原有孩子关系。

### 建议 API

`POST /api/quick-arrangements`

请求建议为 `{ childId, date, title, startTime, endTime, amountMinor, expenseStatus, idempotencyKey }`。成功返回 `{ course, expense?: Expense }`；金额为 0 时不返回 `expense`。

建议错误码：`400 INVALID_TIME_RANGE`、`400 INVALID_AMOUNT`、`404 CHILD_NOT_FOUND`、`403 CHILD_UPDATE_FORBIDDEN`、`409 SCHEDULE_CONFLICT`（返回冲突课次的标题与时间用于提示）、`409 IDEMPOTENCY_CONFLICT`。

查询当日占用时间建议 `GET /api/schedule/busy?childId=&date=`，返回 `{ intervals: { startTime, endTime, courseId, title }[] }`，供时间选择器置灰使用。

### 事务、权限与迁移

- 创建一次课程及可选账单必须在同一事务中完成；任一写入失败则全部回滚。
- 服务端校验孩子属于当前家庭，不能仅信任客户端传入的 `childId`；孩子角色只能为本人创建。
- 幂等键覆盖整个“课程 + 可选账单”事务，重试不得重复创建。
- 当前本地原子入口为 `useAppStore().createQuickArrangement()`，一次修改 `courses` / `expenses` 后只持久化一次；返回 `{ ok: true, courseId, expenseId? }` 或 `{ ok: false, reason: 'invalid' | 'conflict' }`，冲突判定在 Store 内完成，页面只负责展示原因。
- 时间冲突口径由 `services/schedule.ts` 的 `busyIntervalsOnDate()` / `findBusyConflict()` 提供，服务端接入后需用同一判定，避免前后端结论不一致。
- `myhome.v1` 迁移时，临时安排与普通 `freq=once` 课程同样迁移；通过关联的 `Expense.courseId` 保留费用关系，无需额外临时实体。

## 学习与费用统计

### 统计口径

- 家长端默认统计主体是当前家庭，汇总全部孩子；需要管理下钻时才按指定 `childId` 查询。未来孩子端统计主体固定为登录孩子本人。
- 家庭统计中共享课程只计算一次；个人统计中共享课程在该孩子报表内计算一次。
- 统计周期支持 `year` 和 `month`；服务端按家庭时区确定周期边界和“今天”。
- 总支出按 `Expense.period` 归属统计周期，包含已支付和未结清账单。
- 已支付支出为 `status=paid`；待支付支出为其他状态。
- 课程安排基于排课规则与 `ScheduleException` 展开后的有效课次；取消课不计入，补课和改期按最终日期、时间计算。
- 完成课次是有效课次日期不晚于家庭时区当天；后端接入时可进一步引入真实签到/完成状态，替代日期推断。
- 总课时按有效课次的开始和结束时间累计，跨午夜课程按次日结束处理。
- 课程费用按 `Expense.courseId` 聚合；没有课程关联或课程已不存在的费用归入“其他支出”。
- 年度费用趋势严格按 `Expense.period` 聚合；月度费用趋势在账期内按 `dueDate` 落到具体日期，异常日期回落到账期首日。
- 当前本地模型只有 `archived`，没有归档时间，因此无法准确恢复归档课程在历史周期内的有效边界；后端课程模型需要保存 `archivedAt`，历史统计应保留归档前课次。

### 建议 API

`GET /api/analytics/learning?scope=family|child|self&childId={optional}&granularity=year|month&anchor=YYYY-MM-DD`

响应建议包含：

- `summary`：总支出、已支付、待支付、安排课次、完成课次、总分钟数。
- `courses[]`：课程 ID、名称、图标、颜色、安排/完成课次、安排/完成分钟数、完成率、费用。
- `trend[]`：时间桶、课时数、费用。
- `expenseBreakdown[]`：课程 ID 或 `unassigned`、名称、金额、占比。
- `generatedAt`、`timezone`、`dataVersion`。

服务端必须按登录角色限制 `scope`，并在按孩子下钻时校验当前监护人有权访问 `childId`；不可接受客户端传入的课程或费用集合。建议对角色、家庭、作用域、孩子、周期和数据版本建立短期缓存；课程、排课例外或账单变更后失效。金额使用整数最小货币单位，时长使用整数分钟，比例由服务端统一计算。

### 前端接入替换点

- 当前聚合入口：`calculateLearningStatistics()`（`apps/web/src/services/statistics.ts`）。
- 接入后由统计 API 直接返回页面视图模型，前端仅负责年度/月度切换、格式化和图表绘制。
- API 响应需支持空周期，不应由前端补造趋势数据之外的业务数据。

## 新功能记录模板

### [功能名]

- 涉及实体：
- 数据所有权：
- 核心约束：
- 建议 API：
- 事务/幂等：
- 权限：
- 本地实现位置：
- 后端接入替换点：
- 迁移注意事项：
