# 社区药房库存管理系统

用于记录疫苗和胰岛素到店后的温度、签收人和破损情况的 FastAPI 服务。

## 功能特性

- ✅ 入库登记：记录批次号、产品名称、温度、签收人、破损情况
- ✅ 自动温度校验：疫苗/胰岛素正常温度范围 2-8℃，超出自动标记异常
- ✅ 复核流程：支持通过/拒绝两种复核结果
- ✅ 多条件筛选：按签收人、复核人、状态、温度状态、产品类型、时间范围筛选
- ✅ Excel 导出：导出与查询结果一致的报告
- ✅ 本地持久化：使用 SQLite 数据库，重启服务数据不丢失
- ✅ 统计摘要：实时查看总记录数、待复核、已通过、已拒绝、温度异常、存在破损等统计

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用开发模式：

```bash
uvicorn main:app --reload
```

服务将在 `http://localhost:8000` 启动。

### 3. API 文档

启动服务后，访问以下地址查看交互式 API 文档：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 主流程演示

### 方式一：使用 Python 脚本（推荐）

在服务启动后，打开新终端运行：

```bash
python run_demo.py
```

脚本会自动完成所有流程：
- 入库登记（正常数据 + 异常数据）
- 错误分支测试（重复批次、类型错误、重复复核）
- 多条件筛选查询
- 复核流程（通过 + 拒绝）
- 统计摘要
- Excel 导出

### 方式二：使用 curl 命令

在服务启动后，运行：

```bash
./curl_examples.sh
```

或手动执行以下 curl 命令。

---

## API 接口详解

### 1. 入库登记

**POST** `/api/inventory`

**请求体：**
```json
{
  "batch_number": "VAC-2024-001",
  "product_name": "新冠灭活疫苗",
  "product_type": "疫苗",
  "temperature": 4.5,
  "receiver": "张三",
  "has_damage": false,
  "damage_description": ""
}
```

**字段说明：**
- `batch_number`: 批次号（唯一）
- `product_name`: 产品名称
- `product_type`: 产品类型，只能是 "疫苗" 或 "胰岛素"
- `temperature`: 温度（℃），2-8℃ 为正常
- `receiver`: 签收人
- `has_damage`: 是否有破损（true/false）
- `damage_description`: 破损描述（可选）

**curl 示例：**
```bash
# 正常数据
curl -X POST -H "Content-Type: application/json" -d '{"batch_number":"VAC-TEST-001","product_name":"乙肝疫苗","product_type":"疫苗","temperature":5.0,"receiver":"李药师","has_damage":false}' http://localhost:8000/api/inventory

# 异常数据（温度异常 + 破损）
curl -X POST -H "Content-Type: application/json" -d '{"batch_number":"INS-TEST-001","product_name":"甘精胰岛素","product_type":"胰岛素","temperature":15.0,"receiver":"王药师","has_damage":true,"damage_description":"外包装破损"}' http://localhost:8000/api/inventory
```

---

### 2. 查询记录

**GET** `/api/inventory`

**查询参数（均可组合使用）：**
- `receiver`: 按签收人筛选
- `reviewed_by`: 按复核人筛选
- `status`: 按状态筛选（pending/approved/rejected）
- `temperature_status`: 按温度状态筛选（normal/abnormal）
- `product_type`: 按产品类型筛选（疫苗/胰岛素）
- `start_time`: 开始时间
- `end_time`: 结束时间

**curl 示例：**
```bash
# 查询所有记录
curl http://localhost:8000/api/inventory

# 查询温度异常的记录
curl "http://localhost:8000/api/inventory?temperature_status=abnormal"

# 查询待复核的疫苗
curl "http://localhost:8000/api/inventory?status=pending&product_type=疫苗"

# 查询张三签收的记录
curl "http://localhost:8000/api/inventory?receiver=张三"
```

---

### 3. 查询单条记录

**GET** `/api/inventory/{batch_number}`

**curl 示例：**
```bash
curl http://localhost:8000/api/inventory/VAC-2024-001
```

---

### 4. 复核记录

**POST** `/api/inventory/review`

**请求体：**
```json
{
  "batch_number": "VAC-2024-001",
  "reviewed_by": "主管A",
  "status": "approved",
  "review_notes": "温度正常，包装完好"
}
```

**字段说明：**
- `batch_number`: 批次号
- `reviewed_by`: 复核人
- `status`: 复核状态，只能是 "approved"（通过）或 "rejected"（拒绝）
- `review_notes`: 复核备注（可选）

