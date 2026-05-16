# 租户配额回收服务

基于灰度物流拦截等风险场景的租户配额回收后端服务，支持材料下载验证、失败项管理、湖仓分区确认等功能。

## 功能特性

### ✅ 核心功能
- **材料下载验证**：自动检测下载链接是否失效，支持多种失败类型识别
- **失败项独立存储**：所有失败项单独保存，支持按失败类型、租户、状态过滤
- **失败路径样例**：内置多种失败场景样例，包括链接失效、计算错误、权限问题等
- **历史查询过滤**：支持按批次号、操作者、风险类型、任务状态、是否有失败过滤

### ✅ 数据管理
- **配额回收明细**：记录每个租户的原始配额、回收配额、剩余配额
- **湖仓分区管理**：支持湖仓分区清单的人工确认和查询
- **统计概览**：提供整体回收统计和失败类型分布

### ✅ 可靠性
- **SQLite持久化存储**：服务重启后所有数据保留
- **完整测试覆盖**：自检脚本覆盖所有边界情况

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py           # 配置文件
│   ├── database.py         # 数据库连接和初始化
│   ├── models.py           # 数据模型定义
│   ├── schemas.py          # Pydantic 数据结构
│   ├── crud.py             # 数据库CRUD操作
│   ├── services.py         # 核心业务逻辑
│   ├── api.py              # API路由
│   └── main.py             # FastAPI主应用
├── data/                   # SQLite数据库文件目录
├── requirements.txt        # Python依赖
├── self_test.py           # 自检脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检脚本（可选但推荐）

```bash
python self_test.py
```

该脚本会验证所有核心功能，包括：
- 数据库CRUD操作
- 下载链接失效检测
- 失败类型自动映射
- 失败项持久化存储
- 按失败类型查询过滤
- 回收额度明细查询
- 湖仓分区人工确认
- 任务统计状态更新
- 失败项标记解决

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问以下地址：
- API文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## API 接口说明

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/tasks/` | 创建配额回收任务 |
| GET | `/api/v1/tasks/` | 查询任务列表（支持过滤） |
| GET | `/api/v1/tasks/{task_id}` | 获取任务详情（含失败项和明细） |
| POST | `/api/v1/tasks/{task_id}/execute` | 执行配额回收任务 |

**查询参数示例：**
```
GET /api/v1/tasks/?operator=admin&risk_type=gray_logistics&has_failures=true
```

### 失败项管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/failed-items/` | 查询失败项（支持按类型、租户过滤） |
| PUT | `/api/v1/failed-items/{item_id}/resolve` | 标记失败项为已解决 |

**失败类型枚举：**
- `download_link_expired` - 下载链接已失效
- `material_verification_failed` - 材料验证失败
- `quota_calculation_error` - 配额计算错误
- `permission_denied` - 权限不足
- `network_error` - 网络错误
- `internal_error` - 内部错误

### 回收明细

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/recycle-details/?task_id=1` | 按任务ID查询回收明细 |
| GET | `/api/v1/recycle-details/?tenant_id=T001` | 按租户ID查询回收明细 |

### 湖仓分区

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/lakehouse-partitions/` | 创建分区记录 |
| GET | `/api/v1/lakehouse-partitions/` | 查询分区（支持按确认状态过滤） |
| PUT | `/api/v1/lakehouse-partitions/{id}/confirm` | 人工确认分区 |

### 统计查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/summary/` | 获取整体回收统计 |
| GET | `/api/v1/statistics/failures/` | 获取失败类型分布统计 |

## 数据模型

### QuotaRecycleTask（配额回收任务）
- `batch_no`: 批次号（唯一）
- `operator`: 操作者
- `risk_type`: 风险类型（gray_logistics, unauthorized_access等）
- `material_url`: 材料下载链接
- `material_summary`: 材料摘要
- `total_target_quota`: 目标回收总额
- `actual_recycled_quota`: 实际回收总额
- `success_count`: 成功数量
- `failed_count`: 失败数量
- `status`: 任务状态（pending, processing, completed, partial_failed, failed）

