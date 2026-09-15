# 产品与页面地图

对照代码梳理。改交互前先确认「页面实际做什么」和「数据从哪来」，避免把家庭口径和孩子口径混在一个页面里。

能力总表、组件领域、后端切片见 [capability-map.md](capability-map.md)。表与 API 见 [data-and-api.md](data-and-api.md)。

## 导航

底栏 `TabBar.vue`：今日 `/`、日历 `/calendar`、中间 ＋、课程 `/courses`、统计 `/stats`。顶栏主题按钮是本地 UI 状态（`myhome.theme`），太阳与月亮变形过渡，不改变业务作用域。

| 路由 | 页面 | 底栏高亮 | 数据作用域（现状） |
|---|---|---|---|
| `/` | 今日 | 今日（仅当周偏移为 0 且选中今天） | `overview*` 家庭 |
| `/calendar` | 日历 | 日历 | `overview*` 家庭 |
| `/courses` | 课程档案 | 课程 | `store.courses` / `allCourses` **当前孩子** |
| `/courses/edit/:id?` | 新建/编辑课程 | 无底栏 | 写入课程；孩子多选 |
| `/stats` | 学习统计 | 统计 | `overview*` 家庭 |
| `/bills` | 本周课程账单 | 从今日「本周课程账单」进入时高亮**今日**（`?from=today`）；从统计进入仍高亮统计 | `overviewExpenses` 按 `dueDate` 落在当前查看周 |
| `/courses/:id/bills` | 课程账单 | 课程 | 该课程全部正式账单 + 上课日明细 |
| `/bills/edit/:id?` | 记一笔/编辑账单 | 无底栏 | 归属当前孩子 |
| `/login` | 登录 | 无底栏 | 账号+密码，写 JWT |
| `/register` | 注册 | 无底栏 | 创建账号与家庭 |

中间 ＋ 打开快捷菜单：快速新增安排、新增课程、记一笔账单。快速新增经 `useQuickAdd` 跳到今日页弹层。

## 页面功能

### 今日 `TodayPage.vue`

- 周条切换、选日；课次来自 `occurrencesOnDate(overviewCourses, date, exceptions)`。
- 当日时间轴、参与孩子圆形头像（多孩才显示）、课程进度。课卡展示金额（一次性支付只显示总价）和是否已支付，不再展示计费说明文案。
- 概览卡：当日课次完成比例（用当前时刻对比结束时间，不是签到）、本周课程账单（按 `dueDate` 落在本周，含已支付与未支付，进入 `/bills?from=today`）。
- 课程区「新增」、日历课表「新增」与底栏「快速新增安排」共用 `AddOccurrenceSheet`：可选多个日期、选择已有课程或临时新增安排。已有课程用 `addPresetOccurrence()` 写入各日 `ScheduleException.status=added`（已在该日出现的课次会跳过）。临时课标记 `Course.source=temporary`，多日时 `freq=dates`；费用类别为「临时课程」，参与日程和统计但不进入长期课程档案。时间网格按所选日期合并已占用时段。多选日期后触发器只展示首日到末日区间。
- 编辑本次：标题只读课程名称；时间用 `AppTimeSelect`，与该孩子当天其他课冲突的时段置灰。可改这一次的时间、金额和是否已支付。已支付账单金额不可改、不能改回未支付。按时长计费时仍可填实际分钟。保存前走 `findScheduleConflicts`。底部「取消课程」二次确认后从课表移除这一次，「确认修改」写入排课例外并 `upsertOccurrenceExpense`。取消后可用 toast 撤销。
- 选中孩子：本页**不**切换孩子；家庭视图混排全部有效课。

### 日历 `CalendarPage.vue`

- 月网格，日期点用课程主色。
- 选中日复用 `CourseScheduleList`，「新增」与今日相同：给**选中日期**追加一次已有课程。编辑本次与今日相同，进入课次安排与费用，不再跳到课程模板编辑。

### 课程 `CoursesPage.vue`

- 右上角 `ChildProfilePicker` **切换当前孩子**（写入 `session.childId`）。
- 卡片：生命周期、排课进度、本期结算摘要、编辑/结课/恢复/删除/去支付。查看账单与去支付进入 `/courses/:id/bills`，按上课日列出费用与支付状态，顶部为该课总金额、已支付、未支付。删除需二次确认；已支付账单保留，未支付账单与排课一并删除。
- 管理孩子：改名、换头像、添加（四套雪碧图必选）、删除（级联在 Store）。

### 课程编辑 `CourseEditPage.vue`

