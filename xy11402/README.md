# 冷链中转重试补偿队列 API

处理冷链中转赔付的重试补偿队列，支持外部回执、限次重试、人工接管、补偿入账。

## 核心特性

- **幂等性保证**: 重复请求只更新同一条事实，不会重复计算
- **原始证据保留**: 导入时保留来源文件、原始行号、原始值和解析值
- **状态机控制**: 排队 → 处理中 → 等待重试/等待人工 → 补偿入账/关闭
- **自动重试**: 失败任务自动重试，达到上限转人工
- **任务分类**: 网络错误、数据不完整、跨日签收、箱号改名、回执延迟
- **运营视图**: 可重试分类统计、死信处理、恢复待续跑
- **Excel导出**: 支持任务列表、死信队列、待重试任务导出

## 项目结构

```
.
├── app/
│   ├── api/              # API 路由
│   │   ├── tasks.py      # 任务管理接口
│   │   └── reports.py    # 报表导出接口
│   ├── models/           # 数据模型
│   │   ├── enums.py      # 枚举定义
│   │   └── task.py       # 任务/证据/日志模型
│   ├── schemas/          # Pydantic 模式
│   │   └── task.py       # 请求/响应模式
│   ├── services/         # 业务逻辑
│   │   ├── task_service.py    # 任务状态机
│   │   ├── import_service.py  # 数据导入
│   │   ├── report_service.py  # 报表导出
│   │   └── scheduler.py       # 调度器
│   ├── config.py         # 配置
│   ├── database.py       # 数据库连接
│   └── main.py           # 应用入口
├── tests/                # 测试用例
├── sample_data/          # 样例数据
└── requirements.txt      # 依赖列表
```

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 从空库启动

首次启动会自动创建数据库表结构：

```bash
# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看 Swagger 文档。

### 3. 准备样例数据

项目自带样例数据：

- `sample_data/sample_tasks.json` - 司机照片样例
- `sample_data/wms_boxes.csv` - WMS 箱号表样例

### 4. 走主流程

#### 步骤 1: 导入数据

**方式一: JSON 导入**

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/import/json?source=driver_photo&source_file=sample_tasks.json" \
  -H "Content-Type: application/json" \
  -d @sample_data/sample_tasks.json
```

**方式二: CSV 导入**

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/import/file?source=wms_box" \
  -F "file=@sample_data/wms_boxes.csv"
```

#### 步骤 2: 查看任务列表

```bash
# 查看所有任务
curl "http://localhost:8000/api/v1/tasks/"

# 按状态筛选
curl "http://localhost:8000/api/v1/tasks/?status=pending"
```

#### 步骤 3: 提交外部回执

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/submit-receipt" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "receipt-20240115-001",
    "source": "driver_photo",
    "source_file": "driver_app_receipt.json",
    "source_row_no": 1,
    "box_no": "BOX-TEST-001",
    "driver_id": "DRV-001",
    "original_data": {"box_no": "BOX-TEST-001", "temp": "-18"},
    "compensation_amount": 50.0
  }'
```

#### 步骤 4: 补偿入账

```bash
# 先获取任务 ID
TASK_ID=1

curl -X POST "http://localhost:8000/api/v1/tasks/${TASK_ID}/compensate" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "finance_001",
    "compensation_amount": 150.0,
    "remark": "审核通过"
  }'
```

#### 步骤 5: 关闭任务

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/${TASK_ID}/close" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin_001",
    "remark": "流程完成"
  }'
```

### 5. 制造异常场景

#### 场景 1: 模拟处理失败 → 等待重试

通过多次调用来观察状态变化（需要在代码中触发失败）：

```python
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.task_service import handle_processing_failure, get_task_by_id
from app.models.enums import RetryCategory

db = SessionLocal()
task = get_task_by_id(db, 1)
task = handle_processing_failure(db, task, "网络连接超时", RetryCategory.NETWORK_ERROR)
print(f"状态: {task.status}, 重试次数: {task.retry_count}")
```

#### 场景 2: 重试次数超限 → 等待人工

```python
# 连续失败 3 次
for i in range(3):
    task = handle_processing_failure(db, task, "处理失败", RetryCategory.DATA_INCOMPLETE)
    print(f"第{i+1}次失败后状态: {task.status}")
```

#### 场景 3: 标记为死信（永久失败）

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/${TASK_ID}/mark-permanent-failed?operator=admin&remark=数据无法恢复"
```

#### 场景 4: 测试幂等性

重复提交相同请求：

