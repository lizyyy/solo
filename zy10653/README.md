# 文件转码服务人工重试系统

## 项目概述

本系统专为解决文件转码服务转码失败后的人工重试流程设计，重点解决以下问题：
- 防止重复点击重试按钮
- 检测异步回调时源文件被替换的情况
- 记录完整历史追溯过程
- 行级数据校验和坏行处理

## 核心功能

### 1. 任务管理
- 创建转码任务
- 查询任务列表（支持分页、筛选）
- 查看任务详情
- 更新任务状态

### 2. 重试机制
- 人工重试（带防重点击）
- 批量重试
- 基于 requestId 的重复请求检测
- 重试参数自定义

### 3. 冲突处理
- 源文件哈希变更检测
- 冲突状态标记
- 冲突解决流程（取消旧任务/创建新任务）

### 4. 行级校验
- 记录每行校验结果
- 支持多种校验规则（必填、格式、范围等）
- 坏行标记和处理
- 原始数据保留

### 5. 历史追溯
- 完整的重试历史记录
- 状态变更轨迹
- 文件哈希变更记录
- 操作人信息

### 6. 数据导出
- 支持 JSON/CSV 格式导出
- 包含历史记录和校验结果

## 快速开始

### 安装依赖
```bash
npm install
```

### 生成种子数据（验收测试数据）
```bash
npm run seed
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
npm start
```

## API 文档

### 基础路径
```
http://localhost:3001/api
```

### 任务管理

#### 创建任务
```
POST /tasks
Content-Type: application/json

{
  "businessNo": "FIN-2024-001",
  "fileName": "财务报表.xlsx",
  "fileHash": "a1b2c3d4e5f6",
  "fileSize": 1048576,
  "sourceFormat": "xlsx",
  "targetFormat": "csv",
  "createdBy": "user@company.com",
  "retryParams": { "encoding": "UTF-8" }
}
```

#### 查询任务列表
```
GET /tasks?status=failed&page=1&pageSize=20
```

#### 获取任务详情
```
GET /tasks/:id
```

#### 更新任务状态
```
POST /tasks/:id/status
Content-Type: application/json

{
  "status": "completed",
  "outputFilePath": "/outputs/file.csv"
}
```

### 重试接口

#### 人工重试
```
POST /retry/manual
Content-Type: application/json

{
  "taskId": "uuid",
  "retriedBy": "user@company.com",
  "retryNote": "已修正数据",
  "requestId": "req-20240318-001",
  "forceRetry": false
}
```

#### 批量重试
```
POST /retry/batch
Content-Type: application/json

{
  "taskIds": ["uuid1", "uuid2"],
  "retriedBy": "user@company.com"
}
```

### 冲突处理

#### 检测文件变更
```
POST /tasks/:id/check-file-changed
Content-Type: application/json

{
  "newFileHash": "new_hash_value"
}
```

#### 解决冲突
```
POST /conflict/resolve
Content-Type: application/json

{
  "taskId": "uuid",
  "resolvedBy": "user@company.com",
  "resolutionNote": "使用新版本文件",
  "createNewTask": true,
  "cancelOldTask": true
}
```

### 历史和校验

#### 获取重试历史
```
GET /tasks/:id/history
```

#### 获取行级校验结果
```
GET /tasks/:id/validations
```

#### 获取坏行列表
```
GET /tasks/:id/bad-rows
```

#### 导出任务数据
```
GET /export/tasks?format=csv&includeHistory=true
```

## 验收测试场景

### 场景1: 完整流转 (FIN-2024-001)
**目标**: 验证任务从创建到完成的完整流程

1. 查询任务列表，找到业务号 `FIN-2024-001`
2. 查看任务详情，验证状态为 `completed`
3. 查看重试历史，验证包含:
   - 自动重试失败（网络错误）
   - 人工重试发起
   - 最终完成记录
4. 验证重试次数为 2，`isManuallyRetried` 为 true

### 场景2: 源文件替换冲突 (HR-2024-002)
**目标**: 验证源文件被替换后的冲突检测机制

1. 查询任务列表，找到业务号 `HR-2024-002`
2. 查看任务详情，验证状态为 `conflict`
3. 查看 `conflictNote` 字段，验证包含新旧文件哈希
4. 查看重试历史，验证:
   - 初始失败记录（行校验失败）
   - 人工重试发起记录
   - 回调检测文件变更记录
5. 验证历史记录中 `isHashChanged` 为 true，`sourceFileReplaced` 为 true

### 场景3: 导入坏行 (SALE-2024-003)
**目标**: 验证行级校验和坏行处理

1. 查询任务列表，找到业务号 `SALE-2024-003`
2. 查看任务详情，验证失败原因包含 "3条坏行"
3. 调用 `/tasks/:id/validations` 查看所有校验结果
4. 调用 `/tasks/:id/bad-rows` 查看坏行列表，验证返回 3 条记录
5. 验证每条坏行的具体错误:
   - 第5行: customerId 不能为空
   - 第12行: amount 格式错误
   - 第28行: amount 范围错误（负数）
6. 验证第1行是通过校验的正常行（`isBadRow: false`, `isImported: true`）

### 场景4: 防重点击验证 (INV-2024-004)
**目标**: 验证重复点击重试的防护机制

1. 查询任务列表，找到业务号 `INV-2024-004`
2. 查看任务详情，验证当前状态为 `retrying`
3. 调用人工重试接口，使用相同的 `requestId: "req-20240318-001"`
4. 验证返回结果中 `isDuplicate: true`，表示检测到重复请求
5. 验证不会创建新的重试历史记录

## 数据模型

### TranscodeTask (转码任务)
- 核心字段: id, businessNo, fileName, fileHash, status
- 状态: pending, processing, failed, retrying, completed, conflict, cancelled
- 失败码: NETWORK_ERROR, FILE_CORRUPTED, ROW_VALIDATION_FAILED 等

### RetryHistory (重试历史)
- 记录每次重试的完整信息
- 包含状态变更前后、文件哈希变更、操作人、请求ID等
- 支持幂等性检测

### RowValidation (行级校验)
- 记录每行数据的校验结果
- 支持多种校验规则
- 保留原始数据用于追溯

## 目录结构

```
src/
├── entities/           # 数据实体
│   ├── TranscodeTask.ts
│   ├── RetryHistory.ts
│   └── RowValidation.ts
├── services/           # 业务逻辑
│   └── TranscodeTaskService.ts
├── controllers/        # API 控制器
│   └── TranscodeTaskController.ts
├── types/              # 类型定义
│   └── api.ts
├── app.ts              # 应用入口
├── routes.ts           # 路由配置
├── data-source.ts      # 数据库配置
└── seed.ts             # 种子数据
```
