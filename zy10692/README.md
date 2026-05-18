# 数据血缘服务字段下线订阅通知 API

## 项目概述

本服务用于管理数据血缘中字段下线的订阅通知流程，确保下游任务在字段下线前完成确认，防止因提前下线导致的数据异常。

## 核心功能

1. **批量导入血缘影响**：一次性导入多个字段下线的下游影响关系
2. **逐个确认**：下游任务负责人逐条确认下线通知
3. **撤回下线**：取消已发起的下线流程
4. **发布校验**：阻止未确认下游的字段发布，列出未确认对象
5. **导出字段下线表**：导出CSV格式的下线记录

## 数据结构

| 字段 | 说明 | 示例 |
|------|------|------|
| id | 记录唯一ID | uuid |
| tableName | 数据表名 | user_profile |
| fieldName | 字段名 | old_phone |
| downstreamTask | 下游任务 | daily_report_job |
| notifier | 通知人 | zhangsan |
| status | 状态 | pending/confirmed/revoked |
| confirmedBy | 确认人 | lisi |
| confirmedAt | 确认时间 | ISO时间戳 |
| createdAt | 创建时间 | ISO时间戳 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 文档

### 1. 批量导入血缘影响

**接口**: `POST /api/deprecation/import`

**输入**:
```json
{
  "records": [
    {
      "tableName": "user_profile",
      "fieldName": "old_phone",
      "downstreamTask": "daily_report_job",
      "notifier": "zhangsan@example.com",
      "notes": "字段改名为new_phone"
    },
    {
      "tableName": "order_info",
      "fieldName": "legacy_amount",
      "downstreamTask": "monthly_statistics",
      "notifier": "lisi@example.com",
      "notes": "任务已停用"
    },
    {
      "tableName": "user_profile",
      "fieldName": "old_phone",
      "downstreamTask": "user_analytics",
      "notifier": "wangwu@example.com",
      "notes": "待确认"
    }
  ]
}
```

**输出**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "success": 3,
    "failed": 0,
    "results": [...]
  }
}
```

### 2. 逐个确认

**接口**: `POST /api/deprecation/:id/confirm`

**输入**:
```json
{
  "confirmedBy": "lisi@example.com",
  "notes": "已完成代码改造"
}
```

**输出**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "confirmed",
    "confirmedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### 3. 撤回下线

**接口**: `POST /api/deprecation/:id/revoke`

**输入**:
```json
{
  "reason": "下线计划取消"
}
```

**输出**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "revoked"
  }
}
```

### 4. 发布校验

**接口**: `GET /api/deprecation/validate-publish?tableName=user_profile&fieldName=old_phone`

**输出（未确认时）**:
```json
{
  "success": false,
  "error": "UNCONFIRMED_DOWNSTREAMS",
  "message": "存在2个下游任务未确认，禁止发布",
  "data": {
    "canPublish": false,
    "unconfirmedCount": 2,
    "unconfirmedRecords": [...]
  }
}
```

**输出（全部确认时）**:
```json
{
  "success": true,
  "data": {
    "canPublish": true,
    "unconfirmedCount": 0,
    "unconfirmedRecords": []
  }
}
```

### 5. 查询记录

**接口**: `GET /api/deprecation?status=pending`

支持过滤参数：`tableName`, `fieldName`, `status`, `downstreamTask`

### 6. 导出CSV

**接口**: `GET /api/deprecation/export`

支持同样的过滤参数，返回CSV文件下载。

### 7. 统计信息

**接口**: `GET /api/deprecation/statistics`

## 测试命令

### 运行全部测试

```bash
npm test
```

### 正常流程测试

```bash
npm run test:normal
```

### 异常流程测试

```bash
npm run test:abnormal
```

### 重复运行测试

```bash
npm run test:duplicate
```

## 使用样例

### 场景1：字段改名

```bash
# 导入影响
curl -X POST http://localhost:3000/api/deprecation/import \
  -H "Content-Type: application/json" \
  -d '{
    "records": [{
      "tableName": "user_profile",
      "fieldName": "old_phone",
      "downstreamTask": "daily_report",
      "notifier": "admin@example.com",
      "notes": "字段改名为new_phone"
    }]
  }'
```

### 场景2：任务停用

```bash
# 导入后确认
curl -X POST http://localhost:3000/api/deprecation/{id}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "confirmedBy": "owner@example.com",
    "notes": "任务已停用，无影响"
  }'
```

### 场景3：未确认阻止发布

```bash
# 尝试发布（会被阻止）
curl "http://localhost:3000/api/deprecation/validate-publish?tableName=user_profile&fieldName=old_phone"
```

## 状态说明

- **pending**: 待确认，下游尚未响应
- **confirmed**: 已确认，下游已处理
- **revoked**: 已撤回，下线计划取消

## 人工复核

测试完成后，可通过以下方式复核结果：

1. 查看控制台输出的测试报告
2. 调用 `/api/deprecation/statistics` 查看统计
3. 调用 `/api/deprecation/export` 导出完整记录
4. 检查 `/api/deprecation/validate-publish` 的校验行为