**curl 示例：**
```bash
# 复核通过
curl -X POST -H "Content-Type: application/json" -d '{"batch_number":"VAC-TEST-001","reviewed_by":"张主管","status":"approved","review_notes":"温度正常，无破损，同意入库"}' http://localhost:8000/api/inventory/review

# 复核拒绝
curl -X POST -H "Content-Type: application/json" -d '{"batch_number":"INS-TEST-001","reviewed_by":"李主管","status":"rejected","review_notes":"温度异常，做退货处理"}' http://localhost:8000/api/inventory/review
```

---

### 5. 导出Excel报告

**GET** `/api/inventory/export`

支持与查询接口相同的筛选参数，导出与查询结果一致的 Excel 报告。

**curl 示例：**
```bash
# 导出全部记录
curl -o all_records.xlsx http://localhost:8000/api/inventory/export

# 导出温度异常的记录
curl -o abnormal_temp.xlsx "http://localhost:8000/api/inventory/export?temperature_status=abnormal"

# 导出已拒绝的记录
curl -o rejected.xlsx "http://localhost:8000/api/inventory/export?status=rejected"
```

---

### 6. 统计摘要

**GET** `/api/stats`

**curl 示例：**
```bash
curl http://localhost:8000/api/stats
```

**响应示例：**
```json
{
  "总记录数": 4,
  "待复核": 2,
  "已通过": 1,
  "已拒绝": 1,
  "温度异常": 2,
  "存在破损": 2
}
```

---

## 错误分支说明

| 场景 | HTTP 状态码 | 错误信息 |
|------|-------------|----------|
| 批次号已存在 | 400 | 批次号 xxx 已存在 |
| 产品类型错误 | 400 | 产品类型只能是 疫苗 或 胰岛素 |
| 批次号不存在 | 404 | 批次号 xxx 不存在 |
| 重复复核 | 400 | 该记录已复核，无法重复复核 |
| 复核状态错误 | 400 | 状态只能是 approved 或 rejected |

---

## 数据持久化

数据存储在当前目录的 `pharmacy_inventory.db` SQLite 数据库文件中。

**查看数据库内容：**
```bash
# 安装 sqlite3 后执行
sqlite3 pharmacy_inventory.db

# 查看所有记录
SELECT * FROM inventory_records;
```

---

## 样例数据

### 正常数据样例

```json
{
  "batch_number": "VAC-NORMAL-001",
  "product_name": "流感疫苗",
  "product_type": "疫苗",
  "temperature": 5.5,
  "receiver": "张药师",
  "has_damage": false
}
```

### 异常数据样例

```json
{
  "batch_number": "INS-ABNORMAL-001",
  "product_name": "门冬胰岛素",
  "product_type": "胰岛素",
  "temperature": -1.5,
  "receiver": "李药师",
  "has_damage": true,
  "damage_description": "冷链箱冰袋融化，温度显示异常，3支药剂有轻微裂纹"
}
```

---

## 项目结构

```
.
├── main.py              # 主程序文件（FastAPI 服务）
├── requirements.txt     # Python 依赖
├── run_demo.py          # 主流程演示脚本（Python）
├── curl_examples.sh     # curl 命令示例脚本
├── README.md            # 本文档
└── pharmacy_inventory.db # SQLite 数据库（运行后自动生成）
```

---

## 温度校验规则

| 产品类型 | 正常温度范围 | 超出范围处理 |
|---------|-------------|-------------|
| 疫苗 | 2℃ ~ 8℃ | temperature_status = "abnormal" |
| 胰岛素 | 2℃ ~ 8℃ | temperature_status = "abnormal" |

---

## 状态流转

```
待复核 (pending)
    │
    ├─→ 复核通过 → 已通过 (approved)
    │
    └─→ 复核拒绝 → 已拒绝 (rejected)

注意：已复核的记录无法再次复核
```

---

## 常见问题

**Q: 重启服务后数据会丢失吗？**
A: 不会，数据存储在 SQLite 数据库文件 `pharmacy_inventory.db` 中。

**Q: 如何清空数据重新开始？**
A: 删除 `pharmacy_inventory.db` 文件，重启服务即可。

**Q: 支持批量导入吗？**
A: 当前版本暂不支持批量导入，可通过多次调用入库接口实现。

**Q: 如何修改正常温度范围？**
A: 修改 `main.py` 中的 `check_temperature_status` 函数。
