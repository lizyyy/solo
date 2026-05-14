# 接口限流账本 (Rate Limit Ledger)

一个偏技术方向的全栈Web/API应用，用于追踪开放平台API调用限流情况，支持租户配额管理、限流事件记录、手动补偿和账单导出。

## 功能特性

### 控制台功能
- **总览面板**: 租户总数、待处理限流事件、今日事件数、总补偿额度统计
- **租户管理**: 创建、启用/停用租户
- **配额配置**: 为租户配置日配额和月配额
- **限流事件**: 查看所有限流事件、按租户/状态筛选、标记已处理
- **补偿记录**: 手动补偿配额、关联限流事件
- **账单导出**: 生成日报/月报、导出CSV格式

### 核心规则
- **滑动窗口统计**: 基于时间窗口统计API调用频率
- **配额扣减**: 每次成功调用自动扣减日/月配额
- **三重限流**: 
  - 滑动窗口超限 (每分钟超过100次)
  - 日配额耗尽
  - 月配额耗尽
- **补偿调整**: 支持手动增加配额，可关联特定限流事件
- **限流原因**: 记录详细的限流原因和触发时间
- **账单导出**: 支持按日/月周期生成账单并导出CSV

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: 原生 HTML/CSS/JavaScript (无需构建工具)
- **数据持久化**: SQLite 文件数据库

## 本地运行说明

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 初始化示例数据（可选）

```bash
cd backend/src
node -e "const db = require('./models/database'); const { v4: uuidv4 } = require('uuid');

// 创建接口分组
const group1Id = uuidv4();
const group2Id = uuidv4();
db.run('INSERT INTO api_groups (id, name, description) VALUES (?, ?, ?)', [group1Id, '支付接口', '支付相关API接口']);
db.run('INSERT INTO api_groups (id, name, description) VALUES (?, ?, ?)', [group2Id, '用户接口', '用户管理相关API']);

// 创建租户
const tenant1Id = uuidv4();
const tenant2Id = uuidv4();
db.run('INSERT INTO tenants (id, name, contact_email, status) VALUES (?, ?, ?, ?)', [tenant1Id, '客户A科技有限公司', 'contact@companya.com', 'active']);
db.run('INSERT INTO tenants (id, name, contact_email, status) VALUES (?, ?, ?, ?)', [tenant2Id, '客户B电商平台', 'admin@companyb.com', 'active']);

// 创建配额
const quota1Id = uuidv4();
const quota2Id = uuidv4();
db.run('INSERT INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly) VALUES (?, ?, ?, ?, ?, ?, ?)', [quota1Id, tenant1Id, group1Id, 10, 300, 10, 300]);
db.run('INSERT INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly) VALUES (?, ?, ?, ?, ?, ?, ?)', [quota2Id, tenant2Id, group1Id, 5, 150, 5, 150]);

console.log('示例数据初始化完成!');
console.log('租户ID:', tenant1Id, tenant2Id);
console.log('接口分组ID:', group1Id, group2Id);
setTimeout(() => process.exit(0), 1000);
"
```

### 3. 启动后端服务

```bash
cd backend
npm start
# 或开发模式
npm run dev
```

后端服务将在 `http://localhost:3001` 启动

### 4. 启动前端

直接用浏览器打开 `frontend/index.html` 文件，或使用任何静态文件服务器：

```bash
cd frontend
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## API 接口示例

### 1. 租户管理

#### 创建租户
```bash
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试客户科技",
    "contact_email": "test@example.com"
  }'
```

#### 获取所有租户
```bash
curl http://localhost:3001/api/tenants
```

### 2. 配额管理

#### 创建配额
```bash
curl -X POST http://localhost:3001/api/quotas \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "替换为实际租户ID",
    "api_group_id": "替换为实际接口分组ID",
    "daily_quota": 1000,
    "monthly_quota": 30000
  }'
```

#### 获取所有配额
```bash
curl http://localhost:3001/api/quotas
```

### 3. 限流与调用记录

#### 记录API调用（核心限流逻辑）
```bash
curl -X POST http://localhost:3001/api/rate-limit/record \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "替换为实际租户ID",
    "api_group_id": "替换为实际接口分组ID",
    "window_size": 60
  }'
```

**成功响应**:
```json
{
  "success": true,
  "windowCallCount": 5,
  "remainingDaily": 995,
  "remainingMonthly": 29995
}
```

**限流响应**:
```json
{
  "success": false,
  "reason": "DAILY_QUOTA_EXHAUSTED",
  "message": "日调用配额已耗尽"
}
```

### 4. 补偿管理

#### 手动补偿配额
```bash
curl -X POST http://localhost:3001/api/rate-limit/compensate \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "替换为实际租户ID",
    "api_group_id": "替换为实际接口分组ID",
    "amount": 100,
    "reason": "系统误判补偿",
    "operator": "运维管理员",
    "rate_limit_event_id": "可选-关联的限流事件ID"
  }'
