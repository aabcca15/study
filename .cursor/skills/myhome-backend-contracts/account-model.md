# 账号与家庭模型（后期后端）

当前 H5 **没有账号**。`AppSnapshot.session` 只表示本机上次选中的孩子和写死的家长视图。后端第一期必须先引入「家庭」作为租户，再谈登录。

能力切片见 [capability-map.md](capability-map.md)#6-账号与多端未做。建表与导入见 [data-and-api.md](data-and-api.md)。

## 建议对象

```text
Account（登录账号，手机号 / 微信 openid）
  └── FamilyMember（账号在某家庭中的身份）
        ├── role: parent | child
        └── childProfileId?   仅孩子身份绑定档案
Family（租户）
  ├── ChildProfile[]     孩子档案，不是登录账号
  ├── Course[]
  ├── Expense[]
  ├── Goal[]
  └── ScheduleException[]
```

- **家长账号**拥有或受邀加入家庭，可管理该家庭全部孩子（权限仍以服务端成员表为准）。
- **孩子档案**现在就能建多个；**孩子登录**是后期能力：单独 Account + `role=child` + 绑定一个 `ChildProfile`。
- 不要把 `ChildProfile.id` 当成登录用户 ID。课程 `childIds` 指向档案，账单 `childId` 指向档案。
- 多家长共管同一家庭是一期就该预留的表结构（家庭成员），UI 可先只做「创建者即家长」。

## 登录渠道

1. **一期 H5**：验证码登录（手机号）即可；JWT 或 session cookie，payload 含 `accountId`、`familyId`、`role`。
2. **小程序**：微信 `openid` / `unionid` 绑定到同一 Account。同一人 H5 与小程序应能合并账号（手机号或 unionid）。
3. **孩子端**：家长生成邀请码或一次性链接，孩子微信登录后绑定档案。在绑定完成前，孩子请求一律 `403`。

服务端 **不得信任** 客户端传入的 `role`、`familyId`、`childId`。每次用令牌里的成员关系做授权。

## 与现有 Session 的映射

| 本地 `myhome.v1` | 后端 |
|---|---|
| 无 | `Account` + `Family` + `FamilyMember(parent)` |
| `children[]` | `ChildProfile`，`familyId` 外键 |
| `session.childId` | 用户偏好「课程/账单默认孩子」，可放 AccountPreference，不参与鉴权 |
| `session.role` | 废弃；改从 `FamilyMember.role` 读取 |
| 整份 snapshot | 按家庭隔离的资源，接口分页/按资源拉取，不再整包 JSON |

迁移：本机数据在用户首次登录后，经「导入家庭」接口一次性上传，生成 familyId，之后以服务端为准。导入必须幂等（按本地 ID 映射表）。

## 授权口径（与页面）

| 能力 | 家长 | 孩子（后期） |
|---|---|---|
| 今日 / 日历 / 统计 | 默认 `scope=family` | 强制 `scope=self` |
| 课程档案 / 账单生成 | `scope=child` 且孩子属于本家庭 | 只读本人或禁止写 |
| 新增孩子、删孩子、结课 | 家长 | 禁止 |
| 快速新增安排 | 写入指定档案；校验家庭成员 | 仅本人档案 |
| 支付 | 家长 | 禁止（或只读） |

`403 SCOPE_FORBIDDEN`：孩子带 `scope=family` 或其他 `childId`。  
`403 FAMILY_MISMATCH`：资源不属于令牌中的家庭。

## 建议认证 API

- `POST /api/auth/sms/send` `{ phone }` 限流。
- `POST /api/auth/sms/verify` `{ phone, code }` → tokens。
- `POST /api/auth/wechat` `{ code }` 小程序登录。
- `POST /api/auth/refresh`
- `POST /api/families` 创建家庭（首个家长）。
- `GET /api/families/current` 当前家庭摘要 + 成员 + 孩子列表。
- `POST /api/families/invites` 邀请家长或生成孩子绑定码。
- `POST /api/families/join` `{ inviteCode }`
- `PATCH /api/me/preferences` `{ defaultChildId }` 对应今日外的「当前孩子」。

错误码建议：`401 UNAUTHENTICATED`、`429 SMS_RATE_LIMITED`、`409 PHONE_TAKEN`、`404 INVITE_NOT_FOUND`、`410 INVITE_EXPIRED`。

## 金额、时区、审计

- 金额入库用 **整数分**（`amountMinor`）。本地现在是元的 number，迁移时 `Math.round(amount * 100)`。
- 家庭设置 `timezone`，默认 `Asia/Shanghai`。「今天」、统计周期、完成课次都按此时区，不按浏览器随意算。
- 写操作记 `actorAccountId`、时间、幂等键。删除孩子、结课、支付尤其需要审计。

## 明确不做（一期）

- 老师/机构账号
- 孩子之间互看
- 社交动态
- 未绑定家庭的「游客云同步」
