# 无人货架补货差异 API 服务

用于处理便利店无人货架补货差异数据的 API 服务，支持 SKU 别名映射、临期品优先处理、点位盘点时间对齐等功能。

## 功能特性

- **批次管理**: 创建和查询补货批次
- **材料上传**: 登记原始补货材料，支持重复检测
- **SKU 别名处理**: 同一 SKU 多个别名统一映射
- **临期品优先**: 根据过期时间计算优先级分数
- **盘点时间对齐**: 处理不同点位盘点时间不一致
- **处理轨迹追踪**: 查询单条明细的完整处理过程
- **报告生成**: 自动生成 Excel 处理报告
- **错误处理**: 缺字段、时间矛盾、重复编号等错误回写到原始材料位置

## 技术栈

- Python 3.8+
- FastAPI: Web 框架
- SQLAlchemy: ORM
- SQLite: 数据库
- Pandas + OpenPyXL: 报告生成

## 安装运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

服务启动后访问: http://localhost:8000
API 文档: http://localhost:8000/docs

## 完整测试流程 (curl 命令)

### 1. 健康检查
```bash
curl http://localhost:8000/api/health
```

### 2. 设置 SKU 别名（可选）
```bash
curl -X POST "http://localhost:8000/api/sku-aliases" \
  -H "Content-Type: application/json" \
  -d '{"canonical_sku": "COKE-001", "alias_sku": "COKE-CLASSIC"}'

curl -X POST "http://localhost:8000/api/sku-aliases" \
  -H "Content-Type: application/json" \
  -d '{"canonical_sku": "COKE-001", "alias_sku": "COKE-COLA"}'

# 查询所有 SKU 别名
curl http://localhost:8000/api/sku-aliases
```

### 3. 设置点位标准盘点时间（可选）
```bash
curl -X POST "http://localhost:8000/api/location-time?location_code=LOC-A&standard_time=2024-01-15T08:00:00"
```

### 4. 创建补货批次
```bash
curl -X POST "http://localhost:8000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{"batch_no": "BATCH-20240115-001", "name": "2024年1月15日补货批次01"}'
```

### 5. 查询批次信息
```bash
curl http://localhost:8000/api/batches/BATCH-20240115-001
```

### 6. 上传原始材料数据
```bash
curl -X POST "http://localhost:8000/api/materials/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240115-001",
    "materials": [
      {
        "line_number": 1,
        "sku_name": "可口可乐经典",
        "sku_code": "COKE-CLASSIC",
        "quantity": 50,
        "location_code": "LOC-A",
        "location_name": "东门货架A",
        "inventory_time": "2024-01-15T09:30:00",
        "expiry_date": "2024-01-20T23:59:59"
      },
      {
        "line_number": 2,
        "sku_name": "百事可乐",
        "sku_code": "PEPSI-001",
        "quantity": 30,
        "location_code": "LOC-A",
        "location_name": "东门货架A",
        "inventory_time": "2024-01-15T09:30:00"
      },
      {
        "line_number": 3,
        "sku_name": "矿泉水",
        "sku_code": "WATER-001",
        "quantity": -5,
        "location_code": "LOC-B",
        "location_name": "西门货架B",
        "inventory_time": "2024-01-15T10:00:00"
      }
    ]
  }'
```

### 7. 重复材料测试（上传相同内容）
```bash
# 创建新批次
curl -X POST "http://localhost:8000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{"batch_no": "BATCH-20240115-002", "name": "测试重复批次"}'

# 上传相同材料
curl -X POST "http://localhost:8000/api/materials/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240115-002",
    "materials": [
      {
        "line_number": 1,
        "sku_name": "可口可乐经典",
        "sku_code": "COKE-CLASSIC",
        "quantity": 50,
        "location_code": "LOC-A",
        "location_name": "东门货架A",
        "inventory_time": "2024-01-15T09:30:00",
        "expiry_date": "2024-01-20T23:59:59"
      },
      {
        "line_number": 2,
        "sku_name": "百事可乐",
        "sku_code": "PEPSI-001",
        "quantity": 30,
        "location_code": "LOC-A",
        "location_name": "东门货架A",
        "inventory_time": "2024-01-15T09:30:00"
      },
      {
        "line_number": 3,
        "sku_name": "矿泉水",
        "sku_code": "WATER-001",
        "quantity": -5,
        "location_code": "LOC-B",
        "location_name": "西门货架B",
        "inventory_time": "2024-01-15T10:00:00"
      }
    ]
  }'
```

