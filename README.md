# 小树成长（studylog）

跟踪孩子学校课、兴趣班课表及相关费用。H5 为 Vue3 + Vite + TypeScript，后端为 NestJS，本地用 SQLite。第一期用账号+密码登录。

GitHub 仓库：[aabcca15/study](https://github.com/aabcca15/study)。本机仅本目录关联该远程，不改动全局 Git 账号。

## 当前能跑什么

在仓库根目录：

```bash
npm install
npm run dev:server
npm run dev
```

H5 默认 `http://localhost:5173/`，API 默认 `http://127.0.0.1:3000/api`。首次启动前在 `server/` 执行 `npx prisma generate` 与 `npx prisma db push`。

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
| `server/` | 已落地 | NestJS + Prisma + SQLite |
| `packages/domain/` | 占位 | 后期抽出共用类型与口径 |
| `docs/` | 已建 | PRD、设计说明、领域口径、架构 |
| `.cursor/skills/` | 已有 | 给 AI 的后端契约与事务规则 |

## 给后续前后端 / 小程序

- Web 与小程序只共用 **HTTP API 和领域模型**，不共用 Vue 组件。
- 改孩子、课程、排课、账单、统计、账号等业务时，同步 `.cursor/skills/myhome-backend-contracts/`（`SKILL.md` 入口：能力地图、页面、账号、数据与接口、规则、计费、缺口）。
- AI 开发入口见 [AGENTS.md](AGENTS.md)。
