# 小树成长（studylog）

跟踪孩子学校课、兴趣班课表及相关费用。当前是 Vue3 + Vite + TypeScript 的移动 H5，数据暂存在浏览器 `localStorage`（键 `myhome.v1`），尚无服务端。

GitHub 仓库：[aabcca15/study](https://github.com/aabcca15/study)。本机仅本目录关联该远程，不改动全局 Git 账号。

## 当前能跑什么

在仓库根目录：

```bash
npm install
npm run dev
```

开发地址默认 `http://localhost:5173/`（实际工程在 `apps/web/`）。

```bash
npm run build
npm run preview
```

## 仓库布局

单仓 Monorepo（npm workspaces）：

| 路径 | 状态 | 用途 |
|---|---|---|
| `apps/web/` | 现有 | H5（Vue3 + Vite + Pinia） |
| `apps/miniprogram/` | 占位 | 后期微信小程序（与 H5 共用后端） |
| `server/` | 占位 | 后期 Node.js API |
| `packages/domain/` | 占位 | 后期抽出共用类型与口径 |
| `docs/` | 已建 | PRD、设计说明、领域口径、架构 |
| `.cursor/skills/` | 已有 | 给 AI 的后端契约与事务规则 |

## 给后续前后端 / 小程序

- Web 与小程序只共用 **HTTP API 和领域模型**，不共用 Vue 组件。
- 改孩子、课程、排课、账单、统计等业务时，同步 `.cursor/skills/myhome-backend-contracts/`。
- AI 开发入口见 [AGENTS.md](AGENTS.md)。
