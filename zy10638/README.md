# 停车计费无牌车人工匹配 API

## 项目简介

后端服务，支持停车计费系统中的无牌车人工匹配功能。包含批量导入旧记录、单条人工备注处理、状态流转、冲突检测和数据导出功能。

## 技术栈

- Node.js + TypeScript
- Express
- SQLite (better-sqlite3)
- Joi (参数验证)
- Jest + Supertest (测试)

## 状态定义

| 状态 | 说明 |
|------|------|
| pending | 待匹配 |
| matched | 已匹配 |
| disputed | 争议中 |
| settled | 已结算 |

## API 接口

### 1. 匹配记录列表

```
GET /api/matches
```

查询参数：
- `status`: 状态过滤 (pending/matched/disputed/settled)
- `page`: 页码 (默认: 1)
- `pageSize`: 每页条数 (默认: 20, 最大: 100)

### 2. 匹配记录详情

```
GET /api/matches/:id
```

返回详情，包含关联的入场记录、支付记录，以及同一支付单的其他匹配记录（冲突检测）。

### 3. 匹配历史记录

```
GET /api/matches/:id/history
```

### 4. 创建匹配记录

```
POST /api/matches
```

请求体：
```json
{
  "entryId": "入场记录ID",
  "paymentId": "支付记录ID",
  "manualNote": "人工备注（可选）",
  "matchedBy": "匹配人（可选）"
}
```

### 5. 更新状态

```
PUT /api/matches/:id/status
```

请求体：
```json
{
  "status": "matched/disputed/settled",
  "changedBy": "操作人（可选）",
  "changeNote": "变更说明（可选）"
}
```

### 6. 添加人工备注

```
POST /api/matches/:id/note
```

请求体：
```json
{
  "note": "备注内容",
  "changedBy": "操作人（可选）"
}
```

### 7. 批量导入

```
POST /api/matches/import
```

请求体（数组）：
```json
[
  {
    "entryTime": "2024-01-15T08:30:00",
    "photoUrl": "/photos/car_001.jpg",
    "parkingSpot": "A-001",
    "plateNumber": "京A12345",
    "paymentTime": "2024-01-15T10:45:00",
    "amount": 25.00,
    "paymentMethod": "微信支付",
    "transactionId": "TXN_001",
    "manualNote": "备注"
  }
]
```

返回结果：
```json
{
  "success": 成功数量,
  "failed": 失败数量,
  "errors": [
    {
      "row": 行号,
      "message": "错误信息",
      "data": 原始数据
    }
  ]
}
```

### 8. 数据导出

```
GET /api/matches/export/data?status=settled
```

## 运行项目

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 启动生产服务

```bash
npm start
```

### 运行测试

```bash
npm test
```

## 验收场景

测试用例覆盖了三个核心验收场景：

1. **完整流转测试**：验证从创建 → 待匹配 → 已匹配 → 添加备注 → 已结算的完整状态流转
2. **冲突记录测试**：验证同一支付单匹配两次入场时，在详情页和导出结果中能正确显示冲突
3. **导入坏行测试**：验证批量导入时能正确区分成功和失败记录，失败时能明确指出哪条规则未通过

所有 7 个测试用例已全部通过。
