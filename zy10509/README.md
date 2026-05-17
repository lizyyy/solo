# 运维操作双人确认API系统

## 项目简介

本系统用于规范化运维操作流程，实现双人确认机制，确保高危操作安全执行。

## 核心功能

### 1. 双人确认机制
- 中风险及以上操作必须经过双人确认
- 执行人和复核人不能为同一人
- 高危操作每人每天最多复核3次

### 2. 风险分级管理
- **低风险 (low): 无需复核，操作影响范围小
- **中风险 (medium): 需要双人复核，操作有一定影响
- **高风险 (high): 需要双人复核，操作影响较大
- **高危 (critical): 需要双人复核，操作影响重大

### 3. 状态流转控制
```
已创建 → 已确认 → 已锁定 → 执行中 → 成功
                          ↓        ↓        ↓
                        中止    需人工修正  失败
                                  ↓
                            成功/失败/中止
```

### 4. 人工修正记录
- 保留原始输入数据
- 记录每次修正的原因和内容
- 完整的审计追踪

### 5. 报表导出
- CSV格式（业务友好，带中文说明
- JSON格式（完整数据）
- 统计报告（文本格式

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 启动生产服务
```bash
npm start
```

## API 接口文档

### 基础信息
- 服务地址: `http://localhost:3000`
- API 前缀: `/api/operations`
- 健康检查: `GET /health`

### 接口列表

#### 1. 创建操作
```
POST /api/operations
Content-Type: application/json

{
  "title": "数据库备份操作",
  "description": "生产数据库每日全量备份",
  "resourceObject": "mysql-prod-01",
  "resourceType": "database",
  "riskLevel": "high",
  "executorId": "user001",
  "executorName": "张三",
  "planExecuteTime": "2024-01-15T02:00:00",
  "rawInput": {
    "command": "mysqldump --all-databases",
    "params": {...}
  }
}
```

#### 2. 查询操作列表
```
GET /api/operations/query?status=created&riskLevel=high&page=1&pageSize=20
```

参数：
- `status`: 状态筛选 (created/confirmed/locked/executing/success/failed/aborted/needs_manual_correction)
- `riskLevel`: 风险等级 (low/medium/high/critical)
- `executorId`: 执行人ID
- `reviewerId`: 复核人ID
- `startDate`: 开始日期
- `endDate`: 结束日期
- `page`: 页码
- `pageSize`: 每页数量

#### 3. 获取操作详情
```
GET /api/operations/:id
GET /api/operations/no/:operationNo
```

#### 4. 双人确认
```
POST /api/operations/:id/confirm
{
  "reviewerId": "user002",
  "reviewerName": "李四"
}
```

#### 5. 锁定操作
```
POST /api/operations/:id/lock
```

#### 6. 开始执行
```
POST /api/operations/:id/start
```

#### 7. 完成操作
```
POST /api/operations/:id/complete
{
  "operationResult": "备份成功，文件大小2.5GB"
}
```

#### 8. 标记失败
```
POST /api/operations/:id/fail
{
  "errorMessage": "磁盘空间不足",
  "operationResult": "备份中断"
}
```

#### 9. 中止操作
```
POST /api/operations/:id/abort
```

#### 10. 标记需人工修正
```
POST /api/operations/:id/mark-correction
{
  "errorMessage": "执行过程中出现异常，需要人工介入"
}
```

#### 11. 人工修正
```
POST /api/operations/:id/correct
{
  "correctorId": "user003",
  "correctorName": "王五",
  "correctionReason": "配置参数错误，已修正",
  "correctedData": {
    "status": "success",
    "result": "人工处理完成"
  },
  "newStatus": "success"
}
```

#### 12. 导出CSV
```
GET /api/operations/export/csv?startDate=2024-01-01&endDate=2024-01-31
```

#### 13. 导出JSON
```
GET /api/operations/export/json?startDate=2024-01-01&endDate=2024-01-31
```

#### 14. 获取统计数据
```
GET /api/operations/statistics?startDate=2024-01-01&endDate=2024-01-31
```

#### 15. 获取统计报告
```
GET /api/operations/statistics/report?startDate=2024-01-01&endDate=2024-01-31
```

## 数据模型

### 操作记录字段
- `id`: 唯一标识
- `operationNo`: 操作单号（自动生成）
- `title`: 操作标题
- `description`: 操作描述
- `resourceObject`: 操作对象
- `resourceType`: 对象类型
- `riskLevel`: 风险等级
- `executorId`: 执行人ID
- `executorName`: 执行人姓名
- `reviewerId`: 复核人ID
- `reviewerName`: 复核人姓名
- `status`: 当前状态
- `planExecuteTime`: 计划执行时间
- `actualExecuteTime`: 实际执行时间
- `completeTime`: 完成时间
- `operationResult`: 操作结果
- `errorMessage`: 错误信息
- `rawInput`: 原始输入数据
- `correctionHistory`: 修正历史
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

## 项目结构

```
.
├── src/
│   ├── index.ts              # 应用入口
│   ├── types/                # 类型定义
│   │   └── index.ts
│   ├── database/             # 数据库层
│   │   └── index.ts
│   ├── repositories/         # 数据访问层
│   │   └── operationRepository.ts
│   ├── services/             # 业务逻辑层
│   │   ├── operationService.ts
│   │   └── exportService.ts
│   ├── controllers/        # 控制器层
│   │   └── operationController.ts
│   ├── middleware/         # 中间件
│   │   └── errorHandler.ts
│   └── routes/            # 路由
│       └── operations.ts
├── data/                   # 数据库文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- **运行时**: Node.js
- **框架**: Express.js
- **语言**: TypeScript
- **数据库**: SQLite
- **数据导出**: json2csv

## 安全特性

1. **双人确认机制**: 防止单人误操作
2. **状态流转控制**: 确保流程规范执行
3. **完整审计追踪**: 所有操作留痕
4. **异常记录保留**: 原始数据不丢失
5. **人工修正记录**: 异常处理可追溯
