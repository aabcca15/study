# 架构说明

## 目标

单仓维护。H5 与后期微信小程序前后端分离，共用同一套 Node.js API。

```text
[H5 Vue] ----\
               --> [Node.js API] --> 持久化
[微信小程序] --/
```

当前实现：仅 H5，Pinia + `localStorage`（`myhome.v1`）模拟持久化。契约已按服务端语义书写，接入时以服务端结果为准。

## 分层

1. **表现层**：H5（现 `src/`）、小程序（未来 `apps/miniprogram/`）。
2. **应用服务**：现为 `src/stores` 与 `src/services`；未来为 `server/`。
3. **领域规则**：类型在 `src/domain/`；事务与 API 形状在 skills 契约中。
4. **文档**：`docs/` 描述产品与口径，不替代契约中的接口细节。

## 迁移原则

- 不改现有 H5 技术栈。
- 目录迁到 `apps/web/` 与真正拆 `packages/domain` 分开做，避免一次大搬家。
- 小程序不复用 Vue 组件，只复用 API 与领域模型。