```

#### 获取补偿记录
```bash
curl http://localhost:3001/api/rate-limit/compensations
```

### 5. 限流事件

#### 获取限流事件列表
```bash
# 全部事件
curl http://localhost:3001/api/rate-limit/events

# 按租户筛选
curl "http://localhost:3001/api/rate-limit/events?tenant_id=租户ID"

# 未处理事件
curl "http://localhost:3001/api/rate-limit/events?resolved=false"
```

#### 标记事件已处理
```bash
curl -X PUT http://localhost:3001/api/rate-limit/events/事件ID/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "运维管理员"
  }'
```

### 6. 账单管理

#### 生成账单
```bash
curl -X POST http://localhost:3001/api/rate-limit/billing/generate \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "替换为实际租户ID",
    "period_type": "monthly"
  }'
```

#### 导出账单CSV
```bash
# 在浏览器中访问或使用curl
curl -O -J http://localhost:3001/api/rate-limit/billing/export/账单ID
```

#### 获取概览统计
```bash
curl http://localhost:3001/api/rate-limit/overview
```

## 故意失败的路径示例

### 场景1: 日配额耗尽导致限流

```bash
# 1. 先创建租户和配额（日配额设为3）
# 2. 连续调用4次记录API：

for i in {1..4}; do
  echo "--- 第 $i 次调用 ---"
  curl -X POST http://localhost:3001/api/rate-limit/record \
    -H "Content-Type: application/json" \
    -d '{
      "tenant_id": "你的租户ID",
      "api_group_id": "你的接口分组ID",
      "window_size": 60
    }'
  echo ""
done
```

**预期结果**: 前3次成功，第4次返回限流：
```json
{"success":false,"reason":"DAILY_QUOTA_EXHAUSTED","message":"日调用配额已耗尽"}
```

### 场景2: 滑动窗口频率超限

```bash
# 1. 设置配额日限额大于100
# 2. 快速连续调用101次

for i in {1..101}; do
  curl -X POST http://localhost:3001/api/rate-limit/record \
    -H "Content-Type: application/json" \
    -d '{
      "tenant_id": "你的租户ID",
      "api_group_id": "你的接口分组ID",
      "window_size": 60
    }'
  echo ""
done
```

**预期结果**: 第101次返回限流：
```json
{"success":false,"reason":"SLIDING_WINDOW_LIMIT","message":"滑动窗口调用频率超限"}
```

### 场景3: 租户无配额配置

```bash
# 使用一个未配置配额的租户ID调用
curl -X POST http://localhost:3001/api/rate-limit/record \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "不存在或无配额的租户ID",
    "api_group_id": "接口分组ID",
    "window_size": 60
  }'
```

**预期结果**:
```json
{"success":false,"reason":"QUOTA_NOT_CONFIGURED","message":"租户配额未配置"}
```

### 场景4: 重复创建相同配额

```bash
# 两次调用相同的租户+接口分组组合创建配额
curl -X POST http://localhost:3001/api/quotas \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "你的租户ID",
    "api_group_id": "你的接口分组ID",
    "daily_quota": 1000,
    "monthly_quota": 30000
  }'
```

**预期结果**（第二次调用）:
```json
{"error":"该租户配额已配置"}
```

## 数据模型

### 核心表结构

1. **tenants** - 租户表
   - id, name, contact_email, status, created_at, updated_at

2. **api_groups** - 接口分组表
   - id, name, description, created_at

3. **tenant_quotas** - 租户配额表
   - id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly

4. **call_windows** - 调用窗口表
   - id, tenant_id, api_group_id, window_start, window_end, call_count, window_size_seconds

5. **rate_limit_events** - 限流事件表
   - id, tenant_id, api_group_id, event_type, reason, triggered_at, window_id, resolved, resolved_at, resolved_by

6. **compensation_records** - 补偿记录表
   - id, tenant_id, api_group_id, amount, reason, operator, created_at, rate_limit_event_id

7. **billing_summaries** - 账单摘要表
   - id, tenant_id, period_type, period_start, period_end, total_calls, limited_calls, compensation_amount, status, exported, exported_at

## 项目结构

```
xy10804/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js          # 服务入口
│   │   ├── models/
│   │   │   └── database.js    # 数据库模型
│   │   ├── services/
│   │   │   ├── rateLimitService.js  # 限流核心逻辑
│   │   │   └── billingService.js    # 账单服务
│   │   └── routes/
│   │       ├── tenants.js
│   │       ├── quotas.js
│   │       ├── apiGroups.js
│   │       └── rateLimit.js
├── frontend/
│   ├── index.html             # 控制台界面
│   └── app.js                 # 前端逻辑
└── README.md
```

## 健康检查

```bash
curl http://localhost:3001/api/health
```
