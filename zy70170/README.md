# GPU 任务排队服务 (GPU Task Queue Service)

一个基于优先级队列的 GPU 资源调度服务原型，解决训练任务抢 GPU 时的优先级、时长和失败重试不公平问题。

---

## 一、服务启动

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python run.py
```

服务启动后访问:
- Swagger API 文档: `http://localhost:8000/docs`
- 健康检查: `http://localhost:8000/health`

---

## 二、架构设计

### 核心模块

1. **GPU 资源管理 (GPUManager)**
   - GPU 注册、状态管理（可用/占用/维护/离线）
   - 优先分配显存大的 GPU

2. **优先级队列 (QueueManager)**
   - 高优先级任务在前，同优先级先到先得
   - 动态调整队列位置，记录位置变化历史

3. **任务执行器 (TaskExecutor)**
   - 分配 GPU 启动任务
   - 超时检测与回收
   - 自动生成账单

4. **重试管理器 (RetryManager)**
   - 失败/超时任务自动重试
   - 可配置最大重试次数

5. **主调度器 (MainScheduler)**
   - 定时检查超时任务
   - 处理失败重试
   - 从队列分发任务到 GPU

### 数据存储

- SQLite 数据库 (轻量持久化)
- 重启后历史数据完整保留

---

## 三、验收规则

### 3.1 用户应该看到的状态

#### 任务状态 (TaskStatus)

| 状态 | 含义 | 说明 |
|------|------|------|
| `pending` | 待处理 | 任务刚提交，尚未入队 |
| `queued` | 排队中 | 在优先级队列等待 GPU |
| `running` | 运行中 | 已分配 GPU 正在执行 |
| `succeeded` | 成功 | 正常完成 |
| `failed` | 失败 | 执行出错 |
| `timed_out` | 超时 | 超过配置的超时时间 |
| `cancelled` | 已取消 | 用户主动取消 |
| `retrying` | 重试中 | 失败后准备重新排队 |

#### GPU 状态 (GPUStatus)

| 状态 | 含义 |
|------|------|
| `available` | 可用 | 可分配给新任务 |
| `occupied` | 占用 | 正在运行任务 |
| `maintenance` | 维护 | 不可调度 |
| `offline` | 离线 | 已下线 |

#### 查询 API

```
GET /api/v1/tasks/{task_id}          # 查看单个任务详情
GET /api/v1/tasks?status=queued      # 按状态筛选任务列表
GET /api/v1/gpus/                    # 查看所有 GPU 状态
GET /api/v1/gpus/available           # 只看可用 GPU
```

---

### 3.2 用户应该看到的记录

#### 任务历史记录 (TaskHistory)

每个任务的**每一步状态变化**都会被记录，包括：

| 字段 | 内容 |
|------|------|
| `action` | 动作类型（submitted/queued/started/failed/...） |
| `from_status` | 变化前状态 |
| `to_status` | 变化后状态 |
| `reason` | 变化原因 |
| `details` | 详细信息 |
| `gpu_id` | 涉及的 GPU |
| `queue_position` | 队列位置 |
| `timestamp` | 时间戳 |

#### 调度日志 (SchedulerLog)

调度器层面的操作记录，包括：

| 事件类型 | 说明 |
|----------|------|
| `task_submit` | 任务提交 |
| `queue_add` | 加入队列 |
| `task_start` | 任务启动 |
| `task_complete` | 任务成功 |
| `task_fail` | 任务失败 |
| `task_timeout` | 任务超时 |
| `task_cancel` | 任务取消 |
| `retry_scheduled` | 计划重试 |
| `retry_exceeded` | 重试次数超限 |
| `gpu_occupied_fail` | GPU 占用失败 |

#### 查询 API

```
GET /api/v1/tasks/{task_id}/history              # 任务完整历史轨迹
GET /api/v1/reports/scheduler-logs               # 调度器日志
GET /api/v1/reports/scheduler-logs?task_id=xxx   # 某任务的调度日志
GET /api/v1/reports/scheduler-logs?success=false # 只看失败事件
```

---

### 3.3 被拒绝时的卡点追踪

当任务被拒绝或卡住时，用户应能看到：

#### 卡点信息 (Block Point)

通过 `GET /api/v1/tasks/{task_id}/block-point` 获取：

