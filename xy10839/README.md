# 租户数据打包出口 (Tenant Data Export Service)

大客户离线备份数据服务 - 同时获取文件、元数据和导出证明

## 项目架构

```
├── backend/          # 后端服务 (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── models/   # 数据模型层
│   │   ├── services/ # 业务服务层
│   │   ├── routes/   # API 路由
│   │   └── server.ts # 服务入口
│   └── package.json
├── frontend/         # 前端控制台 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   ├── api.ts    # API 客户端
│   │   └── types.ts  # 类型定义
│   └── package.json
└── package.json      # 根配置
```

## 数据模型

- **Tenant**: 租户信息
- **DataScope**: 数据范围（全量/增量、数据类型、时间范围、快照版本）
- **ExportTask**: 导出任务（状态、进度、重试次数、错误信息）
- **FileManifest**: 文件清单（文件名、大小、类型、校验和）
- **VerificationSummary**: 校验摘要（总文件数、总大小、校验算法）
- **DownloadRecord**: 下载记录（令牌、客户端IP、过期时间）
- **ExportCertificate**: 导出证明（证书编号、签发机构、签名）

## 核心规则

1. **范围快照**: 创建任务时自动生成数据范围快照，确保导出数据一致性
2. **异步打包**: 任务创建后异步处理，不阻塞接口响应
3. **摘要校验**: 打包完成后生成文件校验和与整体摘要，确保数据完整性
4. **下载授权**: 通过令牌机制控制下载权限，令牌24小时过期
5. **导出证明**: 任务完成后生成带签名的导出证明，可作为合规凭证
6. **自动重试**: 任务失败时自动重试，最多3次

## 本地运行说明

### 前置要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 启动开发环境

```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：分别启动
# 启动后端 (端口 3001)
npm run dev:backend

# 启动前端 (端口 3000)
npm run dev:frontend
```

### 访问地址

- 前端控制台: http://localhost:3000
- 后端 API: http://localhost:3001
- 健康检查: http://localhost:3001/api/health

## API 接口示例

### 1. 获取租户列表

```bash
curl -X GET http://localhost:3001/api/export/tenants
```

响应:
```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "name": "演示大客户",
      "code": "DEMO_001",
      "status": "active",
      "metadata": {},
      "createdAt": 1716000000000,
      "updatedAt": 1716000000000
    }
  ]
}
```

### 2. 创建导出任务

```bash
curl -X POST http://localhost:3001/api/export/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "TENANT_ID",
    "name": "Q4全量数据导出",
    "dataTypes": ["users", "orders", "products"],
    "createdBy": "admin"
  }'
```

### 3. 查询任务列表

```bash
# 全部任务
curl -X GET http://localhost:3001/api/export/tasks

# 按租户过滤
curl -X GET "http://localhost:3001/api/export/tasks?tenantId=TENANT_ID"

# 按状态过滤
curl -X GET "http://localhost:3001/api/export/tasks?status=completed"
```

### 4. 查询任务详情

```bash
curl -X GET http://localhost:3001/api/export/tasks/TASK_ID
```

响应包含：任务基本信息、数据范围、租户信息、文件清单、校验摘要

### 5. 重试失败任务

```bash
curl -X POST http://localhost:3001/api/export/tasks/TASK_ID/retry
```

### 6. 生成下载令牌

```bash
curl -X POST http://localhost:3001/api/export/tasks/TASK_ID/download-token
```

响应:
```json
{
  "success": true,
  "data": {
    "token": "xxxx-xxxx-xxxx",
    "expiresAt": 1716086400000
  }
}
```

### 7. 获取导出证明

```bash
curl -X GET http://localhost:3001/api/export/tasks/TASK_ID/certificate
```

## 故意失败的测试路径

### 场景一：查询不存在的任务

```bash
# 请求一个不存在的任务ID
curl -X GET http://localhost:3001/api/export/tasks/non-existent-id
```

预期响应: 404 Not Found
```json
{
  "success": false,
  "error": "Task not found"
}
```

### 场景二：重试未失败的任务

```bash
# 先创建一个任务，在它完成前尝试重试
curl -X POST http://localhost:3001/api/export/tasks/TASK_ID/retry
```

预期响应: 400 Bad Request
```json
{
  "success": false,
  "error": "Only failed tasks can be retried"
}
```

### 场景三：为未完成任务生成下载令牌

```bash
# 任务还在处理中时，尝试生成下载令牌
curl -X POST http://localhost:3001/api/export/tasks/PENDING_TASK_ID/download-token
```

预期响应: 400 Bad Request
```json
{
  "success": false,
  "error": "Only completed tasks can be downloaded"
}
```

### 场景四：为不存在的任务获取证书

```bash
curl -X GET http://localhost:3001/api/export/tasks/non-existent-id/certificate
```

预期响应: 404 Not Found
```json
{
  "success": false,
  "error": "Certificate not found"
}
```

### 场景五：创建任务时不提供必要参数

```bash
# 缺少 tenantId
curl -X POST http://localhost:3001/api/export/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试任务",
    "dataTypes": ["users"],
    "createdBy": "admin"
  }'
```

## 任务状态流转

```
pending → snapshot → packing → verifying → completed
                                                    ↗
                                                    ↘
                                                    failed (可重试，最多3次)
```

## 前端控制台功能

1. **总览面板**: 展示所有租户和任务统计（总任务数、进行中、已完成、失败）
2. **任务列表**: 支持按租户、状态筛选，实时刷新任务状态
3. **任务详情**:
   - **总览标签**: 任务信息、数据范围、校验摘要、失败详情
   - **文件清单**: 展示所有导出文件及校验状态
   - **导出证明**: 查看带签名的导出证书
4. **手动补偿**: 失败任务可点击重试按钮重新处理
5. **下载授权**: 已完成任务可生成下载令牌
6. **导出证明**: 一键获取合规性导出证明

## 技术栈

**后端**:
- Node.js + TypeScript
- Express.js
- SQLite (better-sqlite3)
- UUID, CryptoJS (校验和)

**前端**:
- React 18 + TypeScript
- Vite
- React Router
- Axios
- Day.js
