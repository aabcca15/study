---
name: myhome-backend-contracts
description: 维护「小树成长」能力地图、页面/组件领域、账号模型、数据与接口设计、本地 Store 规则和待办缺口。改孩子、课程、排课、日历、账单、统计、目标、登录/账号，或梳理功能、设计 API、建表时自动使用。
---

# 小树成长：业务与后端契约

当前 H5 用 `localStorage` 键 `myhome.v1` 模拟持久化。改业务、拆后端或设计接口时先读本文件再按任务打开参考，不要只改页面组件。

## 必读顺序

做 **功能梳理 / 后端切片 / 接口与表** 时按这次序：

1. **能力、页面与组件领域**：[capability-map.md](capability-map.md)
2. **页面交互与信息架构**：[product-map.md](product-map.md)
3. **登录、家庭、角色**：[account-model.md](account-model.md)
4. **表、资源接口、导入与金额**：[data-and-api.md](data-and-api.md)
5. **规则、事务、错误码、Store 替换点**：[backend-contracts.md](backend-contracts.md)
6. **计费四层与迁移**：[billing-model-v2.md](billing-model-v2.md)
7. **缺口**：[gaps-and-backlog.md](gaps-and-backlog.md)

代码事实源：`apps/web/src/domain/types.ts`、`apps/web/src/stores/app.ts`、`apps/web/src/services/`。契约必须与这三处一致。

## 开发要求

1. 先确认实体、关联、数据所有权（家庭 / 孩子 / 课程 / 账单）。对照 `capability-map.md` 的能力表，不要漏作用域。
2. 区分纯 UI 状态与必须由服务端执行的规则。UI：选中日期、底栏菜单、主题、统计年/月、`returnTo`。
3. 新接口或改表先更新 `data-and-api.md`，再补 `backend-contracts.md` 的规则、错误码、事务、幂等。
4. Store 方法保持业务语义；级联删除、共享课、统计口径、时间冲突不要只写在 `.vue`。组件领域见 capability-map。
5. 接入后端后以服务端结果为准；前端只做确认、请求状态和错误提示。
6. 发现不合理逻辑：先记入 `gaps-and-backlog.md`（现状 / 建议 / 是否已改），再改代码。

## 当前核心约束

- H5 是家长端。今日、日历、统计、本周账单默认家庭作用域；课程列表与记一笔按会话选中的孩子过滤（缺口）。
- 未来孩子端登录后，同类页面只能看本人；客户端选择不能扩大授权。
- 至少保留一个孩子。共享课删孩子时只解绑，不删课。
- 课程生命周期与费用结算独立：结课不改账单，结清不结束排课。
- 排课例外跟课程走。冲突按孩子隔离。独享课、该孩子账单与目标随孩子删除。
- 费用四层分开：实际支出（Payment）、待支付、待结算、预计。家长课次行只展示已支付 / 未支付。
- 尚无登录。`SessionState.role` / `childId` 只是本地会话，不是账号。

## 完成检查

- [ ] 页面没有直接改持久化快照
- [ ] Store 集中实现业务规则
- [ ] 能力地图 / 产品地图 / 账号 / 数据接口 / 契约已按改动更新
- [ ] 新发现的不合理点已写入 backlog
- [ ] 共享数据不会被误删
- [ ] 金额、时区、作用域没有写进纯 UI 组件
- [ ] 构建与关键交互验证通过
