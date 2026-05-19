# 门诊服务台陪检调度系统

基于 FastAPI 的陪检员调度管理系统，支持急诊优先、取消补位、转派留痕等业务规则，提供完整的任务生命周期管理。

## 功能特性

- ✅ **任务全生命周期管理**：创建、分配、接单、开始、完成、取消、转派
- ✅ **智能规则引擎**：
  - 急诊优先：急诊/紧急患者优先分配
  - 陪检员容量控制：防止任务过载
  - 取消补位：任务取消后自动补位排队任务
  - 转派留痕：完整记录所有转派操作
  - 超时检测：自动标记超时任务
- ✅ **批量操作**：支持批量创建、分配任务，失败不影响已成功记录
- ✅ **审计日志**：所有操作都有完整记录，可追溯
- ✅ **统计分析**：等待时间、任务量等统计数据

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 启动 FastAPI 服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 一键执行主流程测试

```bash
# 给脚本执行权限
chmod +x test_flow.sh

# 运行完整测试流程（包含正常/异常场景）
./test_flow.sh
```

测试脚本会自动执行：
- 创建陪检员和患者数据
- 创建不同优先级的任务
- 测试分配、接单、完成流程
- 测试异常场景（分配给不存在的陪检员）
- 测试取消补位、转派功能
- 测试批量操作
- 查看审计日志和统计信息

---

## 核心操作指南

### 📥 数据导入

使用 `data_tools.py` 工具导入数据，支持批量导入陪检员、患者、任务。

```bash
# 导入样例数据
python data_tools.py import sample_data.json
```

**导入数据格式** (`sample_data.json`)：
```json
{
  "escorts": [
    {"name": "张三", "employee_id": "ESC001", "phone": "13800138001", "max_tasks": 3}
  ],
  "patients": [
    {"name": "赵小明", "medical_record_no": "MR001", "age": 45, "gender": "男", "department": "内科"}
  ],
  "tasks": [
    {"patient_id": 1, "priority": "normal", "examination_type": "CT检查"}
  ]
}
```

### 🔍 任务复核

查询任务详情和完整流转记录：

```bash
# 复核任务 ID 为 1 的详细信息
python data_tools.py review 1
```

输出示例：
```
=== 复核任务 ID 1 ===

任务基本信息:
  任务编号: TASK20240115143000A1B2
  优先级: emergency
  状态: completed
  检查类型: 急诊抢救
  创建时间: 2024-01-15T14:30:00

流转记录 (3 条):
  [2024-01-15T14:30:00] created: 任务创建成功，优先级：emergency
  [2024-01-15T14:30:05] assigned: 分配任务给陪检员 ID: 1
  [2024-01-15T14:35:00] completed: 陪检完成
    状态变更: in_progress -> completed
```

### 📤 数据导出

导出系统所有数据到 JSON 文件：

```bash
# 导出数据（默认文件名: export_data.json）
python data_tools.py export

# 指定导出文件名
python data_tools.py export 20240115_backup.json
```

---

## 常用 API 接口

### 任务管理

| 操作 | 方法 | 接口 |
|------|------|------|
| 创建任务 | POST | `/api/tasks/` |
| 查询任务列表 | GET | `/api/tasks/` |
| 任务详情 | GET | `/api/tasks/{task_id}` |
| 分配任务 | POST | `/api/tasks/{task_id}/assign` |
| 接单 | POST | `/api/tasks/{task_id}/accept` |
| 完成任务 | POST | `/api/tasks/{task_id}/complete` |
| 取消任务 | POST | `/api/tasks/{task_id}/cancel` |
| 转派任务 | POST | `/api/tasks/{task_id}/transfer` |
| 审计日志 | GET | `/api/tasks/{task_id}/audit-logs` |

### 批量操作

```bash
# 批量创建任务
curl -X POST http://localhost:8000/api/tasks/batch/create \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {"patient_id": 1, "priority": "normal", "examination_type": "血常规"},
      {"patient_id": 2, "priority": "emergency", "examination_type": "急诊检查"}
    ]
  }'

# 批量分配任务
curl -X POST http://localhost:8000/api/tasks/batch/assign \
  -H "Content-Type: application/json" \
  -d '{"task_ids": [1, 2, 3], "escort_id": 1}'
```

### 查询统计

```bash
# 查看系统统计
curl http://localhost:8000/api/tasks/statistics/overview
```

---

## 业务规则说明

### 🏥 急诊优先规则

- **优先级排序**：`emergency`(急诊) > `urgent`(紧急) > `normal`(普通)
- **自动排序**：任务列表自动按优先级排序，急诊任务始终排在最前面
- **拦截提示**：创建任务时返回优先级信息，便于服务台说明

### 🔄 取消补位规则

- 任务取消后，系统自动查找下一个排队任务
- 按优先级顺序分配空位
- 补位操作记录在审计日志中
- 返回补位任务列表，便于追踪

### 📋 转派留痕规则

每次转派记录以下信息：
- 原陪检员 → 新陪检员
- 转派时间和操作人
- 转派原因（必填）
- 任务状态变更

### ⏰ 超时规则

- 可配置超时时间（默认30分钟）
- 分配后超过时间未接单，自动标记为超时
- 超时任务可重新分配或取消

---

## 常见场景示例

### 场景 1: 为什么任务被拦截？

**问题**：分配任务时返回 400 错误

**解决方案**：查看返回的 `blocking_reasons` 字段
```json
{
  "detail": {
    "message": "任务分配被拦截",
    "blocking_reasons": [
      "escort_capacity: 陪检员 张三 已达最大任务数 3"
    ]
  }
}
```

### 场景 2: 如何解释任务流转？

使用复核功能查询任务的完整审计日志：
```bash
python data_tools.py review 5
```

### 场景 3: 批量导入部分失败怎么办？

批量操作返回每个任务的成功/失败状态：
```json
{
  "batch_id": "BATCH20240115143000",
  "total_count": 5,
  "success_count": 3,
  "failed_count": 2,
  "results": [
    {"task_no": "TASK001", "success": true},
    {"task_no": "TASK002", "success": false, "error_message": "患者不存在"}
  ]
}
```

**重试失败的任务**：只需重新提交失败的任务，已成功的任务不会被重复处理。

---

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主入口
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic Schema
│   ├── crud.py              # 业务逻辑
│   ├── rules.py             # 规则引擎
│   └── routers/
│       ├── __init__.py
│       ├── tasks.py         # 任务 API
│       ├── patients.py      # 患者 API
│       └── escorts.py       # 陪检员 API
├── requirements.txt         # 依赖文件
├── test_flow.sh            # 主流程测试脚本
├── data_tools.py           # 数据导入/导出/复核工具
├── sample_data.json        # 样例数据
└── README.md               # 本文档
```

---

## 技术栈

- **后端框架**: FastAPI 0.109
- **数据库**: SQLite (可轻松切换到 MySQL/PostgreSQL)
- **ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic 2.5

## 常见问题

**Q: 如何修改陪检员的最大任务数？**
```bash
# 陪检员创建时指定
curl -X POST http://localhost:8000/api/escorts/ \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "employee_id": "ESC001", "max_tasks": 5}'
```

**Q: 数据库文件在哪里？**
- 默认位置: `./clinic.db`
- 删除该文件即可重置所有数据

**Q: 如何查看所有 API？**
- 启动服务后访问: http://localhost:8000/docs

---

## License

MIT