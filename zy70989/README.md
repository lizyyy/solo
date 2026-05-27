# 短租运营对账系统 API

解决短租退房时水电抄表、损坏扣款和押金退款对不上的问题。自动区分**正常项**、**待确认项**、**失败项**，保留原始字段并给出处理建议。

## 核心功能

- **阶梯电价计算**：按各地阶梯电价标准自动核算电费
- **损坏证据校验**：检查扣款是否有照片证据，金额是否合理
- **退款冲正**：自动比对应退押金和实退押金，标记差额
- **幂等保护**：同一批材料重复提交不会重复生效
- **可追溯**：每条记录都有原始字段、处理理由、规则说明

## 快速开始

### 1. 安装依赖

```bash
cd /Users/lzy/pro/solo/workspaces/zy70989
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/

### 3. 运行测试

```bash
chmod +x samples/test_request.sh
bash samples/test_request.sh
```

或者直接使用 Python 测试：

```bash
python3 - << 'EOF'
import requests

BASE = "http://localhost:8000"

files = {
    "meter_csv": open("samples/meter_readings.csv", "rb"),
    "orders_json": open("samples/orders.json", "rb"),
    "damage_json": open("samples/damage_claims.json", "rb"),
}
data = {"batch_id": "BATCH-TEST-001"}

resp = requests.post(f"{BASE}/api/reconcile/upload", files=files, data=data)
result = resp.json()

print(f"=== 对账结果 ===")
print(f"批次ID: {result['batch_id']}")
print(f"总计: {result['total_items']} 条")
print(f"  正常: {result['normal_count']} 条")
print(f"  待确认: {result['pending_count']} 条")
print(f"  失败: {result['failed_count']} 条")

print("\n=== 失败项详情 ===")
for item in result['failed_items']:
    print(f"- [{item['category']}] {item['guest_name']}({item['order_id']})")
    print(f"  原因: {item['reason']}")
    print(f"  建议: {item['suggested_action']}")
EOF
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 健康检查 |
| GET | `/properties` | 获取房源配置（阶梯电价等） |
| POST | `/api/reconcile/upload` | 上传对账材料并处理 |
| GET | `/api/reconcile/{batch_id}` | 查询批次处理结果 |
| GET | `/api/batches` | 查询所有处理批次 |
| DELETE | `/api/reset` | 重置测试数据 |

### 上传接口参数

- `batch_id` (可选)：批次ID，不传自动生成
- `meter_csv` (必填)：水电抄表CSV文件
- `orders_json` (必填)：订单数据JSON文件
- `damage_json` (可选)：损坏扣款JSON文件
- `photos` (可选)：损坏照片文件（多个）

**CSV格式要求**：
```
property_id,order_id,checkin_date,checkout_date,electricity_start,electricity_end,water_start,water_end
```

**照片命名约定**：`{order_id}.jpg`，系统会自动关联。

## 处理规则说明

### 1. 阶梯电价规则

以北京为例（PROP-BJ-001）：
- 0-240度：0.48元/度
- 240-400度：0.54元/度
- 400度以上：0.79元/度

### 2. 损坏扣款规则

| 情况 | 状态 | 建议处理 |
|------|------|----------|
| 缺少照片 | 失败 | 要求补材料 |
| 扣款金额 ≤ 0 | 失败 | 拒绝 |
| 扣款 > 押金 | 待确认 | 人工复核 |
| 扣款 > 1000元 | 待确认 | 人工复核 |
| 证据齐全金额合理 | 正常 | 放行 |

### 3. 退款冲正规则

| 情况 | 状态 | 建议处理 |
|------|------|----------|
| 应退 = 实退 | 正常 | 放行 |
| 多退 > 0.01元 | 待确认 | 重新计算 |
| 少退 > 0.01元 | 失败 | 重新计算 |
| 扣款超押金 | 待确认 | 人工追缴 |

## 样例数据说明

样例中包含 5 个订单，其中故意设计了异常场景：

1. **ORD202405001（张三）**：门锁损坏扣款 1200 元（超过 1000 元，需人工复核）
2. **ORD202405002（李四）**：正常退房，无扣款
3. **ORD202405003（王五）**：墙面污渍扣款 200 元（有照片，正常）
4. **ORD202405004（赵六）**：餐具破损扣款 150 元（无照片，失败）
5. **ORD202405005（孙七）**：电表读数异常（结束 < 起始，失败）

## 结果字段说明

每条处理记录包含：
- `status`：normal / pending / failed
- `suggested_action`：approve / manual_review / request_evidence / reject / recalculate
- `reason`：处理理由，可直接向客人或房东解释
- `raw_fields`：原始提交的所有字段，便于追溯
- `rule_applied`：应用的规则名称
- `evidence_status`：证据状态

## 数据存储

- 处理批次记录：`data/batches.json`
- 对账结果：`data/results.json`
- 上传照片：`uploads/` 目录
