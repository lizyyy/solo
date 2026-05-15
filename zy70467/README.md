# SLA 日志后端服务 - 审批流程监控与审计系统

## 项目概述

企业级审批流程监控与审计系统，专为培训环境审批流程提供全面的日志追踪、规则校验、异常检测和审计追溯能力。

## 核心功能

### ✅ 已实现

1. **批次管理模块**
   - 批量创建和处理审批数据
   - 批次状态追踪（PENDING/PROCESSING/SUCCESS/PARTIAL_SUCCESS/FAILED/REVIEWED）
   - 明细条目查看和管理

2. **规则引擎模块**
   - 规则版本管理（支持历史版本追溯）
   - 审批意见缺失检测（核心 blocker 规则）
   - 规则激活/停用切换

3. **异常检测模块**
   - 自动检测审批意见为空的记录
   - 失败项单独隔离保存
   - 部分成功处理（保留成功条目，失败项单独标记）

4. **报告生成模块**
   - 处理前后对比报告
   - 执行时间统计
   - 下一步建议生成
   - 失败项 CSV 导出

5. **审计追踪模块**
   - 全操作日志记录
   - 人工复核意见提交
   - 复核决策关联原始记录

6. **安全操作模块**
   - 候选清单机制（清理/回滚前先审核）
   - 双人审核流程
   - 批量安全操作

## 技术栈

- **后端框架**: Node.js + Express.js + TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **日志**: Winston
- **API 文档**: Swagger/OpenAPI
- **安全**: Helmet + CORS

## 项目结构

```
backend/
├── src/
│   ├── controllers/       # 控制器层
│   │   ├── batch.controller.ts
│   │   ├── rule.controller.ts
│   │   ├── audit.controller.ts
│   │   └── security.controller.ts
│   ├── services/          # 业务逻辑层
│   │   ├── batch.service.ts
│   │   ├── ruleEngine.service.ts
│   │   ├── report.service.ts
│   │   ├── audit.service.ts
│   │   └── security.service.ts
│   ├── models/            # 数据模型和类型定义
│   ├── middleware/        # 中间件
│   │   └── errorHandler.ts
│   ├── utils/             # 工具函数
│   │   ├── logger.ts
│   │   └── db.ts
│   ├── config/            # 配置文件
│   ├── routes/            # 路由定义
│   └── index.ts           # 应用入口
├── prisma/
│   ├── schema.prisma      # 数据库 Schema
│   └── seed.ts            # 种子数据
├── package.json
├── tsconfig.json
└── .env
```

## 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 14+
- npm 或 yarn

### 安装步骤

1. **进入后端目录**
```bash
cd backend
```

2. **安装依赖**
```bash
npm install
```

3. **配置数据库**
   
   编辑 `.env` 文件，配置数据库连接：
```env
DATABASE_URL="postgresql://username:password@localhost:5432/sla_log_db?schema=public"
PORT=3000
NODE_ENV="development"
```

4. **初始化数据库**
```bash
# 生成 Prisma Client
npm run prisma:generate

# 创建数据库表
npm run prisma:migrate --name init

# 插入示例数据（可选）
npm run prisma:seed
```

5. **启动开发服务器**
```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API 文档

启动服务后访问：`http://localhost:3000/api-docs`

### 主要 API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/batches` | 创建批次 |
| GET | `/api/batches` | 获取批次列表 |
| GET | `/api/batches/:id` | 获取批次详情 |
| POST | `/api/batches/:id/execute` | 执行批次处理 |
| GET | `/api/batches/:id/report` | 生成处理报告 |
| GET | `/api/batches/:id/failed-items/export` | 导出失败项 CSV |
| POST | `/api/rules` | 创建规则版本 |
| GET | `/api/rules/active` | 获取当前激活规则 |
| GET | `/api/audit` | 获取审计日志 |
| POST | `/api/audit/review` | 提交复核意见 |
| POST | `/api/security` | 创建候选清单（清理/回滚） |
| PUT | `/api/security/:id/approve` | 审核候选清单 |
| POST | `/api/security/:id/execute` | 执行候选清单操作 |

## 核心业务流程

### 批次处理流程

```
1. 上传培训环境清单 → 创建批次（PENDING）
2. 关联当前激活的规则版本
3. 执行规则校验
   ├── 全部通过 → 标记 SUCCESS
   ├── 部分通过 → 标记 PARTIAL_SUCCESS，成功条目保留
   └── 存在失败 → 标记失败项，单独保存 FailedItem
4. 生成处理报告（前后对比、执行时间、下一步建议）
5. 人工复核失败项，提交意见
6. 全部复核完成 → 批次标记 REVIEWED
```

### 审批意见丢失检测逻辑

```typescript
// 当审批状态为 APPROVED 或 REJECTED 时
if (['APPROVED', 'REJECTED'].includes(item.approvalStatus)) {
  // 检查审批意见是否为空
  if (!item.approvalComment || item.approvalComment.trim() === '') {
    // 触发 BLOCKER 级错误，拦截该记录
    return {
      field: 'approvalComment',
      code: 'APPROVAL_COMMENT_MISSING',
      message: '审批意见为空，流程被拦截',
      severity: 'BLOCKER'
    };
  }
}
```

### 规则版本变更流程

1. 创建新规则版本时，自动将旧规则标记为 INACTIVE
2. 新批次使用新版规则
3. 历史批次保留关联的规则版本快照
4. 查询时可追溯当时使用的判断口径

### 安全操作流程

```
1. 申请清理/回滚操作 → 创建候选清单
2. 审核人审核候选清单
3. 审核通过 → 执行操作
4. 操作完成 → 记录审计日志
```

## 数据库设计

### 核心表结构

- **Batch**: 批次主表，存储批次基本信息和统计
- **BatchItem**: 批次明细表，存储每条原始数据和处理结果
- **RuleVersion**: 规则版本表，支持历史追溯
- **FailedItem**: 失败项表，单独存储异常记录
- **AuditLog**: 审计日志表，记录所有操作
- **CandidateList**: 候选清单表，用于安全操作审核

## 设计亮点

1. **规则版本快照**：每个批次关联创建时的规则版本，历史可追溯
2. **失败项隔离**：异常数据单独存储，不影响正常流程
3. **部分成功机制**：整批处理时部分成功部分失败，分别标记
4. **审计全链路**：所有操作留痕，人工复核不覆盖原始记录
5. **安全双确认**：清理/回滚等危险操作需要先创建清单再审核执行

## 文档位置

详细的产品需求文档和技术架构文档位于：
- `.trae/documents/PRD_SLA日志系统.md`
- `.trae/documents/技术架构_SLA日志系统.md`

## 开发命令

```bash
npm run dev           # 开发模式启动
npm run build         # 构建生产版本
npm start             # 启动生产版本
npm run prisma:generate  # 生成 Prisma Client
npm run prisma:migrate   # 执行数据库迁移
npm run prisma:seed      # 插入种子数据
npm run prisma:studio    # 打开 Prisma Studio
```

## License

MIT
