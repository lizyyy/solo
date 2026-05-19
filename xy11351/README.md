# 印刷车间品控管理系统

一个完整的印刷车间质量控制系统，支持纸张批次、印刷批次、Lab色差检测、质量判定、复核流程、质检单生成、趋势分析和报告导出。

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: SQLite (可扩展至MySQL/PostgreSQL)
- **ORM**: Sequelize
- **数据校验**: Joi
- **报告导出**: ExcelJS、json2csv

## 核心功能

### 1. 数据导入 (Import)
- 纸张批次导入
- 印刷批次导入
- Lab检测记录导入
- 返工记录导入
- 支持批量操作、失败回滚、幂等性保证
- 重复提交结果稳定

### 2. 质量判定 (Quality Determination)
- 基于CIE76色差公式计算ΔE
- 根据公差自动判定合格/不合格
- 自动计算合格率、最大色差
- 质量等级评定 (优秀/良好/合格/不合格)
- 异常类型自动识别

### 3. 复核流程 (Review)
- 检测后可进行复核
- 复核通过/驳回
- 状态流转管理

### 4. 质检单生成 (Quality Order)
- 自动生成质检报告单
- 包含检测数据汇总、结论
- 可追溯性保证

### 5. 趋势分析 (Trends)
- 质量分布统计
- 合格率趋势
- 返工率统计
- 负责人维度分析

### 6. 查询筛选 (Query)
- 按批次号、产品名称搜索
- 按负责人筛选
- 按状态筛选 (待检测/已检测/已通过/已驳回/已返工)
- 按异常类型筛选
- 按纸张批次筛选
- 按时间范围筛选

### 7. 报告导出 (Export)
- Excel格式导出 (多Sheet)
- CSV格式导出
- 报告内容与查询结果一致

## 项目结构

```
├── src/
│   ├── index.js                 # API服务入口
│   ├── config/
│   │   ├── database.js          # 数据库配置
│   │   └── index.js             # 配置入口
│   ├── models/
│   │   ├── index.js             # 模型关联
│   │   ├── PaperBatch.js        # 纸张批次模型
│   │   ├── PrintBatch.js        # 印刷批次模型
│   │   ├── LabRecord.js         # Lab检测记录模型
│   │   ├── QualityOrder.js      # 质检单模型
│   │   └── ReworkRecord.js      # 返工记录模型
│   ├── services/
│   │   ├── importService.js     # 导入服务
│   │   ├── validationService.js # 校验服务
│   │   ├── qualityService.js    # 质量服务
│   │   ├── queryService.js      # 查询服务
│   │   └── exportService.js     # 导出服务
│   ├── api/
│   │   └── routes.js            # API路由
│   └── cli/
│       └── index.js             # CLI命令行工具
├── examples/                     # 示例数据
│   ├── paper_batches.csv
│   ├── print_batches.csv
│   └── lab_records.csv
├── data/                         # 数据库目录 (自动生成)
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 使用CLI命令行

查看帮助:
```bash
npm run cli help
```

导入数据:
```bash
# 导入纸张批次
npm run cli import:paper examples/paper_batches.csv

# 导入印刷批次
npm run cli import:print examples/print_batches.csv

# 导入Lab检测记录
npm run cli import:lab examples/lab_records.csv
```

质量操作:
```bash
# 质量判定
npm run cli quality:determine <批次ID>

# 复核通过
npm run cli quality:review <批次ID> pass

# 生成质检单
npm run cli quality:order <批次ID>

# 查看质量趋势
npm run cli quality:trends
```

查询和导出:
```bash
# 列出印刷批次
npm run cli list:batches

# 导出Excel报告
npm run cli export:excel report.xlsx

# 导出CSV报告
npm run cli export:csv report.csv
```

### 启动API服务

```bash
npm run cli server
# 或
npm start
```

服务启动后访问: http://localhost:3000/api

## API接口文档

### 基础信息
- Base URL: `http://localhost:3000/api`
- Content-Type: `application/json`

### 健康检查
```
GET /health
```

### 数据导入
```
POST /import/paper-batches    # 导入纸张批次
POST /import/print-batches    # 导入印刷批次
POST /import/lab-records      # 导入Lab记录
POST /import/rework-records   # 导入返工记录

请求体:
{
  "data": [...],
  "operator": "用户名"
}
```

