# 陶艺工作室烧窑管理 API

一个基于 FastAPI 和 SQLite 的社区陶艺工作室烧窑安排管理系统。

## 功能特性

### 前台功能
- **作品录入**: 录入学员作品信息，包括坯体干燥状态、釉料类型、期望取件日和可接受温区
- **作品查询**: 支持按学员姓名、干燥状态、温区等条件筛选

### 管理员功能
- **窑次管理**: 创建、编辑、删除窑次，设置目标温区、计划日期和最大容量
- **拼窑校验**: 自动校验以下冲突：
  - 温区不匹配
  - 坯体未干透
  - 釉料不兼容
  - 窑次超载
  - 插队风险（存在更早的可用窑次）
- **烧成记录**: 记录烧成开始/结束时间和结果
- **延期查询**: 查询已延期的作品列表
- **交接报告**: 导出 Markdown 格式的每日交接报告

## 技术栈

- **后端框架**: FastAPI (Python)
- **数据库**: SQLite (通过 SQLAlchemy ORM)
- **异步支持**: 全程异步 (async/await)
- **API 文档**: 自动生成 Swagger UI 和 ReDoc

## 快速开始

### 1. 环境要求

- Python 3.8+
- pip (Python 包管理器)

### 2. 安装依赖

```bash
# 创建虚拟环境 (推荐)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -e .
```

### 3. 初始化数据库并添加示例数据

```bash
python sample_data.py
```

### 4. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. 访问 API

- **API 根路径**: http://localhost:8000/
- **Swagger UI 文档**: http://localhost:8000/docs
- **ReDoc 文档**: http://localhost:8000/redoc
- **健康检查**: http://localhost:8000/health

## API 端点

### 作品管理 (Works)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/works` | 创建新作品 |
| GET | `/api/v1/works` | 查询作品列表（支持分页和筛选） |
| GET | `/api/v1/works/{id}` | 获取单个作品详情 |
| PUT | `/api/v1/works/{id}` | 更新作品信息 |
| DELETE | `/api/v1/works/{id}` | 删除作品 |

### 窑次管理 (Kiln Sessions)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/kiln-sessions` | 创建新窑次 |
| GET | `/api/v1/kiln-sessions` | 查询窑次列表 |
| GET | `/api/v1/kiln-sessions/{id}` | 获取窑次详情 |
| PUT | `/api/v1/kiln-sessions/{id}` | 更新窑次信息 |
| DELETE | `/api/v1/kiln-sessions/{id}` | 删除窑次 |
| POST | `/api/v1/kiln-sessions/{id}/validate` | 校验窑次拼窑合理性 |
| POST | `/api/v1/kiln-sessions/load-work` | 装载作品到窑次（带校验） |
| DELETE | `/api/v1/kiln-sessions/loadings/{id}` | 从窑次卸载作品 |
| POST | `/api/v1/kiln-sessions/{id}/start-firing` | 开始烧成 |
| POST | `/api/v1/kiln-sessions/{id}/complete-firing` | 完成烧成并记录结果 |

### 报告管理 (Reports)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/reports/delayed-works` | 查询延期作品名单 |
| GET | `/api/v1/reports/handover` | 导出 Markdown 格式交接报告 |

## 数据模型

### 作品 (Work)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| student_name | String | 学员姓名 |
| work_description | Text | 作品描述 |
| dryness_status | Enum | 干燥状态: not_dry / partially_dry / dry |
| glaze_type | String | 釉料类型 |
| expected_pickup_date | Date | 期望取件日期 |
| temperature_zone | String | 温区: low / mid / high |

### 窑次 (KilnSession)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| session_name | String | 窑次名称 |
| target_temperature_zone | String | 目标温区 |
| scheduled_firing_date | Date | 计划烧成日期 |
| max_capacity | Integer | 最大容量（件数） |
| is_fired | Boolean | 是否已烧成 |
| firing_result | Enum | 烧成结果: success / partial_success / failure |

