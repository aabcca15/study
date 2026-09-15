# 能力与领域地图

设计接口或拆后端任务前先读本文：确认「产品有哪些能力、落在哪一页、谁拥有数据、哪些规则必须上服务端」。页面交互细节见 [product-map.md](product-map.md)，账号见 [account-model.md](account-model.md)，表与 API 见 [data-and-api.md](data-and-api.md)。

## 产品一句话

家长在家庭维度跟踪孩子的课表、课次变动和课程费用。当前只有 H5 家长端。数据由 `server/` NestJS 接口持久化，前端不再把 `myhome.v1` 当数据源。

## 当前实现边界

| 已落地 | 未落地 |
|---|---|
| 多孩档案、共享课、排课与例外、临时安排、账号密码登录 | 短信/微信登录、多家长邀请、孩子端 |
| 课次编辑、取消、确认已上（本地） | 孩子端登录与授权 |
| 计费规则、Charge、账单、支付/退款 | 真实支付渠道 |
| 本周账单、课程账单、家庭统计 | 目标页、年级编辑 |
| 明暗主题、底栏导航、账号密码登录 | 短信/微信登录、小程序、拆表 |

整份 `AppSnapshot` 等价于**一个家庭**。`SessionState.childId` 只是默认孩子偏好；授权看 JWT 里的 FamilyMember。

## 能力清单

状态：`已落地` 本地完整可用；`部分` 规则或 UI 未齐；`未做` 无页面或无持久化入口。

### 1. 家庭与孩子档案

| 功能点 | 状态 | 数据所有权 | 服务端必须做 | 本地入口 | 页面 |
|---|---|---|---|---|---|
| 至少一名孩子 | 已落地 | Family | 删最后一名返回冲突 | `removeChild` | 课程页管理孩子 |
| 新建孩子（姓名 + 四套头像） | 已落地 | Family | 校验 `avatarKey` | `addChild` | `ChildProfilePicker` |
| 改名 / 换头像 | 已落地 | ChildProfile | 版本冲突 | `updateChild` | 同上 |
| 删除孩子（级联） | 已落地 | Family | 原子事务，见契约 | `removeChild` | 二次确认后调 Store |
| 切换「当前孩子」 | 已落地 | 用户偏好 | **不参与鉴权** | `selectChild` | 仅课程页 |
| 年级 `grade` | 未做 | ChildProfile | 可并进资料 PATCH | seed 有值 | 无编辑 UI |

级联删除：独享课物理删除；共享课只解绑；该孩账单与目标删除；已移除课程的例外删除。详见 [backend-contracts.md](backend-contracts.md)#删除孩子。

### 2. 课程档案与生命周期

| 功能点 | 状态 | 数据所有权 | 服务端必须做 | 本地入口 | 页面 |
|---|---|---|---|---|---|
| 新建 / 编辑课程 | 已落地 | Course（`childIds` 多对多） | 校验孩子属本家庭 | `upsertCourse` | `CourseEditPage` |
| 课程类型 / 图标 / 主色 | 已落地 | Course | 枚举校验 | 同上 | 同上 |
| 计费规则（一次/按次/按时/免费） | 部分 | `billingPolicy` | 与账单同事务；旧 `fixed_period` 兼容 | 同上 + `syncCourseUpfrontExpense` | 编辑页未暴露周期费、课包、结算周期 |
| 日期排课（`freq=dates`） | 已落地 | Recurrence | 查询时展开，勿在写路径物化 weekly | `upsertCourse` / slots | 编辑页月历 |
| 规则排课 weekly/once | 部分 | Recurrence | **保留规则 + 例外表** | 读时仍支持；写时常被物化成 dates | 见 backlog |
| 结课 / 恢复 | 已落地 | `archived` | 加 `archivedAt`；不改账单 | `archiveCourse` `restoreCourse` | 课程卡 |
| 删除课程 | 已落地 | Course | 未付账单删、已付账单解绑保留 | `removeCourse` | 二次确认 |
| 课程卡生命周期 / 本期结算 | 已落地 | 派生 | 服务端算 `lifecycle` + `billingSummary` | `courseOverview.ts` | `CoursesPage` |
| 临时课不进档案 | 已落地 | `source=temporary` | V2 可独立单次日程 | `createQuickArrangement` | 课程列表过滤 |

生命周期（进行中 / 待开课 / 待排课 / 已结束 / 已结课）与费用结算**独立**：结课不改账单，结清不结束排课。

### 3. 日程与课次

