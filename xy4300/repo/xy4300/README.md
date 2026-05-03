# 医用气瓶周转防错台

医院中心供氧站本地纯后端 API 服务，用于管理医用气瓶的周转流程，防止过期未检气瓶被借出、氧气/笑气瓶混放、同一瓶号重复流转或空瓶没追回。

## 功能特性

- **数据导入**：支持 CSV/JSON 格式导入气瓶台账、充装检测记录、科室领用/归还表、运输交接单
- **库存管理**：实时查询库存状态、位置信息、统计数据
- **状态流转**：支持借出、归还、报废等状态变更，内置状态机验证
- **风险检测**：自动检测过期未检、气体混放、重复流转、空瓶未追回等风险
- **人工复核**：风险告警支持人工复核和处理
- **审计导出**：支持 Markdown、CSV、JSON 格式的审计日志和库存导出

## 项目结构

```
xy4300/
├── src/
│   ├── index.js              # 入口文件
│   ├── routes/
│   │   └── index.js          # API 路由层
│   ├── parsers/
│   │   └── index.js          # 解析校验层（CSV/JSON解析、数据验证）
│   ├── rules/
│   │   └── index.js          # 规则引擎（风险检测）
│   ├── state-machine/
│   │   └── index.js          # 状态机（状态流转）
│   ├── storage/
│   │   └── index.js          # 存储层（SQLite操作）
│   └── exporters/
│       └── index.js          # 导出层（Markdown/CSV/JSON）
├── data/
│   ├── sample-cylinders.csv      # 示例气瓶台账
│   └── sample-inspections.json   # 示例检测记录
├── test/
│   └── index.test.js         # 测试用例
├── package.json
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 运行测试

```bash
npm test
```

## API 接口

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 数据导入

#### 导入气瓶台账 (CSV)

```bash
curl -X POST -F "file=@data/sample-cylinders.csv" http://localhost:3000/api/import/cylinder-ledger
```

**CSV 格式要求：**

| 字段名 | 说明 | 必填 |
|--------|------|------|
| 气瓶编号 | 气瓶唯一编号 | 是 |
| 气体类型 | 氧气/笑气/氮气/二氧化碳/其他 | 是 |
| 容量 | 气瓶容量（升） | 否 |
| 制造商 | 生产厂家 | 否 |
| 制造日期 | YYYY-MM-DD | 否 |
| 上次检验日期 | YYYY-MM-DD | 否 |
| 下次检验日期 | YYYY-MM-DD | 否 |
| 状态 | in_stock/borrowed/inspecting/scrapped | 否 |
| 位置 | 存放位置 | 否 |

#### 导入充装检测记录 (JSON)

```bash
curl -X POST -F "file=@data/sample-inspections.json" http://localhost:3000/api/import/inspection-records
```

**JSON 格式要求：**

```json
[
  {
    "serialNumber": "OXY-001",
    "inspectionDate": "2025-01-10",
    "inspector": "张检验员",
    "result": "合格",
    "notes": "外观检查良好",
    "nextInspectionDate": "2026-01-10"
  }
]
```

#### 导入领用/归还记录 (CSV/JSON)

```bash
curl -X POST -F "file=@data/transactions.csv" http://localhost:3000/api/import/transaction-records
```

#### 导入运输交接单 (CSV/JSON)

```bash
curl -X POST -F "file=@data/transfers.csv" http://localhost:3000/api/import/transfer-records
```

### 库存查询

#### 查询库存列表

```bash
# 获取所有库存
curl http://localhost:3000/api/inventory

# 按状态筛选
curl "http://localhost:3000/api/inventory?status=in_stock"

# 按气体类型筛选
curl "http://localhost:3000/api/inventory?gasType=氧气"

# 按位置筛选
curl "http://localhost:3000/api/inventory?location=中心供氧站A区"

# 按编号模糊搜索
curl "http://localhost:3000/api/inventory?serialNumber=OXY"
```

#### 获取库存统计

```bash
curl http://localhost:3000/api/inventory/stats
```

#### 查询单个气瓶详情

```bash
curl http://localhost:3000/api/cylinders/OXY-001
```

### 状态流转

#### 借出气瓶

```bash
curl -X POST http://localhost:3000/api/transactions/borrow \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "OXY-001",
    "department": "外科",
    "person": "张医生",
    "notes": "手术用氧"
  }'
```

**注意**：借出前会自动进行风险检测，如果存在风险（如过期未检），将拒绝借出。

#### 归还气瓶

```bash
curl -X POST http://localhost:3000/api/transactions/return \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "OXY-001",
    "department": "外科",
    "person": "张医生",
    "notes": "使用完毕，压力正常"
  }'
```

#### 报废气瓶

```bash
curl -X POST http://localhost:3000/api/transactions/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "OXY-004",
    "notes": "瓶体腐蚀严重，申请报废"
  }'
```

### 风险检测

#### 执行全量风险扫描

```bash
curl http://localhost:3000/api/risk-check
```

**风险类型：**

| 类型 | 说明 | 等级 |
|------|------|------|
| expired_inspection | 过期未检 | critical/high |
| gas_mixup | 氧气/笑气混放 | critical |
| duplicate_flow | 重复流转 | critical/high |
| missing_empty_cylinder | 空瓶未追回 | high |

#### 查询风险告警

```bash
# 获取所有告警
curl http://localhost:3000/api/risk-alerts

# 按状态筛选
curl "http://localhost:3000/api/risk-alerts?status=open"

# 按风险类型筛选
curl "http://localhost:3000/api/risk-alerts?riskType=expired_inspection"
```

#### 人工复核风险告警

```bash
curl -X POST http://localhost:3000/api/risk-alerts/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "action": "resolve",
    "notes": "已安排重新检验",
    "reviewedBy": "李管理员"
  }'
