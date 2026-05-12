# 农产品检测溯源 API

一个完整的农产品供应链溯源系统，围绕**产地、检测报告、批次混装、分拣、出库、异常召回和冻结**展开，实现全流程闭环。

## 核心功能

### 业务流程
- **创建批次** → **提交检测** → **入仓** → **混装** → **分拣** → **出库** → **追溯/召回**

### 关键规则
1. ✅ **检测报告过期** - 入仓前自动检查检测报告有效期
2. ✅ **混装批次部分异常** - 冻结时自动追溯所有关联批次和箱子
3. ✅ **已出库追溯** - 召回时能追溯所有已出库箱子的目的地
4. ✅ **重复入仓** - 禁止已入仓批次重复入仓
5. ✅ **召回后禁止分拣** - 已召回批次无法进行分拣操作
6. ✅ **幂等性** - 支持 `X-Idempotency-Key` 防重复调用
7. ✅ **人工修正审计** - 每次修改都记录前后差异和操作者

### API 接口
| 类型 | 接口 | 说明 |
|------|------|------|
| **创建** | POST /api/batches | 创建批次 |
| **推进** | POST /api/inspections | 提交检测报告 |
| **推进** | POST /api/warehouse/in | 入仓 |
| **推进** | POST /api/batches/mix | 混装 |
| **推进** | POST /api/batches/sort | 分拣 |
| **推进** | POST /api/warehouse/out | 出库 |
| **异常处理** | POST /api/freeze | 冻结批次/箱子 |
| **异常处理** | POST /api/recall | 发起召回 |
| **异常处理** | POST /api/manual-correction | 人工修正 |
| **查询** | GET /api/batches/{id} | 批次详情（含血缘、审计日志） |
| **查询** | GET /api/batches/{id}/lineage | 批次血缘关系 |
| **查询** | GET /api/batches/{id}/outbound-trace | 出库追溯 |
| **查询** | GET /api/boxes/{id} | 箱子详情 |
| **查询** | GET /api/audit | 审计日志 |
| **报告导出** | GET /api/reports/recall/{id} | 召回报告 |
| **报告导出** | GET /api/reports/freeze/{id} | 冻结报告 |

---

## 本地启动

### 方式一：一键启动脚本
```bash
chmod +x run_server.sh
./run_server.sh
```

### 方式二：手动启动
```bash
# 1. 安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 生成样例数据（可选）
python3 sample_data.py

# 3. 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 验证服务
- 文档页面: http://127.0.0.1:8000/docs
- 健康检查: http://127.0.0.1:8000/health
- 状态概览: http://127.0.0.1:8000/status

---

## 造数说明

运行 `python3 sample_data.py` 会自动生成 5 个完整场景的测试数据：

### 场景 1：正常入仓流程
- 创建批次（绿源农场的西红柿）
- 提交检测报告（农药残留、重金属、微生物均合格）
- 入仓生成 20 个箱子
- **验证点**: 批次状态从 CREATED → INSPECTION_PASSED → IN_WAREHOUSE

### 场景 2：混装分拣流程
- 创建两个苹果批次（阳光果园 + 红富士基地）
- 两个批次分别检测、入仓（共 28 个箱子）
- 混装为一个新批次「混合苹果」
- 分拣为精品苹果(10箱)、普通苹果(10箱)、次级苹果(8箱)
- **验证点**: 可以看到完整的批次血缘树，箱子从原始批次 → 混装批次 → 子批次的流转

### 场景 3：检测异常冻结
- 创建菠菜批次
- 检测报告不合格（农残和重金属超标）
- 冻结该批次
- 查看冻结报告
- **验证点**: 批次状态变为 FROZEN，所有箱子被冻结，冻结报告包含影响范围

### 场景 4：出库追溯与召回
- 创建草莓批次
- 入仓 10 箱 → 分拣为商超配送(6箱) + 电商配送(4箱)
- 分别出库到「上海沃尔玛超市」和「杭州电商仓」
- 追溯原始批次的出库情况
- 发起召回
- 查看召回报告
- **验证点**: 能追溯到所有已出库箱子的目的地，召回时同时冻结在库和已出库的箱子

### 场景 5：规则验证（失败路径）
- 未检测就入仓 → **失败**
- 重复入仓 → **失败**
- 幂等性测试 → **同一 key 返回相同结果**
- 召回后分拣 → **失败**

---

## 主要演示路径

### 路径 A：完整正向流程
```bash
# 1. 创建批次
curl -X POST http://127.0.0.1:8000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {
      "farm_id": "FARM_DEMO",
      "farm_name": "演示农场",
      "region": "北京市大兴区",
      "country": "中国"
    },
    "product_type": "黄瓜",
    "quantity": 500,
    "unit": "公斤"
  }'

