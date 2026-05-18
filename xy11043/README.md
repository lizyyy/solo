# 家具定制厂板材裁切排队 API

支持按日期、状态、负责人或门店筛选，批量导入时处理余料预占冲突，提供行级结果。

## 特性

- ✅ 完整的裁切排队记录管理（增删改查）
- ✅ 多条件筛选（日期、状态、负责人、门店、板材类型等）
- ✅ 批量导入（行级结果、不中断整批、余料冲突检测）
- ✅ Excel 导出功能
- ✅ 版本控制（防止反复修改同一条记录导致混乱）
- ✅ 本地启动无需外部服务
- ✅ 配置缺失时给出清晰提示

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (Mac/Linux)
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

`.env` 文件内容：

```env
DATABASE_URL=sqlite:///./cutting_queue.db
HOST=0.0.0.0
PORT=8000
DEBUG=True
```

### 3. 初始化样例数据

```bash
python init_sample_data.py
```

### 4. 启动服务

```bash
python main.py
```

服务启动后访问：http://localhost:8000/docs

---

## API 使用指南

### 一、创建裁切排队记录

**接口**: `POST /api/cutting-queue/`

**请求示例**:

```bash
curl -X POST "http://localhost:8000/api/cutting-queue/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "CQ20240518007",
    "customer_name": "吴女士",
    "store_name": "南京鼓楼店",
    "salesperson": "周红",
    "order_date": "2024-05-18",
    "delivery_date": "2024-06-01",
    "board_type": "颗粒板",
    "board_color": "黑色",
    "board_thickness": 18.0,
    "board_length": 2440,
    "board_width": 1220,
    "required_pieces": 40,
    "cut_pieces": 0,
    "remaining_pieces": 40,
    "material_code": "KLB-BK-18",
    "material_batch": "B20240517",
    "material_location": "E区-01-02",
    "edge_banding": "四边封边",
    "drilling": "标准孔位",
    "special_processing": "无",
    "priority": 6,
    "status": "pending",
    "assigned_to": "钱师傅",
    "machine_no": "CNC-004",
    "estimated_cutting_time": 80,
    "remarks": "",
    "is_urgent": false,
    "has_remaining_material": false,
    "created_by": "admin"
  }'
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_no | string | 是 | 订单编号（唯一） |
| customer_name | string | 是 | 客户名称 |
| store_name | string | 是 | 门店名称 |
| salesperson | string | 是 | 销售员 |
| order_date | date | 是 | 下单日期 |
| delivery_date | date | 是 | 交货日期 |
| board_type | string | 是 | 板材类型（颗粒板、多层板、欧松板等） |
| board_color | string | 是 | 板材颜色 |
| board_thickness | float | 是 | 板材厚度(mm) |
| board_length | int | 是 | 板材长度(mm) |
| board_width | int | 是 | 板材宽度(mm) |
| required_pieces | int | 是 | 需求数量 |
| cut_pieces | int | 否 | 已裁切数量，默认0 |
| remaining_pieces | int | 是 | 剩余数量 |
| material_code | string | 是 | 物料编码 |
| material_batch | string | 否 | 物料批次 |
| material_location | string | 否 | 物料位置 |
| edge_banding | string | 否 | 封边要求 |
| drilling | string | 否 | 钻孔要求 |
| special_processing | string | 否 | 特殊工艺 |
| priority | int | 否 | 优先级(1-10)，默认5 |
| status | string | 否 | 状态，默认pending |
| assigned_to | string | 否 | 负责人 |
| machine_no | string | 否 | 机器编号 |
| estimated_cutting_time | int | 否 | 预计裁切时间(分钟) |
| remarks | string | 否 | 备注 |
| is_urgent | bool | 否 | 是否急单，默认false |
| has_remaining_material | bool | 否 | 是否有余料，默认false |
| remaining_material_info | string | 否 | 余料信息 |
| created_by | string | 否 | 创建人 |

**状态值**:
- `pending`: 待排队
- `queued`: 已排队
- `cutting`: 裁切中
- `completed`: 已完成
- `paused`: 已暂停
- `cancelled`: 已取消

---

### 二、修改裁切排队记录

**接口**: `PUT /api/cutting-queue/{id}`

**请求示例**:

```bash
curl -X PUT "http://localhost:8000/api/cutting-queue/1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "queued",
    "cut_pieces": 10,
    "remaining_pieces": 40,
    "remarks": "已安排到CNC-001",
    "updated_by": "operator"
  }'
```

**说明**:
- 每次修改会自动递增 `version` 版本号，避免反复修改同一条记录导致混乱
- 只需传入需要修改的字段即可
- 支持部分更新

---

### 三、查询裁切排队记录

#### 3.1 查询列表

**接口**: `GET /api/cutting-queue/`

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| skip | int | 跳过记录数，默认0 |
| limit | int | 返回记录数，默认100 |
| start_date | date | 开始日期（按下单日期筛选） |
| end_date | date | 结束日期（按下单日期筛选） |
| status | string | 状态筛选 |
| assigned_to | string | 负责人筛选 |
| store_name | string | 门店名称（模糊匹配） |
| board_type | string | 板材类型（模糊匹配） |
| is_urgent | bool | 是否急单 |

**请求示例**:

```bash
# 查询所有记录
curl "http://localhost:8000/api/cutting-queue/"

