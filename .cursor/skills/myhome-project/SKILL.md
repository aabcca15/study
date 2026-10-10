---
name: myhome-project
description: >-
  介绍「Uday家庭课表计划 / myhome」是做什么的、用户怎么走完今日课表、课程、账单、统计和家庭邀请，以及 H5 与微信小程序各自的数据落在哪里。
  换电脑、新开对话、用户问项目功能、页面流程、小程序和网页的区别，或准备部署上线时使用。
  改孩子、课程、排课、账单、登录或接口时，同时读 myhome-backend-contracts。
---

# Uday家庭课表计划：项目入口

家长用来管孩子的学校课、兴趣班、上课地点和费用。仓库名 `myhome`。产品名「Uday家庭课表计划」，登录页品牌字是 Uday。

先读本文件建立整体图。改业务规则、接口或表时再读 [myhome-backend-contracts](../myhome-backend-contracts/SKILL.md)。用户怎么一步步操作，见 [flows.md](flows.md)。小程序从注册到发布，见 [docs/miniprogram-launch.md](../../../docs/miniprogram-launch.md)；日常打包、分环境部署云函数、体验版 / 正式版见 [docs/miniprogram-deploy.md](../../../docs/miniprogram-deploy.md)。

## 两套客户端，数据不互通

| 端 | 代码 | 登录 | 数据 |
|---|---|---|---|
| 网页 H5 | `apps/web/` | 账号 + 密码，JWT | `server/` NestJS + 本机 SQLite |
| 微信小程序 | `apps/miniprogram/` | 微信 `openid`，云函数 `api` | 微信云数据库 `users` / `families` / `invites`，课程和账单都在 `families.snapshotJson`；集合由云函数自动创建 |

两边共用排课、账单规则：`server/src/domain` 与 `server/src/workspace/family-workspace.ts`。小程序云函数由 `npm run build:cloud` 把这套规则打进 `cloudfunctions/api/index.js`。不要假设网页上的家庭能在小程序里看到。

## 小程序用户能做什么

底栏：今日、日历、课程、统计。家庭成员从底栏中间 ＋ 菜单的「邀请家人」进入，不占底栏 tab。

- **创建者 `owner`**：建家庭的那个人。可改课表和账单，可邀请家长和家人，可移出别人。
- **家长 `parent`**：可改课表和账单，只能邀请家人。
- **家人 `viewer`**：只看今日、日历、老师和地点。不能改课，看不到账单。切换正在看的孩子只记在这台手机上。

邀请码 6 位、24 小时、最多 10 次。分享路径是 `pages/login/index?invite=CODE`。

已经登录过的手机用本机标记 `myhome.mp.logged` 恢复会话。恢复请求带 `resume: true`，没有家庭时不会偷偷新建。

## 改代码放哪

- 小程序页面、Pinia、云调用：`apps/miniprogram/src/`。不要把 H5 的 Vue 页面改成小程序语法。主包是登录和四个 tab 页（`src/pages/`），二级页面在分包 `src/subpages/`，路由写 `/subpages/xxx/index`。
- 小程序环境：`apps/miniprogram/.env.development`（`dev:mp`、`build:mp:dev`）和 `.env.production`（`build:mp`）里填 `VITE_CLOUD_ENV`、`WX_APPID`；`miniprogramRoot` 由打包脚本自动切换。
- 云函数源码：`apps/miniprogram/cloudfunctions/api/src/index.ts`。改完必须 `npm run build:cloud`，再在微信开发者工具里重新上传部署。只改源码不部署，线上仍是旧逻辑。
- 网页与 Nest API：`apps/web/`、`server/`。
- `apps/miniprogram/dist/` 被 git 忽略。换电脑后要重新 `npm install`、`npm run build:cloud`、`npm run build:mp`。

## 不要做

- 不要改本机全局 Git `user.name` / `user.email`。本仓库本地身份是 `jj` / `jj@admin.com`。
- 不要提交 `node_modules/`、`dist/`、`.env`、日志或密钥。
- 不要用游客 AppID。游客没有 openid，云函数会拒绝。
- 不要为了小程序重写现有 H5 业务逻辑。
- 级联删除、共享课、统计口径、角色权限放在 Store 或云函数里，不要只写在页面组件里。
