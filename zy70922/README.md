# 检测站对账服务

一个面向检测站接样员的后端对账服务，用于自动比对送样CSV、检测项目JSON和复检规则，支持人工复核、差异解释和报告导出。

## 功能特性

- 📥 **数据导入**: 支持CSV样品数据和JSON检测项目数据导入
- 🔍 **自动比对**: 自动匹配样品与检测项目，应用复检规则
- ⚠️ **差异识别**: 自动检测样品混批、复检窗口超时、检测值超标等差异
- 📖 **差异解释**: 为每条差异提供根本原因、影响分析和建议操作
- ✅ **人工复核**: 支持放行、退回、要求补材料三种复核操作
- 🔄 **重新计算**: 复核后自动同步更新统计数据和报告
- 📄 **报告导出**: 支持HTML、Excel、CSV格式报告导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化示例数据

```bash
npm run seed
```

### 3. 运行测试流程

```bash
npm test
```

### 4. 启动服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

## API 文档

### 健康检查

```
GET /api/health
```

### 数据导入

#### 导入样品CSV
```
POST /api/import/csv
Content-Type: multipart/form-data

Parameters:
- file: CSV文件
- imported_by: 导入人姓名
```

#### 导入检测项目JSON
```
POST /api/import/json
Content-Type: multipart/form-data

Parameters:
- file: JSON文件
- imported_by: 导入人姓名
```

#### 获取导入记录列表
```
GET /api/import
```

### 对账管理

#### 创建对账会话
```
POST /api/reconciliations
Content-Type: application/json

{
  "batch_id": "BATCH20240501",
  "name": "2024年5月第一批次对账",
  "created_by": "接样员张三",
  "csv_import_id": "xxx",
  "json_import_id": "xxx"
}
```

#### 获取对账列表
```
GET /api/reconciliations
```

#### 获取对账详情
```
GET /api/reconciliations/:id
```

#### 执行自动比对
```
POST /api/reconciliations/:id/start
```

#### 重新计算
```
POST /api/reconciliations/:id/recalculate
```

#### 获取差异列表（带解释）
```
GET /api/reconciliations/:id/discrepancies
```

#### 获取指定样品的差异
```
GET /api/reconciliations/:id/discrepancies/sample/:sampleNo
```

#### 获取样品列表
```
GET /api/reconciliations/:id/samples
GET /api/reconciliations/:id/samples?status=mismatch
```

#### 获取决策支持
```
GET /api/reconciliations/:id/decision-support/:sampleNo
```

#### 人工复核样品
```
POST /api/reconciliations/:id/review
Content-Type: application/json

{
  "sample_no": "S202405001",
  "action": "approve",
  "reviewer": "接样员张三",
  "comment": "所有检测项目合格",
  "discrepancy_ids": ["xxx", "yyy"]
}

action 可选值: approve（放行）, reject（退回）, supplement（要求补材料）
```

#### 获取复核历史
```
GET /api/reconciliations/:id/reviews
GET /api/reconciliations/:id/reviews?sample_no=S202405001
```

### 报告导出

#### 获取报告数据
```
GET /api/reports/:id
```

#### 导出HTML报告
```
GET /api/reports/:id/html
```

#### 导出Excel报告
```
GET /api/reports/:id/excel
```

#### 导出CSV报告
```
GET /api/reports/:id/csv
```

### 复检规则管理

#### 创建复检规则
```
POST /api/retest-rules
Content-Type: application/json

{
  "rule_code": "RETEST001",
  "rule_name": "农药残留超标复检",
  "item_code": "P001",
  "fail_threshold": "0.1",
  "retest_count": 1,
  "retest_window_hours": 24,
  "action_on_fail": "review",
  "description": "有机磷农药残留超标时需在24小时内完成复检",
  "is_active": true
}
```

#### 获取规则列表
```
GET /api/retest-rules
GET /api/retest-rules?active=true
```

## 数据模型

### 差异类型 (DiscrepancyType)
- `mixed_batch`: 样品混批
- `retest_window`: 复检窗口超时
- `report_withdrawn`: 报告撤回
- `project_mismatch`: 检测项目不匹配
- `value_out_of_range`: 检测值超标
- `duplicate_sample`: 重复样品
- `missing_data`: 数据缺失

### 样品状态 (SampleStatus)
- `pending`: 待处理
- `matched`: 比对通过
- `mismatch`: 比对不通过
- `reviewing`: 复核中
- `approved`: 已放行
- `rejected`: 已退回
- `supplement`: 需补材料

### 复核操作 (ReviewAction)
- `approve`: 放行
- `reject`: 退回
- `supplement`: 要求补材料

## 示例数据说明

示例数据包含8个样品：
- **S202405001**: 所有检测项目合格，无差异
- **S202405002**: 农药残留超标（0.08mg/kg > 标准0.05mg/kg），需要人工修正
- **S202405003**: 重金属铅超标但已复检（可演示复检窗口超时场景）
- **S202405004**: 合格
- **S202405005**: 合格
- **S202405006**: 农药残留超标，待处理
- **S202405007**: 合格
- **S202405008**: 所有项目合格

## 项目结构

```
src/
├── database/          # 数据库连接和初始化
├── routes/            # API路由
│   ├── import.ts
│   ├── reconciliation.ts
│   ├── report.ts
│   └── retest-rules.ts
├── services/          # 业务逻辑服务
│   ├── importService.ts
│   ├── reconciliationService.ts
│   ├── explanationService.ts
│   ├── reviewService.ts
│   ├── reportService.ts
│   └── retestRuleService.ts
├── scripts/           # 脚本
│   ├── seed.ts        # 初始化示例数据
│   └── test-flow.ts   # 完整流程测试
├── types/             # TypeScript类型定义
│   └── index.ts
└── server.ts          # 服务器入口

samples/               # 示例数据文件
├── sample_csv.csv     # 样品CSV
└── inspection_data.json # 检测项目JSON
```

## 典型使用流程

1. 导入送样CSV文件 (`POST /api/import/csv`)
2. 导入检测项目JSON文件 (`POST /api/import/json`)
3. 创建对账会话 (`POST /api/reconciliations`)
4. 执行自动比对 (`POST /api/reconciliations/:id/start`)
5. 查看差异列表，获取每条差异的解释和建议
6. 使用决策支持辅助判断
7. 对有差异的样品进行人工复核
8. 重新计算对账统计
9. 导出报告（HTML/Excel/CSV）

接样员可以通过导出的报告向他人说明每条记录被放行、退回或要求补材料的原因。
