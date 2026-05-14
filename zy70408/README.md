# 租户初始化后端服务

## 项目概述

基于高峰门店设备台账的租户初始化后端服务，支持完整的异常处理、失败项追踪、回滚清理、审批流和导出功能。

## 技术栈

- Node.js + TypeScript
- Express.js (Web框架)
- SQLite (持久化存储)
- CSV导出

## 项目结构

```
.
├── src/
│   ├── types/
│   │   └── index.ts           # 类型定义
│   ├── database/
│   │   └── index.ts           # 数据库连接和查询封装
│   ├── services/
│   │   ├── tenantInitService.ts  # 租户初始化核心服务
│   │   ├── rollbackService.ts    # 回滚/清理服务
│   │   └── exportService.ts      # 导出/审批/附件修正服务
│   ├── routes/
│   │   └── tenantInitRoutes.ts   # API路由
│   └── server.ts                 # 服务入口
├── data/                          # SQLite数据库目录
├── uploads/                       # 文件上传目录
├── exports/                       # 导出文件目录
├── test-package.zip               # 测试用压缩包
├── test-api.sh                    # API测试脚本
├── package.json
└── tsconfig.json
```

## 核心功能

### 1. 初始化步骤（7步流程）

1. **VALIDATE_PACKAGE** - 验证压缩包路径
2. **EXTRACT_FILES** - 解压文件
3. **PARSE_METADATA** - 解析元数据
4. **CREATE_TENANT** - 创建租户
5. **IMPORT_DEVICES** - 导入设备（高峰门店台账）
6. **CONFIGURE_PERMISSIONS** - 配置权限
7. **FINALIZE** - 完成

### 2. 失败路径处理

- **压缩包路径异常**：空路径、不存在、格式不支持、文件为空等场景均有专门校验
- **失败项单独保存**：每条失败的明细项独立存储，包含错误信息和失败步骤
- **失败步骤追踪**：`currentStep` 字段明确指示初始化停在哪一步

### 3. 统一查询入口

- 查询所有记录（支持按状态和租户ID筛选）
- 查询单条记录详情
- 查询明细项（支持按状态和步骤筛选）
- 专门的失败项查询接口

### 4. 部分成功处理

- 部分设备导入失败时，整批标记为 `PARTIAL_SUCCESS` 而非 `SUCCESS`
- 保留每条明细的独立状态（成功/失败）
- 成功和失败数据都可独立查询

### 5. 数据持久化

- 使用SQLite数据库本地存储
- 重启服务后所有处理记录、材料摘要、失败项均可查询
- 数据目录：`./data/tenant_init.db`

### 6. 清理/回滚候选清单

- 生成回滚候选清单（基于失败项和未完成安装的设备）
- 支持选择性回滚（指定候选ID列表）
- 生成清理候选清单（30天以上的失败/部分成功记录）

### 7. 附件修正与审批

- 记录会议纪要等附件的修正前后值
- 支持按审批节点查询和回溯
- 完整的审批流支持

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译TypeScript

```bash
npm run build
```

### 3. 启动服务

```bash
npm run dev    # 开发模式（自动重启）
# 或
npm start      # 生产模式
```

服务默认运行在 `http://localhost:3000`

### 4. 运行API测试

```bash
chmod +x test-api.sh
./test-api.sh
```

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /api/tenant-init/initialize | 初始化租户 |
| GET | /api/tenant-init/records | 查询初始化记录列表 |
| GET | /api/tenant-init/records/:recordId | 查询单条记录详情 |
| GET | /api/tenant-init/records/:recordId/details | 查询明细项 |
| GET | /api/tenant-init/records/:recordId/failed | 查询失败项 |
| POST | /api/tenant-init/rollback/:recordId/candidates | 生成回滚候选清单 |
| GET | /api/tenant-init/rollback/:recordId/candidates | 查询回滚候选 |
| POST | /api/tenant-init/rollback/:recordId/execute | 执行回滚 |
| GET | /api/tenant-init/cleanup/candidates | 生成清理候选清单 |
| POST | /api/tenant-init/export/:recordId | 导出初始化记录 |
| POST | /api/tenant-init/export/devices/:tenantId | 导出设备台账 |
| POST | /api/tenant-init/revisions | 创建附件修正记录 |
| GET | /api/tenant-init/revisions/:recordId | 查询附件修正记录 |
| POST | /api/tenant-init/approvals | 创建审批节点 |
| POST | /api/tenant-init/approvals/:nodeId/approve | 审批节点 |
| GET | /api/tenant-init/approvals/:recordId | 查询审批节点 |
| GET | /api/tenant-init/devices/:tenantId | 查询高峰门店设备台账 |