```json
{
  "current_status": "queued",
  "block_point": "Waiting in priority queue",
  "block_reason": "Position #3, waiting for available GPU",
  "latest_action": {
    "action": "position_changed",
    "from_status": "queued",
    "to_status": "queued",
    "reason": "Queue rebalanced by priority",
    "details": "Position changed from 2 to 3",
    "timestamp": "2026-05-10T10:30:00"
  },
  "previous_action": {
    "action": "queued",
    "from_status": "pending",
    "to_status": "queued",
    "reason": "Task added to priority queue",
    "details": "Priority: 8, Position: 2",
    "timestamp": "2026-05-10T10:25:00"
  },
  "queue_position": 3,
  "retry_count": 0,
  "max_retries": 3
}
```

#### 典型卡点场景

| 场景 | block_point | block_reason |
|------|-------------|--------------|
| 队列等待 | Waiting in priority queue | Position #N, waiting for available GPU |
| 失败重试 | Retrying after failure | Retry 2/3 |
| 被拒绝 | Rejected at submission/scheduling | Max retries exceeded / GPU not available |

---

### 3.4 账单记录

任务结束后自动生成账单：

#### 账单字段

| 字段 | 含义 |
|------|------|
| `start_time` | GPU 开始占用时间 |
| `end_time` | GPU 释放时间 |
| `total_seconds` | 实际使用秒数 |
| `base_cost` | 基础费用 (0.01/秒) |
| `premium_cost` | 优先级溢价 (>5 优先级加收) |
| `total_cost` | 总费用 |

#### 查询 API

```
GET /api/v1/bills/task/{task_id}           # 某任务的账单
GET /api/v1/bills/summary/{user_id}        # 某用户的汇总账单
GET /api/v1/bills?user_id=alice            # 某用户的所有账单
```

---

### 3.5 汇总报告

#### 调度报告

`GET /api/v1/reports/scheduler`

```json
{
  "generated_at": "...",
  "total_gpus": 4,
  "available_gpus": 1,
  "occupied_gpus": 2,
  "maintenance_gpus": 1,
  
  "total_tasks": 156,
  "queued_tasks": 5,
  "running_tasks": 2,
  "succeeded_tasks": 140,
  "failed_tasks": 6,
  "timed_out_tasks": 2,
  "cancelled_tasks": 1,
  
  "queue_summary": [
    {"priority": 10, "count": 1},
    {"priority": 8, "count": 2},
    {"priority": 5, "count": 2}
  ],
  "recent_activities": [...]
}
```

#### 统计摘要

`GET /api/v1/reports/statistics`

- GPU 统计：总数、可用、占用、利用率
- 任务统计：总数、各状态数量、成功率
- 计费统计：总账单数、总时长、总费用

---

## 四、主要 API 接口

### GPU 管理

```
POST  /api/v1/gpus/register              # 注册 GPU
GET   /api/v1/gpus/                      # 列出 GPU
GET   /api/v1/gpus/{gpu_id}              # GPU 详情
POST  /api/v1/gpus/{gpu_id}/maintenance  # 设置维护模式
```

### 任务管理

```
POST  /api/v1/tasks/submit               # 提交任务
GET   /api/v1/tasks/                     # 任务列表
GET   /api/v1/tasks/{task_id}            # 任务详情
GET   /api/v1/tasks/{task_id}/history    # 任务历史
GET   /api/v1/tasks/{task_id}/block-point # 卡点查询
POST  /api/v1/tasks/{task_id}/cancel     # 取消任务
POST  /api/v1/tasks/{task_id}/complete   # 标记完成
GET   /api/v1/tasks/queue/overview       # 队列概览
```

### 账单

```
GET   /api/v1/bills/                     # 账单列表
GET   /api/v1/bills/{bill_id}            # 账单详情
GET   /api/v1/bills/task/{task_id}       # 按任务查账单
GET   /api/v1/bills/summary/{user_id}    # 用户汇总
```

### 报告

```
GET   /api/v1/reports/scheduler          # 调度报告
GET   /api/v1/reports/scheduler-logs     # 调度日志
GET   /api/v1/reports/statistics         # 统计摘要
```

---

## 五、典型使用流程

### 5.1 准备工作