### 质量操作
```
POST /quality/determine/:id   # 质量判定
POST /quality/review/:id       # 复核
POST /quality/order/:id        # 生成质检单
GET  /quality/trends           # 质量趋势
```

### 查询接口
```
GET /print-batches             # 查询印刷批次
GET /print-batches/:id         # 批次详情
GET /paper-batches             # 查询纸张批次
GET /responsible-list          # 获取负责人列表
```

查询参数:
- `batchNo`: 批次号 (模糊匹配)
- `productName`: 产品名称 (模糊匹配)
- `responsible`: 负责人
- `status`: 状态
- `exceptionType`: 异常类型
- `paperBatchNo`: 纸张批次号
- `startDate`/`endDate`: 时间范围
- `page`: 页码 (默认1)
- `pageSize`: 每页条数 (默认20)

### 导出接口
```
GET /export/excel    # 导出Excel
GET /export/csv      # 导出CSV
```

支持与查询相同的筛选参数

## 数据模型

### 纸张批次 (PaperBatch)
- `id`: UUID
- `batchNo`: 批次号 (唯一)
- `paperType`: 纸张类型
- `supplier`: 供应商
- `weight`: 克重
- `receiveDate`: 入库日期
- `quantity`: 数量
- `remark`: 备注
- `createdBy`: 创建人

### 印刷批次 (PrintBatch)
- `id`: UUID
- `batchNo`: 批次号 (唯一)
- `productName`: 产品名称
- `paperBatchId`: 纸张批次ID
- `paperBatchNo`: 纸张批次号
- `printDate`: 印刷日期
- `quantity`: 数量
- `targetL/A/B`: 目标Lab值
- `status`: 状态 (pending/checked/approved/rejected/reworked)
- `qualityLevel`: 质量等级
- `responsible`: 负责人
- `checker/reviewer`: 检测人/复核人
- `checkTime/reviewTime`: 检测/复核时间
- `exceptionType`: 异常类型
- `reworkCount`: 返工次数

### Lab检测记录 (LabRecord)
- `id`: UUID
- `printBatchId`: 印刷批次ID
- `samplePoint`: 采样点
- `measureL/A/B`: 实测值
- `deltaL/A/B/E`: 差值/总色差
- `isPassed`: 是否合格
- `measureTime`: 测量时间
- `measuredBy`: 测量人

### 质检单 (QualityOrder)
- `id`: UUID
- `orderNo`: 质检单号
- `printBatchId`: 印刷批次ID
- `avgL/A/B`: 平均Lab值
- `targetL/A/B`: 目标Lab值
- `maxDeltaE`: 最大色差
- `passRate`: 合格率
- `qualityLevel`: 质量等级
- `conclusion`: 质检结论
- `generatedBy`: 生成人
- `generateTime`: 生成时间

### 返工记录 (ReworkRecord)
- `id`: UUID
- `printBatchId`: 印刷批次ID
- `reworkNo`: 返工单号
- `reworkCount`: 第几次返工
- `reason`: 返工原因
- `action`: 返工措施
- `operator`: 操作人
- `result`: 返工结果
- `verifiedBy`: 验证人

## 配置说明

### Lab公差配置
在 `src/config/index.js` 中可调整:
```javascript
LAB_TOLERANCE: {
  L: 2.0,  // L值公差
  A: 2.0,  // A值公差
  B: 2.0   // B值公差
}
```

### 数据库配置
默认使用SQLite，数据库文件位于 `data/database.sqlite`。

如需使用MySQL/PostgreSQL，修改 `src/config/database.js` 中的连接配置。

## 业务流程

1. **纸张入库** → 导入纸张批次数据
2. **印刷生产** → 创建印刷批次，关联纸张批次
3. **色差检测** → 导入Lab检测记录
4. **质量判定** → 系统自动判定质量等级
5. **人工复核** → 主管复核确认
6. **返工处理** → 不合格批次返工
7. **报告导出** → 生成质检报告归档

## 幂等性保证

系统设计了严格的幂等性机制:
- 重复导入相同批次号会自动跳过
- 重复生成质检单返回已有记录
- 状态变更有严格的前置条件校验
- 所有操作可追溯、可审计

## 批量操作失败处理

批量导入时:
- 返回成功/失败/跳过的详细清单
- 失败记录可单独重试
- 已成功记录不会重复处理
- 支持事务回滚保证数据一致性

## License

MIT
