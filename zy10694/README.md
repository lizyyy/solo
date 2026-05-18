# API文档中心接口废弃延期登记API

用于登记API废弃延期申请，避免调用方口头承诺还在使用的情况。支持创建、审批、撤回、到期提醒和导出功能，并提供同步检查功能用于排查延期记录未同步到告警规则的问题。

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API接口列表

### 基础路径
`/api/v1/deprecation-extension`

### 1. 创建延期登记

**POST** `/extensions`

**请求体:**
```json
{
  "apiName": "用户信息查询API",
  "apiPath": "/api/v1/user/info",
  "caller": "订单服务",
  "originalDeprecationDate": "2024-06-30",
  "extendedDeprecationDate": "2024-12-31",
  "reason": "订单系统重构延期，需要继续使用该接口",
  "contactPerson": "张三",
  "contactEmail": "zhangsan@company.com"
}
```

**CURL命令:**
```bash
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "用户信息查询API",
    "apiPath": "/api/v1/user/info",
    "caller": "订单服务",
    "originalDeprecationDate": "2024-06-30",
    "extendedDeprecationDate": "2024-12-31",
    "reason": "订单系统重构延期，需要继续使用该接口",
    "contactPerson": "张三",
    "contactEmail": "zhangsan@company.com"
  }'
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "apiName": "用户信息查询API",
    "apiPath": "/api/v1/user/info",
    "caller": "订单服务",
    "status": "pending",
    ...
  }
}
```

### 2. 查询延期登记列表

**GET** `/extensions`

**查询参数:**
- `status` (可选): pending/approved/rejected/withdrawn/expired
- `caller` (可选): 调用方名称
- `apiPath` (可选): API路径

**CURL命令:**
```bash
# 查询所有
curl http://localhost:3000/api/v1/deprecation-extension/extensions

# 按状态筛选
curl "http://localhost:3000/api/v1/deprecation-extension/extensions?status=approved"

# 按调用方筛选
curl "http://localhost:3000/api/v1/deprecation-extension/extensions?caller=订单服务"
```

### 3. 查询单个延期登记

**GET** `/extensions/:id`

**CURL命令:**
```bash
curl http://localhost:3000/api/v1/deprecation-extension/extensions/{id}
```

### 4. 审批延期登记

**POST** `/extensions/:id/approve`

**请求体:**
```json
{
  "approvedBy": "审批员A"
}
```

**CURL命令:**
```bash
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "审批员A"}'
```

### 5. 拒绝延期登记

**POST** `/extensions/:id/reject`

**请求体:**
```json
{
  "approvedBy": "审批员A"
}
```

**CURL命令:**
```bash
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/{id}/reject \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "审批员A"}'
```

### 6. 撤回延期登记

**POST** `/extensions/:id/withdraw`

**CURL命令:**
```bash
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/{id}/withdraw
```

### 7. 同步状态检查

**GET** `/sync-check`

当调用方仍收到废弃告警时，使用此接口检查哪条延期记录没有同步到提醒规则。

**查询参数:**
- `apiPath` (必填): API路径
- `caller` (可选): 调用方名称

**CURL命令:**
```bash
curl "http://localhost:3000/api/v1/deprecation-extension/sync-check?apiPath=/api/v1/user/info&caller=订单服务"
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "extensionId": "uuid",
      "apiPath": "/api/v1/user/info",
      "caller": "订单服务",
      "extendedDeprecationDate": "2024-12-31",
      "syncStatus": "unsynced",
      "ruleExists": true,
      "ruleDateMatches": false
    }
  ]
}
```

### 8. 查询未同步的延期登记

**GET** `/unsynced`

列出所有已审批但未同步到告警规则的延期记录。

**CURL命令:**
```bash
curl http://localhost:3000/api/v1/deprecation-extension/unsynced
```

### 9. 更新同步状态

**PATCH** `/extensions/:id/sync-status`

**请求体:**
```json
{
  "syncStatus": "synced",
  "syncMessage": "已同步到告警规则"
}
```

**CURL命令:**
```bash
curl -X PATCH http://localhost:3000/api/v1/deprecation-extension/extensions/{id}/sync-status \
  -H "Content-Type: application/json" \
  -d '{
    "syncStatus": "synced",
    "syncMessage": "已同步到告警规则"
  }'
```

### 10. 到期提醒查询

**GET** `/expiring`

查询即将到期的延期登记。

**查询参数:**
- `daysBefore` (可选): 提前多少天，默认7天

**CURL命令:**
```bash
# 默认7天
curl http://localhost:3000/api/v1/deprecation-extension/expiring

# 指定15天
curl "http://localhost:3000/api/v1/deprecation-extension/expiring?daysBefore=15"
```

### 11. 导出数据

**GET** `/export`

