# LoadTest Review API - 压测复盘后端服务

一个统一管理压测项目、批次、指标、调优动作的纯后端 API 服务。

## 功能特性

### 核心实体管理
- **压测项目**: 创建和管理多个压测项目，支持多环境
- **接口清单**: 管理被测接口，支持批量导入
- **流量模型**: 定义压测流量特征（用户数、持续时间、分布模式）
- **压测批次**: 记录每次压测的详细数据，支持 k6/JMeter 摘要解析
- **机器容量**: 管理服务器硬件配置信息
- **监控快照**: 记录压测期间的系统监控数据（CPU、内存、磁盘、网络、JVM、数据库）
- **调优动作**: 跟踪从问题发现到验证的完整调优生命周期

### 自动指标计算
- 百分位计算: P50/P90/P95/P99 响应时间
- 吞吐量: QPS/TPS 自动计算
- 错误率: 基于请求总数和错误数计算
- 容量水位: 结合机器配置和监控数据评估

### 基线与 SLO
- **基线比较**: 对比两轮压测的指标差异，识别改善/退化
- **SLO 评估**: 基于阈值自动判断压测结果是否准入
- **显著变化检测**: 配置化的阈值判断是否为显著变化

### 瓶颈分析
- 自动识别 CPU/内存/数据库/缓存/网络瓶颈
- 基于监控数据给出瓶颈解释
- 生成下一轮压测方案建议

### 调优动作跟踪
- 状态机驱动: pending -> in_progress -> implemented -> verified
- 支持拒绝和恢复流程
- 支持按状态、优先级统计

### 报告导出
- Markdown 格式: 适合人工阅读和分享
- JSON 格式: 适合程序处理和集成

## 技术栈

- **框架**: FastAPI 0.109.0
- **ORM**: SQLAlchemy 2.0.25
- **数据验证**: Pydantic 2.5.3
- **数据库**: SQLite (可切换至 PostgreSQL/MySQL)
- **测试**: pytest + httpx

## 项目结构

```
zy1212/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置管理
│   ├── database.py             # 数据库连接
│   ├── seed.py                 # 种子数据
│   ├── api/                    # API 路由
│   │   ├── __init__.py
│   │   ├── projects.py         # 项目管理
│   │   ├── interfaces.py       # 接口清单
│   │   ├── traffic_models.py   # 流量模型
│   │   ├── load_test_batches.py # 压测批次
│   │   ├── machine_capacities.py # 机器容量
│   │   ├── monitoring_snapshots.py # 监控快照
│   │   ├── optimization_actions.py # 调优动作
│   │   └── reports.py          # 报告生成
│   ├── models/                 # SQLAlchemy 模型
│   │   ├── __init__.py
│   │   ├── project.py
│   │   ├── interface.py
│   │   ├── traffic_model.py
│   │   ├── load_test_batch.py
│   │   ├── machine_capacity.py
│   │   ├── monitoring_snapshot.py
│   │   └── optimization_action.py
│   ├── schemas/                # Pydantic Schema
│   │   ├── __init__.py
│   │   ├── common.py           # 通用枚举和类型
│   │   ├── project.py
│   │   ├── interface.py
│   │   ├── traffic_model.py
│   │   ├── load_test_batch.py
│   │   ├── machine_capacity.py
│   │   ├── monitoring_snapshot.py
│   │   ├── optimization_action.py
│   │   └── report.py
│   └── services/               # 核心业务服务
│       ├── __init__.py
│       ├── metrics_calculator.py    # 指标计算
│       ├── baseline_comparator.py   # 基线比较
│       ├── slo_evaluator.py         # SLO 评估
│       ├── bottleneck_analyzer.py   # 瓶颈分析
│       └── report_generator.py      # 报告生成
├── tests/                  # 测试文件
│   ├── __init__.py
│   ├── conftest.py        # pytest fixtures
│   ├── test_api.py         # API 测试
│   ├── test_services.py    # 服务测试
│   ├── test_validation.py  # 参数校验测试
│   └── test_metrics_calculator.py # 指标计算测试
├── requirements.txt        # 依赖列表
└── README.md
```

