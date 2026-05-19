# 印刷车间品控管理系统 (Print Quality Control System)

一个完整的服务端系统，用于管理印刷批次的 Lab 颜色值、纸张批次、返工记录、质检判定和报告生成。

## 功能特性

### 核心功能
- ✅ **批次导入** - 支持单批次和批量导入，幂等性保证
- ✅ **Lab 颜色值管理** - 自动计算 Delta E 和公差判定
- ✅ **QC 判定流程** - 判定、复核、完成状态流转
- ✅ **返工记录** - 完整的返工历史追踪
- ✅ **质检单生成** - 自动生成 PDF 质检报告
- ✅ **趋势分析** - 按日/周/月统计合格率和 Delta E 趋势

### 安全与权限
- ✅ **API Key 认证** - 三级权限（操作员、QC、管理员）
- ✅ **敏感字段脱敏** - 客户名、操作员等敏感字段自动脱敏
- ✅ **审计日志** - 所有操作完整记录，可追溯
- ✅ **速率限制** - API 请求频率限制
- ✅ **日志脱敏** - 日志文件中敏感字段自动隐藏

### 数据持久化
- ✅ **SQLite 本地数据库** - 无需额外安装数据库服务
- ✅ **重启数据保留** - 服务重启后数据完整保留
- ✅ **事务保证** - 关键操作使用数据库事务

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **框架**: Express.js
- **ORM**: TypeORM
- **数据库**: SQLite
- **校验**: Joi
- **日志**: Winston
- **导出**: ExcelJS, PDFKit

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 3. 健康检查

```bash
curl http://localhost:3000/health
```

### 4. 运行 API 测试

```bash
# 首先确保服务正在运行，然后执行
npx ts-node src/scripts/test-api.ts
```

## API 文档

### 认证

所有 API 端点需要在请求头中携带 `x-api-key`:

- **管理员 Key**: `admin-qc-key-2024` - 完整权限
- **QC Key**: `qc_xxx` - QC 操作权限（判定、复核等）
- **操作员 Key**: `op_xxx` - 基础操作权限

示例:
```bash
curl -H "x-api-key: admin-qc-key-2024" http://localhost:3000/api/batches
```

### 批次接口

#### 导入批次
```
POST /api/batches/import
Content-Type: application/json

{
  "batchNumber": "BATCH-001",
  "productName": "Product A",
  "customerName": "Customer XYZ",
  "quantity": 1000,
  "paperBatchNumber": "PAPER-001",
  "productionDate": "2024-01-15",
  "machineId": "MACHINE-A",
  "operator": "John Doe",
  "standardLabValues": {
    "L": 95.0,
    "a": 0.5,
    "b": -1.0,
    "tolerance": 2.0
  },
  "labRecords": [
    {
      "L": 94.5,
      "a": 0.8,
      "b": -0.7,
      "tolerance": 2.0,
      "measurePoint": "Top-Left",
      "measureOrder": 1
    }
  ],
  "remark": "备注"
}
```

#### 批量导入
```
POST /api/batches/batch-import
Content-Type: application/json

{
  "batches": [
    { ... 批次1数据 ... },
    { ... 批次2数据 ... }
  ]
}
```

#### QC 判定
```
POST /api/batches/judgment
Content-Type: application/json

{
  "batchNumber": "BATCH-001",
  "isPassed": true,
  "remark": "All measurements within tolerance",
  "judgeName": "QC Inspector"
}
```

#### 复核
```
POST /api/batches/review
Content-Type: application/json

{
  "batchNumber": "BATCH-001",
  "reviewResult": "confirm_pass",  // confirm_pass, confirm_fail, need_rework
  "remark": "Review passed",
  "reviewerName": "Senior QC"
}
```

#### 记录返工
```
POST /api/batches/rework
Content-Type: application/json

{
  "batchNumber": "BATCH-001",
  "reworkType": "color_adjustment",  // color_adjustment, reprint, material_replacement, other
  "reason": "Color deviation found",
  "solution": "Adjusted ink density",
  "reworkedQuantity": 500,
  "operator": "John Smith",
  "beforeLabValues": { "L": 90, "a": 2.0, "b": -3.0 },
  "afterLabValues": { "L": 95, "a": 0.5, "b": -1.0 }
}
```

#### 生成质检单
```
POST /api/batches/quality-order
Content-Type: application/json

{
  "batchNumber": "BATCH-001",
  "inspector": "Inspector A"
}
```

#### 标记完成
```
PATCH /api/batches/:batchNumber/complete
```

#### 查询单个批次
```
GET /api/batches/:batchNumber
```

#### 查询批次列表
```
GET /api/batches?status=passed&page=1&pageSize=20

查询参数:
- status: 状态筛选 (imported, pending_judgment, passed, failed, pending_review, reviewed, reworked, completed)
- isPassed: 是否合格 (true/false)
- hasRework: 是否返工 (true/false)
- startDate: 开始日期
- endDate: 结束日期
- productName: 产品名称模糊搜索
- page: 页码
- pageSize: 每页数量
```

#### 趋势分析
```
GET /api/batches/trend?groupBy=day&startDate=2024-01-01&endDate=2024-01-31

查询参数:
- groupBy: day / week / month
- startDate: 开始日期
- endDate: 结束日期
```

### 导出接口

