# AI 开发约定

本仓库是「小树成长」单仓：H5 在 `apps/web/`，后期会加 Node.js 与微信小程序。改代码前先读本文件和 `docs/`。

## 现在改哪里

- **H5 UI / 路由 / Pinia**：`apps/web/`，技术栈保持 Vue3 + Vite + TS + Pinia + Vue Router。业务数据走 `/api`，不要再写 `myhome.v1`。
- **NestJS API**：`server/`，本地 SQLite，`npm run dev:server`。
- **业务规则、能力地图、账号与接口**：`.cursor/skills/myhome-backend-contracts/`（`SKILL.md` 入口；`capability-map.md` / `product-map.md` / `account-model.md` / `data-and-api.md` / `backend-contracts.md` / `billing-model-v2.md` / `gaps-and-backlog.md`）。
- **产品与口径说明**：`docs/prd/`、`docs/domain/`、`docs/design/`、`docs/architecture.md`。

不要把级联删除、共享课、统计口径只写在页面组件里；Store 保持业务语义，契约保持与 `apps/web/src/domain/types.ts`、`apps/web/src/stores/app.ts` 一致。

## 以后改哪里（尚未落地）

- Node API 放 `server/`，Web 与小程序打同一套接口。
- 可复用类型与口径再抽到 `packages/domain/`。
- 小程序只放 `apps/miniprogram/`，不要把 Vue 页面改成小程序语法。

## 明确不要做

- 不要修改本机全局 Git `user.name` / `user.email`。本仓库本地身份是 `jj` / `jj@admin.com`。
- 不要提交 `node_modules/`、`dist/`、`.env`、日志或密钥。
- 不要为了小程序提前重写现有 H5 业务逻辑。
