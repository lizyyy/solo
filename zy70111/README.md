# 屠宰检疫证流转服务系统

## 项目简介

本系统旨在解决屠宰检疫证在养殖、运输、市场端流转时证号经常重复使用的问题。系统以检疫证号作为唯一入口，通过批次绑定和运输核销推进业务流转，提供市场验收、作废重开、监管导出等兜底和复查功能。

## 技术栈

- **后端框架**: NestJS 10.x
- **语言**: TypeScript
- **数据库**: PostgreSQL
- **ORM**: TypeORM 0.3.x
- **API 文档**: Swagger
- **日志**: nestjs-pino (Pino)
- **Excel 导出**: ExcelJS
- **日期处理**: date-fns

## 核心功能

### 1. 证号重复检测
- 录入检疫证时自动检测证号是否已存在
- 标记 `hasDuplicate=true` 并创建复核任务
- 返回 `needsReview=true` 提醒业务人员

### 2. 业务流程推进
```
已开具 → 批次绑定 → 运输中 → 运输核销 → 市场验收
```

### 3. 人工修正一致性保障
- 每次人工修正保存数据快照
- `flow_histories` 表记录完整时间线
- `hasManualCorrection` 永久标记
- 当前统计与历史查询分离，互不矛盾

### 4. 监管导出
- 5 种导出类型（日常报告、重复分析、流转历史、复核汇总、合规检查）
- 中文业务字段，无需理解代码
- 包含导出说明页
- 支持自动筛选

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置数据库
复制 `.env.example` 为 `.env` 并修改配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=quarantine_cert

JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

LOG_LEVEL=info
```

### 3. 创建数据库
```sql
CREATE DATABASE quarantine_cert;
```

### 4. 启动服务
```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

### 5. 访问 API 文档
启动后访问：
- **API 基础路径**: http://localhost:3000/api/v1
- **Swagger 文档**: http://localhost:3000/docs

## 数据库实体

### 核心实体
| 实体 | 表名 | 说明 |
|-----|------|------|
| `Certificate` | `certificates` | 检疫证主表 |
| `CertificateDuplicate` | `certificate_duplicates` | 证号重复冲突记录 |
| `Batch` | `batches` | 批次表 |
| `TransportRecord` | `transport_records` | 运输记录表 |
| `MarketInspection` | `market_inspections` | 市场验收记录表 |
| `VoidRecord` | `void_records` | 作废记录表 |
| `FlowHistory` | `flow_histories` | 流转历史表 |
| `AuditLog` | `audit_logs` | 审计日志表 |
| `ReviewTask` | `review_tasks` | 人工复核任务表 |
| `ExportTask` | `export_tasks` | 导出任务表 |

### 状态机
```
issued (已开具)
  ↓
batch_bound (已绑定批次)
  ↓
in_transport (运输中)
  ↓
transport_verified (运输已核销)
  ↓
market_accepted (市场已验收)
```

其他状态：
- `voided` - 已作废
- `manually_corrected` - 已人工修正
- `duplicate_detected` - 检测到重复

## 关键 API

### 检疫证管理
```bash
# 录入检疫证（入口）
POST /api/v1/certificates

# 查询证号详情（含重复和历史）
GET /api/v1/certificates/detail/{certificateNumber}

# 人工修正
PATCH /api/v1/certificates/{id}/manual-correction
```

### 批次管理
```bash
# 创建批次
POST /api/v1/batches

# 绑定检疫证
POST /api/v1/batches/bind

# 解绑检疫证
POST /api/v1/batches/unbind
```

### 运输核销
```bash
# 创建运输记录
POST /api/v1/transports

# 运输核销
POST /api/v1/transports/verify
```

### 市场验收
```bash
# 市场验收
POST /api/v1/market-inspections
```

### 作废重开
```bash
# 作废检疫证
POST /api/v1/void-certificates

# 重开检疫证
POST /api/v1/void-certificates/reissue
```

### 监管导出
```bash
# 创建导出任务
POST /api/v1/exports

# 查询导出任务
GET /api/v1/exports/{id}
```

## 统一返回格式

所有业务操作返回 `ProcessingResult` 格式：
```json
{
  "success": true,
  "data": { ... },
  "needsReview": false,
  "message": "操作成功"
}
```

当需要人工复核时：
```json
{
  "success": true,
  "needsReview": true,
  "reviewReason": "DUPLICATE_CERTIFICATE_NUMBER",
  "reviewPriority": "high",
  "message": "检疫证录入成功，但检测到证号重复",
  "warnings": ["检测到证号重复", "已自动创建复核任务"]
}
```

## 复核原因代码

| 代码 | 含义 | 优先级 |
|-----|------|--------|
| `DUPLICATE_CERTIFICATE_NUMBER` | 证号重复 | 高 |
| `BATCH_CONTAINS_DUPLICATE_CERTS` | 批次包含重复证 | 中 |
| `TRANSPORT_CONTAINS_DUPLICATE_CERTS` | 运输包含重复证 | 高 |
| `MARKET_INSPECTION_DUPLICATE_CERT` | 市场验收发现重复 | 高 |

## 项目结构

```
src/
├── common/
│   ├── types/          # 枚举和接口定义
│   ├── exceptions/     # 自定义异常
│   └── decorators/     # 自定义装饰器
├── config/
│   └── typeorm.config.ts  # TypeORM 配置
├── modules/
│   ├── certificate/    # 检疫证管理
│   ├── batch/          # 批次管理
│   ├── transport/      # 运输核销
│   ├── market/         # 市场验收
│   ├── void/           # 作废重开
│   ├── export/         # 监管导出
│   ├── history/        # 历史记录（Global）
│   ├── review/         # 人工复核
│   └── health/         # 健康检查
├── app.module.ts
└── main.ts
```

## 业务规则

详细业务规则请参考 [BUSINESS_RULES.md](./BUSINESS_RULES.md)

## 开发命令

```bash
# 开发模式（带热重载）
npm run start:dev

# 构建生产版本
npm run build

# 启动生产版本
npm run start:prod

# 代码检查
npm run lint

# 格式化代码
npm run format

# 运行测试
npm run test

# 生成数据库迁移
npm run migration:generate

# 执行迁移
npm run migration:run
```

## 日志配置

日志级别通过环境变量 `LOG_LEVEL` 控制：
- `trace` - 最详细
- `debug` - 调试信息
- `info` - 一般信息（默认）
- `warn` - 警告
- `error` - 错误

## 注意事项

1. **数据库同步**：开发环境 `synchronize: true`，生产环境请关闭
2. **人工修正**：每次修正都会保存快照，可追溯
3. **导出文件**：默认保存到 `/tmp/exports/`，生产环境需配置持久化存储
4. **JWT 密钥**：生产环境请更换为安全的密钥

## License

UNLICENSED