# 2. 提交检测（通过）
curl -X POST http://127.0.0.1:8000/api/inspections \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "替换为上面返回的batch_id",
    "inspector_id": "INS_DEMO",
    "items": [{"name": "农残", "result": "合格"}],
    "status": "PASSED",
    "expiry_days": 30
  }'

# 3. 入仓
curl -X POST http://127.0.0.1:8000/api/warehouse/in \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "替换为batch_id",
    "box_count": 10
  }'

# 4. 查看批次详情（确认状态变化、审计日志）
curl "http://127.0.0.1:8000/api/batches/替换为batch_id"

# 5. 查看审计日志
curl "http://127.0.0.1:8000/api/audit?entity_type=BATCH&entity_id=替换为batch_id"
```

### 路径 B：混装分拣 + 出库 + 召回
```bash
# 前提：运行 sample_data.py 后会有数据

# 1. 查看召回报告（sample_data 中场景4已生成召回）
curl "http://127.0.0.1:8000/status"  # 先查看 recall_id

# 2. 用返回的 recall_id 查看详细报告
curl "http://127.0.0.1:8000/api/reports/recall/替换为recall_id"

# 3. 查看批次血缘
curl "http://127.0.0.1:8000/api/batches/替换为batch_id/lineage"
```

### 路径 C：异常冻结
```bash
# 用 sample_data 生成的冻结批次
curl "http://127.0.0.1:8000/status"  # 查看 freeze_id

# 查看冻结报告
curl "http://127.0.0.1:8000/api/reports/freeze/替换为freeze_id"
```

---

## 失败路径演示

### 失败路径 1：未检测就入仓
```bash
# 1. 先创建一个批次
BATCH_ID=$(curl -s -X POST http://127.0.0.1:8000/api/batches \
  -H "Content-Type: application/json" \
  -d '{"origin":{"farm_id":"F1","farm_name":"测试农场","region":"测试","country":"中国"},"product_type":"测试产品","quantity":100,"unit":"公斤"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch_id'])")

echo "创建的批次: $BATCH_ID"

# 2. 直接入仓（未检测）- 应该失败
curl -X POST http://127.0.0.1:8000/api/warehouse/in \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\":\"$BATCH_ID\",\"box_count\":5}"

# 预期返回 400，错误码: invalid_status_for_warehouse_in
```

### 失败路径 2：重复入仓
```bash
# 假设 BATCH_ID 已经检测并入仓

# 再次入仓 - 应该失败
curl -X POST http://127.0.0.1:8000/api/warehouse/in \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\":\"$BATCH_ID\",\"box_count\":5}"

# 预期返回 400，错误码: duplicate_warehouse_in
```

### 失败路径 3：召回后禁止分拣
```bash
# 1. 先召回一个批次
curl -X POST http://127.0.0.1:8000/api/recall \
  -H "Content-Type: application/json" \
  -d "{\"source_batch_ids\":[\"$BATCH_ID\"],\"reason\":\"测试召回\"}"

