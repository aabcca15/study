# 领域口径

业务不变量以 `.cursor/skills/myhome-backend-contracts/` 为准：

- 页面与数据作用域：[product-map.md](../.cursor/skills/myhome-backend-contracts/product-map.md)
- 规则与 API：[backend-contracts.md](../.cursor/skills/myhome-backend-contracts/backend-contracts.md)
- 账号与家庭：[account-model.md](../.cursor/skills/myhome-backend-contracts/account-model.md)
- 已知缺口：[gaps-and-backlog.md](../.cursor/skills/myhome-backend-contracts/gaps-and-backlog.md)

这里只放给人读的摘要，避免两处长期打架。

摘要：

- 当前 H5 是家长端：今日、日历、学习统计默认看全家；课程页和账单页目前按会话选中的孩子过滤（计划对齐，见缺口文档）。
- 至少一名孩子。
- 课程可多孩子共享；删一个孩子时不得删掉共享课，只解绑。
- 排课例外跟课程走，共享课的例外继续服务剩余孩子。
- 独享课、该孩子账单与目标随孩子删除。
- 统计实际支出看 Payment 支付日净额；待支付、待结算、预计费用分开，不按「单价 × 次数」充当总支出。
- 尚无登录；后端第一期以家庭为租户。
