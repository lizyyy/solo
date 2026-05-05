# DB Performance Diagnostics API

一个纯后端的数据库性能诊断 API 服务，用于分析数据库性能问题并提供优化建议。

## 功能特性

### 六大诊断分析
- **连接池容量分析** - 分析连接池配置、使用率、闲置连接等问题
- **批量写入收益分析** - 对比单条插入与批量写入的性能差异
- **索引缺失/冗余分析** - 识别缺失索引、冗余索引和未使用索引
- **慢 SQL 分析** - 解析慢查询日志，识别性能瓶颈
- **读写分离路由分析** - 分析读写分离配置和路由效率
- **分库分表热点分析** - 识别数据热点和查询热点

### 核心功能
- **创建诊断案例** - 导入 db-profile、schema.sql、slow-sql.log、批量写入样例
- **启动分析任务** - 执行全部或指定类型的诊断分析
- **查看诊断结果** - 获取详细的问题发现和优化建议
- **对比两套配置** - 对比优化前后的性能差异，找出最优方案
- **导出报告** - 支持导出 JSON、Markdown、HTML 格式的诊断报告

## 技术栈

- **后端框架**: FastAPI (Python)
- **数据库**: SQLite (可扩展支持 PostgreSQL/MySQL)
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic
- **测试**: pytest + httpx

## 快速开始

### 环境准备

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 启动服务

```bash
# 初始化数据库并导入示例数据（可选）
python -c "from app.seed import init_database, seed_sample_tasks; init_database(); seed_sample_tasks()"

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- Redoc 文档: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

### 运行测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试文件
pytest tests/test_tasks.py -v

# 生成覆盖率报告
pytest --cov=app -v
```

## API 接口

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/tasks` | 创建新任务 |
| GET | `/api/v1/tasks` | 获取任务列表（分页） |
| GET | `/api/v1/tasks/{task_id}` | 获取任务详情 |
| PUT | `/api/v1/tasks/{task_id}` | 更新任务 |
| DELETE | `/api/v1/tasks/{task_id}` | 删除任务 |
| POST | `/api/v1/tasks/{task_id}/snapshots` | 添加输入快照 |
| GET | `/api/v1/tasks/{task_id}/snapshots` | 获取任务快照列表 |
| GET | `/api/v1/tasks/{task_id}/summary` | 获取任务分析摘要 |

### 分析执行

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/analysis/{task_id}/run` | 执行诊断分析 |
| GET | `/api/v1/analysis/{task_id}/results` | 获取分析结果 |
| GET | `/api/v1/analysis/results/{result_id}` | 获取单个结果详情 |
| GET | `/api/v1/analysis/types` | 获取可用分析类型 |

### 报告导出

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/exports` | 创建导出任务 |
| GET | `/api/v1/exports` | 获取导出记录列表 |
| GET | `/api/v1/exports/{export_id}` | 获取导出记录详情 |
| GET | `/api/v1/exports/{export_id}/download` | 下载导出文件 |
| DELETE | `/api/v1/exports/{export_id}` | 删除导出记录 |

### 对比分析

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/comparisons` | 对比多个任务 |
| GET | `/api/v1/comparisons/best` | 获取最优任务 |
| POST | `/api/v1/comparisons/export` | 导出对比报告 |

## 使用示例

### 创建诊断任务

```bash
# 创建任务
curl -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单系统性能诊断",
    "description": "对订单系统的数据库性能进行全面诊断",
    "config": {
      "enabled_analyses": ["connection_pool", "index_analysis", "slow_sql"]
    }
  }'
```

### 添加输入快照

```bash
# 添加 db_profile 快照
curl -X POST http://localhost:8000/api/v1/tasks/1/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_type": "db_profile",
    "content": "{\"max_connections\": 200, \"current_connections\": 180, \"wait_timeout\": 100}",
    "metadata": {"source": "production_monitor"}
  }'

# 添加 slow_sql_log 快照
curl -X POST http://localhost:8000/api/v1/tasks/1/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_type": "slow_sql_log",
    "content": "# Time: 2024-01-15T10:05:00\n# Query_time: 12.3456  Lock_time: 0.0012  Rows_sent: 1  Rows_examined: 100000\nSELECT * FROM orders WHERE status = 1;",
    "metadata": {"source": "slow_query_log"}
  }'
```

### 执行分析

```bash
curl -X POST http://localhost:8000/api/v1/analysis/1/run
```

### 导出报告

