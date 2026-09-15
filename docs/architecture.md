# 架构说明

## 目标

单仓维护。H5 与后期微信小程序前后端分离，共用同一套 Node.js API。

```text
[H5 Vue] ----\
               --> [Node.js API] --> 持久化
[微信小程序] --/
```

当前实现：H5（`apps/web/`）+ NestJS API（`server/`，本地 SQLite）。Pinia 从 `GET /api/families/current/snapshot` 水合，写操作走语义接口。主题仍用本地 `myhome.theme`。

## 目录

```text
apps/web/              H5（现有）
apps/miniprogram/      微信小程序（占位）
server/                NestJS API（一期 Prisma + SQLite）
packages/domain/       共用领域模型（占位，尚未从 web 抽出）
docs/                  PRD / 设计 / 口径
.cursor/skills/        AI 契约（能力地图、账号、数据与接口、规则）
```

## 分层

1. **表现层**：H5（`apps/web/`）、小程序（未来 `apps/miniprogram/`）。
2. **应用服务**：`server/src`（认证、家庭 Workspace）；H5 Store 只做请求与展示态。
3. **领域规则**：类型暂在 `apps/web/src/domain/`；事务与 API 形状在 skills 契约中；稳定后抽到 `packages/domain/`。
4. **文档**：`docs/` 描述产品与口径，不替代契约中的接口细节。

## 迁移原则

- 不改现有 H5 技术栈。
- 真正拆 `packages/domain` 与上 Node 分开做。
- 小程序不复用 Vue 组件，只复用 API 与领域模型。
