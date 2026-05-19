# 农机合作社财务管理系统

拖拉机作业计费管理系统，支持按时/亩/油费混合计费、数据导入、复核、账单生成和导出。

## 功能特性

- ✅ **混合计费模式**：支持按小时数、作业亩数、油耗联合计算费用
- ✅ **数据导入**：支持 CSV/Excel 文件批量导入作业记录
- ✅ **数据校验**：自动校验机手、拖拉机、作业类型、数值合法性
- ✅ **审核流程**：作业记录需审核通过后才能生成账单
- ✅ **账单管理**：自动生成账单，支持支付状态跟踪
- ✅ **数据导出**：支持 CSV/Excel 格式导出账单和汇总报表
- ✅ **敏感数据保护**：手机号、身份证、银行账号加密存储，导出时自动脱敏
- ✅ **操作日志**：完整记录所有操作，支持审计追溯
- ✅ **本地持久化**：SQLite 数据库，重启服务数据不丢失

## 计费规则

系统采用基础服务费 + 各项作业费用的混合计费模式：

| 费用类型 | 单价 | 说明 |
|---------|------|------|
| 小时费 | 80元/小时 | 按实际作业时长计算 |
| 亩计费 | 50元/亩 | 按实际作业面积计算 |
| 油费 | 7.5元/升 | 按实际油耗计算 |
| 基础服务费 | 20元/次 | 每次作业固定收取 |

**计算公式**：
总费用 = (小时数 × 80) + (亩数 × 50) + (油耗 × 7.5) + 20

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试（验证系统功能）

```bash
npm test
```

测试脚本会自动执行以下流程：
- 查询基础数据（机手、拖拉机）
- 测试计费计算
- 导入正常数据（5条）
- 导入异常数据（验证错误处理）
- 审核通过记录
- 驳回记录
- 查询账单和操作日志

### 3. 启动服务

```bash
npm start
```

服务启动后访问：http://localhost:3000

## 使用指南

### 一、准备导入数据

#### CSV 文件格式

```csv
机手姓名,拖拉机牌号,作业日期,作业类型,地块名称,小时数,亩数,油耗,备注
张三,皖01-12345,2024-05-01,耕地,东大地1号,4.5,20,15.2,正常作业
```

**字段说明**：
| 字段 | 必填 | 说明 |
|-----|------|------|
| 机手姓名 | ✅ | 必须是系统已登记的机手 |
| 拖拉机牌号 | ✅ | 必须是系统已登记的拖拉机 |
| 作业日期 | ✅ | 格式：YYYY-MM-DD |
| 作业类型 | ✅ | 耕地/播种/收割/运输/其他 |
| 地块名称 | - | 作业地块名称 |
| 小时数 | * | 作业时长（小时） |
| 亩数 | * | 作业面积（亩） |
| 油耗 | * | 耗油量（升） |
| 备注 | - | 其他说明 |

> * 小时数、亩数、油耗至少需要填写一项

#### 样例数据

系统提供了样例数据文件：
- `samples/valid_records.csv` - 正常数据（5条）
- `samples/invalid_records.csv` - 包含错误的数据（用于测试校验）

### 二、导入作业记录

#### API 方式

```bash
curl -X POST http://localhost:3000/api/import/upload \
  -F "file=@samples/valid_records.csv" \
  -H "X-Operator: 财务人员"
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "batchNo": "BATCH20240519-123456",
    "totalRecords": 5,
    "successRecords": 5,
    "failedRecords": 0,
    "results": [...]
  }
}
```

### 三、查看待审核记录

```bash
curl http://localhost:3000/api/review/pending
```

### 四、审核记录

#### 单条审核通过

```bash
curl -X POST http://localhost:3000/api/review/1 \
  -H "Content-Type: application/json" \
  -H "X-Operator: 审核员" \
  -d '{
    "reviewResult": "approved",
    "reviewComments": "数据无误，审核通过"
  }'
```

审核通过后，系统会自动生成账单。

#### 驳回记录

```bash
curl -X POST http://localhost:3000/api/review/2 \
  -H "Content-Type: application/json" \
  -H "X-Operator: 审核员" \
  -d '{
    "reviewResult": "rejected",
    "reviewComments": "数据异常，请重新核实后导入"
  }'
```

#### 批量审核

```bash
curl -X POST http://localhost:3000/api/review/batch \
  -H "Content-Type: application/json" \
  -H "X-Operator: 审核员" \
  -d '{
    "recordIds": [1, 2, 3],
    "reviewResult": "approved",
    "reviewComments": "批量审核通过"
  }'
```