## 快速开始

### 环境要求

- Python 3.10+
- pip

### 安装

1. 克隆仓库并进入目录:

```bash
cd /Users/lzy/pro/solocoder/pro/zy1212/repo/zy1212
```

2. 创建虚拟环境:

```bash
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# 或
.venv\Scripts\activate  # Windows
```

3. 安装依赖:

```bash
pip install -r requirements.txt
```

### 运行服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

### 加载种子数据

```bash
python -m app.seed
```

这会创建一个完整的示例数据集:
- 1 个压测项目
- 4 个接口
- 1 个流量模型
- 2 个压测批次（优化前后对比）
- 4 台机器容量信息
- 4 条监控快照
- 4 个调优动作（不同状态）

### 运行测试

```bash
pytest tests/ -v
```

或运行带覆盖率的测试:

```bash
pytest tests/ -v --cov=app
```

## API 端点

### 项目管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/projects/ | 创建项目 |
| GET | /api/v1/projects/ | 列出项目（支持分页和筛选） |
| GET | /api/v1/projects/{id} | 获取单个项目 |
| PUT | /api/v1/projects/{id} | 更新项目 |
| DELETE | /api/v1/projects/{id} | 删除项目 |

### 接口清单

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/projects/{project_id}/interfaces/ | 创建接口 |
| POST | /api/v1/projects/{project_id}/interfaces/batch-import | 批量导入接口 |
| GET | /api/v1/projects/{project_id}/interfaces/ | 列出接口 |
| GET | /api/v1/interfaces/{id} | 获取单个接口 |
| PUT | /api/v1/interfaces/{id} | 更新接口 |
| DELETE | /api/v1/interfaces/{id} | 删除接口 |

### 流量模型

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/projects/{project_id}/traffic-models/ | 创建流量模型 |
| GET | /api/v1/projects/{project_id}/traffic-models/ | 列出流量模型 |
| GET | /api/v1/traffic-models/{id} | 获取单个流量模型 |
| PUT | /api/v1/traffic-models/{id} | 更新流量模型 |
| DELETE | /api/v1/traffic-models/{id} | 删除流量模型 |

### 压测批次

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/projects/{project_id}/load-test-batches/ | 创建批次 |
| POST | /api/v1/projects/{project_id}/load-test-batches/import-raw | 导入原始数据（自动计算指标） |
| GET | /api/v1/projects/{project_id}/load-test-batches/ | 列出批次 |
| GET | /api/v1/load-test-batches/{id} | 获取单个批次 |
| PUT | /api/v1/load-test-batches/{id} | 更新批次 |
| DELETE | /api/v1/load-test-batches/{id} | 删除批次 |
| POST | /api/v1/load-test-batches/compare | 比较两个批次 |
| POST | /api/v1/load-test-batches/{id}/evaluate-slo | SLO 评估 |
| POST | /api/v1/load-test-batches/{id}/analyze-bottlenecks | 瓶颈分析 |

### 报告生成

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/reports/generate | 生成报告（支持 Markdown/JSON） |

支持的报告类型:
- `batch_summary`: 批次摘要报告
- `baseline_comparison`: 基线对比报告
- `project_summary`: 项目摘要报告
- `optimization_tracking`: 调优跟踪报告
- `full_review`: 完整复盘报告

## 参数校验示例

### 项目创建

```json
{
  "name": "订单服务压测",
  "service_name": "order-service",
  "environment": "production",
  "description": "订单服务性能压测"
}
```

**校验规则**:
- `name`: 必填，1-200 字符
- `service_name`: 必填，1-100 字符
- `environment`: 可选，枚举值: `development`, `staging`, `production`

### 接口创建

