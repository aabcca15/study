# 微信小程序打包与发布（开发 / 体验版 / 正式版）

第一次注册账号、填资料、选类目，看 [miniprogram-launch.md](miniprogram-launch.md)。本文讲已经有 AppID 之后，每次怎么打包、上传云函数、发体验版和正式版。

Windows PowerShell 里命令一条一条执行，不要用 `&&` 连起来。下面的命令都在仓库根目录 `myhome` 执行。

## 1. 数据存在哪里

小程序所有新增、修改、删除都走云函数 `api`，前端不直接读写数据库：

```text
页面 → Pinia store（src/stores/family.ts）
     → wx.cloud.callFunction({ name: 'api', data: { action, payload } })
     → 云函数按 openid 找到家庭，在事务里改快照
     → 写回云数据库
```

云数据库只有三个集合：

| 集合 | 存什么 |
| --- | --- |
| `users` | 每个微信用户一条：`openid`、`familyId`、`role`、`displayName` |
| `families` | 每个家庭一条。孩子、课程、排课、临时安排、出勤、账单、付款、退款**全部**放在字段 `snapshotJson` 里（一段 JSON 字符串），另有 `version`、`ownerOpenid` |
| `invites` | 邀请码，文档 ID 就是邀请码 |

所以云开发控制台里**不会**出现 `courses`、`expenses` 这类集合。想看刚加的课或账单，打开「数据库」→ `families` → 自己家庭那条记录 → `snapshotJson`。

在控制台找不到数据，通常是下面两个原因之一：

1. 看的是「云函数」页面，不是「数据库」页面。
2. 控制台切到的云环境和小程序实际连接的环境不同。小程序连哪个环境，由 `.env.*` 里的 `VITE_CLOUD_ENV` 决定；留空时用开发者工具当前选中的环境。

## 2. 集合会自动创建

不需要手动建 `users`、`families`、`invites`。正式上线也不需要。

新环境里第一次调用云函数时，如果数据库报「集合不存在」，云函数会自动创建这三个集合，然后把这次请求重新执行一遍。这段逻辑在 `cloudfunctions/api/src/index.ts` 的 `ensureCollections()`。

建议做一次（可选）：集合出现后，在「数据库」里把三个集合的权限都改成「所有用户不可读写」。小程序端本来就不直接访问数据库，云函数用管理员身份读写，不受这条限制。

## 3. 环境配置

两个环境文件在 `apps/miniprogram/`：

| 文件 | 用在 | 内容 |
| --- | --- | --- |
| `.env.development` | `npm run dev:mp`、`npm run build:mp:dev` | 开发 / 测试云环境 |
| `.env.production` | `npm run build:mp` | 正式云环境 |

每个文件三项：

```text
VITE_APP_ENV=dev                 # dev 或 prod，只是标记
VITE_CLOUD_ENV=myhome-dev-xxxx   # 云开发控制台 → 设置 → 环境 ID
WX_APPID=wx1234567890abcdef      # 小程序后台 → 开发管理 → 开发设置
```

这里只放 AppID、环境 ID 这类公开标识，文件会进 git。不要放 AppSecret 或任何密钥。个人临时改动可以写在 `.env.development.local`，它不进 git。

只有一个云环境时，两个文件的 `VITE_CLOUD_ENV` 填同一个即可。建议准备两个：一个 `myhome-dev` 给自己测试，一个 `myhome-prod` 给家人真实使用，测试数据不会混进正式家庭。

每次打包前，脚本 `scripts/use-env.mjs` 会自动：

- 把 `project.config.json` 的 `miniprogramRoot` 改成本次的输出目录。`dev:mp` 是 `dist/dev/mp-weixin/`，`build:mp` / `build:mp:dev` 是 `dist/build/mp-weixin/`。
- 把 `WX_APPID` 写进 `project.config.json` 和 `src/manifest.json`（`WX_APPID` 留空时不改）。
- 清掉上一次的输出目录。

不用再手动改 `miniprogramRoot`。

## 4. 三个打包命令

| 命令 | 输出目录 | 连接的云环境 | 用途 |
| --- | --- | --- | --- |
| `npm run dev:mp` | `dist/dev/mp-weixin/` | 开发 | 日常改页面，保存后自动重新编译 |
| `npm run build:mp:dev` | `dist/build/mp-weixin/` | 开发 | 压缩后的包，上传成体验版给自己测 |
| `npm run build:mp` | `dist/build/mp-weixin/` | 正式 | 上传审核、发布正式版 |

`build:*` 结束时会打印主包和分包体积。微信限制主包和单个分包各不超过 2MB，整包不超过 20MB。超过时命令会返回失败，并列出 200KB 以上的大文件。

开发者工具已经打开项目时，换命令之后点一下工具栏「编译」。如果工具没有切到新目录，关掉项目重新打开 `apps/miniprogram`。

## 5. 包体积做了什么