- 顶栏返回与标题同一行：编辑为「课程编辑」，新建为「新增课程」，不重复展示课程名称。
- 字段：孩子（可多选）、名称、类型、老师、地点、图标、主色、计费规则、金额、备注。
- 类型：兴趣课、运动课、文化课、学校课、其它。旧「在线课堂」迁移为「其它」。
- 计费规则：一次性支付、按需计费（按次/按小时）、无需缴费。不再展示结算周期、课包追踪和固定周期费。一次性支付用「是否已支付」开关，保存时同步课程一次性账单。新建课程默认主色避开已有课程颜色。
- 课程时间统一使用 `AppTimeSelect` 底部时/分选择器，不再展示浏览器原生 `input[type=time]`。
- 选择器按所选孩子、已选日期合并占用时段：冲突开始/结束时间置灰，并标明占用课程。编辑当前课排除自身。
- 排课：月历点选/拖选日期，每格可设开始结束时间；保存后 `freq=dates`。
- 旧数据若仍是 `weekly`/`once`，编辑页会展开为日期列表再存回 `dates`（见 backlog：规则课被物化）。
- 保存走 `upsertCourse`；已结课编辑不会隐式 `restore`。

### 统计 `StatsPage.vue`

- 标题「账单数据 / 课程统计」。默认月度，切换顺序为月度 / 年度。`calculateLearningStatistics`。
- 顶部与本周课程账单相同：本月或本年总金额、已支付、未支付（按 `dueDate` 落在周期内的正式账单）。接着按费用类型环图。
- 保留每门课程表现：完成次数与进度，数值为该课总费用、已支付、未支付。点卡片进入 `/courses/:id/bills?returnTo=/stats`。课时趋势、支付趋势仍按 Payment。
- 完成课次 = 日期 ≤ 今天，无签到。课时优先用确认的实际分钟。

### 账单 `BillsPage.vue` / `ExpenseEditPage.vue`

- 标题「本周课程账单」，带返回。无账期选择、无状态筛选，直接展示本周全部账单（已支付与未支付都在）。顶部展示本周总金额、已支付、待支付。点卡片进入明细。费用类型用环图展示，中心为「本周」。账单卡使用关联课程的图标与主色，无课程时回退为 ¥。日期为支付日，未支付显示「未支付」。
- 进入页面或切换今日周条后，对覆盖本周的月份自动调用 `generateBillingStatements`。账单按 `dueDate` 落在周一至周日（与今日页 `weekOffset` 一致）。从今日入口带 `from=today`，底栏保持今日高亮。
- 编辑支出是消费详情，不只读改表单：展示名称、类型、金额和是否已支付。不能改关联课程、结算方式、账期或金额。未支付可标记已支付；已支付可记录退款，不能删除。底部「保持」返回费用页，「删除」仅对未支付账单生效并二次确认。
- 记一笔：名称、类型、金额、日期。日期可补过去或记未来账单，写入 `dueDate` / `paidAt` / `period`。来这里记录即视为已支付。底部「确认 / 取消」。不再提供关联课程、结算方式和账期编辑。归属 `session.childId`。
- 课程账单 `/courses/:id/bills`：顶部为该课总金额、已支付、未支付。课次行只区分已支付 / 未支付，不再展示待结算或预计。一次性支付的课次标注「已含总价」。有正式账单的行可进入明细。返回优先 `returnTo`（统计入口回统计），否则回课程页，避免与支出详情互相 `history.back` 死循环。

### 未落地的领域

- **目标 `Goal`**：seed 有一条，Store 有 `addGoalProgress`，**无页面**。
- **年级 `ChildProfile.grade`**：seed 有值，添加孩子时写空字符串，**无编辑 UI**。
- **孩子端登录**：无。`session.role` 仍写在快照里，授权以 JWT 的 FamilyMember 为准。
- **短信 / 微信登录、家庭邀请**：未做。

## 数据读写入口

| 能力 | Store / service |
|---|---|
| 孩子 CRUD、切换 | `addChild` `updateChild` `removeChild` `selectChild` |
| 课程保存/结课/删除 | `upsertCourse` `archiveCourse` `restoreCourse` `removeCourse` |
| 课次例外 | `upsertScheduleException` `restoreOccurrenceSlot` `dropOccurrenceSlot` |
| 课次费用 | `upsertOccurrenceExpense` |
| 从预设加到某天 | `addPresetOccurrence`（今日/日历课表新增） |
| 快速临时安排 | `createQuickArrangement` |
| 账单 | `upsertExpense` `setExpenseStatus` `removeExpense` |
| 课次展开 | `services/schedule.ts` |
| 日期物化/进度 | `services/courseSchedule.ts` |
| 生命周期/本期结算 | `services/courseOverview.ts` |
| 统计 | `services/statistics.ts` |
| 课包余额 | `services/packages.ts` |
| 预算预测 | `services/forecast.ts` |
| 金额展示 | `services/billing.ts` |
| 课程账单明细 | `services/courseBills.ts` `buildCourseBillLedger` |

持久化：`data/storage.ts` 读时迁移（头像、课程色、`childIds`、例外物化）。

## 纯 UI 状态（不要做成服务端资源）

- `useHomeDate`：周偏移与选中日
- `useQuickAdd`：快捷菜单、待打开预设弹层
- `useTheme`：明暗（`myhome.theme`）
- 统计粒度与锚点日期
- 底栏 indicator 动画、弹层开合
- 导航 `returnTo` / `backTo`（客户端 `replace`，避免账单 ↔ 支出详情死循环）

组件哪些能写 Store、哪些只能展示，见 [capability-map.md](capability-map.md)#组件领域范围。
