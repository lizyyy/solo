# 港口调度对账服务

船期、泊位、潮汐自动比对与人工复核系统

## 功能特性

### 1. **数据导入**
- 船期CSV导入（支持中英文表头）
- 泊位JSON导入
- 潮汐CSV导入

### 2. **自动比对算法**
- 吃水限制校验（基准水深+潮汐高度）
- 泊位可用性检查
- 装卸窗口计算
- 跨日作业预警
- 临时插队船舶检测
- 潮汐变化跟踪
- 差异原因自动解释

### 3. **人工复核流程**
- 单条/批量复核
- 支持通过/拒绝/需补充信息/强制放行
- 复核意见记录
- 复核历史追踪
- 数据修改后重新计算
- 差异标记已解决

### 4. **报告导出**
- 汇总报告（统计数据、差异分类）
- 详细报告（每条记录+差异详情+复核历史）
- CSV导出
- Excel多工作表导出

## 技术栈

- **后端框架**: FastAPI
- **数据库**: SQLAlchemy + SQLite
- **数据处理**: Pandas
- **Excel导出**: openpyxl

## 快速开始

### 1. 安装依赖

```bash
pip install fastapi uvicorn sqlalchemy pandas openpyxl python-multipart python-dotenv pytz
```

或使用 Poetry:
```bash
poetry install
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 使用流程

### 1. 导入示例数据

```bash
# 导入船期
curl -X POST "http://localhost:8000/api/v1/import/vessel-schedule" \
  -F "file=@examples/vessel_schedule.csv"

# 导入泊位
curl -X POST "http://localhost:8000/api/v1/import/berth" \
  -F "file=@examples/berths.json"

# 导入潮汐
curl -X POST "http://localhost:8000/api/v1/import/tide" \
  -F "file=@examples/tide.csv"
```

### 2. 运行自动对账

```bash
# 先创建对账批次
curl -X POST "http://localhost:8000/api/v1/batch/create?name=202405对账"

# 运行对账
curl -X POST "http://localhost:8000/api/v1/reconciliation/run/{batch_id}"
```

### 3. 查询对账结果

```bash
# 获取批次详情
curl "http://localhost:8000/api/v1/reconciliation/batch/{batch_id}"

# 获取单条记录详情
curl "http://localhost:8000/api/v1/reconciliation/record/{record_id}"
```

### 4. 人工复核

```bash
# 复核单条记录
curl -X POST "http://localhost:8000/api/v1/review/record/1" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve",
    "notes": "经确认可安全靠泊",
    "reviewer": "调度员A"
  }'

# 批量复核
curl -X POST "http://localhost:8000/api/v1/review/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "record_ids": [1, 2, 3],
    "decision": "approve",
    "reviewer": "调度员A"
  }'
```

### 4.5 修改数据并重新计算

当人工复核发现数据需要修正时，可通过此接口修改船期数据并自动触发重新对账：

```bash
# 修改吃水深度并重新计算
curl -X POST "http://localhost:8000/api/v1/record/1/update-and-recalculate" \
  -H "Content-Type: application/json" \
  -d '{
    "draft": 14.0,
    "operator": "调度员A"
  }'

# 查看单条船期详情
curl "http://localhost:8000/api/v1/vessel/1"
```

### 5. 导出报告

```bash
# 导出CSV
curl "http://localhost:8000/api/v1/report/export/csv/{batch_id}"

# 导出Excel
curl "http://localhost:8000/api/v1/report/export/excel/{batch_id}"
```

## 差异类型说明

| 差异类型 | 说明 |
|---------|------|
| draft_exceeds_depth | 吃水超过可用水深 |
| window_conflict | 作业窗口冲突 |
| cut_in_detected | 检测到插队船舶 |
| berth_unavailable | 泊位不可用 |
| cross_day_window | 跨日作业窗口 |
| tide_insufficient | 水深余量不足 |
| vessel_length_exceeded | 船舶长度超限 |
| cargo_type_restricted | 货物类型受限 |

## 复核决策说明

| 决策 | 说明 |
|-----|------|
| approve | 复核通过 |
| reject | 拒绝靠泊申请 |
| need_info | 需要补充材料 |
| override | 强制放行（需说明原因） |

## 项目结构

```
port-reconciliation-service/
├── app/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py          # API路由
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py          # 配置管理
│   │   └── database.py        # 数据库连接
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py          # 基础模型
│   │   ├── vessel.py        # 船期模型
│   │   ├── berth.py         # 泊位模型
│   │   ├── tide.py          # 潮汐模型
│   │   ├── reconciliation.py # 对账模型
│   │   └── audit.py         # 审计日志
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py        # 通用Schema
│   │   ├── vessel.py        # 船期Schema
│   │   ├── berth.py         # 泊位Schema
│   │   ├── tide.py          # 潮汐Schema
│   │   └── reconciliation.py # 对账Schema
│   └── services/
│       ├── __init__.py
│       ├── import_service.py      # 数据导入服务
│       ├── reconciliation_service.py # 对账服务
│       ├── review_service.py   # 复核服务
│       └── report_service.py  # 报告服务
├── examples/
│   ├── vessel_schedule.csv  # 船期示例
│   ├── berths.json        # 泊位示例
│   └── tide.csv            # 潮汐示例
├── exports/                  # 导出文件目录
├── main.py                   # 主程序入口
├── pyproject.toml            # 项目配置
└── README.md
```

## 配置说明

复制 `.env.example` 为 `.env` 并根据需要修改配置：

```env
DATABASE_URL=sqlite:///./port_reconciliation.db
TIMEZONE=Asia/Shanghai
MAX_UPLOAD_SIZE=10485760
EXPORT_DIR=./exports
```

## 数据字典

### 船期字段说明

| 字段 | 说明 |
|-----|------|
| vessel_name | 船名 |
| vessel_imo | IMO编号 |
| voyage_number | 航次 |
| draft | 吃水(米) |
| eta | 预计到港时间 |
| etd | 预计离港时间 |
| berth_number | 泊位号 |
| is_cut_in | 是否插队 |

### 对账状态说明

| 状态 | 说明 |
|-----|------|
| pending | 待处理 |
| auto_checked | 已自动检查 |
| reviewing | 复核中 |
| approved | 已通过 |
| rejected | 已拒绝 |
| needs_more_info | 需补充材料 |

## 注意事项

1. 首次启动时自动创建数据库表
2. 导出文件默认保存在 `exports/` 目录
3. 支持中文表头的CSV文件需使用UTF-8编码
4. 时间格式支持多种格式自动解析

## 许可证

MIT License
