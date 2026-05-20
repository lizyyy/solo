# 定时任务互斥锁 API

一个完整的分布式定时任务互斥锁管理系统，提供 Web 管理界面和 RESTful API。

## 功能特性

### 🔐 核心锁机制
- **互斥抢占**: 同一任务同一时间只允许一个实例持有锁
- **心跳续租**: 持有锁的实例定期发送心跳延长锁有效期
- **超时释放**: 实例异常退出未释放锁时自动超时释放
- **重复执行拦截**: 检测并拦截短时间内的重复执行

### 📊 管理功能
- **任务管理**: 创建、查看、管理定时任务
- **锁状态监控**: 实时查看所有锁的持有状态
- **执行日志**: 完整的任务执行历史记录
- **异常队列**: 自动捕获锁超时、抢锁失败等异常

### 🛠️ API 接口
- `POST /api/locks/acquire` - 抢占锁
- `POST /api/locks/heartbeat` - 心跳续租
- `POST /api/locks/release` - 释放锁
- `POST /api/locks/{id}/force-release` - 强制释放锁
- `GET /api/tasks` - 获取任务列表
- `GET /api/execution-logs` - 获取执行日志
- `GET /api/abnormal-queue` - 获取异常队列
- `GET /api/export/*` - 导出数据

## 项目结构

```
.
├── backend/                 # Python FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # 主应用入口
│   │   ├── models.py       # 数据模型
│   │   ├── schemas.py      # Pydantic 模式
│   │   ├── database.py     # 数据库配置
│   │   └── lock_service.py # 锁核心逻辑
│   ├── requirements.txt    # Python 依赖
│   └── mutex_lock.db       # SQLite 数据库（自动生成）
│
└── frontend/               # React 前端
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── App.css
    │   ├── types/          # TypeScript 类型定义
    │   ├── services/       # API 服务
    │   └── pages/          # 页面组件
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (默认端口 8000)
uvicorn app.main:app --reload --host 0.0.0.0
```

后端 API 文档: http://localhost:8000/docs

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务 (默认端口 3000)
npm run dev
```

访问 Web 界面: http://localhost:3000

## 测试指南

### 测试 1: 基本互斥功能

1. 打开 http://localhost:3000 进入管理界面
2. 点击「任务管理」→「模拟抢锁」
3. 选择/创建一个任务，输入实例 ID: `instance-a`，点击「抢锁」
4. 再次点击「模拟抢锁」，使用同一个任务，实例 ID: `instance-b`
5. 观察: 第二次抢锁应该失败，提示锁已被其他实例持有
6. 查看「执行日志」，应该有一条标记为「重复」的记录

### 测试 2: 脏数据处理（锁超时）

1. 用某个实例抢锁成功
2. **不要释放锁**，直接等待超过锁的最大执行时间（默认 300 秒）
3. 或者调用 `POST /api/cleanup/expired-locks` 手动触发清理
4. 查看「异常队列」：应该出现一条类型为 `lock_timeout` 的异常记录
5. 查看「锁状态」：该锁状态应该变为 `expired`

### 测试 3: 重复请求测试

使用 curl 或其他工具并发发送多个抢锁请求：

```bash
# 终端 1
curl -X POST http://localhost:8000/api/locks/acquire \
  -H "Content-Type: application/json" \
  -d '{"task_name": "test_task", "instance_id": "instance-1"}'

# 终端 2 (立即执行)
curl -X POST http://localhost:8000/api/locks/acquire \
  -H "Content-Type: application/json" \
  -d '{"task_name": "test_task", "instance_id": "instance-2"}'
```

预期结果: 只有一个请求成功，另一个失败并进入异常队列

### 测试 4: 心跳续租功能

```bash
# 1. 先抢锁
curl -X POST http://localhost:8000/api/locks/acquire \
  -H "Content-Type: application/json" \
  -d '{"task_name": "heartbeat_test", "instance_id": "instance-1"}'

# 2. 在锁过期前发送心跳
curl -X POST http://localhost:8000/api/locks/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"task_name": "heartbeat_test", "instance_id": "instance-1"}'

# 观察锁状态：过期时间应该被延长
```

### 测试 5: 补偿动作

1. 强制释放一个持有的锁（在「锁状态」页面点击「强制释放」）
2. 查看「异常队列」：会记录类型为 `manual_release` 的异常
3. 查看「执行日志」：对应任务状态变为 `aborted`
4. 在异常队列中标记异常为「已解决」，填写处理说明

## 数据模型说明

### Task (任务)
- `id`: 任务 ID
- `name`: 任务名称（唯一）
- `description`: 任务描述
- `max_execution_time`: 最大执行时间（秒）
- `heartbeat_interval`: 心跳间隔（秒）
- `is_active`: 是否激活

### Lock (锁)
- `id`: 锁 ID
- `task_id`: 任务 ID
- `instance_id`: 实例 ID
- `status`: 状态 (acquired/released/expired/failed)
- `acquired_at`: 获得时间
- `expires_at`: 过期时间
- `last_heartbeat_at`: 最后心跳时间

### ExecutionLog (执行日志)
- `id`: 日志 ID
- `task_id`: 任务 ID
- `instance_id`: 实例 ID
- `status`: 执行状态
- `is_duplicate`: 是否重复执行
- `duration_seconds`: 执行耗时

### AbnormalQueue (异常队列)
- `id`: 异常 ID
- `abnormal_type`: 异常类型 (lock_timeout/lock_acquire_failed/manual_release)
- `severity`: 严重程度 (warning/error)
- `is_resolved`: 是否已解决
- `resolution_note`: 处理说明

## API 使用示例

### Python 客户端

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 抢锁
response = requests.post(f"{BASE_URL}/locks/acquire", json={
    "task_name": "daily_report",
    "instance_id": "worker-001"
})

if response.json()["success"]:
    lock_id = response.json()["lock_id"]
    try:
        # 执行业务逻辑...
        
        # 发送心跳
        requests.post(f"{BASE_URL}/locks/heartbeat", json={
            "task_name": "daily_report",
            "instance_id": "worker-001"
        })
        
        # 正常释放锁
        requests.post(f"{BASE_URL}/locks/release", json={
            "task_name": "daily_report",
            "instance_id": "worker-001",
            "success": True,
            "result": "completed"
        })
    except Exception as e:
        # 异常时也释放锁
        requests.post(f"{BASE_URL}/locks/release", json={
            "task_name": "daily_report",
            "instance_id": "worker-001",
            "success": False,
            "error_message": str(e)
        })
```

## 注意事项

1. **生产环境**: 当前使用 SQLite，生产环境建议使用 PostgreSQL/MySQL
2. **高可用**: 本实现为演示用途，真正的分布式锁建议使用 Redis Redlock
3. **监控**: 建议定期检查异常队列，及时处理锁超时等问题
4. **清理**: 定期清理历史执行日志，避免数据库过大
