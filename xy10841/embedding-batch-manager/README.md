# Embedding Batch Manager - 向量批处理管家

一个面向技术团队的全栈向量批处理管理系统，提供批次管理、任务追踪、失败重试、数据校验等功能。

## 🚨 修复说明

### 第一轮修复 (metadata 字段问题)
**问题**: 创建批次返回 `ResponseValidationError: metadata Input should be a valid dictionary`

**原因**: 
1. SQLAlchemy `Base` 模型自带 `metadata` 属性（ORM 元数据）
2. 数据库字段命名为 `metadata_`（避免与保留字冲突）
3. Pydantic v2 `from_attributes` 模式下，ORM 对象被优先当作 dict 处理时，`metadata` 被错误赋值为 SQLAlchemy 的 MetaData 对象

**修复方案**:
- **`backend/app/models.py`**: 添加 `metadata_dict` property（避免命名冲突）
- **`backend/app/schemas.py`**: 添加 `@model_validator(mode="before")` 正确从 `metadata_` 解析 JSON 到 `metadata` 字段
- **`backend/app/schemas.py`**: 所有 Schema 的 Config 配置 `from_attributes = True`

### 第二轮修复 (核心功能补全)
**问题**: README 声明的功能与实际实现存在差距：
1. 缺少删除批次 API 接口
2. 前端缺少编辑/删除入口
3. `cleanup_dirty_data` 只处理卡住的 processing 任务，未处理孤儿任务和重复索引

**修复方案**:
- **`backend/app/main.py`**: 添加 `DELETE /api/batches/{batch_id}` 接口
- **`backend/app/services.py`**: 
  - 完善 `cleanup_dirty_data` 函数，新增：
    - `orphaned_tasks`: 清理 batch_id 不存在的孤儿任务
    - `duplicate_indexes`: 清理相同 task_id 或 vector_id 的重复索引结果
  - 新增 `delete_document_batch` 删除服务
- **`backend/app/schemas.py`**: 扩展 `DocumentBatchUpdate`，支持编辑：
  - `source_type`, `total_documents`, `total_chunks`, `strategy_id`
- **`frontend/index.html`**: 
  - 批次列表新增「编辑」「删除」按钮
  - 添加编辑批次模态框，支持编辑批次基本信息
  - 删除前有确认提示，避免误操作

验证通过！创建、编辑、删除、脏数据清理全链路正常工作。

## 核心功能

### 📊 批次管理
- 创建/编辑/删除批次
- 实时进度追踪
- 状态流转控制（待处理 → 运行中 → 已暂停 → 已完成/失败）
- 批量任务统计概览

### 🎯 任务管理
- 向量任务创建与查询
- 任务状态追踪
- 自动重试机制（支持最大重试次数）
- 失败片段保留与详情查看

### 🔄 补偿机制
- 幂等性请求支持（防止重复提交）
- 重试队列管理
- 断点续跑功能
- 脏数据清理（处理卡住的任务）

### ✅ 数据校验
- 索引结果校验
- 缺失索引检测
- 校验状态标记
- 批量验证报告

### 📋 报告与导出
- 批次详细报告
- 完整数据导出（JSON格式）
- 失败详情汇总
- 任务执行统计

## 技术架构

### 后端
- **框架**: FastAPI + Python 3.8+
- **数据库**: SQLite（可扩展至 PostgreSQL）
- **ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic 2.0

### 前端
- **技术栈**: 原生 HTML5 + JavaScript + TailwindCSS
- **特性**: 响应式设计、无需构建步骤、直接运行

## 数据模型

### 1. ChunkStrategy（切片策略）
- `id`: 主键
- `name`: 策略名称（唯一）
- `chunk_size`: 切片大小
- `chunk_overlap`: 重叠大小
- `separator`: 分隔符
- `description`: 描述

