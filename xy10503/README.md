# 仓配波次缺货拆单 API

仓库夜班拣货时发现某些 SKU 缺货，只能在群里问要不要拆单或换仓。这个 API 可以直接给同事试用，围绕仓库波次拣货时部分 SKU 缺货后的拆单、保留、换仓并回写履约状态展开。

## 功能特性

- 波次管理：创建波次、添加订单、开始拣货、完成波次
- 缺货处理：缺货登记、拆单、换仓建议、执行换仓、保留
- 状态追踪：每个实体的状态变化历史记录
- 幂等性：支持 X-Idempotent-Key 请求头避免重复操作
- 人工修正：记录前后差异、原因和操作者
- 报告导出：波次报告、缺货报告、订单层级报告、库存变化报告

## 内置样例覆盖

| 场景 | 订单 | 说明 |
|------|------|------|
| 完整拣货 | SO20250512004 | 库存充足，正常拣货完成 |
| 部分缺货拆单 | SO20250512001 | iPhone 缺货 1 个，拆出子单 |
| 换仓成功 | SO20250512002 | iPad 上海仓无货，从北京仓调货 |
| 换仓失败保留 | SO20250512003 | iPad 缺货，换仓过程中库存被抢，选择保留 |

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm

### 安装依赖

```bash
npm install
```

### 初始化数据

```bash
npm run seed
```

这将创建：
- 3 个仓库（上海仓 WH-SH、北京仓 WH-BJ、广州仓 WH-GZ）
- 5 个 SKU
- 初始库存分布
- 4 个测试订单

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 健康检查

```bash
curl http://localhost:3000/health
```

## API 端点

### 订单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/orders | 创建订单 |
| GET | /api/orders | 订单列表 |
| GET | /api/orders/no/:orderNo | 按订单号查询 |
| GET | /api/orders/:orderId | 按 ID 查询 |
| PUT | /api/orders/:orderId/status | 更新订单状态 |
| POST | /api/orders/:orderId/correct | 人工修正订单状态 |
| GET | /api/orders/:orderId/hierarchy | 订单层级关系（父子订单） |

### 波次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/waves | 创建波次 |
| GET | /api/waves | 波次列表 |
| GET | /api/waves/no/:waveNo | 按波次号查询 |
| GET | /api/waves/:waveId | 按 ID 查询 |
| POST | /api/waves/:waveId/orders | 添加订单到波次 |
| POST | /api/waves/:waveId/start-picking | 开始拣货 |
| POST | /api/waves/:waveId/report-picked | 报告拣货结果 |
| POST | /api/waves/stockouts | 登记缺货 |
| GET | /api/waves/stockouts/:stockoutId | 查询缺货详情 |
| POST | /api/waves/stockouts/:stockoutId/suggest-transfer | 生成换仓建议 |
| POST | /api/waves/stockouts/:stockoutId/split | 拆单 |
| POST | /api/waves/stockouts/:stockoutId/execute-transfer | 执行换仓 |
| POST | /api/waves/stockouts/:stockoutId/retain | 保留缺货 |
| POST | /api/waves/:waveId/complete | 完成波次 |
| GET | /api/waves/:waveId/report | 波次报告 |
| GET | /api/waves/:waveId/inventory-report | 库存变化报告 |

### 库存查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/inventory | 所有仓库库存 |
| GET | /api/inventory/warehouse/:warehouseCode | 指定仓库库存 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/wave/:waveId | 波次报告 |
| GET | /api/reports/stockouts | 缺货报告 |
| GET | /api/reports/order-hierarchy/:orderId | 订单层级报告 |
| GET | /api/reports/inventory-change/:waveId | 库存变化报告 |

## 请求头

- `X-Operator`: 操作者标识（默认: system）
- `X-Idempotent-Key`: 幂等性键（用于创建波次、创建订单等操作）

## 主要演示路径

### 场景 1: 完整拣货流程（无缺货）

订单 SO20250512004（赵六）- 商品：AirPods Pro 2 x3, Apple Watch x2

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="zhangsan@warehouse"

# 创建波次
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "warehouse_code": "WH-SH",
    "wave_no": "WAVE-001"
  }')
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 添加订单到波次
curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"order_nos": ["SO20250512004"]}'

# 开始拣货
curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/start-picking" \
  -H "X-Operator: $OPERATOR"