```

**action 可选值：**
- `resolve` - 已解决
- `dismiss` - 忽略
- `review` - 已复核

### 数据导出

#### 审计日志导出

```bash
# Markdown 格式
curl -O audit-log.md "http://localhost:3000/api/export/audit/markdown"

# CSV 格式
curl -O audit-log.csv "http://localhost:3000/api/export/audit/csv"

# JSON 格式
curl -O audit-log.json "http://localhost:3000/api/export/audit/json"

# 按时间范围筛选
curl "http://localhost:3000/api/export/audit/json?startDate=2025-01-01&endDate=2025-12-31"

# 按操作类型筛选
curl "http://localhost:3000/api/export/audit/json?operation=BORROW"
```

#### 库存导出

```bash
# Markdown 格式
curl -O inventory.md "http://localhost:3000/api/export/inventory/markdown"

# CSV 格式
curl -O inventory.csv "http://localhost:3000/api/export/inventory/csv"

# JSON 格式
curl -O inventory.json "http://localhost:3000/api/export/inventory/json"

# 按状态筛选
curl "http://localhost:3000/api/export/inventory/json?status=in_stock"

# 按气体类型筛选
curl "http://localhost:3000/api/export/inventory/json?gasType=氧气"
```

## 状态机规则

### 状态定义

| 状态 | 说明 |
|------|------|
| in_stock | 在库 |
| borrowed | 借出 |
| inspecting | 检验中 |
| scrapped | 已报废 |

### 状态流转规则

```
in_stock → borrowed  (借出)
in_stock → scrapped  (报废)
in_stock → inspecting (送检)

borrowed → in_stock  (归还)
borrowed → scrapped  (报废)

inspecting → in_stock  (检验完成)
inspecting → scrapped  (检验不合格报废)

scrapped → 无流出状态 (已报废不可流转)
```

## 数据库表结构

### cylinders (气瓶表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| serial_number | TEXT | 气瓶编号（唯一） |
| gas_type | TEXT | 气体类型 |
| capacity | REAL | 容量 |
| manufacturer | TEXT | 制造商 |
| manufacture_date | TEXT | 制造日期 |
| last_inspection_date | TEXT | 上次检验日期 |
| next_inspection_date | TEXT | 下次检验日期 |
| status | TEXT | 状态 |
| location | TEXT | 位置 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### inspections (检验记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| cylinder_id | INTEGER | 气瓶ID |
| inspection_date | TEXT | 检验日期 |
| inspector | TEXT | 检验人 |
| result | TEXT | 检验结果 |
| notes | TEXT | 备注 |
| next_inspection_date | TEXT | 下次检验日期 |
| created_at | TEXT | 创建时间 |

### transactions (交易记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| cylinder_id | INTEGER | 气瓶ID |
| type | TEXT | 类型 (borrow/return/scrap) |
| department | TEXT | 科室 |
| person | TEXT | 经办人 |
| quantity | INTEGER | 数量 |
| notes | TEXT | 备注 |
| created_at | TEXT | 创建时间 |

### risk_alerts (风险告警表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| cylinder_id | INTEGER | 气瓶ID |
| risk_type | TEXT | 风险类型 |
| risk_level | TEXT | 风险等级 |
| description | TEXT | 描述 |
| status | TEXT | 状态 (open/reviewed/resolved/dismissed) |
| reviewed_by | TEXT | 复核人 |
| reviewed_at | TEXT | 复核时间 |
| notes | TEXT | 备注 |
| created_at | TEXT | 创建时间 |

### audit_logs (审计日志表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| operation | TEXT | 操作类型 |
| table_name | TEXT | 操作表名 |
| record_id | INTEGER | 记录ID |
| old_values | TEXT | 旧值 (JSON) |
| new_values | TEXT | 新值 (JSON) |
| user | TEXT | 操作用户 |
| ip_address | TEXT | IP地址 |
| created_at | TEXT | 创建时间 |

## 完整验证流程示例

```bash
# 1. 启动服务
npm start &

# 2. 健康检查
curl http://localhost:3000/api/health

# 3. 导入气瓶台账
curl -X POST -F "file=@data/sample-cylinders.csv" http://localhost:3000/api/import/cylinder-ledger

# 4. 导入检测记录
curl -X POST -F "file=@data/sample-inspections.json" http://localhost:3000/api/import/inspection-records

# 5. 查询库存统计
curl http://localhost:3000/api/inventory/stats

# 6. 执行风险扫描（应该能检测到 OXY-004 过期）
curl http://localhost:3000/api/risk-check

# 7. 尝试借出过期气瓶（应该被拒绝）
curl -X POST http://localhost:3000/api/transactions/borrow \
  -H "Content-Type: application/json" \
  -d '{"serialNumber": "OXY-004", "department": "内科", "person": "王医生"}'

# 8. 借出正常气瓶
curl -X POST http://localhost:3000/api/transactions/borrow \
  -H "Content-Type: application/json" \
  -d '{"serialNumber": "OXY-001", "department": "外科", "person": "张医生", "notes": "手术用氧"}'

# 9. 查询气瓶状态
curl http://localhost:3000/api/cylinders/OXY-001

# 10. 归还气瓶
curl -X POST http://localhost:3000/api/transactions/return \
  -H "Content-Type: application/json" \
  -d '{"serialNumber": "OXY-001", "department": "外科", "person": "张医生"}'

# 11. 导出审计日志
curl -O audit.json "http://localhost:3000/api/export/audit/json"

# 12. 导出库存报表
curl -O inventory.md "http://localhost:3000/api/export/inventory/markdown"
```

## 许可证

MIT
