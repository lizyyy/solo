# 远程运维平台批量命令审批 API

基于 Node.js + TypeScript + Express + PostgreSQL 构建的企业级批量命令审批系统。

## ✨ 核心特性

- **状态流转**: 待审批 → 已批准 → 执行中 → 已完成 / 已终止
- **幂等性**: 基于 requestId 保证重复提交的幂等性
- **审计追踪**: 完整的操作历史记录，便于追溯
- **异常处理**: 执行窗口过期后的人工备注机制，流程可继续推进
- **错误响应**: 结构化的错误信息，包含建议操作，便于调用方处理
- **批量导入**: 支持批量导入命令，详细记录坏行信息和原因

## 🚀 快速开始

### 前置要求

- Node.js 16+
- Docker & Docker Compose
- npm 或 yarn

### 1. 启动 PostgreSQL

```bash
docker-compose up -d postgres
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

```bash
npm run db:init
```

### 4. 启动 API 服务

```bash
npm run dev
```

服务启动后访问: http://localhost:3000

### 5. 运行验收测试

```bash
npm run test:acceptance
```

## 📊 验收测试覆盖

### 场景 1: 完整命令审批流转
```
提交命令 → 审批通过 → 开始执行 → Agent上报 → 完成
```

### 场景 2: 冲突记录 - 过期后人工干预
```
提交(过期窗口) → 审批(状态变为EXPIRED) → 执行失败 → 人工备注 → 继续执行
```

### 场景 3: 导入坏行 - 部分成功部分失败
```
批量导入(含坏记录) → 返回成功/失败详情 → 保存批次记录和错误信息
```

### 场景 4: 数据一致性验证
```
列表 ↔ 详情 ↔ 审批历史 ↔ 操作历史 ↔ 执行记录 数据互相对齐
```

## 📁 项目结构

```
.
├── sql/
│   └── 001-init.sql          # 数据库表结构
├── src/
│   ├── config/
│   │   └── database.ts       # 数据库连接配置
│   ├── middleware/
│   │   └── errorHandler.ts   # 错误处理中间件
│   ├── routes/
│   │   ├── commands.ts       # 命令相关路由
│   │   ├── hostGroups.ts     # 主机组相关路由
│   │   └── audit.ts          # 审计日志路由
│   ├── services/
│   │   ├── commandService.ts # 命令核心业务
│   │   ├── auditService.ts   # 审计日志服务
│   │   └── hostGroupService.ts # 主机组服务
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   ├── scripts/
│   │   ├── init-db.ts        # 数据库初始化脚本
│   │   └── acceptance-test.ts # 验收测试脚本
│   └── index.ts              # 应用入口
├── docker-compose.yml        # Docker 配置
├── package.json
└── tsconfig.json
```

## 🔌 API 端点

### 命令管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/commands | 提交新的命令审批请求 |
| GET | /api/commands | 查询命令列表（支持分页和过滤） |
| GET | /api/commands/:id | 查询命令详情 |
| POST | /api/commands/:id/approve | 审批命令 |
| POST | /api/commands/:id/start | 开始执行命令 |
| POST | /api/commands/:id/terminate | 终止命令 |
| POST | /api/commands/:id/complete | 标记命令执行完成 |
| POST | /api/commands/:id/manual-remark | 过期命令添加人工备注 |
| POST | /api/commands/:id/continue-after-expired | 过期后继续执行 |
| GET | /api/commands/:id/approvals | 查询审批历史 |
| GET | /api/commands/:id/history | 查询操作历史 |
| GET | /api/commands/:id/executions | 查询执行记录 |
| POST | /api/commands/:id/agent-report | Agent上报执行结果 |

### 主机组管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/host-groups | 创建主机组 |
| GET | /api/host-groups | 查询主机组列表 |
| GET | /api/host-groups/:id | 查询主机组详情 |
| PUT | /api/host-groups/:id | 更新主机组 |
| DELETE | /api/host-groups/:id | 删除主机组 |
| POST | /api/host-groups/import | 批量导入命令 |
| GET | /api/host-groups/import/:batchId | 查询导入批次详情 |

### 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/audit-logs | 查询审计日志列表 |

## 📋 状态说明

| 状态 | 说明 | 允许的后续状态 |
|------|------|--------------|
| PENDING_APPROVAL | 待审批 | APPROVED, TERMINATED |
| APPROVED | 已批准 | EXECUTING, TERMINATED, EXPIRED |
| EXECUTING | 执行中 | COMPLETED, FAILED, TERMINATED |
| EXPIRED | 已过期 | APPROVED, TERMINATED |
| COMPLETED | 已完成 | - |
| FAILED | 已失败 | - |
| TERMINATED | 已终止 | - |

## ❌ 错误码说明

| 错误码 | 说明 | 建议操作 |
|--------|------|---------|
| VALIDATION_ERROR | 参数验证失败 | 检查请求参数 |
| DUPLICATE_REQUEST | 重复的请求ID | 使用唯一的requestId |
| INVALID_STATE_TRANSITION | 状态流转不合法 | 检查当前状态是否允许操作 |
| EXECUTION_WINDOW_EXPIRED | 执行窗口已过期 | 人工备注确认后继续执行 |
| HOST_GROUP_NOT_FOUND | 主机组不存在 | 检查hostGroupId是否正确 |
| AGENT_EXECUTION_ABNORMAL | Agent上报异常 | 人工确认执行结果 |
| MANUAL_INTERVENTION_REQUIRED | 需要人工干预 | 联系管理员处理 |

## 💡 使用示例

### 1. 提交命令审批

```bash
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2024-001",
    "title": "日常巡检",
    "command": "df -h",
    "hostGroupId": "00000000-0000-0000-0000-000000000001",
    "executionWindowStart": "2024-01-01T00:00:00.000Z",
    "executionWindowEnd": "2024-01-02T00:00:00.000Z",
    "submitterId": "user_001",
    "submitterName": "运维人员A"
  }'
```

### 2. 审批命令

```bash
curl -X POST http://localhost:3000/api/commands/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "approver_001",
    "approverName": "张三",
    "remark": "同意执行"
  }'
```

### 3. 开始执行

```bash
curl -X POST http://localhost:3000/api/commands/{id}/start \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "operator_001",
    "operatorName": "执行员A"
  }'
```

## 🏗️ 数据库表设计

- **host_groups**: 主机组信息
- **approvers**: 审批人配置
- **batch_commands**: 批量命令主表
- **command_approvals**: 审批记录表
- **execution_records**: 执行结果记录
- **audit_logs**: 审计操作日志
- **import_records**: 导入批次记录

## 🔧 开发命令

```bash
npm run dev        # 开发模式启动
npm run build      # 构建生产版本
npm start          # 生产模式启动
npm run db:init    # 初始化数据库
npm run test:acceptance  # 运行验收测试
```

## 📝 注意事项

1. 执行窗口过期后，需要先调用 `manual-remark` 接口添加备注，然后调用 `continue-after-expired` 才能继续执行
2. Agent上报执行结果时，如果命令已过期，会返回详细的错误信息和人工处理建议
3. 批量导入支持部分成功，失败的记录会在错误详情中列出具体原因
4. 所有操作都会记录审计日志，便于追溯和审计