# 2. 尝试分拣 - 应该失败
curl -X POST http://127.0.0.1:8000/api/batches/sort \
  -H "Content-Type: application/json" \
  -d "{\"batch_id\":\"$BATCH_ID\",\"sorting_plan\":[{\"box_count\":2}]}"

# 预期返回 400，错误码: recalled_batch_cannot_sort
```

### 失败路径 4：幂等性验证
```bash
# 用同一个 X-Idempotency-Key 调用两次
KEY="demo-idempotency-key-$(date +%s)"

# 第一次
echo "=== 第一次调用 ==="
curl -s -X POST http://127.0.0.1:8000/api/batches \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{"origin":{"farm_id":"F2","farm_name":"幂等测试农场","region":"测试","country":"中国"},"product_type":"幂等测试","quantity":100,"unit":"公斤"}' \
  | python3 -m json.tool

echo ""
echo "=== 第二次调用（相同 Key） ==="
curl -s -X POST http://127.0.0.1:8000/api/batches \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{"origin":{"farm_id":"F2","farm_name":"幂等测试农场","region":"测试","country":"中国"},"product_type":"幂等测试","quantity":100,"unit":"公斤"}' \
  | python3 -m json.tool

# 第二次返回会包含 "idempotent": true，且 batch_id 相同
```

---

## 如何判断业务闭环

### 不看源码，通过结果判断

1. **查看状态概览**
   ```bash
   curl http://127.0.0.1:8000/status
   ```
   能看到各状态的批次数量、冻结/召回统计

2. **查看批次详情**
   ```bash
   curl "http://127.0.0.1:8000/api/batches/{batch_id}"
   ```
   返回包含：
   - 当前状态
   - 箱子列表及其状态
   - 来源批次（追溯上游）
   - 子批次（追溯下游）
   - 完整的审计日志（每一步操作记录）

3. **查看批次血缘**
   ```bash
   curl "http://127.0.0.1:8000/api/batches/{batch_id}/lineage"
   ```
   以树形结构展示：原始批次 → 混装批次 → 分拣子批次

4. **查看召回报告**
   ```bash
   curl "http://127.0.0.1:8000/api/reports/recall/{recall_id}"
   ```
   返回包含：
   - 影响的所有批次
   - 影响的所有箱子（含原始批次信息）
   - 已出库箱子的目的地（可用于追回）
   - 在库 vs 出库的统计

5. **查看审计日志**
   ```bash
   curl "http://127.0.0.1:8000/api/audit"
   ```
   每一条记录都有：
   - 操作人
   - 操作时间
   - 操作前状态
   - 操作后状态
   - 差异对比（diff）
   - 失败原因（如果失败）

---

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 路由层
│   ├── models.py        # 数据模型（Pydantic）
│   ├── services.py      # 核心业务逻辑（规则引擎）
│   └── database.py      # 可持久化的内存数据库
├── data/
│   └── db.json          # 数据持久化文件（自动生成）
├── sample_data.py       # 样例数据生成脚本
├── run_server.sh        # 一键启动脚本
├── requirements.txt     # 依赖
└── README.md            # 本文档
```

---

## 核心规则引擎

在 `app/services.py` 中实现了以下规则：

| 规则 | 代码位置 | 说明 |
|------|---------|------|
| 状态转换验证 | `VALID_STATUS_TRANSITIONS` | 定义合法的状态流转路径 |
| 检测报告过期 | `_check_inspection_expiry()` | 入仓前检查报告有效期 |
| 重复入仓检测 | `warehouse_in()` L204 | 检查 `batch.boxes` 是否已存在 |
| 召回后禁止分拣 | `sort_batch()` L338 | 检查 `batch.recalled` 标记 |
| 冻结级联 | `_freeze_batch_and_descendants()` | 递归冻结所有子批次 |
| 召回级联 | `_recall_batch_and_lineage()` | 递归追溯所有关联实体 |
| 幂等性 | `_check_idempotency()` | 基于 Header 中的 key 缓存结果 |
| 人工修正审计 | `manual_correction()` | 记录 before/after/diff |