### 装载记录 (KilnLoading)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| work_id | Integer | 作品 ID (外键) |
| kiln_session_id | Integer | 窑次 ID (外键) |
| position_notes | Text | 位置备注 |
| loading_order | Integer | 装载顺序 |

## 校验规则说明

### 1. 温区冲突校验
- 作品的 `temperature_zone` 必须与窑次的 `target_temperature_zone` 完全匹配
- 例如：高温区作品不能放入中温窑次

### 2. 未干透校验
- 只有 `dryness_status = dry`（已干透）的作品才能入窑
- `not_dry` 和 `partially_dry` 状态会被拒绝

### 3. 釉料不兼容校验
- 根据配置检查釉料组合是否兼容
- 默认不兼容组合：
  - `lead_based` ↔ `copper_based`, `alkali_based`
  - `copper_based` ↔ `lead_based`, `manganese_based`
  - `manganese_based` ↔ `copper_based`, `zinc_based`
  - `zinc_based` ↔ `manganese_based`, `alkali_based`
  - `alkali_based` ↔ `lead_based`, `zinc_based`

### 4. 超载校验
- 窑次装载量不能超过 `max_capacity`

### 5. 插队风险提示
- 如果存在更早的可用窑次（未烧成、未满载），会给出警告但不阻止操作

## 配置说明

主要配置位于 `app/config.py`：

```python
KILN_MAX_CAPACITY = 50  # 默认最大容量
TEMPERATURE_ZONES = ["low", "mid", "high"]  # 可用温区
GLAZE_INCOMPATIBILITIES = {...}  # 釉料不兼容规则
```

也可以通过 `.env` 文件覆盖配置：

```env
DEBUG=false
DATABASE_URL=sqlite+aiosqlite:///./production.db
KILN_MAX_CAPACITY=60
```

## 测试

### 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest -v
```

### 测试内容

- 作品 CRUD 操作
- 窑次 CRUD 操作
- 拼窑校验逻辑（温区、干燥、釉料、容量）
- 烧成流程
- 报告导出

## 使用示例

### 1. 创建一个作品

```bash
curl -X POST "http://localhost:8000/api/v1/works" \
  -H "Content-Type: application/json" \
  -d '{
    "student_name": "张三",
    "work_description": "手工茶杯",
    "dryness_status": "dry",
    "glaze_type": "lead_based",
    "expected_pickup_date": "2026-05-10",
    "temperature_zone": "mid"
  }'
```

### 2. 创建一个窑次

```bash
curl -X POST "http://localhost:8000/api/v1/kiln-sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "2026-05-05-中温窑",
    "target_temperature_zone": "mid",
    "scheduled_firing_date": "2026-05-05",
    "max_capacity": 50
  }'
```

### 3. 装载作品到窑次

```bash
curl -X POST "http://localhost:8000/api/v1/kiln-sessions/load-work" \
  -H "Content-Type: application/json" \
  -d '{
    "work_id": 1,
    "kiln_session_id": 1,
    "position_notes": "窑位前排",
    "loading_order": 1
  }'
```

### 4. 导出交接报告

```bash
curl "http://localhost:8000/api/v1/reports/handover"
```

### 5. 查询延期作品

```bash
curl "http://localhost:8000/api/v1/reports/delayed-works"
```

## 项目结构

```
xy4337/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主应用
│   ├── config.py            # 配置文件
│   ├── database.py          # 数据库连接配置
│   ├── models.py            # SQLAlchemy 模型
│   ├── schemas.py           # Pydantic 数据模型
│   ├── validators.py        # 业务校验逻辑
│   └── routers/
│       ├── __init__.py
│       ├── works.py         # 作品管理路由
│       ├── kiln_sessions.py # 窑次管理路由
│       └── reports.py       # 报告路由
├── sample_data.py           # 示例数据脚本
├── pyproject.toml           # 项目依赖配置
└── README.md                # 本文档
```

## 许可证

MIT License