### 五、查看账单

```bash
# 查看账单汇总
curl http://localhost:3000/api/billing/summary
```

### 六、更新支付状态

```bash
curl -X PUT http://localhost:3000/api/billing/1/payment \
  -H "Content-Type: application/json" \
  -H "X-Operator: 财务人员" \
  -d '{
    "status": "paid"
  }'
```

### 七、导出报表

#### 导出账单（Excel）

```bash
curl -O http://localhost:3000/api/billing/export/excel
```

#### 导出账单（CSV）

```bash
curl -O http://localhost:3000/api/billing/export/csv
```

#### 导出机手汇总报表

```bash
curl -O http://localhost:3000/api/billing/export/operator-summary
```

### 八、查看操作日志

```bash
curl http://localhost:3000/api/logs
```

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 系统信息 |
| POST | `/api/import/upload` | 上传导入文件 |
| GET | `/api/import/history` | 导入历史 |
| GET | `/api/import/batch/:batchNo` | 批次详情 |
| GET | `/api/review/pending` | 待审核记录 |
| POST | `/api/review/:id` | 审核单条记录 |
| POST | `/api/review/batch` | 批量审核 |
| GET | `/api/review/record/:workRecordId` | 记录审核历史 |
| GET | `/api/billing/summary` | 账单汇总 |
| PUT | `/api/billing/:id/payment` | 更新支付状态 |
| GET | `/api/billing/export/csv` | 导出CSV账单 |
| GET | `/api/billing/export/excel` | 导出Excel账单 |
| GET | `/api/billing/export/operator-summary` | 导出机手汇总 |
| GET | `/api/logs` | 操作日志 |

## 数据持久化

系统使用 SQLite 数据库，数据存储在 `data/database.sqlite` 文件中。

数据库包含以下表：
- `operators` - 机手信息（敏感字段加密存储）
- `tractors` - 拖拉机信息
- `work_records` - 作业记录
- `billing_records` - 账单记录
- `reviews` - 审核记录
- `import_batches` - 导入批次
- `operation_logs` - 操作日志

**重要**：备份 `data/` 目录即可备份所有数据。

## 安全特性

1. **敏感字段加密**：手机号、身份证号、银行账号在数据库中加密存储
2. **导出自动脱敏**：导出 CSV/Excel 时敏感字段自动脱敏处理
3. **API 响应脱敏**：所有 API 返回数据自动脱敏敏感字段
4. **操作日志**：所有操作都有完整记录，支持审计追踪
5. **日志脱敏**：系统日志自动脱敏敏感信息

## 目录结构

```
.
├── package.json          # 项目配置
├── README.md             # 本文档
├── src/
│   ├── index.js          # 服务入口
│   ├── config/           # 配置文件
│   ├── database/         # 数据库连接和初始化
│   ├── models/           # 数据模型
│   ├── services/         # 业务服务
│   │   ├── validationService.js   # 数据校验
│   │   ├── importService.js       # 导入服务
│   │   ├── billingService.js      # 计费服务
│   │   ├── reviewService.js       # 审核服务
│   │   └── exportService.js       # 导出服务
│   ├── routes/           # API 路由
│   └── utils/            # 工具函数
│       ├── security.js   # 安全/加密/脱敏
│       └── logger.js     # 日志工具
├── samples/              # 样例数据
│   ├── valid_records.csv
│   └── invalid_records.csv
├── tests/                # 测试脚本
├── data/                 # 数据库文件（自动创建）
├── logs/                 # 日志文件（自动创建）
├── uploads/              # 上传文件（自动创建）
└── exports/              # 导出文件（自动创建）
```

## 常见问题

### Q: 如何添加新机手或拖拉机？

目前需要直接操作数据库，后续会提供管理接口。可以使用 SQLite 工具打开 `data/database.sqlite` 文件进行操作。

### Q: 计费规则可以调整吗？

可以，修改 `src/config/index.js` 中的 `billing` 配置即可。

### Q: 数据导入失败怎么查看原因？

查看导入响应中的 `results` 字段，每条记录会显示具体的错误信息。也可以查看 `logs/` 目录下的日志文件。

### Q: 重启服务后数据会丢失吗？

不会，所有数据都持久化存储在 SQLite 数据库中。

### Q: 导出的报表中手机号是星号？

这是系统的安全机制，敏感字段在导出和 API 返回时都会自动脱敏，保护个人隐私。

## 技术栈

- Node.js + Express - 后端框架
- SQLite - 数据库
- Joi - 数据校验
- csv-parser + xlsx - 文件处理
- crypto-js - 加密
- winston - 日志