### 2. DocumentBatch（文档批次）
- `id`: 主键
- `batch_name`: 批次名称
- `source_type`: 来源类型
- `total_documents`: 文档总数
- `total_chunks`: 切片总数
- `status`: 状态（pending/running/paused/completed/failed/partial）
- `progress`: 进度百分比
- `strategy_id`: 关联切片策略
- `metadata`: 元数据（JSON）
- `error_message`: 错误信息

### 3. VectorTask（向量任务）
- `id`: 主键
- `batch_id`: 所属批次
- `document_id`: 文档ID
- `chunk_index`: 切片索引
- `chunk_text`: 切片内容
- `embedding_model`: 嵌入模型
- `vector_dimension`: 向量维度
- `status`: 状态（pending/processing/completed/failed/retrying）
- `retry_count`: 重试次数
- `max_retries`: 最大重试次数
- `error_message`: 错误信息

### 4. FailedChunk（失败片段）
- `id`: 主键
- `batch_id`: 所属批次
- `task_id`: 关联任务
- `document_id`: 文档ID
- `chunk_index`: 切片索引
- `chunk_text`: 切片内容
- `error_type`: 错误类型
- `error_message`: 错误信息
- `error_traceback`: 错误堆栈
- `failed_at`: 失败时间
- `resolved`: 是否已解决

### 5. RetryQueue（重试队列）
- `id`: 主键
- `batch_id`: 所属批次
- `task_id`: 关联任务
- `failed_chunk_id`: 关联失败片段
- `priority`: 优先级
- `retry_after`: 延迟重试时间
- `retry_count`: 重试次数
- `status`: 状态

### 6. IndexResult（索引结果）
- `id`: 主键
- `batch_id`: 所属批次
- `task_id`: 关联任务
- `document_id`: 文档ID
- `chunk_index`: 切片索引
- `vector_id`: 向量ID（唯一）
- `vector_checksum`: 向量校验和
- `indexed_at`: 索引时间
- `verified`: 是否已验证
- `verified_at`: 验证时间
- `verification_error`: 验证错误信息

## 快速开始

### 1. 环境准备
```bash
cd embedding-batch-manager/backend
pip install -r requirements.txt
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件（如需）
```

### 3. 启动后端服务
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档将自动生成在：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 启动前端
直接在浏览器中打开：`frontend/index.html`

或者使用任意 HTTP 服务器：
```bash
cd frontend
python -m http.server 8080
# 访问: http://localhost:8080
```

## API 使用指南

### 幂等性请求
为防止重复提交，关键接口支持 `request_id` 参数：

```bash
# 创建批次（带幂等性）
curl -X POST "http://localhost:8000/api/batches/?request_id=unique-id-123" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "文档处理批次001",
    "source_type": "PDF",
    "total_documents": 100,
    "total_chunks": 500
  }'
```

**注意**: 相同的 `request_id` 在 24 小时内重复调用会返回相同结果，不会重复创建。

### 常用接口示例

#### 创建切片策略
```bash
curl -X POST "http://localhost:8000/api/strategies/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "standard-512",
    "chunk_size": 512,
    "chunk_overlap": 50,
    "separator": "\n\n",
    "description": "标准切片策略，512字符，50重叠"
  }'
```

#### 创建向量任务（批量）
```bash
curl -X POST "http://localhost:8000/api/tasks/bulk?batch_id=1&request_id=bulk-123" \
  -H "Content-Type: application/json" \
  -d '[{
    "batch_id": 1,
    "document_id": "doc-001",
    "chunk_index": 0,
    "chunk_text": "这是一段测试文本...",
    "embedding_model": "text-embedding-ada-002"
  }]'
```

#### 标记任务完成
```bash
curl -X POST "http://localhost:8000/api/tasks/1/complete"
```

#### 标记任务失败
```bash
curl -X POST "http://localhost:8000/api/tasks/1/fail?error_message=API超时&error_type=NetworkError"
```

#### 重试失败任务
```bash
curl -X POST "http://localhost:8000/api/tasks/1/retry"
```