| 功能点 | 状态 | 数据所有权 | 服务端必须做 | 本地入口 | 页面 |
|---|---|---|---|---|---|
| 按日 / 按范围展开课次 | 已落地 | 查询派生 | `GET /schedule` 服务端展开 | `schedule.ts` | 今日、日历 |
| 家庭混排、共享课不重复 | 已落地 | Family | 查询层去重 | `overviewCourses` | 今日、日历 |
| 时间冲突（按孩子隔离） | 已落地 | 查询 | 同孩子重叠拒绝；不同孩子可同时 | `findScheduleConflicts` | 加课、建课、临时安排 |
| 占用时段置灰 | 已落地 | 查询 | `GET /schedule/busy?childId=` | `busyIntervalsForDates` | 课程编辑、加课、课次改时间 |
| 已有课加到某天 | 已落地 | `ScheduleException.added` | 自然键 `courseId+date` | `addPresetOccurrence` | `AddOccurrenceSheet` |
| 临时安排 | 已落地 | Course+可选 Expense | 课程+账单同一事务 | `createQuickArrangement` | 同上 / 底栏 |
| 改本次时间 / 金额 / 支付 | 已落地 | 例外 + 账单 | 改时间走同一冲突校验并置灰 | `upsertScheduleException` `upsertOccurrenceExpense` | `OccurrenceEditSheet` |
| 取消本次 / 短时恢复 | 已落地 | 例外 | 删 `cancelled` 即恢复 | `dropOccurrenceSlot` `restoreOccurrenceSlot` | 今日/日历 toast |
| 确认已上 / 未上 | 部分 | `OccurrenceRecord` | 统计最终以确认为准 | `setOccurrenceAttendance` | 课次编辑；统计仍按日期推断 |

冲突口径：只和该课 `childIds`（或当前孩子）自己的课比时间。取消课不占时段。

### 4. 计费、账单、支付

四层口径不得混称「总支出」：

1. **实际支出**：`Payment` 净额，按 `paidAt`
2. **待支付**：已生成正式账单未付
3. **待结算**：已完成课次、Charge 尚未出账
4. **预计费用**：未来安排推算，不计入 1/2

| 功能点 | 状态 | 数据所有权 | 服务端必须做 | 本地入口 | 页面 |
|---|---|---|---|---|---|
| 一次性课费同步 | 已落地 | Expense `course_upfront` | 与课程同事务；已付不可因改规则删除 | `syncCourseUpfrontExpense` | 课程编辑 |
| 确认上课生成 Charge | 已落地 | Charge | 未确认不落库 | `upsertUnbilledUsageCharge` | 课次确认 |
| 按周/月出账 | 已落地 | Expense + Charge | `statementKey` 幂等 | `generateBillingStatements` | 进本周账单页自动触发 |
| 本周全家账单 | 已落地 | 按 `dueDate` 落周 | `scope=family` | `overviewExpenses` | `BillsPage` |
| 课程账单（上课日） | 已落地 | 该课正式账单 + 课次行 | `GET /courses/{id}/bills` | `buildCourseBillLedger` | `CourseBillsPage` |
| 记一笔（已付） | 已落地 | Expense 属当前孩子 | 服务端用令牌孩子，不信 session | `upsertExpense` | `ExpenseEditPage` 新建 |
| 标记已支付 | 已落地 | Expense + Payment | 幂等；不可改回未付 | `setExpenseStatus` | 账单详情 |
| 退款 | 已落地 | Payment `kind=refund` | 不超过原支付；保留原流水 | `refundExpense` | 已付账单详情 |
| 删未付账单 | 已落地 | Expense | 已付禁止删 | `removeExpense` | 二次确认 |
| 课包余额 | 部分 | 派生自确认课次 | 不单独落库 | `packages.ts` | 编辑页未完整暴露 |
| 家长支付状态展示 | 已落地 | — | 对外只展示已支付 / 未支付 | — | 课卡、课程账单 |

本地 `Expense` 过渡表达 Bill。后端新表必须拆 `Charge / Bill / Payment`，见 [billing-model-v2.md](billing-model-v2.md)。

### 5. 统计

| 功能点 | 状态 | 作用域 | 服务端必须做 | 本地入口 | 页面 |
|---|---|---|---|---|---|
| 月度 / 年度总金额、已付、未付 | 已落地 | 家庭，`dueDate` 落周期 | 家庭时区切周期 | `calculateLearningStatistics` | `StatsPage` |
| 费用类型环图 | 已落地 | 同上 | 服务端聚合 | `groupByCategory` | 统计 / 本周账单 |
| 每门课费用与完成进度 | 已落地 | 家庭；共享课排课计一次 | 费用按 Expense 逐笔 | 同上 | 点卡片进课程账单 |
| 课时趋势 / 支付趋势 | 已落地 | 课时按安排；支付按 Payment | 空周期返回空桶 | 同上 | 趋势图 |
| 按孩子下钻 | 未做 | — | `scope=child` + 归属校验 | — | 无切换 |

完成课次过渡期 = 日期 ≤ 今天，无签到。接入后以 `OccurrenceRecord` 为准。

### 6. 账号与多端

见 [account-model.md](account-model.md)。一期已落地家庭租户 + 账号密码登录。未做：孩子端、短信/微信、多家长邀请、小程序绑账号。

### 7. 目标（未做）

`Goal` 有类型和 `addGoalProgress`，无页面。上线目标页之前不要单独铺复杂目标服务。

## 页面领域范围

页面只做确认、跳转、展示和请求状态，**不实现**级联删除、出账、冲突、统计口径。