```bash
# 导出 JSON 格式
curl -X POST http://localhost:8000/api/v1/exports \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1,
    "format": "json",
    "include_metrics": true,
    "include_recommendations": true
  }'

# 导出 Markdown 格式
curl -X POST http://localhost:8000/api/v1/exports \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1,
    "format": "markdown"
  }'
```

### 对比多个任务

```bash
curl -X POST http://localhost:8000/api/v1/comparisons \
  -H "Content-Type: application/json" \
  -d '{
    "task_ids": [1, 2],
    "include_metrics": true,
    "include_recommendations": true
  }'
```

## 项目结构

```
zy1209/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置管理
│   ├── database.py             # 数据库连接
│   ├── exceptions.py           # 自定义异常
│   ├── models/
│   │   ├── __init__.py
│   │   ├── enums.py            # 枚举定义
│   │   └── task.py             # SQLAlchemy 模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py           # 通用响应模型
│   │   ├── task.py             # 任务相关 Pydantic 模型
│   │   ├── analysis.py         # 分析配置模型
│   │   ├── comparison.py       # 对比分析模型
│   │   └── export.py           # 导出相关模型
│   ├── analyzers/
│   │   ├── __init__.py
│   │   ├── base.py             # 分析器基类
│   │   ├── registry.py         # 分析器注册
│   │   ├── connection_pool.py  # 连接池分析器
│   │   ├── batch_write.py      # 批量写入分析器
│   │   ├── index_analysis.py   # 索引分析器
│   │   ├── slow_sql.py         # 慢SQL分析器
│   │   ├── read_write_split.py # 读写分离分析器
│   │   └── sharding_hotspot.py # 分库分表热点分析器
│   ├── services/
│   │   ├── __init__.py
│   │   ├── task_service.py     # 任务服务
│   │   ├── analysis_service.py # 分析服务
│   │   ├── export_service.py   # 导出服务
│   │   └── comparison_service.py # 对比服务
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── tasks.py            # 任务路由
│   │   ├── analysis.py         # 分析路由
│   │   ├── exports.py          # 导出路由
│   │   └── comparisons.py      # 对比路由
│   └── seed.py                 # 示例数据生成
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # pytest 配置
│   ├── test_tasks.py           # 任务测试
│   ├── test_analysis.py        # 分析测试
│   ├── test_export.py          # 导出测试
│   └── test_comparison.py      # 对比测试
├── requirements.txt            # 依赖列表
└── README.md                   # 本文档
```

## 输入快照类型

| 类型 | 描述 | 示例内容 |
|------|------|----------|
| `db_profile` | 数据库性能配置文件 | JSON 格式的连接池、读写分离、分库分表配置 |
| `schema_sql` | 数据库表结构 | CREATE TABLE 语句 |
| `slow_sql_log` | 慢查询日志 | MySQL 格式的慢查询日志 |
| `batch_write_sample` | 批量写入样例 | JSON 格式的批量写入性能数据 |

## 诊断分析详情

### 连接池容量分析
- 检查连接池使用率是否过高
- 检查等待超时时间配置
- 检查最大连接数配置是否合理
- 检测闲置连接过多的问题

### 批量写入收益分析
- 对比单条插入与批量写入的性能差异
- 分析批量大小是否合理
- 计算时间节省比例和吞吐量提升

### 索引分析
- 分析缺失索引（基于慢查询日志）
- 识别冗余索引（相同列的多个索引）
- 检测前缀冗余索引
- 分析未使用的索引

### 慢 SQL 分析
- 解析慢查询日志
- 统计慢查询数量和执行时间分布
- 识别高频慢查询模式
- 检测疑似全表扫描的查询

### 读写分离路由分析
- 检查从库利用率
- 检测读请求路由错误
- 分析主从延迟
- 检查从库可用性

### 分库分表热点分析
- 分析数据分布均衡性
- 检测数据热点分片
- 分析查询分布均衡性
- 检测查询热点分片

## 配置说明

可以通过环境变量或 `.env` 文件配置：

```env
# 应用配置
APP_NAME=DB Performance Diagnostics API
APP_VERSION=1.0.0
DEBUG=False

# 数据库配置
DATABASE_URL=sqlite:///./db_diagnostics.db

# 目录配置
UPLOAD_DIR=./uploads
EXPORT_DIR=./exports

# 上传限制
MAX_UPLOAD_SIZE=52428800
```

## 许可证

MIT License