### FailedItem（失败项）
- `task_id`: 关联任务ID
- `failure_type`: 失败类型
- `tenant_id`: 租户ID
- `tenant_name`: 租户名称
- `error_message`: 错误信息
- `raw_data`: 原始数据（JSON）
- `resolved`: 是否已解决
- `resolved_by`: 解决人
- `resolution_note`: 解决备注
- `resolved_at`: 解决时间

### RecycleDetail（回收明细）
- `task_id`: 关联任务ID
- `tenant_id`: 租户ID
- `tenant_name`: 租户名称
- `original_quota`: 原始配额
- `recycled_quota`: 回收配额
- `remaining_quota`: 剩余配额
- `reason`: 回收原因
- `evidence_url`: 证据链接

### LakehousePartition（湖仓分区）
- `task_id`: 关联任务ID
- `partition_path`: 分区路径（唯一）
- `partition_date`: 分区日期
- `record_count`: 记录数量
- `data_size_mb`: 数据大小(MB)
- `manually_confirmed`: 是否已人工确认
- `confirmed_by`: 确认人
- `confirmation_note`: 确认备注

## 使用示例

### 1. 创建并执行回收任务

```bash
# 创建任务
curl -X POST http://localhost:8000/api/v1/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-2024-001",
    "operator": "admin",
    "risk_type": "gray_logistics",
    "material_url": "https://example.com/materials/gray-logistics.json",
    "total_target_quota": 50000.0,
    "remark": "灰度物流拦截配额回收"
  }'

# 执行任务（触发材料下载验证和配额计算）
curl -X POST http://localhost:8000/api/v1/tasks/1/execute
```

### 2. 查询失败项（按失败类型过滤）

```bash
# 查询所有链接已失效的失败项
curl "http://localhost:8000/api/v1/failed-items/?failure_type=download_link_expired"

# 查询未解决的失败项
curl "http://localhost:8000/api/v1/failed-items/?resolved=false"
```

### 3. 查询任务（多条件过滤）

```bash
# 查询admin操作的、灰度物流类型、且有失败的任务
curl "http://localhost:8000/api/v1/tasks/?operator=admin&risk_type=gray_logistics&has_failures=true"
```

### 4. 人工确认湖仓分区

```bash
curl -X PUT "http://localhost:8000/api/v1/lakehouse-partitions/1/confirm?confirmed_by=admin&confirmation_note=数据已核对无误"
```

### 5. 查看回收明细

```bash
# 按任务查看
curl "http://localhost:8000/api/v1/recycle-details/?task_id=1"

# 按租户查看
curl "http://localhost:8000/api/v1/recycle-details/?tenant_id=T001"
```

## 内置样例数据

服务启动时会自动创建演示数据，包括：

1. **成功任务示例** (BATCH-2024-001)
   - 包含3个成功回收的租户
   - 2个内置失败项（链接失效、计算错误）
   - 3个湖仓分区记录

2. **链接失效任务示例** (BATCH-2024-002)
   - 演示整个任务因材料链接失效而失败

这些样例展示了真实场景中可能出现的各种失败路径。

## 故障排查

### 常见问题

1. **数据库文件无法打开**
   - 确保 `data/` 目录存在且有写权限
   - 检查磁盘空间是否充足

2. **任务执行后状态为failed**
   - 查看该任务的failed_items，检查具体失败原因
   - 常见原因：材料链接失效、网络超时、权限不足

3. **无法过滤查询结果**
   - 检查枚举值的大小写和拼写
   - 参考API文档中的参数说明

## 技术栈

- **Web框架**: FastAPI 0.109
- **ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic 2.5
- **数据库**: SQLite
- **HTTP客户端**: httpx

## License

MIT
