# 学校后勤对账服务

一个面向学校后勤部门的对账系统，用于按月核对困难学生补贴、刷卡消费和退餐退款记录。

## 功能特性

### 核心功能
- **数据导入**: 支持导入补贴名单(JSON)、刷卡记录(CSV)、退款表(CSV)
- **自动比对**: 自动检测补贴上限超出、重复刷卡、退餐异常等问题
- **人工复核**: 支持人工审核、调整金额、要求补充材料
- **重新计算**: 复核后自动重新计算并同步更新汇总数据
- **报告导出**: 支持导出Excel、CSV、PDF格式的对账报告

### 差异检测类型
1. **补贴上限超出**: 学生消费超过月度补贴限额
2. **疑似重复刷卡**: 5分钟内相同金额的重复刷卡
3. **退餐无对应消费**: 退款记录找不到对应的消费记录
4. **有补贴无消费记录**: 享有补贴但本月无任何消费
5. **有消费无补贴记录**: 有消费但不在补贴名单中

## 项目结构

```
.
├── src/
│   ├── models/
│   │   └── types.ts              # 数据类型定义
│   ├── services/
│   │   ├── importService.ts      # 数据导入服务
│   │   ├── reconciliationService.ts  # 对账核心服务
│   │   └── reportService.ts      # 报告生成服务
│   ├── store/
│   │   └── dataStore.ts          # 数据存储层
│   ├── routes/
│   │   └── reconciliationRoutes.ts  # API路由
│   └── index.ts                  # 服务入口
├── examples/                      # 示例数据
│   ├── subsidy.json              # 补贴名单示例
│   ├── swipe.csv                 # 刷卡记录示例
│   └── refund.csv                # 退款记录示例
├── scripts/
│   └── demo.ts                   # 演示脚本
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 运行演示
```bash
npx ts-node scripts/demo.ts
```

### 3. 启动服务
```bash
npm run dev
```

服务将在 http://localhost:3000 启动

## API 接口

### 对账批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reconciliation/batches` | 创建对账批次 |
| GET | `/api/reconciliation/batches` | 获取所有批次 |
| GET | `/api/reconciliation/batches/:id` | 获取批次详情 |

**创建批次示例**:
```bash
curl -X POST http://localhost:3000/api/reconciliation/batches \
  -H "Content-Type: application/json" \
  -d '{"month": "2024-05", "createdBy": "张老师", "name": "2024年5月对账"}'
```

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reconciliation/import/subsidy` | 导入补贴名单(JSON) |
| POST | `/api/reconciliation/import/swipe` | 导入刷卡记录(CSV) |
| POST | `/api/reconciliation/import/refund` | 导入退款表(CSV) |

**导入补贴名单示例**:
```bash
curl -X POST http://localhost:3000/api/reconciliation/import/subsidy \
  -F "file=@examples/subsidy.json"
```

### 对账流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reconciliation/batches/:id/process` | 执行自动对账 |
| GET | `/api/reconciliation/batches/:id/summary` | 获取对账汇总 |
| GET | `/api/reconciliation/batches/:id/details` | 获取明细列表 |
| GET | `/api/reconciliation/batches/:id/details/:detailId` | 获取单条明细 |

**执行对账示例**:
```bash
curl -X POST http://localhost:3000/api/reconciliation/batches/{batchId}/process
```

### 人工复核

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reconciliation/details/:id/review` | 复核单条记录 |
| POST | `/api/reconciliation/details/:id/recalculate` | 重新计算 |
| POST | `/api/reconciliation/batches/:id/complete` | 完成对账 |

**复核操作示例**:
```bash
curl -X POST http://localhost:3000/api/reconciliation/details/{detailId}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "李老师",
    "action": "approve",
    "comments": "情况属实，同意发放"
  }'
```

**复核操作类型**:
- `approve`: 通过，按系统计算结果发放
- `reject`: 驳回，不予补贴
- `adjust`: 调整，需指定 adjustedAmount
- `require_materials`: 要求补充材料

### 报告下载

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reconciliation/batches/:id/report/xlsx` | 下载Excel报告 |
| GET | `/api/reconciliation/batches/:id/report/csv` | 下载CSV报告 |
| GET | `/api/reconciliation/batches/:id/report/pdf` | 下载PDF报告 |

## 数据格式说明

### 补贴名单 (JSON)
```json
[
  {
    "studentId": "2024001",
    "name": "张三",
    "grade": "高一",
    "class": "1班",
    "subsidyType": "特困生补贴",
    "monthlyLimit": 400,
    "effectiveMonth": "2024-05",
    "status": "active"
  }
]
```

### 刷卡记录 (CSV)
```csv
studentId,姓名,年级,班级,刷卡时间,金额,餐别,商户,终端号,使用补贴
2024001,张三,高一,1班,2024-05-01 07:30:00,8.5,早餐,第一食堂,POS001,是
```

### 退款记录 (CSV)
```csv
studentId,姓名,年级,班级,退款日期,退款金额,退款原因,操作员
2024001,张三,高一,1班,2024-05-05,25.00,饭菜不新鲜,张管理员
```

## 对账流程说明

### 完整工作流
1. **创建批次**: 按月份创建对账批次
2. **导入数据**: 依次导入补贴名单、刷卡记录、退款表
3. **自动对账**: 系统自动比对，标记差异记录
4. **人工复核**: 后勤人员逐条审核差异记录
5. **调整计算**: 支持人工调整金额或重新计算
6. **生成报告**: 导出对账结果报告
7. **完成对账**: 所有记录复核完成后结束批次

### 差异解释示例

**补贴上限超出**:
> 该生月度补贴上限为¥400.00，本月实际消费¥520.00，超出部分¥120.00。超出部分将不予补贴，需由学生自费。

**疑似重复刷卡**:
> 检测到2笔疑似重复刷卡记录（5分钟内相同金额），涉及金额¥24.00。请核实是否为误刷或重复扣款。

**退餐无对应消费**:
> 发现1笔退餐记录找不到对应的刷卡消费记录，涉及金额¥25.00。请核实退餐原因和对应消费记录。

## 核心设计要点

1. **数据同步**: 人工复核后自动更新明细、汇总、报告中的所有数据
2. **可追溯性**: 所有复核操作留痕，记录操作人、时间、意见
3. **边界说明**: 对补贴上限等边界情况提供可读的详细说明
4. **可解释性**: 每条记录都有明确的最终说明，便于向他人解释

## 技术栈

- **运行时**: Node.js + TypeScript
- **Web框架**: Express
- **文件处理**: multer, csv-parser, exceljs, pdfkit
- **数据存储**: 内存存储（可扩展为数据库）
- **ID生成**: UUID

## 扩展建议

1. **持久化存储**: 接入 MySQL/MongoDB 数据库
2. **用户认证**: 添加登录认证和权限管理
3. **前端界面**: 开发 Web 管理后台
4. **消息通知**: 差异提醒、材料催交通知
5. **数据同步**: 对接校园一卡通系统实时获取数据
