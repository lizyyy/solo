# SaaS 租户配额超用 API

一套可直接给同事试用的 **SaaS 租户配额超用监控 API**，围绕租户的存储、调用量和成员数配额，按套餐、加购和冻结状态进行全链路管控。

## ✨ 核心特性

| 功能 | 说明 |
|------|------|
| 套餐配额 | 4 档内置套餐（免费版/入门版/专业版/企业版），可自由升降级 |
| 加购包 | 临时/永久加购配额，支持生效时间和过期时间 |
| 软硬限制 | 软限制（80%告警）+ 硬限制（超用），状态清晰 |
| 冻结状态 | 冻结后阻止新用量上报，完整的冻结/解冻历史 |
| 超用原因分析 | 自动识别是「历史用量」「加购包过期」还是「当前超用」导致 |
| 幂等性 | `requestId` 保证重复上报不会重复计数 |
| 人工修正 | 强制记录前后差异、原因和操作人 |
| 审计日志 | 所有操作全链路可追溯 |
| 日期报告 | 支持 JSON/CSV 格式导出日报 |

## 🚀 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm start
```

服务将在 `http://localhost:3000` 启动。

## 📦 内置套餐

| 套餐 | 存储(GB) | 调用量 | 成员数 | 软限制 |
|------|----------|--------|--------|--------|
| free (免费版) | 1 | 1,000 | 3 | 80% |
| starter (入门版) | 10 | 10,000 | 10 | 80% |
| pro (专业版) | 100 | 100,000 | 50 | 80% |
| enterprise (企业版) | 1,000 | 1,000,000 | 200 | 80% |

## 🔌 API 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/plans` | 查看所有套餐 |
| POST | `/api/tenants` | 创建租户 |
| GET | `/api/tenants/:id` | 查询租户信息 |
| GET | `/api/tenants/:id/ledger` | **查询配额账本（核心接口）** |
| POST | `/api/tenants/:id/usage` | 上报用量 |
| POST | `/api/tenants/:id/plan` | 套餐变更 |
| POST | `/api/tenants/:id/addons` | 加购配额 |
| POST | `/api/tenants/:id/freeze` | 冻结租户 |
| POST | `/api/tenants/:id/unfreeze` | 解冻租户 |
| POST | `/api/tenants/:id/correction` | 人工修正 |
| GET | `/api/tenants/:id/history` | 查询历史记录 |
| GET | `/api/tenants/:id/report/daily` | 导出日期用量报告 |

## 📝 主要演示路径（正常流程）

```bash
# 确保服务已启动
npm start

# 新开一个终端，运行 Node.js 自动化演示
node scripts/demo-normal-flow.js
```

**演示内容：**
1. 创建租户（入门版 10GB 存储）
2. 上报用量 → 正常状态
3. 接近配额 → 软限制告警（warning）
4. 超出配额 → 硬超用（over）
5. 加购恢复 → 回到正常
6. 套餐降级 → 历史用量追溯，再次超用 + 超用原因分析
7. 冻结租户 → 阻止新用量上报
8. 人工修正 → 记录前后差异和操作人
9. 幂等性测试 → 重复上报不重复计数
10. 导出日报 → JSON/CSV 格式

## ❌ 失败路径演示

```bash
node scripts/demo-failure-flow.js
```

**覆盖的异常场景：**
- 409 创建已存在租户
- 404 查询不存在租户/套餐
- 400 缺少必填参数
- 400 冻结后上报用量
- 重复冻结/解冻的幂等性
- 加购包过期后的超用原因分析
- 人工修正缺少操作人

## 🌰 Curl 一步一步演示

```bash
# 确保服务已启动
chmod +x scripts/curl-demo.sh
./scripts/curl-demo.sh
```

或者手动执行关键 curl 命令：

