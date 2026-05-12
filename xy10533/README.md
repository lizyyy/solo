# 餐饮预制菜追溯 API

一个完整的餐饮预制菜追溯系统 API，用于追踪预制菜从中央厨房到门店销售的完整流程。

## 功能特点

- **批次追踪**: 完整追踪预制菜批次从生产到销售的全流程
- **冷链监控**: 记录和监控冷链运输温度，异常自动报警
- **库存管理**: 实时追踪门店库存（冷冻/解冻/已售/报损）
- **召回管理**: 支持批次召回，追踪召回覆盖率
- **状态历史**: 所有状态变更都有完整的历史记录
- **幂等性保障**: 重复操作不会产生重复数据
- **规则验证**: 过期批次禁止出库/销售、召回批次禁止销售、禁止重复接收等
- **报告导出**: 生成批次流向报告、库存报告、召回报告

## 技术栈

- **Node.js** + **Express**: 后端服务框架
- **SQLite**: 轻量级数据库（数据文件: `data/traceability.db`）
- **UUID**: 生成唯一ID
- **Moment.js**: 日期时间处理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 3. 健康检查

访问 `http://localhost:3000` 确认服务正常运行

## 业务流程

### 完整流程图

```
创建批次 → 出库 → 冷链运输 → 门店接收 → 解冻 → 销售 → (可能的召回/报损)
   ↓          ↓           ↓            ↓         ↓        ↓
 CREATED → OUTBOUND → IN_TRANSIT → RECEIVED → THAWING → THAWED → PARTIAL_SOLD → SOLD
                                                            ↓
                                                      (异常时)
                                                            ↓
                                                        ABNORMAL
                                                            ↓
                                                        (报损)
                                                            ↓
                                                        DAMAGED
```

### 批次状态说明

| 状态 | 说明 |
|------|------|
| CREATED | 批次已创建，待出库 |
| OUTBOUND | 已从中央厨房出库 |
| IN_TRANSIT | 冷链运输中 |
| RECEIVED | 门店已接收 |
| THAWING | 解冻中 |
| THAWED | 解冻完成 |
| PARTIAL_SOLD | 部分销售 |
| SOLD | 全部销售完成 |
| RECALLED | 已召回 |
| DAMAGED | 已报损 |
| EXPIRED | 已过期 |
| ABNORMAL | 异常（如冷链温度异常） |

## API 接口

### 基础路径

所有 API 接口路径前缀: `http://localhost:3000/api`

### 请求头

- `Content-Type: application/json`
- `x-operator`: 操作者标识（可选，默认为 'system'）

### 1. 门店管理

#### 创建门店
```bash
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -H "x-operator: admin" \
  -d '{
    "store_name": "北京朝阳店",
    "store_code": "STORE_BJ001",
    "city": "北京",
    "address": "北京市朝阳区建国路88号"
  }'
```

#### 获取所有门店
```bash
curl http://localhost:3000/api/stores
```

### 2. 批次管理

#### 创建批次
```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -H "x-operator: kitchen_manager" \
  -d '{
    "product_name": "宫保鸡丁预制菜",
    "product_code": "PROD_GBC001",
    "production_date": "2026-05-10",
    "expiry_date": "2026-08-10",
    "quantity": 100,
    "unit": "箱"
  }'
```

#### 获取批次列表
```bash
# 所有批次
curl http://localhost:3000/api/batches

# 按状态筛选
curl "http://localhost:3000/api/batches?status=RECEIVED"

# 按产品代码筛选
curl "http://localhost:3000/api/batches?product_code=PROD_GBC001"
```

#### 获取批次详情（含完整历史）
```bash
curl http://localhost:3000/api/batches/{batch_id}
```

### 3. 业务流程

#### 出库
```bash
curl -X POST http://localhost:3000/api/outbound \
  -H "Content-Type: application/json" \
  -H "x-operator: warehouse_manager" \
  -d '{
    "batch_id": "{batch_id}",
    "quantity": 50,
    "outbound_time": "2026-05-12 08:00:00"
  }'
```

