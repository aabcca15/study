# 小树成长小程序

uni-app（Vue 3）家长端。微信小程序走云开发：登录用微信号 `openid`，读写走云函数 `api`。页面里的日期、时间和下拉都用小程序原生 `picker`。

抖音小程序可以先编译页面（`mp-toutiao`）。云函数目前只接微信，抖音端打开会提示尚未接入。

网页版仍使用 `server/` 的账号密码和 SQLite。两边复用同一套排课、账单规则（`server/src/domain` 与 `server/src/workspace/family-workspace.ts`），数据不互通。

## 目录

```text
src/                    uni-app 页面、Pinia、云函数调用
cloudfunctions/api/     微信云函数。src/index.ts 是源码，index.js 是打包结果
scripts/build-cloud.mjs 把家庭工作区打进云函数
```

云数据库两个集合，由云函数创建：

- `users`：`openid`、`unionid`、`familyId`
- `families`：`snapshotJson`（与网页版家庭快照相同）、`version`、`timezone`

请在云开发控制台把这两个集合的权限设为「仅云函数可读写」，不要让小程序端直接改数据库。

## 本地运行

1. 用自己的小程序 AppID 开通云开发。把 AppID 填进 `src/manifest.json` 的 `mp-weixin.appid`。环境 ID 可填进 `src/config.ts` 的 `CLOUD_ENV`；留空则用开发者工具当前环境。
2. 在仓库根目录安装依赖：`npm install`
3. 打包云函数：`npm run build:cloud`
4. 安装云函数依赖：在微信开发者工具里对 `api` 选择「安装依赖」，或进入 `apps/miniprogram/cloudfunctions/api` 后执行 `npm install`
5. 启动微信端：`npm run dev:mp`
6. 用微信开发者工具导入 **`apps/miniprogram`**（这一层同时包含小程序和 `cloudfunctions/`）。把 `project.config.json` 里的 `appid` 换成你的小程序 AppID。只执行过 `build:mp` 时，把 `miniprogramRoot` 改成 `dist/build/mp-weixin/`。
7. 在开发者工具中上传并部署云函数 `api`（云端安装依赖）。

云开发不能使用游客 AppID。未开通云环境时，页面可以编译，登录会失败。

抖音端编译：`npm run dev:mp-toutiao --prefix apps/miniprogram`

## 云函数动作

小程序只调用 `wx.cloud.callFunction({ name: 'api', data: { action, payload } })`。身份以云函数里的 `OPENID` 为准，不信任客户端传来的家庭 ID。

`login` 会按 openid 找到或创建家庭。其余动作包括孩子、课程、加课、临时安排、课次、出勤、账单、退款和出账，规则与网页版家庭工作区一致。