| 路由 | 页面 | 领域 | 读写作用域 | 底栏 |
|---|---|---|---|---|
| `/` | `TodayPage` | 家庭日程：选日、当日课、本周账单入口、加课/改本次 | `overview*` 家庭 | 今日（周偏移 0 且选今天） |
| `/calendar` | `CalendarPage` | 家庭月历 + 选中日课表 | `overview*` | 日历 |
| `/courses` | `CoursesPage` | 当前孩子的课程档案、孩子 CRUD、结课/删除 | `session.childId` | 课程 |
| `/courses/edit/:id?` | `CourseEditPage` | 课程主数据 + 日期排课 + 一次性支付开关 | 写入 Course；孩子多选 | 无 |
| `/courses/:id/bills` | `CourseBillsPage` | 单课正式账单与上课日台账 | 该课；返回看 `returnTo` | 课程（从统计来高亮统计） |
| `/stats` | `StatsPage` | 家庭账单数据 / 课程统计 | `overview*` | 统计 |
| `/bills` | `BillsPage` | 本周全家正式账单 | `overviewExpenses` × 当前周 | `?from=today`→今日；默认统计 |
| `/bills/edit/:id?` | `ExpenseEditPage` | 记一笔或账单详情（支付/退款/删未付） | 当前孩子 | 无 |
| `/login` | `LoginPage` | 账号密码登录 | 无家庭数据 | 无 |
| `/register` | `RegisterPage` | 注册账号并创建家庭 | 创建 Family | 无 |

导航壳：`App.vue` + `AppHeader`（主题，本地 `myhome.theme`）+ `TabBar`（＋菜单：快速安排 / 新增课程 / 记一笔）。

## 组件领域范围

### 壳与纯 UI（禁止写业务规则）

| 组件 | 范围 |
|---|---|
| `AppHeader` | 品牌、主题切换 |
| `TabBar` | 四 tab、快捷菜单、高亮（含 `returnTo` / `from=today`） |
| `PageHeader` | 标题、返回（`returnTo` 优先，`replace`） |
| `AppDatePicker` `AppTimeSelect` `AppSelect` `AppPaySwitch` | 输入控件；`AppTimeSelect` 为底部时/分选择器，占用置灰由调用方传入 options；支付开关只做开关样式 |
| `CourseIcon` `ChildAvatar` | 展示 |
| `TrendChart` | 折线展示 |

### 领域展示（只读派生数据）

| 组件 | 范围 | 数据从哪来 |
|---|---|---|
| `TodayCourseCard` | 单次课：时间、金额、支付、进度 | 页面传入 occurrence + progress |
| `CourseCard` | 档案卡（若仍引用） | 生命周期 / 结算摘要由 service 算好再传入 |
| `ExpenseCard` | 账单行 | 页面传入 Expense + 课程色 |
| `CourseScheduleList` | 某日课列表，转发 add / edit | 不自己写例外 |

### 领域交互（只调 Store，不复制级联）

| 组件 | 范围 | 允许调用 |
|---|---|---|
| `ChildProfilePicker` | 切换当前孩子、增改删孩子 | `selectChild` `addChild` `updateChild` `removeChild` |
| `AddOccurrenceSheet` | 多日加已有课或临时安排 | `addPresetOccurrence` `createQuickArrangement` + 冲突查询 |
| `OccurrenceEditSheet` | 改本次、确认出勤、取消 | `upsertScheduleException` `upsertOccurrenceExpense` `setOccurrenceAttendance` `dropOccurrenceSlot` |

## 作用域矩阵（家长端现状）

| 数据 | 今日 / 日历 / 统计 / 本周账单 | 课程档案 / 记一笔 |
|---|---|---|
| 课程 | `overviewCourses`（全家未结课） | `courses` / `allCourses`（当前孩子） |
| 例外 | `overviewScheduleExceptions` | 当前孩子可见课的例外 |
| 账单 | `overviewExpenses` | `expenses` 当前孩子 |
| Charge / Payment | `overviewCharges` / `overviewPayments` | 当前孩子 |

这是已知缺口：首页全家待付 vs 课程页单孩。后端用 `scope=family|child` 显式表达，不要再靠 `session.childId` 隐式过滤首页。

## 纯 UI 状态（不要做成资源）

- `useHomeDate`：周偏移、选中日
- `useQuickAdd`：快捷菜单、待打开加课弹层
- `useTheme`：`myhome.theme`
- 统计月/年与锚点日期
- 底栏 indicator、弹层开合
- 返回栈用的 `returnTo` / `backTo`（客户端导航，服务端无此资源）

## 后端一期建议切片

按依赖顺序，不要平行铺未做领域：

1. **家庭租户 + 家长登录 + 孩子档案**（导入 `myhome.v1`）
2. **课程 + 排课例外 + 日程展开 + 按孩子冲突**
3. **Charge / Bill / Payment + 出账 + 课程账单查询**
4. **统计只读 API**（家庭时区）
5. 其后：孩子端、支付渠道、目标、临时课独立实体