#### 开始冷链运输
```bash
curl -X POST http://localhost:3000/api/cold-chain/start \
  -H "Content-Type: application/json" \
  -H "x-operator: logistics_manager" \
  -d '{
    "batch_id": "{batch_id}",
    "store_id": "{store_id}",
    "outbound_record_id": "{outbound_id}",
    "transport_start_time": "2026-05-12 09:00:00"
  }'
```

#### 完成冷链运输
```bash
# 正常温度 (-18°C ~ -5°C)
curl -X POST http://localhost:3000/api/cold-chain/{cold_chain_id}/complete \
  -H "Content-Type: application/json" \
  -H "x-operator: logistics_manager" \
  -d '{
    "transport_end_time": "2026-05-12 11:30:00",
    "temperature_log": [
      {"time": "2026-05-12 09:00:00", "temperature": -18},
      {"time": "2026-05-12 10:00:00", "temperature": -17},
      {"time": "2026-05-12 11:30:00", "temperature": -15}
    ]
  }'

# 异常温度（会自动标记为异常）
curl -X POST http://localhost:3000/api/cold-chain/{cold_chain_id}/complete \
  -H "Content-Type: application/json" \
  -H "x-operator: logistics_manager" \
  -d '{
    "transport_end_time": "2026-05-12 11:30:00",
    "temperature_log": [
      {"time": "2026-05-12 09:00:00", "temperature": -18},
      {"time": "2026-05-12 10:00:00", "temperature": 0},
      {"time": "2026-05-12 11:30:00", "temperature": 2}
    ]
  }'
```

#### 门店接收
```bash
curl -X POST http://localhost:3000/api/receive \
  -H "Content-Type: application/json" \
  -H "x-operator: store_manager" \
  -d '{
    "cold_chain_record_id": "{cold_chain_id}",
    "receive_time": "2026-05-12 12:00:00",
    "remarks": "货物完好，数量无误"
  }'
```

#### 开始解冻
```bash
curl -X POST http://localhost:3000/api/thaw/start \
  -H "Content-Type: application/json" \
  -H "x-operator: chef" \
  -d '{
    "batch_id": "{batch_id}",
    "store_id": "{store_id}",
    "quantity": 10,
    "thaw_start_time": "2026-05-12 14:00:00",
    "expected_thaw_time": "2026-05-12 20:00:00"
  }'
```

#### 完成解冻
```bash
curl -X POST http://localhost:3000/api/thaw/{thaw_id}/complete \
  -H "Content-Type: application/json" \
  -H "x-operator: chef" \
  -d '{
    "thaw_end_time": "2026-05-12 19:30:00"
  }'
```

#### 销售
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "x-operator: cashier" \
  -d '{
    "batch_id": "{batch_id}",
    "store_id": "{store_id}",
    "quantity": 5,
    "sale_time": "2026-05-12 21:00:00"
  }'
```

#### 召回
```bash
curl -X POST http://localhost:3000/api/recalls \
  -H "Content-Type: application/json" \
  -H "x-operator: quality_manager" \
  -d '{
    "batch_id": "{batch_id}",
    "recall_reason": "该批次调料包检测出微生物超标",
    "recall_time": "2026-05-12 20:00:00"
  }'
```

#### 报损
```bash
curl -X POST http://localhost:3000/api/damages \
  -H "Content-Type: application/json" \
  -H "x-operator: store_manager" \
  -d '{
    "batch_id": "{batch_id}",
    "store_id": "{store_id}",
    "quantity": 10,
    "damage_type": "frozen",
    "damage_reason": "冷链温度异常，存在食品安全风险",
    "damage_time": "2026-05-12 14:00:00"
  }'
```

### 4. 查询接口

#### 查询门店库存
```bash
# 所有门店库存
curl http://localhost:3000/api/inventory