#### 处理重试队列
```bash
curl -X POST "http://localhost:8000/api/batches/1/retry-queue/process"
```

#### 清理脏数据
```bash
# 单个批次清理
curl -X POST "http://localhost:8000/api/batches/1/cleanup"

# 全局清理
curl -X POST "http://localhost:8000/api/admin/cleanup-all"
```

#### 验证索引结果
```bash
# 单个索引验证
curl -X POST "http://localhost:8000/api/index-results/1/verify?is_valid=true"

# 批次级验证
curl "http://localhost:8000/api/batches/1/verify-indexes"
```

#### 导出批次数据
```bash
curl "http://localhost:8000/api/batches/1/export" -o batch-1-export.json
```

## 关键操作路径

### 1. 正常批次处理流程
```
创建批次 → 创建任务 → 启动批次 → 处理任务 → 标记完成 → 验证索引 → 完成批次
```

### 2. 失败补偿流程
```
任务失败 → 自动记录失败片段 → 加入重试队列 → 处理重试队列 → 任务重新执行
→ 成功: 标记完成
→ 仍失败: 达到最大重试次数后停止，保留失败记录
```

### 3. 断点续跑流程
```
批次意外中断 → 启动服务 → 调用 cleanup 接口（清理卡住的任务）
→ 恢复批次状态 → 继续未完成任务
```

### 4. 脏数据处理场景
- **卡住的任务**: 状态为 `processing` 但超过 2 小时无更新
- **重复索引**: 相同 `vector_id` 的重复记录
- **孤儿任务**: 关联了不存在的批次

## 前端功能说明

### 主界面
- **统计卡片**: 总批次数、运行中、已完成、失败/异常
- **搜索筛选**: 按批次名称搜索、按状态筛选
- **批次列表**: 显示批次名称、状态、进度、任务统计、操作按钮

### 详情弹窗
点击「查看」按钮打开批次详情：
- 批次基本信息卡片
- 操作按钮组（启动/暂停/恢复/处理重试/导出/清理）
- 失败片段列表（显示错误类型、信息、文档切片信息）
- 最近任务列表（显示任务状态、重试次数、操作按钮）

### 创建批次
点击「创建批次」按钮：
- 填写批次名称（必填）
- 选择来源类型
- 填写文档数量和切片数量
- 选择切片策略（可选）
- 填写元数据（JSON 格式，可选）

## 状态流转说明

### 批次状态
| 状态 | 说明 | 可流转至 |
|------|------|----------|
| pending | 待处理 | running |
| running | 运行中 | paused, completed, failed |
| paused | 已暂停 | running |
| completed | 已完成 | - |
| failed | 失败 | running |
| partial | 部分完成 | - |

### 任务状态
| 状态 | 说明 | 可流转至 |
|------|------|----------|
| pending | 待处理 | processing |
| processing | 处理中 | completed, failed |
| completed | 已完成 | - |
| failed | 失败 | retrying |
| retrying | 重试中 | pending |

## 生产环境部署建议

1. **数据库迁移**: 使用 Alembic 管理数据库版本
2. **CORS 配置**: 根据实际域名调整跨域设置
3. **认证授权**: 添加 API Key 或 OAuth2 认证
4. **日志系统**: 集成结构化日志（如 structlog）
5. **监控告警**: 对接 Prometheus + Grafana
6. **高可用**: 使用 Redis 实现分布式锁和重试队列
7. **数据备份**: 定期备份 SQLite 数据库或迁移至 PostgreSQL

## 扩展开发

### 添加新的状态
1. 在 `app/models.py` 中添加枚举值
2. 在 `app/services.py` 中更新状态流转逻辑
3. 在前端 `STATUS_LABELS` 中添加中文标签和样式

### 集成真实向量服务
在 `complete_vector_task` 函数中添加实际的向量生成和索引存储逻辑。

## 许可证

MIT License