- 首页 tab（今日、日历、课程、统计）和登录页在主包。账单、课程编辑、课程账单、记账、家庭成员在分包 `subpages/`。进入今日页后会在后台预下载分包，点进去不需要等。
- 孩子头像雪碧图从 1.4MB 的 PNG 压成 47KB 的 JPG（`src/static/user_icon.jpg`）。
- 云函数不再复制进 `dist`，它只从 `apps/miniprogram/cloudfunctions/` 上传。
- 开启了按需注入组件（`lazyCodeLoading`），以及 JS / WXSS / WXML 压缩和上传时过滤无用文件。
- 关闭了 uni 统计，不再打包统计代码，也不会请求 dcloud 的统计域名。

新增图片时，先压缩再放进 `src/static/`。单张超过 200KB 的图，建议放到云存储，用链接加载。

## 6. 上传云函数

页面代码和云函数要分开上传。改了 `cloudfunctions/api/src/index.ts`，或者改了 `server/src/domain`、`src/domain` 里的共享规则，都要重新上传云函数。

1. 打包云函数：

   ```text
   npm run build:cloud
   ```

   生成 `apps/miniprogram/cloudfunctions/api/index.js`。工具上传的是这个文件，不是 `src/index.ts`。

2. 开发者工具左侧找到 `cloudfunctions` 目录，它后面会显示当前环境名。右键 `cloudfunctions` →「选择环境」，选要部署到的环境：
   - 测试：选 `.env.development` 里的环境
   - 正式：选 `.env.production` 里的环境

3. 右键 `cloudfunctions/api` →「上传并部署：云端安装依赖」。不要选「不安装依赖」。

4. 云开发控制台 →「云函数」，确认 `api` 的更新时间是刚才。

有两个环境时，第 2、3 步每个环境各做一次。

上线顺序：**先部署云函数，再上传小程序代码**。新版页面调用了旧云函数没有的动作时，会提示「不支持的操作」。

## 7. 发体验版

体验版是给自己和家人在手机上试用的版本，不需要审核。

1. 在 `apps/miniprogram/.env.development` 填好 `VITE_CLOUD_ENV` 和 `WX_APPID`。
2. 按第 6 步，把云函数部署到开发环境。
3. 打包：

   ```text
   npm run build:mp:dev
   ```

   想让体验版直接用正式数据，改用 `npm run build:mp`。

4. 开发者工具打开 `apps/miniprogram`，点「编译」，确认模拟器能正常打开登录页。
5. 右上角「上传」。版本号填例如 `0.2.0`，备注写「体验：xxx」。
6. 打开 [mp.weixin.qq.com](https://mp.weixin.qq.com) →「管理」→「版本管理」→「开发版本」，在刚上传的版本上选「选为体验版」。
7. 「管理」→「成员管理」→「体验成员」，添加家人的微信号。最多 15 人（个人主体）。
8. 版本管理里体验版旁边有二维码，用手机微信扫码打开。

验证：创建家庭、加一门课、记一笔账，然后去云开发控制台「数据库」→ `families` 看 `snapshotJson` 里有没有这条课和账单。

## 8. 发正式版

1. 在 `apps/miniprogram/.env.production` 填好正式的 `VITE_CLOUD_ENV` 和 `WX_APPID`。
2. 按第 6 步，把云函数部署到**正式环境**。
3. 打包：

   ```text
   npm run build:mp
   ```

   终端里不应出现「正式包没有填写 VITE_CLOUD_ENV」的提示。

4. 开发者工具「编译」，再点「预览」用手机扫码，把登录、加课、记账、邀请家人走一遍。
5. 「上传」，版本号比上一次大，例如 `1.0.0`，备注写本次改动。
6. mp.weixin.qq.com →「版本管理」→「开发版本」→「提交审核」。审核备注可复制 [miniprogram-profile.md](miniprogram-profile.md) 里的段落。
7. 审核通过后，在「审核版本」里点「发布」。不点发布，用户仍在用旧版本。
8. 发布后用一个没有开发者权限的微信搜索小程序名，确认能打开。

以后每次迭代重复第 8 节。没改云函数时跳过第 2 步。

## 9. 常见问题

**开发者工具提示主包超过 2MB。**  
执行 `npm run build:mp`，看最后几行 `[size]` 输出里哪个文件大。确认工具编译的是 `dist/build/mp-weixin/`，不是旧的 `dist/dev/mp-weixin/`：`dev` 目录没压缩，体积会大很多。

**云函数报「collection not exists」。**  
云函数还是旧版本，没有自动建集合的逻辑。重新 `npm run build:cloud`，再上传部署一次。

**控制台数据库里看不到刚加的课。**  
课和账单在 `families` 那条记录的 `snapshotJson` 字段里，没有单独的集合。另外确认控制台右上角的环境，和 `.env.*` 里的 `VITE_CLOUD_ENV` 一致。

**体验版能用，正式版登录失败。**  
正式环境没有部署 `api`。按第 6 步切到正式环境再上传一次。

**提示「请在微信内打开小程序」。**  
用了游客 AppID，或 `WX_APPID` 没填。填好后重新打包，开发者工具里确认右上角是你的 AppID。

**换了电脑，页面空白或是旧页面。**  
`dist` 不进 git。执行 `npm install`、`npm run build:cloud`、`npm run build:mp`，再用开发者工具打开 `apps/miniprogram`，菜单「清缓存」→「全部清除」后编译。