# 指定门店库存
curl "http://localhost:3000/api/inventory?store_id={store_id}"
```

### 5. 人工修正

#### 修正库存（必须留痕）
```bash
curl -X POST http://localhost:3000/api/manual-correction \
  -H "Content-Type: application/json" \
  -H "x-operator: inventory_auditor" \
  -d '{
    "entity_type": "STORE_INVENTORY",
    "entity_id": "{inventory_id}",
    "corrections": {
      "frozen_quantity": 18
    },
    "reason": "盘点发现差异，系统记录20箱，实际只有18箱"
  }'
```

### 6. 报告导出

#### 批次流向报告
```bash
curl http://localhost:3000/api/reports/batch-flow/{batch_id}
```

#### 门店库存报告
```bash
# 所有门店
curl http://localhost:3000/api/reports/inventory

# 指定门店
curl "http://localhost:3000/api/reports/inventory?store_id={store_id}"
```

#### 召回报告
```bash
curl http://localhost:3000/api/reports/recall/{batch_id}
```

## 演示脚本

项目提供了 4 个完整的演示脚本，覆盖各种业务场景：

### 前置条件

确保 API 服务已启动：
```bash
npm start
```

在另一个终端运行演示脚本。

### 演示 1: 正常到店销售流程

场景：宫保鸡丁预制菜从中央厨房到门店销售的完整流程

```bash
npm run demo-normal
```

**流程步骤：**
1. 创建门店和批次
2. 中央厨房出库
3. 冷链运输（正常温度）
4. 门店接收
5. 开始解冻
6. 完成解冻（正常时间内）
7. 销售
8. 生成批次流向报告

**状态变化：**
`CREATED → OUTBOUND → IN_TRANSIT → RECEIVED → THAWING → THAWED → PARTIAL_SOLD`

### 演示 2: 冷链异常复核流程

场景：麻婆豆腐预制菜冷链运输温度异常，质量部门复核后报损

```bash
npm run demo-abnormal
```

**流程步骤：**
1. 创建门店和批次
2. 出库
3. 冷链运输（模拟制冷故障，最高温度 2°C）
4. 系统自动标记为异常
5. 质量部门复核
6. 门店接收（隔离等待质检）
7. 质量部门决定报损
8. 生成报告

**验证内容：**
- 冷链温度异常自动检测
- 异常原因记录
- 状态历史追踪
- 报损流程

### 演示 3: 召回冻结流程

场景：红烧肉预制菜发现质量问题，启动召回，验证召回后禁止销售

```bash
npm run demo-recall
```

**流程步骤：**
1. 创建门店和批次
2. 正常流程到部分销售（已售15箱，门店剩余25箱）
3. 发现质量问题，启动召回
4. 验证：尝试销售召回批次被拒绝
5. 生成召回报告（分析召回覆盖率）
6. 查看完整历史记录

**验证内容：**
- 召回后批次状态变为 `RECALLED`
- 召回批次禁止销售
- 召回报告统计：已售数量、门店剩余、召回覆盖率
- 完整的状态变更历史

### 演示 4: 重复操作验证（幂等性）

场景：验证系统幂等性和防止重复接收的规则

```bash
npm run demo-duplicate
```

**验证内容：**
1. **出库幂等性**：相同参数重复出库不重复创建
2. **批次创建幂等性**：相同产品代码和生产日期不重复创建
3. **禁止重复接收**：同一冷链记录只能接收一次
4. **召回幂等性**：重复召回返回第一次结果
5. **人工修正留痕**：保存前后差异、操作者和原因

## 业务规则说明

### 1. 批次过期规则
- 创建批次时自动检查是否过期
- 过期批次禁止出库
- 过期批次禁止销售
- 过期批次禁止解冻

### 2. 冷链异常规则
- 安全温度范围：-18°C ~ -5°C
- 温度过高（> -5°C）自动标记为异常
- 温度过低（< -25°C）自动标记为异常
- 异常原因自动记录

### 3. 召回规则
- 召回后批次状态变为 `RECALLED`
- 召回批次禁止销售
- 召回批次禁止出库
- 召回批次禁止解冻
- 召回批次禁止接收

### 4. 重复接收规则
- 同一冷链运输记录只能接收一次
- 系统自动检查是否已接收
- 已接收的冷链记录再次接收会报错

### 5. 解冻规则
- 冷冻库存不足时不能解冻
- 解冻时间超过 24 小时标记为超时
- 同一批次同一门店不能同时有多个未完成的解冻

### 6. 销售规则
- 解冻库存不足时不能销售
- 召回批次不能销售
- 过期批次不能销售

### 7. 幂等性规则
以下操作支持幂等（重复执行返回相同结果）：
- 创建批次（key: product_code + production_date）
- 出库（key: batch_id + outbound_time）
- 开始冷链（key: batch_id + store_id + outbound_record_id）
- 完成冷链（key: cold_chain_id）
- 接收（key: cold_chain_record_id）
- 开始解冻（key: batch_id + store_id + thaw_start_time）
- 完成解冻（key: thaw_id）
- 销售（key: batch_id + store_id + sale_time + quantity）
- 召回（key: batch_id）
- 报损（key: batch_id + store_id + damage_time + quantity）

### 8. 人工修正规则
- 人工修正必须指定操作者
- 人工修正必须说明原因
- 系统自动记录修正前后的数据差异
- 修正记录不可删除

## 数据模型

### 核心表结构

| 表名 | 说明 |
|------|------|
| batches | 预制菜批次 |
| stores | 门店 |
| outbound_records | 出库记录 |
| cold_chain_records | 冷链运输记录 |
| receive_records | 接收记录 |
| store_inventory | 门店库存 |
| thaw_records | 解冻记录 |
| sales_records | 销售记录 |
| recall_records | 召回记录 |
| damage_records | 报损记录 |
| status_history | 状态历史（所有变更记录） |
| idempotency_records | 幂等记录 |

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── database.js            # 数据库初始化和连接
│   ├── routes.js              # API 路由
│   ├── utils.js               # 工具函数
│   └── services/
│       ├── traceabilityService.js   # 核心业务逻辑
│       └── reportService.js         # 报告服务
├── scripts/
│   ├── demoHelper.js          # 演示工具
│   ├── seedData.js            # 初始化基础数据
│   ├── demoNormal.js          # 演示1: 正常流程
│   ├── demoAbnormal.js        # 演示2: 异常流程
│   ├── demoRecall.js          # 演示3: 召回流程
│   └── demoDuplicate.js       # 演示4: 重复操作验证
├── data/                      # 数据库文件目录（自动创建）
├── package.json
└── README.md
```

## 常用命令

```bash
# 启动服务
npm start

# 初始化基础数据（门店和批次）
npm run seed

# 运行演示脚本
npm run demo-normal    # 正常流程
npm run demo-abnormal  # 异常流程
npm run demo-recall    # 召回流程
npm run demo-duplicate # 重复操作验证

# 清理数据库（重新开始）
npm run clean
```

## 故障排查

### 服务无法启动
- 检查端口 3000 是否被占用
- 检查是否安装了依赖: `npm install`
- 检查 data 目录是否有写入权限

### 数据库文件损坏
- 删除 `data/traceability.db` 文件
- 重启服务会自动创建新数据库

### 演示脚本运行失败
- 确保 API 服务已在运行
- 检查服务地址是否正确（默认 localhost:3000）
- 查看错误信息，可能是数据已存在（幂等性保护）

## 扩展建议

- 添加用户认证和权限管理
- 添加消息通知（召回时通知门店）
- 添加实时监控仪表板
- 集成扫码枪支持
- 添加文件导出（Excel/PDF）
- 添加更多统计分析

## 许可证

MIT License