# 查询订单行 ID
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512004")
LINE_IDS=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; print(' '.join([l['id'] for l in lines]))")

# 报告拣货完成
curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{\"picked_results\": [
    $(echo "$LINE_IDS" | tr ' ' '\n' | while read lid; do
      echo "{\"order_line_id\": \"$lid\", \"picked_qty\": $(curl -s \"$BASE_URL/api/orders/no/SO20250512004\" | python3 -c \"import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['qty']) for l in lines if l['id']=='$lid']\" 2>/dev/null)}"
    done | paste -sd ',' -)
  ]}"

# 查看波次报告
curl -s "$BASE_URL/api/waves/$WAVE_ID/report"
```

**状态变化**：
- 波次：created → assigned → picking → partial_picked
- 订单：pending → wave_assigned → picking
- 订单行：pending → picking → picked

### 场景 2: 部分缺货拆单流程

订单 SO20250512001（张三）- 商品：iPhone 15 Pro x2, AirPods Pro x1

上海仓 iPhone 库存 50，但只拣到 1 个（缺货 1 个），AirPods 充足。

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="lisi@warehouse"

# 创建波次
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"warehouse_code": "WH-SH", "wave_no": "WAVE-002"}')
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 添加订单
curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"order_nos": ["SO20250512001"]}'

# 开始拣货
curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/start-picking" \
  -H "X-Operator: $OPERATOR"

# 获取订单行 ID
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512001")
IPHONE_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-001']")
AIRPODS_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-002']")

# 报告拣货：iPhone 只拣到 1 个，缺货 1 个
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      {\"order_line_id\": \"$IPHONE_LINE_ID\", \"picked_qty\": 1, \"reason\": \"库存不足，只找到1台\"},
      {\"order_line_id\": \"$AIRPODS_LINE_ID\", \"picked_qty\": 1}
    ]
  }")
STOCKOUT_ID=$(echo "$REPORT_PICK" | python3 -c "import sys,json; sos=json.load(sys.stdin)['data']['stockouts']; [print(s['id']) for s in sos]")

# 查看缺货详情
curl -s "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID"

# 拆单处理
curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/split" \
  -H "X-Operator: $OPERATOR"

# 查看订单层级关系（父订单 + 子订单）
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512001")
ORDER_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
curl -s "$BASE_URL/api/orders/$ORDER_ID/hierarchy"
```

**状态变化**：
- 波次：created → assigned → picking → has_stockout
- 缺货：pending → split
- 原订单：pending → wave_assigned → picking → partial_picked
- 子订单（SO20250512001-S1）：split

### 场景 3: 换仓成功流程

订单 SO20250512002（李四）- 商品：MacBook Air x1, iPad Air x1

上海仓 iPad 库存 0，北京仓 iPad 库存 50。

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="wangwu@warehouse"

# 创建波次
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"warehouse_code": "WH-SH", "wave_no": "WAVE-003"}')
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 添加订单、开始拣货...
# （步骤同上）

# 获取订单行 ID
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512002")
MAC_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-003']")
IPAD_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-004']")

# 报告拣货：MacBook 有货，iPad 缺货
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      {\"order_line_id\": \"$MAC_LINE_ID\", \"picked_qty\": 1},
      {\"order_line_id\": \"$IPAD_LINE_ID\", \"picked_qty\": 0, \"reason\": \"iPad Air 5 上海仓无货\"}
    ]
  }")
STOCKOUT_ID=$(echo "$REPORT_PICK" | python3 -c "import sys,json; sos=json.load(sys.stdin)['data']['stockouts']; [print(s['id']) for s in sos]")

# 生成换仓建议
curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/suggest-transfer" \
  -H "X-Operator: $OPERATOR"

# 执行换仓
curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/execute-transfer" \
  -H "X-Operator: $OPERATOR"