#### 导出多批次 Excel
```
POST /api/batches/export
Content-Type: application/json

{
  "batchNumbers": ["BATCH-001", "BATCH-002"],
  "format": "excel"
}
```

#### 导出单批次明细 Excel
```
GET /api/batches/:batchNumber/export?format=excel
```

#### 导出质检单 PDF
```
GET /api/batches/:batchNumber/quality-order/pdf
```

### 审计日志接口

```
GET /api/audit-logs?page=1&pageSize=20

查询参数:
- action: 操作类型 (create, update, delete, import, judgment, review, rework, export, generate_order)
- entityType: 实体类型
- batchNumber: 批次号
- operator: 操作员
- startDate: 开始日期
- endDate: 结束日期
- page: 页码
- pageSize: 每页数量
```

*注意: 仅管理员可访问审计日志*

## 状态流转图

```
导入 (IMPORTED)
    ↓
待判定 (PENDING_JUDGMENT)
    ↓
  ┌─┴─┐
  ↓   ↓
通过  不合格 (FAILED)
(PASSED)  ↓
  ↓     待复核 (PENDING_REVIEW)
待复核     ↓
(PENDING_REVIEW) ───┬───┐
  ↓                ↓   ↓
已复核 (REVIEWED)  返工  合格/不合格
  ↓              (REWORKED) ↓
完成              ↓         ↓
(COMPLETED)    待判定 ────┘
```

## 项目结构

```
.
├── src/
│   ├── config/           # 配置文件
│   ├── controllers/      # API 控制器
│   ├── database/         # 数据库配置
│   ├── middleware/       # 中间件
│   ├── models/           # 数据模型 (TypeORM Entities)
│   ├── routes/           # 路由定义
│   ├── services/         # 业务逻辑服务
│   ├── types/            # TypeScript 类型定义
│   ├── utils/            # 工具函数
│   └── index.ts          # 应用入口
├── data/                 # SQLite 数据库文件目录
├── exports/              # 导出文件目录 (Excel/PDF)
├── logs/                 # 日志文件目录
├── .env                  # 环境变量
├── package.json
├── tsconfig.json
└── README.md
```

## 数据模型

### PrintBatch (印刷批次)
- 基础信息: 批次号、产品名、客户、数量、生产日期、机台号
- 状态信息: 状态、是否合格、是否返工、返工次数
- Lab 标准值: L/a/b、公差
- 关联: Lab 记录、返工记录、质检单、纸张批次

### LabRecord (Lab记录)
- 测量值: L/a/b
- 标准值: L/a/b
- Delta E: 自动计算
- 是否在公差内: 自动判定
- 测量点、测量顺序

### PaperBatch (纸张批次)
- 批次号、纸张类型、供应商、生产日期
- 关联印刷批次

### ReworkRecord (返工记录)
- 返工类型、原因、解决方案
- 返工次数、返工数量、报废数量
- 返工前后 Lab 值对比
- 操作员、开始/完成时间

### QualityOrder (质检单)
- 质检单号、状态、日期
- 抽样数量、合格/不合格数量
- 合格率、检验项目、缺陷描述、结论
- 检验员、批准人

### AuditLog (审计日志)
- 操作类型、实体类型、实体ID
- 变更前后数据、变更描述
- 操作员、角色、IP地址
- 请求ID、时间戳

## 幂等性保证

系统通过以下机制保证幂等性:

1. **导入 Key 生成**: 基于批次号、生产日期、Lab记录数量生成唯一标识
2. **重复检测**: 导入时先检查 importKey 是否已存在
3. **返回现有数据**: 重复导入时返回已存在的批次，不创建重复数据

## 敏感字段处理

系统在以下层级处理敏感字段:

1. **API 响应**: 非管理员用户看到的敏感字段已脱敏
2. **导出文件**: Excel/PDF 导出时根据用户角色决定是否脱敏
3. **日志文件**: 所有日志中的敏感字段自动脱敏

当前脱敏字段:
- customerName (客户名)
- operator (操作员)
- judgedBy (判定人)
- reviewedBy (复核人)
- approvedBy (批准人)
- inspector (检验员)

脱敏规则: 保留首字符和尾字符，中间用 * 替代
- 例: "Customer XYZ" → "C**********Z"

## 构建与部署

### 构建生产版本

```bash
npm run build
```

### 启动生产服务

```bash
npm start
```

### 环境变量配置

创建 `.env` 文件:

```env
PORT=3000
NODE_ENV=production
DB_PATH=./data/qc_system.db
LOG_LEVEL=info
ADMIN_API_KEY=your-secure-admin-key-here
```

## 开发说明

### 添加新的实体

1. 在 `src/models/` 创建 Entity 类，继承 BaseEntity
2. 在 Service 中添加业务逻辑
3. 在 Controller 中添加 API 端点
4. 在 `src/routes/` 中注册路由

### 扩展权限

在 `src/middleware/auth.ts` 中添加新的角色和权限检查中间件。

### 扩展导出功能

在 `src/services/ExportService.ts` 中添加新的导出格式或模板。

## 注意事项

1. 生产环境请务必修改默认的 `ADMIN_API_KEY`
2. 数据库文件位于 `data/` 目录，请定期备份
3. 日志文件位于 `logs/` 目录，建议配置日志轮转
4. 导出文件位于 `exports/` 目录，建议定期清理

## 许可证

MIT
