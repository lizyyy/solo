# 工单附件病毒扫描API

基于 Node.js + Express + SQLite 构建的工单附件病毒扫描管理系统，实现扫描请求创建、状态追踪、异常处理、人工审核和数据导出功能。

## 功能特性

- 📋 **工单附件管理**：支持多附件上传扫描
- 🔍 **多引擎支持**：ClamAV、Kaspersky、Windows Defender、McAfee
- 🚦 **状态流转**：排队 → 扫描中 → 成功/失败/隔离
- 🚨 **自动隔离**：高危/严重风险自动隔离
- 👨‍💻 **人工审核**：支持放行、隔离、重试三种操作
- 📊 **数据导出**：CSV 导出 + 摘要报告
- 📝 **失败追踪**：完整记录原始输入、处理依据和最终结论

## 快速开始

### 环境要求

- Node.js >= 16.x
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
npm run init-db
```

### 创建示例数据

```bash
npx ts-node src/scripts/sample-data.ts
```

### 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

服务默认运行在：http://localhost:3000

## API 接口

### 基础路径

`http://localhost:3000/api/ticket-scan`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | / | 创建扫描请求 |
| GET | / | 获取所有扫描记录（分页） |
| GET | /:id | 获取单个扫描记录 |
| GET | /ticket/:ticketId | 按工单编号查询 |
| GET | /status/:status | 按状态查询 |
| PUT | /:id/status | 更新扫描状态 |
| POST | /:id/failure | 异常处理 |
| POST | /:id/manual-correction | 人工修正 |
| GET | /export/csv | 导出 CSV |
| GET | /export/summary | 导出摘要报告 |

## cURL 调用示例

### 1. 创建扫描请求

```bash
curl -X POST http://localhost:3000/api/ticket-scan \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "TK-2024-005",
    "scanEngine": "clamav",
    "attachments": [
      {
        "filename": "问题反馈.docx",
        "fileSize": 153600,
        "fileType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "fileUrl": "/uploads/TK-2024-005/问题反馈.docx"
      },
      {
        "filename": "错误日志.txt",
        "fileSize": 51200,
        "fileType": "text/plain",
        "fileUrl": "/uploads/TK-2024-005/错误日志.txt"
      }
    ]
  }'
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "ticketId": "TK-2024-005",
    "status": "queued",
    "riskLevel": "safe",
    "isolationAction": "none",
    "processingSummary": "附件已进入扫描队列，等待扫描引擎处理"
  },
  "message": "扫描请求创建成功"
}
```

### 2. 查询所有扫描记录

```bash
curl http://localhost:3000/api/ticket-scan?page=1&pageSize=10
```

### 3. 查询单个扫描记录

```bash
curl http://localhost:3000/api/ticket-scan/{记录ID}
```

### 4. 按工单编号查询

```bash
curl http://localhost:3000/api/ticket-scan/ticket/TK-2024-001
```

### 5. 更新扫描状态（标记扫描中）

```bash
curl -X PUT http://localhost:3000/api/ticket-scan/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "scanning"
  }'
```

### 6. 更新扫描状态（扫描成功 - 发现病毒）

```bash
curl -X PUT http://localhost:3000/api/ticket-scan/{记录ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "riskLevel": "high",
    "virusFound": ["Trojan.Generic.12345", "Exploit.Script.678"],
    "scanReport": "ClamAV 扫描完成：发现2个恶意程序",
    "processingSummary": "自动隔离高危文件"
  }'
```

### 7. 异常处理（扫描失败）

```bash
curl -X POST http://localhost:3000/api/ticket-scan/{记录ID}/failure \
  -H "Content-Type: application/json" \
  -d '{
    "errorMessage": "扫描引擎连接超时：ETIMEDOUT",
    "rawInput": {
      "ticketId": "TK-2024-005",
      "fileSize": 104857600,
      "timeout": 60000
    }
  }'
```

### 8. 人工修正（放行）