```

**状态变化**：
- 波次：created → assigned → picking → has_stockout
- 缺货：pending → transfer_success
- 订单：pending → wave_assigned → picking
- 换仓建议：pending → success

### 场景 4: 换仓失败后保留流程

订单 SO20250512003（王五）- 商品：iPhone x1, iPad x2, Watch x1

上海仓 iPad 库存 0，换仓过程中北京仓库存被其他订单抢走。

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="zhaoliu@warehouse"

# 创建波次、添加订单、开始拣货...

# 报告拣货结果（iPad 缺货 2 个）
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      {\"order_line_id\": \"$IPHONE_LINE_ID\", \"picked_qty\": 1},
      {\"order_line_id\": \"$IPAD_LINE_ID\", \"picked_qty\": 0, \"reason\": \"iPad Air 5 上海仓无货，需要2个\"},
      {\"order_line_id\": \"$WATCH_LINE_ID\", \"picked_qty\": 1}
    ]
  }")
STOCKOUT_ID=$(echo "$REPORT_PICK" | python3 -c "import sys,json; sos=json.load(sys.stdin)['data']['stockouts']; [print(s['id']) for s in sos]")

# 生成换仓建议
curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/suggest-transfer" \
  -H "X-Operator: $OPERATOR"

# （假设换仓时源仓库库存不足，执行换仓会失败）
# 执行换仓
TRANSFER_RESULT=$(curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/execute-transfer" \
  -H "X-Operator: $OPERATOR")

# 查看失败原因
echo "$TRANSFER_RESULT"

# 选择保留，等待补货
curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/retain" \
  -H "X-Operator: $OPERATOR"
```

**状态变化**：
- 缺货：pending → transfer_failed → retained
- 订单：pending → wave_assigned → picking → delayed
- 订单行：picked（有货商品）、retained（缺货商品）

## 失败路径演示

### 幂等性测试

```bash
# 第一次调用
curl -s -X POST "http://localhost:3000/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: tester" \
  -H "X-Idempotent-Key: idem-test-001" \
  -d '{"warehouse_code": "WH-SH", "wave_no": "WAVE-IDEM-001"}'

# 第二次调用（使用相同的 X-Idempotent-Key）
# 返回相同的结果，不会创建重复波次
curl -s -X POST "http://localhost:3000/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: tester" \
  -H "X-Idempotent-Key: idem-test-001" \
  -d '{"warehouse_code": "WH-SH", "wave_no": "WAVE-IDEM-001-DUP"}'
```

### 异常处理测试

```bash
# 已出库的订单行不能拆单
# 尝试在已完成的波次上开始拣货
curl -s -X POST "http://localhost:3000/api/waves/$COMPLETED_WAVE_ID/start-picking" \
  -H "X-Operator: tester"
# 返回错误: 波次状态为 completed，无法开始拣货
```

### 人工修正

```bash
# 人工修正订单状态（记录前后差异、原因、操作者）
curl -s -X POST "http://localhost:3000/api/orders/$ORDER_ID/correct" \
  -H "Content-Type: application/json" \
  -H "X-Operator: manager@warehouse" \
  -d '{
    "old_status": "partial_picked",
    "new_status": "shipped",
    "reason": "客户要求加急发货，人工确认已出库"
  }'
```

## 报告输出示例

### 波次报告

```json
{
  "wave": {
    "wave_no": "WAVE-004",
    "warehouse": "WH-SH - 上海仓",
    "status": "has_stockout"
  },
  "statistics": {
    "total_orders": 1,
    "total_skus": 3,
    "stockout_count": 1,
    "resolved_stockout_count": 1,
    "pending_stockout_count": 0,
    "transfer_success_count": 0,
    "transfer_failed_count": 0,
    "delayed_order_count": 1
  },
  "delayed_orders": [
    {
      "order_no": "SO20250512003",
      "customer_name": "王五",
      "total_amount": 20796
    }
  ]
}
```

### 缺货报告

```json
{
  "statistics": {
    "total_stockouts": 3,
    "by_status": {
      "pending": 0,
      "split": 1,
      "transfer_success": 1,
      "transfer_failed": 0,
      "retained": 1
    },
    "total_shortage_qty": 4
  },
  "stockouts": [
    {
      "stockout_id": "stout_xxx",
      "wave_no": "WAVE-002",
      "order_no": "SO20250512001",
      "customer": "张三",
      "warehouse": "WH-SH - 上海仓",
      "sku_code": "SKU-001",
      "sku_name": "iPhone 15 Pro 256G",
      "requested_qty": 2,
      "available_qty": 48,
      "shortage_qty": 1,
      "reason": "库存不足，只找到1台",
      "status": "split"
    }
  ]
}
```

### 订单层级报告