# 按日期筛选
curl "http://localhost:8000/api/cutting-queue/?start_date=2024-05-01&end_date=2024-05-31"

# 按状态筛选
curl "http://localhost:8000/api/cutting-queue/?status=pending"

# 按负责人筛选
curl "http://localhost:8000/api/cutting-queue/?assigned_to=王师傅"

# 按门店筛选
curl "http://localhost:8000/api/cutting-queue/?store_name=北京"

# 组合筛选
curl "http://localhost:8000/api/cutting-queue/?status=cutting&is_urgent=true&store_name=上海"
```

#### 3.2 查询单个记录

**接口**: `GET /api/cutting-queue/{id}`

**请求示例**:

```bash
curl "http://localhost:8000/api/cutting-queue/1"
```

---

### 四、导出裁切排队记录

**接口**: `GET /api/cutting-queue/export`

**查询参数**：支持与列表查询相同的筛选参数

**请求示例**:

```bash
# 导出所有记录
curl -O "http://localhost:8000/api/cutting-queue/export"

# 按条件导出
curl -O "http://localhost:8000/api/cutting-queue/export?status=completed&start_date=2024-05-01"
```

**说明**:
- 导出格式为 Excel (.xlsx)
- 支持所有筛选条件
- 文件名自动包含时间戳

---

### 五、批量导入裁切排队记录

**接口**: `POST /api/cutting-queue/batch-import`

**请求示例**:

```bash
curl -X POST "http://localhost:8000/api/cutting-queue/batch-import" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "order_no": "CQ20240518008",
      "customer_name": "郑先生",
      "store_name": "武汉江汉店",
      "salesperson": "吴杰",
      "order_date": "2024-05-18",
      "delivery_date": "2024-06-05",
      "board_type": "多层板",
      "board_color": "樱桃色",
      "board_thickness": 18.0,
      "board_length": 2440,
      "board_width": 1220,
      "required_pieces": 30,
      "cut_pieces": 0,
      "remaining_pieces": 30,
      "material_code": "DCB-YT-18",
      "material_location": "A区-01-03",
      "priority": 5,
      "status": "pending",
      "has_remaining_material": true
    },
    {
      "order_no": "CQ20240518001",
      "customer_name": "重复订单",
      "store_name": "测试门店",
      "salesperson": "测试",
      "order_date": "2024-05-18",
      "delivery_date": "2024-06-01",
      "board_type": "颗粒板",
      "board_color": "白色",
      "board_thickness": 18.0,
      "board_length": 2440,
      "board_width": 1220,
      "required_pieces": 10,
      "remaining_pieces": 10,
      "material_code": "TEST-001"
    }
  ]'
```

**返回示例**:

```json
{
  "total": 2,
  "success_count": 1,
  "failed_count": 1,
  "results": [
    {
      "row": 1,
      "order_no": "CQ20240518008",
      "success": true,
      "message": "警告: 物料 KLB-NW-18 在位置 A区-01-03 的余料已被订单 CQ20240518001 预占",
      "error_type": "material_conflict",
      "data": { ... }
    },
    {
      "row": 2,
      "order_no": "CQ20240518001",
      "success": false,
      "message": "订单编号 CQ20240518001 已存在",
      "error_type": "duplicate"
    }
  ]
}
```

**说明**:
- 行级处理：单条失败不影响其他记录导入
- 余料冲突检测：同一位置的余料被多单预占时给出警告但继续导入
- 重复订单检测：订单编号重复时标记为失败
- 详细的导入结果：包含每行的成功/失败状态、错误类型和提示信息

---

## 项目结构

```
.
├── main.py              # 主程序入口
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模式定义
├── crud.py              # 数据库操作
├── database.py          # 数据库连接配置
├── init_sample_data.py  # 样例数据初始化
├── requirements.txt     # 依赖列表
├── .env.example         # 环境变量示例
└── README.md            # 项目说明文档
```

## 注意事项

1. **版本控制**: 每次修改记录时 `version` 字段会自动递增，可用于追踪修改历史
2. **余料管理**: 同一物料位置的余料被多单预占时会给出警告提示
3. **配置检查**: 启动时会自动检查必要配置，缺失时给出清晰提示
4. **数据完整性**: 订单编号唯一约束防止重复导入

## 技术栈

- Python 3.8+
- FastAPI: Web 框架
- SQLAlchemy: ORM 框架
- SQLite: 数据库（可替换为 MySQL/PostgreSQL）
- Pandas + OpenPyXL: Excel 导出
- Uvicorn: ASGI 服务器