```json
{
  "name": "创建订单",
  "path": "/api/v1/orders",
  "method": "POST",
  "expected_qps": 500,
  "expected_avg_latency_ms": 100
}
```

**校验规则**:
- `path`: 必须以 `/` 开头
- `method`: 枚举值: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`
- `expected_qps`: >= 0

### 压测批次

```json
{
  "name": "V1.0.0 基线压测",
  "test_type": "baseline",
  "status": "completed",
  "qps": 500.0,
  "avg_response_time_ms": 100.0,
  "p50_response_time_ms": 80.0,
  "p95_response_time_ms": 200.0,
  "p99_response_time_ms": 400.0,
  "error_rate": 0.005
}
```

**校验规则**:
- `error_rate`: 0.0 - 1.0 (百分比)
- `qps`: >= 0.0
- 百分位顺序: P50 <= P90 <= P95 <= P99

### 导入原始响应时间数据

```json
{
  "name": "从原始数据导入",
  "test_type": "regression",
  "raw_response_times": [50, 60, 70, 80, 90, 100, 150, 200, 300, 500],
  "duration_seconds": 60,
  "total_requests": 1000,
  "total_errors": 10
}
```

系统会自动计算:
- P50/P95/P99 百分位
- 平均/最小/最大响应时间
- QPS/TPS
- 错误率

## 调优动作状态机

```
pending ──────┐
   │          │
   ├► in_progress ──► implemented ──► verified
   │          │
   └► rejected ◄─────┘
```

**有效转换**:
- `pending` -> `in_progress`
- `pending` -> `rejected`
- `in_progress` -> `implemented`
- `in_progress` -> `rejected`
- `rejected` -> `pending`
- `rejected` -> `in_progress`
- `implemented` -> `verified`

## 瓶颈分析规则

系统会根据以下规则自动识别瓶颈:

| 瓶颈类型 | 触发条件 |
|----------|----------|
| CPU 瓶颈 | CPU 利用率 > 80% 或 负载 > 核数 * 0.7 |
| 内存瓶颈 | 内存利用率 > 85% |
| 数据库瓶颈 | 数据库查询延迟 > 100ms 或 活跃连接过高 |
| 缓存瓶颈 | 缓存命中率 < 80% |
| 错误率瓶颈 | 错误率 > 0.01 |
| 响应时间瓶颈 | P99 > 500ms 或 平均响应时间 > 200ms |

## SLO 评估配置

```json
{
  "min_qps": 500.0,
  "min_qps_warning": 600.0,
  "max_avg_latency_ms": 200.0,
  "max_avg_latency_warning_ms": 150.0,
  "max_p95_latency_ms": 300.0,
  "max_p99_latency_ms": 500.0,
  "max_error_rate": 0.01,
  "max_error_rate_warning": 0.005
}
```

**评估结果**:
- `PASS`: 所有条件通过
- `WARNING`: 有警告条件触发
- `FAIL`: 有失败条件触发

## 报告示例

### Markdown 报告示例

```markdown
# 压测批次摘要报告

## 基本信息
- **批次名称**: V1.1.0 优化后压测
- **测试类型**: regression
- **状态**: completed

## 核心指标
| 指标 | 值 |
|------|-----|
| QPS | 720.0 |
| 平均响应时间 | 85.0 ms |
| P95 | 180.0 ms |
| P99 | 320.0 ms |
| 错误率 | 0.10% |

## 调优动作
- [已验证] 优化数据库连接池配置
- [已验证] 引入 Redis 缓存热点数据
- [进行中] 优化 SQL 查询语句
- [待处理] 增加应用服务器数量
```

## 配置

通过 `.env` 文件或环境变量配置:

```env
APP_NAME=LoadTest Review API
APP_VERSION=1.0.0
DEBUG=True
DATABASE_URL=sqlite:///./loadtest_review.db
```

## 切换至 PostgreSQL

修改 `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/loadtest_review
```

并安装依赖:

```bash
pip install psycopg2-binary
```

## 许可证

MIT License