**查询参数:**
- `format`: json/csv，默认json
- `status` (可选): 按状态筛选
- `caller` (可选): 按调用方筛选

**CURL命令:**
```bash
# 导出JSON
curl http://localhost:3000/api/v1/deprecation-extension/export

# 导出CSV并保存
curl "http://localhost:3000/api/v1/deprecation-extension/export?format=csv" -o extensions.csv

# 按条件筛选导出
curl "http://localhost:3000/api/v1/deprecation-extension/export?format=csv&status=approved"
```

## SDK使用示例

### 带缓存的SDK调用

```typescript
import { DeprecationExtensionSDK } from './src/sdk';

// SDK默认带5分钟缓存
const sdk = new DeprecationExtensionSDK();

// 创建延期登记
const extension = await sdk.createExtension({
  apiName: '用户信息查询API',
  apiPath: '/api/v1/user/info',
  caller: '订单服务',
  originalDeprecationDate: '2024-06-30',
  extendedDeprecationDate: '2024-12-31',
  reason: '订单系统重构延期',
  contactPerson: '张三',
  contactEmail: 'zhangsan@company.com'
});

// 审批
await sdk.approveExtension(extension.id, '审批员A');

// 更新同步状态
await sdk.updateSyncStatus(extension.id, 'synced', '已同步');

// 使用缓存查询（第二次调用会命中缓存）
const list1 = await sdk.listExtensions({}, true);
const list2 = await sdk.listExtensions({}, true); // 使用缓存

// 同步状态检查
const syncCheck = await sdk.checkSyncStatus('/api/v1/user/info', '订单服务');
console.log('同步检查结果:', syncCheck);
```

### 内网旧路径调用示例

如果需要兼容内网旧路径，可以通过反向代理或修改SDK配置：

```typescript
// 使用内网旧路径的SDK初始化
const oldSdk = new DeprecationExtensionSDK('http://intranet.company.com/old-api-path');
```

## 运行测试

### 完整测试套件

```bash
# 启动服务
npm run dev

# 新开终端运行测试
npm run test
```

### 手动测试步骤

**1. 创建正常记录**
```bash
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "用户信息查询API",
    "apiPath": "/api/v1/user/info",
    "caller": "订单服务",
    "originalDeprecationDate": "2024-06-30",
    "extendedDeprecationDate": "2024-12-31",
    "reason": "订单系统重构延期",
    "contactPerson": "张三",
    "contactEmail": "zhangsan@company.com"
  }'
```

**2. 创建异常记录（验证参数校验）**
```bash
# 空API名称 - 应该失败
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions \
  -H "Content-Type: application/json" \
  -d '{"apiName":"","apiPath":"/test","caller":"测试","originalDeprecationDate":"2024-06-30","extendedDeprecationDate":"2024-12-31","reason":"测试","contactPerson":"测试","contactEmail":"test@test.com"}'

# 延期日期早于原废弃日期 - 应该失败
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions \
  -H "Content-Type: application/json" \
  -d '{"apiName":"测试API","apiPath":"/test","caller":"测试","originalDeprecationDate":"2024-12-31","extendedDeprecationDate":"2024-06-30","reason":"测试","contactPerson":"测试","contactEmail":"test@test.com"}'
```

**3. 重复操作测试**
```bash
# 先创建并审批
EXT_ID=$(curl -s -X POST http://localhost:3000/api/v1/deprecation-extension/extensions \
  -H "Content-Type: application/json" \
  -d '{"apiName":"重复测试API","apiPath":"/test/repeat","caller":"测试","originalDeprecationDate":"2024-06-30","extendedDeprecationDate":"2024-12-31","reason":"测试","contactPerson":"测试","contactEmail":"test@test.com"}' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# 首次审批
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/$EXT_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy":"管理员"}'

# 重复审批 - 应该失败
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/$EXT_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy":"管理员"}'

# 撤回
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/$EXT_ID/withdraw

# 重复撤回 - 应该失败
curl -X POST http://localhost:3000/api/v1/deprecation-extension/extensions/$EXT_ID/withdraw
```

## 定时任务说明

- **每日到期提醒**: 每天9:00检查7天内即将到期的延期登记
- **每小时同步检查**: 每小时检查一次未同步的延期登记

## 项目结构

```
.
├── src/
│   ├── index.ts          # 服务入口
│   ├── routes.ts         # 路由定义
│   ├── service.ts        # 业务逻辑
│   ├── database.ts       # 数据库层
│   ├── sdk.ts            # SDK封装
│   └── types.ts          # 类型定义
├── test-data.ts          # 测试数据和脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待审批 |
| approved | 已批准 |
| rejected | 已拒绝 |
| withdrawn | 已撤回 |
| expired | 已过期 |

## 同步状态说明

| 状态 | 说明 |
|------|------|
| pending | 待同步 |
| synced | 已同步 |
| failed | 同步失败 |
