# 数据抽样复核 API

一个完整的数据抽样复核系统，支持多种抽样方法、复核流程管理、异常追踪和报告导出。

## 核心功能

### 数据模型
- **抽样批次 (Batch)**: 管理整个抽样复核流程的生命周期
- **抽样规则 (Rule)**: 定义抽样策略，支持多种抽样方法
- **原始记录 (Record)**: 存储待抽样的原始数据，保留原始输入
- **复核人 (Reviewer)**: 管理复核人员信息
- **复核结论 (Conclusion)**: 记录每条抽样样本的复核结果
- **异常日志 (Exception Log)**: 追踪处理过程中的所有异常
- **抽样报告 (Report)**: 生成并导出Excel格式的复核报告

### 抽样规则
- **随机抽样**: 从数据中随机抽取指定数量的样本
- **系统抽样**: 按固定间隔抽取样本
- **分层抽样**: 按指定字段分层后抽样，确保样本代表性
- **规则抽样**: 基于过滤条件筛选后抽样

### 状态流转
```
草稿 → 抽样中 → 抽样完成 → 复核中 → 复核完成 → 报告生成 → 归档
```

### 关键特性
- ✅ **样本追踪**: 每条记录可追溯到原始输入、处理依据和最终结论
- ✅ **异常处理**: 完整的异常记录和追踪机制
- ✅ **人工修正**: 支持对复核结论进行人工修正，并保留修改痕迹
- ✅ **Excel导出**: 生成包含概览、明细、异常记录的完整报告
- ✅ **持久化存储**: 使用SQLite数据库，重启服务数据不丢失
- ✅ **失败记录追溯**: 可单独查询失败记录，关联原始数据和异常信息

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 初始化数据库
```bash
npm run db:migrate
```

### 导入初始数据（可选）
```bash
npm run db:seed
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 1. 抽样规则管理

#### 创建抽样规则
```
POST /api/rules
```
```json
{
  "name": "月度质检抽样规则",
  "description": "用于月度质量检查的抽样规则",
  "method": "random",
  "sampleSize": 100,
  "sampleRate": 0.1,
  "createdBy": "admin"
}
```

#### 查询抽样规则列表
```
GET /api/rules?isActive=true&page=1&pageSize=20
```

#### 查询单个规则
```
GET /api/rules/:ruleId
```

### 2. 抽样批次管理

#### 创建抽样批次
```
POST /api/batches
```
```json
{
  "name": "2024年1月质检批次",
  "description": "第一季度质量检查",
  "ruleId": "uuid-of-rule",
  "createdBy": "admin"
}
```

#### 导入原始记录
```
POST /api/batches/:batchId/import
```
```json
{
  "records": [
    {
      "originalId": "data_001",
      "dataSource": "system_a",
      "content": { "amount": 1000, "type": "normal" },
      "rawInput": "{\"amount\":1000,\"type\":\"normal\"}"
    }
  ]
}
```

#### 执行抽样
```
POST /api/batches/:batchId/sampling
```

#### 查询批次列表
```
GET /api/batches?status=draft&page=1&pageSize=20
```

### 3. 复核管理

#### 开始复核
```
POST /api/reviews/:batchId/start
```

#### 提交复核结论
```
POST /api/reviews/conclusions
```
```json
{
  "batchId": "uuid-of-batch",
  "originalRecordId": "uuid-of-record",
  "reviewerId": "uuid-of-reviewer",
  "result": "pass",
  "comments": "数据符合要求",
  "evidence": ["img1.jpg"],
  "processingBasis": "按照质检规范第3条"
}
```

#### 人工修正
```
POST /api/reviews/correct
```
```json
{
  "conclusionId": "uuid-of-conclusion",
  "correctedBy": "admin",
  "result": "pass",
  "comments": "经复核，原始结论有误",
  "processingBasis": "根据最新质检标准修正"
}
```

#### 查询复核统计
```
GET /api/reviews/:batchId/stats
```

#### 查询失败记录（带追溯）
```
GET /api/reviews/:batchId/failures?page=1&pageSize=20
```

### 4. 报告管理

#### 生成报告
```
POST /api/reports/:batchId/generate
```
```json
{
  "generatedBy": "admin"
}
```

#### 下载报告
```
GET /api/reports/:reportId/download
```

#### 查询报告列表
```
GET /api/reports?batchId=xxx&page=1&pageSize=20
```

## 数据模型关系

```
抽样规则 (1) ──→ (N) 抽样批次
                        ↓
                        ├─→ (N) 原始记录
                        │         ↓
                        │         ├─→ (N) 复核结论
                        │         └─→ (N) 异常日志
                        │
                        └─→ (N) 抽样报告
```

## 状态枚举

### 批次状态
- `draft`: 草稿
- `sampling`: 抽样中
- `sampling_completed`: 抽样完成
- `reviewing`: 复核中
- `review_completed`: 复核完成
- `report_generated`: 报告已生成
- `archived`: 已归档

### 复核结果
- `pending`: 待复核
- `pass`: 通过
- `fail`: 不通过
- `needs_review`: 需要复核

### 抽样方法
- `random`: 随机抽样
- `systematic`: 系统抽样
- `stratified`: 分层抽样
- `cluster`: 整群抽样
- `convenience`: 便利抽样
- `rule_based`: 规则抽样

### 异常类型
- `sampling_error`: 抽样异常
- `review_error`: 复核异常
- `data_import_error`: 数据导入异常
- `report_error`: 报告生成异常
- `system_error`: 系统异常

## 项目结构

```
├── src/
│   ├── index.ts              # 应用入口
│   ├── routes.ts             # 路由配置
│   ├── database/
│   │   ├── connection.ts     # 数据库连接
│   │   ├── migrate.ts        # 迁移脚本
│   │   └── seed.ts           # 种子数据
│   ├── models/               # 数据模型
│   │   ├── index.ts
│   │   ├── SamplingBatch.ts
│   │   ├── SamplingRule.ts
│   │   ├── OriginalRecord.ts
│   │   ├── Reviewer.ts
│   │   ├── ReviewConclusion.ts
│   │   ├── ExceptionLog.ts
│   │   └── SamplingReport.ts
│   ├── services/             # 业务逻辑
│   │   ├── SamplingService.ts
│   │   ├── ReviewService.ts
│   │   ├── ReportService.ts
│   │   └── RuleService.ts
│   └── controllers/          # API 控制器
│       ├── batchController.ts
│       ├── ruleController.ts
│       ├── reviewController.ts
│       └── reportController.ts
├── data/                     # 数据存储
│   └── reports/              # 报告文件
├── package.json
└── tsconfig.json
```

## 典型使用流程

1. **创建抽样规则**: 定义抽样策略
2. **创建抽样批次**: 关联规则，创建批次
3. **导入原始数据**: 批量导入待检数据
4. **执行抽样**: 按规则抽取样本
5. **开始复核**: 进入复核流程
6. **提交复核结论**: 逐条复核样本
7. **异常处理**: 记录并处理过程异常
8. **人工修正**: 对有问题的结论进行修正
9. **生成报告**: 导出Excel格式报告
10. **追溯查询**: 随时追溯失败记录的完整链路

## 数据追溯能力

系统确保每条失败记录都可以追溯到：
- **原始输入**: 导入时的完整原始数据
- **处理依据**: 复核时的判定依据
- **异常信息**: 处理过程中产生的异常日志
- **修改历史**: 人工修正的时间和操作人

这些数据全部持久化存储，服务重启后依然可以完整查询。

## License

MIT