```bash
# 1. 注册 GPU
curl -X POST http://localhost:8000/api/v1/gpus/register \
  -H "Content-Type: application/json" \
  -d '{"gpu_id":"gpu-001","name":"RTX 3090","model":"NVIDIA RTX 3090","memory_gb":24}'

curl -X POST http://localhost:8000/api/v1/gpus/register \
  -H "Content-Type: application/json" \
  -d '{"gpu_id":"gpu-002","name":"A100","model":"NVIDIA A100","memory_gb":80}'
```

### 5.2 提交任务

```bash
# 高优先级任务 (priority=9)
curl -X POST http://localhost:8000/api/v1/tasks/submit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ImageNet Training",
    "user_id": "alice",
    "priority": 9,
    "estimated_duration_minutes": 30,
    "timeout_minutes": 60,
    "max_retries": 3,
    "command": "python train.py --epochs 100"
  }'

# 普通优先级任务 (priority=5)
curl -X POST http://localhost:8000/api/v1/tasks/submit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CIFAR10 Experiment",
    "user_id": "bob",
    "priority": 5,
    "estimated_duration_minutes": 15,
    "timeout_minutes": 30
  }'
```

### 5.3 追踪任务

```bash
# 查看队列
curl http://localhost:8000/api/v1/tasks/queue/overview

# 查看任务详情
curl http://localhost:8000/api/v1/tasks/task_abc123

# 如果卡住，查看卡点
curl http://localhost:8000/api/v1/tasks/task_abc123/block-point

# 查看完整历史轨迹
curl http://localhost:8000/api/v1/tasks/task_abc123/history
```

### 5.4 结束任务

```bash
# 成功完成
curl -X POST "http://localhost:8000/api/v1/tasks/task_abc123/complete?success=true"

# 标记失败（会触发重试逻辑）
curl -X POST "http://localhost:8000/api/v1/tasks/task_abc123/complete?success=false&reason=CUDA+out+of+memory"

# 主动取消
curl -X POST http://localhost:8000/api/v1/tasks/task_abc123/cancel
```

### 5.5 查看账单和报告

```bash
# 任务账单
curl http://localhost:8000/api/v1/bills/task/task_abc123

# 用户汇总
curl http://localhost:8000/api/v1/bills/summary/alice

# 调度报告
curl http://localhost:8000/api/v1/reports/scheduler

# 统计摘要
curl http://localhost:8000/api/v1/reports/statistics
```

---

## 六、配置说明

通过 `.env` 文件配置（参考 `.env.example`）：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_RETRY_COUNT` | 3 | 最大重试次数 |
| `DEFAULT_PRIORITY` | 5 | 默认优先级 (1-10) |
| `DEFAULT_MAX_DURATION_MINUTES` | 60 | 默认预估时长 |
| `DEFAULT_TIMEOUT_MINUTES` | 120 | 默认超时时间 |
| `SCHEDULER_INTERVAL_SECONDS` | 5 | 调度器检查间隔 |

---

## 七、设计亮点

### 7.1 公平性保证

1. **优先级明确**：1-10 级，高优先级永远在前
2. **同优先级 FIFO**：同一优先级按提交时间排序
3. **动态重平衡**：高优先级任务提交时自动插队，并记录位置变化历史
4. **超时回收**：防止任务长期占坑
5. **可控重试**：失败重试但有上限，避免无限重试霸占资源

### 7.2 可追溯性

- **任务级历史**：每一步状态变化都有原因和详情
- **调度级日志**：调度器的每个决策都有记录
- **卡点查询**：专门的 API 告诉你当前卡在哪、为什么
- **前一次记录**：卡点查询同时返回上一次动作，方便对比

### 7.3 持久化

- SQLite 数据库，轻量无依赖
- 服务重启后所有历史、账单、日志完整保留
- 无需读源码，通过 API 即可了解发生了什么

---

## 八、项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── database.py            # 数据库连接
│   ├── models.py              # 数据模型
│   ├── schemas.py             # API Schema
│   ├── main.py                # FastAPI 入口
│   ├── core/
│   │   └── scheduler.py       # 核心调度逻辑
│   ├── api/
│   │   ├── gpus.py            # GPU API
│   │   ├── tasks.py           # 任务 API
│   │   ├── bills.py           # 账单 API
│   │   └── reports.py         # 报告 API
│   └── services/
├── data/                      # SQLite 数据库
├── logs/                      # 日志目录
├── requirements.txt
├── .env.example
├── run.py
└── README.md
```