```bash
# 1. 健康检查
curl http://localhost:3000/health

# 2. 创建租户
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"id":"my-tenant","name":"我的公司","planId":"starter"}'

# 3. 查询配额账本
curl http://localhost:3000/api/tenants/my-tenant/ledger

# 4. 上报用量（带 requestId 保证幂等）
curl -X POST http://localhost:3000/api/tenants/my-tenant/usage \
  -H "Content-Type: application/json" \
  -d '{"resourceType":"storage","amount":5,"requestId":"req-001"}'

# 5. 超用（10GB 配额，再上报 6GB -> 累计 11GB）
curl -X POST http://localhost:3000/api/tenants/my-tenant/usage \
  -H "Content-Type: application/json" \
  -d '{"resourceType":"storage","amount":6,"requestId":"req-002"}'

# 6. 查看超用状态和原因
curl http://localhost:3000/api/tenants/my-tenant/ledger

# 7. 加购 5GB
curl -X POST http://localhost:3000/api/tenants/my-tenant/addons \
  -H "Content-Type: application/json" \
  -d '{"type":"storage","amount":5,"operator":"sales-001"}'

# 8. 套餐降级（历史用量追溯）
curl -X POST http://localhost:3000/api/tenants/my-tenant/plan \
  -H "Content-Type: application/json" \
  -d '{"planId":"free","reason":"用户降级","operator":"cs-001"}'

# 9. 查看历史记录
curl http://localhost:3000/api/tenants/my-tenant/history

# 10. 导出日报（JSON）
curl "http://localhost:3000/api/tenants/my-tenant/report/daily?from=2026-05-01&to=2026-05-12"

# 11. 导出日报（CSV）
curl "http://localhost:3000/api/tenants/my-tenant/report/daily?from=2026-05-01&to=2026-05-12&format=csv" -o report.csv
```

## 📊 配额账本（Ledger）字段说明

调用 `GET /api/tenants/:id/ledger` 返回：

```json
{
  "success": true,
  "ledger": {
    "tenantId": "my-tenant",
    "tenantName": "我的公司",
    "status": "active",
    "currentPlan": { "id": "starter", "name": "入门版", "effectiveAt": "..." },
    "ledger": {
      "storage": {
        "planQuota": 10,
        "addonQuota": 5,
        "totalQuota": 15,
        "softLimit": 12,
        "currentUsage": 11,
        "historicalUsage": 0,
        "available": 4,
        "overage": 0,
        "status": "warning",
        "overageReason": null
      },
      "call": { ... },
      "member": { ... }
    }
  }
}
```

**状态说明：**
- `normal`: 正常使用，未达软限制
- `warning`: 已达软限制（默认 80%），应告警
- `over`: 已超用（硬限制），应冻结或限制功能

**超用原因（overageReason）：**
- `historical`: 套餐生效前的历史用量导致
- `addon_expired`: 加购包过期，配额减少
- `current_overuse`: 当前周期使用量 > 当前有效配额

## 🧪 重置数据库

如需重新开始演示，删除数据库文件即可：

```bash
rm quota.db
npm start
```

## 📁 项目结构

```
.
├── server.js              # Express 服务入口
├── package.json
├── quota.db               # SQLite 数据库（运行时生成）
├── README.md
├── src/
│   ├── db.js              # 数据库模型和初始化
│   └── quota-engine.js    # 核心配额计算引擎
└── scripts/
    ├── demo-helper.js     # 演示辅助函数
    ├── demo-normal-flow.js    # 正常流程演示
    ├── demo-failure-flow.js   # 失败路径演示
    └── curl-demo.sh           # 纯 curl 演示脚本
```

## 🔐 关键业务规则

| 规则 | 说明 |
|------|------|
| 用量上报幂等 | 同一 `requestId` 多次上报只记一次 |
| 套餐生效时间 | 套餐变更时重置「当前周期」起点，历史用量单独计算 |
| 超用原因分析 | 自动判断是历史用量/加购过期/当前超用 |
| 冻结阻断 | `status = 'frozen'` 时拒绝新用量上报 |
| 人工修正审计 | `operator` 为必填，自动记录 before/after 状态 |
| 加购包有效期 | 仅 `effective_at <= now < expires_at` 期间计入配额 |