## 关键设计说明

### 处理状态（ProcessingStatus）

- `PENDING` - 待处理
- `PROCESSING` - 处理中
- `SUCCESS` - 全部成功
- `PARTIAL_SUCCESS` - 部分成功（关键！不标记为成功）
- `FAILED` - 失败

### 明细项状态（ItemStatus）

- `PENDING` - 待处理
- `SUCCESS` - 成功
- `FAILED` - 失败
- `SKIPPED` - 跳过

### 数据库表设计

1. **tenant_init_records** - 初始化主记录
2. **init_detail_items** - 明细项（每条设备独立记录）
3. **approval_nodes** - 审批节点
4. **attachment_revisions** - 附件修正记录
5. **rollback_candidates** - 回滚候选清单
6. **device_ledgers** - 高峰门店设备台账

## 使用示例

### 1. 初始化租户（含压缩包路径异常测试）

```bash
# 空路径（失败）
curl -X POST http://localhost:3000/api/tenant-init/initialize \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "T001", "tenantName": "高峰店A", "packagePath": ""}'

# 不存在路径（失败）
curl -X POST http://localhost:3000/api/tenant-init/initialize \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "T001", "tenantName": "高峰店A", "packagePath": "/invalid/file.zip"}'

# 正常初始化（会生成部分成功，故意设置2个设备导入失败）
curl -X POST http://localhost:3000/api/tenant-init/initialize \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "T001", "tenantName": "高峰店A", "packagePath": "test-package.zip"}'
```

### 2. 查询失败项

```bash
curl http://localhost:3000/api/tenant-init/records/{recordId}/failed
```

### 3. 生成回滚候选清单

```bash
curl -X POST http://localhost:3000/api/tenant-init/rollback/{recordId}/candidates
```

### 4. 创建附件修正记录

```bash
curl -X POST http://localhost:3000/api/tenant-init/revisions \
  -H "Content-Type: application/json" \
  -d '{
    "recordId": "...",
    "detailItemId": "...",
    "attachmentName": "会议纪要.pdf",
    "beforeValue": "v1.0",
    "afterValue": "v1.1",
    "modifiedBy": "admin"
  }'
```

### 5. 导出记录

```bash
curl -X POST http://localhost:3000/api/tenant-init/export/{recordId}
```

## 关键特性验证点

✅ **失败项单独保存** - 查询 `GET /records/:id/failed` 即可看到
✅ **统一查询入口** - `GET /records?status=PARTIAL_SUCCESS` 和 `GET /records?status=FAILED`
✅ **部分成功不标记为成功** - 状态为 `PARTIAL_SUCCESS` 而非 `SUCCESS`
✅ **本地重启可查** - SQLite持久化，重启后数据不丢失
✅ **清理候选清单** - `GET /cleanup/candidates` 先生成清单，不直接删除
✅ **附件修正前后值** - `POST /revisions` 记录，导出时包含
✅ **审批节点回溯** - `GET /approvals/:recordId` 可查询审批历史
✅ **失败步骤指示** - `currentStep` 字段明确失败位置

## 初始化步骤失败场景

| 步骤 | 可能失败原因 | 返回信息 |
|------|-------------|---------|
| VALIDATE_PACKAGE | 路径为空、不存在、格式错误、文件为空 | error + currentStep |
| EXTRACT_FILES | 解压异常、文件损坏 | error + currentStep |
| PARSE_METADATA | 格式错误、缺少必要字段 | error + currentStep |
| CREATE_TENANT | 租户ID冲突、系统错误 | error + currentStep |
| IMPORT_DEVICES | 部分设备数据异常 | partial_success + failed_items |
| CONFIGURE_PERMISSIONS | 权限配置异常 | partial_success |
| FINALIZE | 收尾操作失败 | success/failed |