```json
{
  "root_order": {
    "order_no": "SO20250512001",
    "status": "partial_picked",
    "split_count": 1
  },
  "related_orders": [
    {
      "order_no": "SO20250512001",
      "is_root": true,
      "status": "partial_picked",
      "total_amount": 9898,
      "shipping_fee": 12,
      "lines": [
        { "sku_code": "SKU-001", "qty": 1, "picked_qty": 1, "status": "stockout" },
        { "sku_code": "SKU-002", "qty": 1, "picked_qty": 1, "status": "picked" }
      ]
    },
    {
      "order_no": "SO20250512001-S1",
      "parent_order_no": "SO20250512001",
      "is_root": false,
      "status": "split",
      "total_amount": 7999,
      "shipping_fee": 12,
      "lines": [
        { "sku_code": "SKU-001", "qty": 1, "picked_qty": 0, "status": "stockout" }
      ]
    }
  ]
}
```

## 业务规则

### 拆单规则

1. 已出库的订单行不能拆单（status = shipped）
2. 拆单后子单运费与原单一致
3. 子单状态初始为 split
4. 原单状态变为 partial_picked
5. 同一订单支持多次拆单（split_count 记录）

### 换仓规则

1. 检查源仓库可用库存
2. 库存不足时标记 transfer_failed
3. 成功后更新订单行状态为 picked
4. 跨仓库存转移：源仓库 -qty，目标仓库 +qty

### 幂等性规则

1. 使用 X-Idempotent-Key 请求头
2. 相同 key 重复调用返回相同结果
3. 不重复创建实体

### 状态流转

**波次状态**：
- created → assigned → picking → partial_picked/has_stockout → completed
- has_stockout → picking（缺货处理后重试）

**订单状态**：
- pending → wave_assigned → picking → partial_picked/shipped/delayed

**缺货状态**：
- pending → split/transfering → transfer_success/transfer_failed/retained

## 数据存储

使用内存数据结构 + JSON 文件持久化，无需数据库：

- 数据文件：`data/warehouse-data.json`
- 首次启动自动创建
- 每次操作后自动保存

## 脚本说明

项目包含以下演示脚本（`scripts/` 目录）：

| 脚本 | 说明 |
|------|------|
| demo-scenario-1-complete-picking.sh | 完整拣货流程 |
| demo-scenario-2-split-order.sh | 部分缺货拆单流程 |
| demo-scenario-3-transfer-success.sh | 换仓成功流程 |
| demo-scenario-4-transfer-fail-retain.sh | 换仓失败保留流程 |
| demo-failure-and-idempotency.sh | 失败路径和幂等性演示 |

## 运行演示脚本

```bash
# 确保服务已启动
npm start

# 在另一个终端运行演示
bash scripts/demo-scenario-1-complete-picking.sh
bash scripts/demo-scenario-2-split-order.sh
# ... 其他场景
```

## 核心测试

项目包含一个完整的测试脚本，可以验证所有业务场景：

```bash
node test-demo.js
```

该脚本会依次测试：
1. 完整拣货流程
2. 缺货拆单流程
3. 换仓成功流程
4. 换仓失败保留流程
5. 幂等性和异常处理
6. 人工修正审计追踪
7. 报告导出

## 状态机一览

### 波次状态机

```
created → assigned → picking → partial_picked → completed
                          ↓
                     has_stockout ─→ picking (重试)
                          ↓
                     completed (缺货已处理)
```

### 订单状态机

```
pending → wave_assigned → picking → partial_picked → shipped
                                      ↓
                                 delayed (有保留商品)
                                      ↓
                                 partial_shipped
```

### 缺货状态机

```
pending ─→ split (拆单)
      └─→ transfering ─→ transfer_success
                       └─→ transfer_failed ─→ retained
```

## 常见问题

**Q: 数据文件在哪里？**
A: `data/warehouse-data.json`，可以直接删除后重新运行 `npm run seed` 重置。

**Q: 如何清空数据重新开始？**
A: 删除 `data/warehouse-data.json` 或运行 `npm run init-db && npm run seed`。

**Q: 服务端口被占用？**
A: 修改 `src/app.js` 中的 PORT 或使用 `PORT=3001 npm start` 指定端口。

**Q: 如何查看历史记录？**
A: 查询订单/波次详情时会返回 `history` 字段，包含所有状态变化。

**Q: 人工修正会记录什么？**
A: 记录 `old_value`、`new_value`、`reason`、`operator`、时间戳，可通过 `manual_corrections` 字段查询。