```bash
curl -X POST http://localhost:3000/api/ticket-scan/{记录ID}/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "安全管理员-李四",
    "reviewComment": "经核实为误报，该文件为业务所需，予以放行",
    "action": "release",
    "riskLevel": "low"
  }'
```

### 9. 导出 CSV

```bash
curl http://localhost:3000/api/ticket-scan/export/csv?ticketId=TK-2024-001 -o export.csv
```

### 10. 导出摘要报告

```bash
curl http://localhost:3000/api/ticket-scan/export/summary
```

## 被规则拦截的路径示例

### 1. 查询不存在的记录

```bash
curl http://localhost:3000/api/ticket-scan/non-existent-id
```

**错误响应：**
```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "扫描记录不存在",
  "timestamp": "2024-05-16T12:00:00.000Z"
}
```

### 2. 创建请求缺少必填字段

```bash
curl -X POST http://localhost:3000/api/ticket-scan \
  -H "Content-Type: application/json" \
  -d '{
    "attachments": []
  }'
```

**错误响应：**
```json
{
  "code": "BAD_REQUEST",
  "message": "工单编号和附件清单不能为空",
  "timestamp": "2024-05-16T12:00:00.000Z"
}
```

### 3. 人工修正使用无效的操作类型

```bash
curl -X POST http://localhost:3000/api/ticket-scan/{记录ID}/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "管理员",
    "reviewComment": "测试",
    "action": "invalid_action"
  }'
```

**错误响应：**
```json
{
  "code": "BAD_REQUEST",
  "message": "无效的操作类型",
  "timestamp": "2024-05-16T12:00:00.000Z"
}
```

### 4. 访问不存在的 API 路径

```bash
curl http://localhost:3000/api/not-found
```

**错误响应：**
```json
{
  "code": "NOT_FOUND",
  "message": "请求的资源不存在",
  "timestamp": "2024-05-16T12:00:00.000Z"
}
```

## 数据模型

### 扫描记录字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录唯一ID |
| ticketId | string | 工单编号 |
| attachments | array | 附件列表 |
| scanEngine | string | 扫描引擎 |
| riskLevel | string | 风险等级 |
| isolationAction | string | 隔离动作 |
| status | string | 当前状态 |
| processingSummary | string | 处理摘要 |
| scanReport | string | 扫描报告 |
| virusFound | array | 发现的病毒列表 |
| failureRecords | array | 失败记录 |
| reviewedBy | string | 审核人 |
| reviewComment | string | 审核意见 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |
| scannedAt | datetime | 扫描完成时间 |
| reviewedAt | datetime | 审核时间 |

### 状态枚举

- `pending` - 待处理
- `queued` - 已排队
- `scanning` - 扫描中
- `success` - 扫描成功
- `failed` - 扫描失败
- `isolated` - 已隔离
- `manual_review` - 人工审核中
- `released` - 已放行

### 风险等级

- `safe` - 安全
- `low` - 低危
- `medium` - 中危
- `high` - 高危
- `critical` - 严重

### 隔离动作

- `none` - 无动作
- `quarantine` - 隔离
- `delete` - 删除
- `hold` - 保留（待人工确认）

## 健康检查

```bash
curl http://localhost:3000/health
```

## 项目结构

```
.
├── src/
│   ├── app.ts                 # 应用入口
│   ├── types/
│   │   └── index.ts           # 类型定义
│   ├── database/
│   │   └── index.ts           # 数据库配置
│   ├── dao/
│   │   └── ticketScan.dao.ts  # 数据访问层
│   ├── services/
│   │   └── ticketScan.service.ts  # 业务逻辑层
│   ├── routes/
│   │   └── ticketScan.routes.ts   # API 路由
│   ├── middleware/
│   │   └── errorHandler.ts    # 错误处理中间件
│   └── scripts/
│       ├── init-db.ts         # 数据库初始化脚本
│       └── sample-data.ts     # 示例数据脚本
├── package.json
├── tsconfig.json
└── README.md
```
