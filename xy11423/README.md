# 二手车整备验收回放链路服务

用于记录和追踪二手车整备验收过程的完整链路，支持批次复核、多次返厂追踪、异常处理和审计回放。

## 核心特性

- **批次管理**：检测单、维修报价、照片清单、短信截图统一批次提交
- **幂等处理**：支持 `ignore` / `overwrite` / `append` 三种策略
- **状态追踪**：draft → submitted → partial_success → success → recalled → frozen → exported
- **审计日志**：完整记录谁在什么时候做了什么改动
- **异常处理**：支持人工改判、撤回重提、回放异常
- **对账功能**：按VIN查询同一车辆的所有历史记录和费用汇总
- **数据导出**：导出前强制冻结，保证数据一致性

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 从空库启动服务

```bash
# 首次启动会自动创建数据库
npm run dev
```

服务启动后访问: http://localhost:3000/health

### 3. 准备样例数据

```bash
# 生成测试数据（会重置数据库）
npm run seed
```

### 4. 走主流程

```bash
# 确保服务已启动，然后运行主流程测试
npm run test
```

主流程包含：
- 健康检查
- 提交批次（检测单 + 报价单 + 照片 + 短信）
- 查询批次详情
- 撤回批次
- 冻结 + 导出批次
- 按VIN查询历史批次

### 5. 制造异常场景

```bash
# 测试边界情况
npm run test:edge
```

覆盖以下边界：
- **部分失败**：提交包含错误数据，验证 partial_success 状态
- **冻结后修改**：验证冻结批次无法被修改
- **撤回后重提**：验证 recalled 状态后可以重提
- **人工改判**：验证异常照片的人工审核功能

```bash
# 测试幂等性
npm run test:idempotent
```

验证三种策略：
- **ignore**：重复提交直接忽略
- **overwrite**：重复提交覆盖原有数据
- **append**：重复提交追加新数据

### 6. 查看导出结果

导出文件位于 `exports/` 目录，每个批次导出为单独的文件夹，包含：
- `batch_info.csv` - 批次基本信息
- `inspection_sheets.csv` - 检测单
- `repair_quotes.csv` - 维修报价
- `photo_items.csv` - 照片清单
- `abnormal_photos.csv` - 异常照片
- `sms_screenshots.csv` - 短信截图
- `audit_logs.csv` - 审计日志
- `status_transitions.csv` - 状态流转记录

## 命令脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式启动服务 |
| `npm run seed` | 生成测试数据（重置数据库） |
| `npm run test` | 运行主流程测试 |
| `npm run test:idempotent` | 运行幂等性测试 |
| `npm run test:edge` | 运行边界情况测试 |
| `npm run reconcile` | 对账（检查数据一致性） |
| `npm run replay` | 异常回放工具 |

## API 接口

### 提交批次
```bash
POST /api/batches/submit
Content-Type: application/json

{
  "batchNo": "BATCH-2024-001",
  "vin": "LSVAM4187D2123456",
  "plateNumber": "京A12345",
  "responsiblePerson": "张三",
  "strategy": "ignore",
  "inspectionSheets": [...],
  "repairQuotes": [...],
  "photoItems": [...],
  "smsScreenshots": [...],
  "operator": "admin",
  "operatorRole": "admin"
}
```

### 查询批次列表
```bash
GET /api/batches
GET /api/batches?vin=LSVAM4187D2123456
```

### 查询批次详情
```bash
GET /api/batches/{batchId}
```

### 撤回批次
```bash
POST /api/batches/{batchId}/recall
{
  "operator": "manager",
  "operatorRole": "manager",
  "reason": "数据有误"
}
```

### 冻结批次
```bash
POST /api/batches/{batchId}/freeze
{
  "operator": "admin",
  "operatorRole": "admin"
}
```

### 解冻批次
```bash
POST /api/batches/{batchId}/unfreeze
{
  "operator": "admin",
  "operatorRole": "admin"
}
```

### 导出批次
```bash
POST /api/batches/{batchId}/export
{
  "operator": "admin",
  "operatorRole": "admin"
}
```

### 人工改判异常照片
```bash
POST /api/batches/abnormal-photos/{photoId}/manual-override
{
  "operator": "supervisor",
  "operatorRole": "supervisor",
  "reviewResult": "正常现象，无需处理"
}
```

## 对账工具

```bash
# 查看所有批次概况
npm run reconcile

# 按VIN查看明细（包含总费用）
npm run reconcile -- vin LSVAM4187D2123456

# 查看单个批次详情
npm run reconcile -- batch {batchId}
```

## 异常回放工具

```bash
# 列出所有异常
npm run replay -- list

# 只看失败/部分成功的批次
npm run replay -- failed

# 查看未审核的异常照片
npm run replay -- unreviewed

# 查看最近N条操作日志
npm run replay -- logs 100

# 重放某个批次
npm run replay -- replay {batchId}
```

## 数据库结构

- **batches** - 批次主表
- **inspection_sheets** - 检测单
- **repair_quotes** - 维修报价
- **photo_items** - 照片清单
- **abnormal_photos** - 异常照片
- **sms_screenshots** - 短信截图
- **audit_logs** - 审计日志
- **status_transitions** - 状态流转记录

## 状态流转

```
draft (创建)
  ↓
submitted (提交)
  ├→ success (全部成功)
  ├→ partial_success (部分成功)
  └→ failed (全部失败)
       ↓
recalled (撤回) ←→ success/partial_success
       ↓
re-submitted (重提)
       ↓
frozen (冻结，导出前)
       ↓
exported (已导出)
```

## 幂等策略说明

| 策略 | 重复提交行为 | 适用场景 |
|------|-------------|----------|
| **ignore** | 直接忽略，返回已有批次 | 避免重复处理 |
| **overwrite** | 删除原有数据，重新写入 | 需要完全替换 |
| **append** | 保留原有数据，追加新记录 | 增量补充数据 |

## 项目结构

```
.
├── src/
│   ├── api/              # API路由
│   ├── database/         # 数据库连接和schema
│   ├── middleware/       # 中间件
│   ├── repositories/     # 数据访问层
│   ├── services/         # 业务逻辑层
│   ├── types/            # TypeScript类型
│   └── index.ts          # 服务入口
├── scripts/              # 脚本工具
│   ├── seed.ts           # 造数脚本
│   ├── reconcile.ts      # 对账脚本
│   ├── replay-errors.ts  # 回放脚本
│   ├── test-flow.ts      # 主流程测试
│   ├── test-idempotent.ts # 幂等性测试
│   └── test-edge-cases.ts # 边界情况测试
├── exports/              # 导出文件目录
├── data/                 # 数据库文件目录
└── package.json
```

## 重点关注

**收车负责人应该重点看**：
1. **命令脚本** - 造数、对账、回放、测试都有单独命令
2. **HTTP接口** - 所有操作都有对应的API，可追踪traceId
3. **本地持久化** - SQLite本地存储，审计日志完整记录每个操作
4. **状态变化** - 每个批次的状态流转都有记录
5. **幂等控制** - 同一批数据重复提交有明确策略
