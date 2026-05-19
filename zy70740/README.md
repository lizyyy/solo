# GPU作业排队优先级仲裁后端API

基于 FastAPI + SQLite 的 GPU 作业排队管理系统，支持优先级仲裁、资源占用校验、超时释放等核心功能。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据（造数）

```bash
python -m scripts.seed_data
```

该脚本会初始化 GPU 资源配置并创建示例作业。

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问 http://localhost:8000/docs 查看 Swagger API 文档。

## 核心特性

- **作业管理**: 创建、查询、更新、取消作业
- **优先级仲裁**: 按优先级和创建时间自动调度作业
- **资源占用校验**: 实时检查 GPU 资源可用性
- **超时释放**: 自动释放超时作业的 GPU 资源
- **重复申请幂等**: 相同 job_id 重复提交不会创建重复记录
- **排队摘要导出**: 导出完整的排队信息和统计摘要
- **释放事件记录**: 记录所有 GPU 资源释放事件
- **异常路径记录**: 保留原始输入、处理人、处理结论

## API 接口

### 作业管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/jobs/` | 创建作业 |
| GET | `/jobs/` | 查询所有作业 |
| GET | `/jobs/{job_id}` | 查询单个作业 |
| PUT | `/jobs/{job_id}` | 更新作业状态/优先级 |
| DELETE | `/jobs/{job_id}` | 取消/关闭作业 |

### 队列操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/jobs/advance/{gpu_model}` | 推进队列（按优先级启动作业） |
| POST | `/jobs/{job_id}/release` | 释放作业资源 |
| POST | `/jobs/process-timeouts` | 处理超时作业 |

### 队列统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/queue/summary/` | 获取排队摘要 |
| GET | `/queue/export/` | 导出完整队列信息 |

### 资源与事件

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/gpu-resources/` | 创建 GPU 资源配置 |
| GET | `/gpu-resources/` | 查询所有 GPU 资源 |
| GET | `/release-events/` | 查询释放事件记录 |
| POST | `/exceptions/` | 记录异常处理信息 |

## Curl 主流程示例

### 1. 创建 GPU 资源配置

```bash
curl -X POST "http://localhost:8000/gpu-resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "gpu_model": "A100",
    "total": 8,
    "available": 8
  }'
```

### 2. 创建作业

```bash
curl -X POST "http://localhost:8000/jobs/" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "JOB-001",
    "gpu_model": "A100",
    "gpu_count": 2,
    "estimated_duration": 60,
    "priority": 10,
    "user": "alice"
  }'
```

### 3. 推进队列（优先级仲裁）

```bash
curl -X POST "http://localhost:8000/jobs/advance/A100"
```

### 4. 查询作业状态

```bash
curl "http://localhost:8000/jobs/JOB-001"
```

### 5. 获取队列摘要

```bash
curl "http://localhost:8000/queue/summary/"
```

### 6. 释放作业资源

```bash
curl -X POST "http://localhost:8000/jobs/JOB-001/release?released_by=admin"
```

### 7. 取消作业

```bash
curl -X DELETE "http://localhost:8000/jobs/JOB-001"
```

### 8. 导出队列信息

```bash
curl "http://localhost:8000/queue/export/"
```

### 9. 记录异常信息

```bash
curl -X POST "http://localhost:8000/exceptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "original_input": "{\"job_id\": \"INVALID\"}",
    "handler": "admin",
    "conclusion": "无效的 GPU 型号"
  }'
```

## 冲突路径示例

### 1. 创建未配置 GPU 型号的作业（失败）

```bash
curl -X POST "http://localhost:8000/jobs/" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "JOB-002",
    "gpu_model": "RTX3090",
    "gpu_count": 2,
    "estimated_duration": 60,
    "priority": 5,
    "user": "bob"
  }'
# 返回 400: GPU model RTX3090 not configured
```

### 2. 查询不存在的作业

```bash
curl "http://localhost:8000/jobs/NONEXISTENT"
# 返回 404: Job not found
```

### 3. 重复提交相同 job_id（幂等）

```bash
curl -X POST "http://localhost:8000/jobs/" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "JOB-001",
    "gpu_model": "A100",
    "gpu_count": 2,
    "estimated_duration": 60,
    "priority": 10,
    "user": "alice"
  }'
# 第二次提交返回已存在的作业记录，不创建新记录
```

## 运行测试

```bash
pytest tests/test_api.py -v
```

测试覆盖场景：
- 创建 GPU 资源配置
- 创建作业
- 重复申请幂等性
- 查询作业
- 优先级仲裁推进队列
- 释放作业资源
- 取消作业
- 队列摘要查询
- 队列信息导出
- 404 异常处理
- 未配置 GPU 资源的作业创建
- 优先级顺序验证
- 异常记录创建

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic 模式
│   ├── crud.py          # CRUD 操作
│   ├── core.py          # 核心业务逻辑
│   └── main.py          # FastAPI 应用
├── scripts/
│   └── seed_data.py     # 造数脚本
├── tests/
│   └── test_api.py      # 测试用例
├── requirements.txt     # 依赖列表
└── README.md           # 项目说明
```

## 数据模型

### Job (作业)
- job_id: 作业唯一标识
- gpu_model: GPU 型号 (A100, A10, V100, T4)
- gpu_count: 需要的 GPU 数量
- estimated_duration: 预计时长（分钟）
- priority: 优先级（数值越大优先级越高）
- user: 提交用户
- status: 状态 (pending, running, completed, failed, cancelled)
- queue_position: 排队位置

### GPUResource (GPU资源)
- gpu_model: GPU 型号
- total: 总数量
- available: 可用数量
- last_updated: 最后更新时间

### ReleaseEvent (释放事件)
- job_id: 作业 ID
- released_gpus: 释放的 GPU 数量
- gpu_model: GPU 型号
- released_by: 释放人
- released_at: 释放时间

### ExceptionRecord (异常记录)
- original_input: 原始输入
- handler: 处理人
- conclusion: 处理结论
- created_at: 创建时间