### 8. 触发处理流程
```bash
curl -X POST "http://localhost:8000/api/process/trigger" \
  -H "Content-Type: application/json" \
  -d '{"batch_no": "BATCH-20240115-001"}'
```

### 9. 查询批次材料列表
```bash
curl http://localhost:8000/api/materials/batch/BATCH-20240115-001
```

### 10. 查询单条明细处理轨迹
```bash
# 先用上面的命令获取 material_id，然后替换下面的 ID
curl http://localhost:8000/api/trace/1
```

### 11. 下载处理报告
```bash
curl -O -J "http://localhost:8000/api/reports/BATCH-20240115-001"
```

### 12. 查询所有批次
```bash
curl http://localhost:8000/api/batches
```

## Python 测试脚本

```python
import requests
import json

BASE_URL = "http://localhost:8000"

print("=== 1. 健康检查 ===")
response = requests.get(f"{BASE_URL}/api/health")
print(response.json())

print("\n=== 2. 设置 SKU 别名 ===")
response = requests.post(
    f"{BASE_URL}/api/sku-aliases",
    json={"canonical_sku": "COKE-001", "alias_sku": "COKE-CLASSIC"}
)
print(response.json())

print("\n=== 3. 创建批次 ===")
response = requests.post(
    f"{BASE_URL}/api/batches",
    json={"batch_no": "BATCH-TEST-001", "name": "测试批次001"}
)
print(response.json())

print("\n=== 4. 上传材料 ===")
materials = {
    "batch_no": "BATCH-TEST-001",
    "materials": [
        {
            "line_number": 1,
            "sku_name": "可口可乐",
            "sku_code": "COKE-CLASSIC",
            "quantity": 100,
            "location_code": "LOC-001",
            "location_name": "正门货架",
            "inventory_time": "2024-01-15T08:00:00",
            "expiry_date": "2024-02-01T23:59:59"
        }
    ]
}
response = requests.post(f"{BASE_URL}/api/materials/upload", json=materials)
print(response.json())

print("\n=== 5. 触发处理 ===")
response = requests.post(
    f"{BASE_URL}/api/process/trigger",
    json={"batch_no": "BATCH-TEST-001"}
)
print(response.json())

print("\n=== 6. 查询处理轨迹 ===")
response = requests.get(f"{BASE_URL}/api/trace/1")
print(json.dumps(response.json(), indent=2, ensure_ascii=False))
```

## 关键字段追踪

从原始输入到最终报告的关键字段映射：

| 原始字段 | 处理过程 | 报告字段 |
|---------|---------|---------|
| line_number | 直接保留 | 原始行号 |
| sku_name | 直接保留 | SKU名称 |
| sku_code | → SKU别名映射 → canonical_sku | 原始SKU编码 / 标准SKU编码 |
| quantity | → 验证调整 → adjusted_quantity | 原始数量 / 调整后数量 |
| location_code | 直接保留 | 点位编码 |
| location_name | 直接保留 | 点位名称 |
| inventory_time | → 与标准时间比较 → time_diff | 盘点时间 / 盘点时间差异 |
| expiry_date | → 计算优先级 → priority_score | 过期时间 / 优先级分数 |

## API 端点列表

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/batches | 创建批次 |
| GET | /api/batches/{batch_no} | 查询批次 |
| GET | /api/batches | 批次列表 |
| POST | /api/materials/upload | 上传材料 |
| GET | /api/materials/batch/{batch_no} | 批次材料列表 |
| POST | /api/process/trigger | 触发处理 |
| GET | /api/trace/{material_id} | 处理轨迹查询 |
| GET | /api/reports/{batch_no} | 下载报告 |
| POST | /api/sku-aliases | 创建SKU别名 |
| GET | /api/sku-aliases | SKU别名列表 |
| POST | /api/location-time | 设置点位盘点时间 |
| GET | /api/health | 健康检查 |