```bash
# 第一次提交
curl -X POST "http://localhost:8000/api/v1/tasks/submit-receipt" \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key": "idem-test-001", "source": "driver_photo", "source_file": "test.json", "box_no": "IDEM-001", "original_data": {}, "compensation_amount": 0}'

# 第二次提交（返回相同任务）
curl -X POST "http://localhost:8000/api/v1/tasks/submit-receipt" \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key": "idem-test-001", "source": "driver_photo", "source_file": "test.json", "box_no": "IDEM-001", "original_data": {}, "compensation_amount": 0}'
```

### 6. 查看运营数据和导出

#### 查看运营仪表盘

```bash
curl "http://localhost:8000/api/v1/reports/dashboard"
```

返回示例：
```json
{
  "status_overview": {
    "pending": 5,
    "processing": 2,
    "waiting_retry": 3,
    "waiting_manual": 1,
    "permanent_failed": 0,
    "compensated": 10,
    "closed": 8
  },
  "retry_category_stats": {
    "total_waiting": 4,
    "by_category": {
      "network_error": 2,
      "data_incomplete": 1,
      "cross_day_sign": 1
    }
  },
  "dead_letter_stats": {
    "total": 0
  },
  "recovery_pending_stats": {
    "pending_retry_count": 3,
    "overdue_count": 0
  }
}
```

#### 导出 Excel

```bash
# 导出所有任务
curl -o tasks.xlsx "http://localhost:8000/api/v1/reports/export/tasks"

# 导出死信队列
curl -o dead_letter.xlsx "http://localhost:8000/api/v1/reports/export/dead-letter"

# 导出待重试任务
curl -o retry_tasks.xlsx "http://localhost:8000/api/v1/reports/export/retry-tasks"
```

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行幂等性测试
pytest tests/test_idempotency.py -v

# 运行状态流转测试
pytest tests/test_status_transitions.py -v
```

## 状态流转图

```
                    ┌─────────────┐
                    │   PENDING   │  排队中
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ PROCESSING  │  处理中
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │WAITING_RETRY│ │WAITING_MANUA│ │ COMPENSATED │  补偿入账
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │                │                │
           │ 重试成功       │ 人工处理       │
           └────────┬───────┘                │
                    │                        │
                    ▼                        ▼
              ┌───────────┐           ┌───────────┐
              │PERMANENT_ │           │  CLOSED   │  关闭
              │  FAILED   │           └───────────┘
              └───────────┘
                 死信队列
```

## 状态说明

| 状态 | 说明 | 可操作 |
|------|------|--------|
| pending | 排队中，等待处理 | 开始处理 |
| processing | 处理中 | 成功/失败 |
| waiting_retry | 等待重试 | 自动/手动重试 |
| waiting_manual | 等待人工处理 | 人工接管/补偿/关闭 |
| permanent_failed | 永久失败（死信） | 查看/导出 |
| compensated | 已补偿入账 | 关闭 |
| closed | 已关闭 | - |

## 重试分类

- `network_error`: 网络错误
- `data_incomplete`: 数据不完整
- `cross_day_sign`: 跨日签收
- `box_rename`: 箱号改名
- `receipt_delayed`: 回执延迟
- `other`: 其他

## API 接口清单

### 任务管理

- `POST /api/v1/tasks/` - 创建任务
- `POST /api/v1/tasks/submit-receipt` - 提交回执
- `GET /api/v1/tasks/` - 任务列表
- `GET /api/v1/tasks/{id}` - 任务详情
- `POST /api/v1/tasks/{id}/retry` - 重试
- `POST /api/v1/tasks/{id}/manual-takeover` - 人工接管
- `POST /api/v1/tasks/{id}/compensate` - 补偿入账
- `POST /api/v1/tasks/{id}/close` - 关闭
- `POST /api/v1/tasks/{id}/mark-permanent-failed` - 标记死信

### 数据导入

- `POST /api/v1/tasks/import/file` - 文件导入（Excel/CSV）
- `POST /api/v1/tasks/import/json` - JSON 导入

### 报表导出

- `GET /api/v1/reports/dashboard` - 运营仪表盘
- `GET /api/v1/reports/export/tasks` - 导出任务列表
- `GET /api/v1/reports/export/dead-letter` - 导出死信
- `GET /api/v1/reports/export/retry-tasks` - 导出待重试

## 配置说明

在 `.env` 文件中配置：

```
DATABASE_URL=sqlite:///./cold_chain.db
MAX_RETRY_COUNT=3
RETRY_INTERVAL_MINUTES=5
SCHEDULER_ENABLED=true
```
