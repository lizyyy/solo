# 门诊陪检调度系统

门诊服务台陪检员调度系统，支持任务创建、派单、接单、转派、完成、取消、超时处理、统计和导出功能。

## 核心功能

### 任务管理
- **创建任务**: 支持患者信息、优先级、位置等
- **派单**: 将任务分配给陪检员
- **接单**: 陪检员接受任务
- **转派**: 将任务转给其他陪检员
- **完成**: 完成任务并记录服务时长
- **取消**: 取消任务并记录原因

### 排队和优先级
- 支持普通/紧急/特急三个优先级
- 自动计算排队位置
- 优先处理高优先级任务

### 超时处理
- 自动超时检测（默认30分钟）
- 超时任务标记异常

### 统计分析
- 任务状态统计
- 等待时间统计
- 服务时间统计
- 陪检员绩效统计
- 每日趋势分析
- 排队情况统计

### 筛选和导出
- 按状态、陪检员、优先级、异常类型、时间范围筛选
- 支持导出Excel和CSV格式
- 报告包含完整任务信息和审计记录

### 幂等性和批量操作
- 重复提交请求ID相同的任务返回已有结果
- 批量派单、完成、取消、更新优先级
- 批量操作返回成功/失败明细

### 审计日志
- 记录所有操作（角色、操作人、时间）
- 支持任务审计追溯

## 安装

```bash
pip install -r requirements.txt
```

## 运行

### 启动API服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档

### 使用命令行工具
```bash
# 创建陪检员
python cli.py create-escort --name "张三" --phone "13800138000" --employee-id "E001"

# 列出陪检员
python cli.py list-escorts

# 创建任务
python cli.py create-task --request-id "REQ001" --patient-name "李四" --priority normal

# 派单
python cli.py assign-task --task-id 1 --escort-id 1

# 接单
python cli.py accept-task --task-id 1

# 完成任务
python cli.py complete-task --task-id 1

# 取消任务
python cli.py cancel-task --task-id 2

# 列出任务
python cli.py list-tasks

# 查看统计
python cli.py stats

# 导出任务
python cli.py export --format excel
```

## API接口

### 任务接口 `POST /api/v1/tasks`

### 陪检员接口 `GET /api/v1/escorts`

### 统计接口 `GET /api/v1/stats/tasks/summary`

### 导出接口 `POST /api/v1/exports/tasks/excel`

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI主应用
│   ├── config.py            # 配置文件
│   ├── database.py          # 数据库连接
│   ├── models/              # 数据模型
│   │   ├── __init__.py
│   │   ├── enums.py         # 枚举类型
│   │   └── models.py        # ORM模型
│   ├── schemas.py           # Pydantic模型
│   ├── services/            # 业务逻辑
│   │   ├── __init__.py
│   │   ├── task_service.py  # 任务服务
│   │   ├── escort_service.py # 陪检员服务
│   │   ├── stats_service.py # 统计服务
│   │   ├── export_service.py # 导出服务
│   │   └── batch_service.py # 批量服务
│   └── api/                 # API路由
│       ├── __init__.py
│       ├── tasks.py         # 任务接口
│       ├── escorts.py       # 陪检员接口
│       ├── stats.py         # 统计接口
│       └── exports.py       # 导出接口
├── tests/                   # 测试文件
├── exports/                 # 导出文件目录
├── cli.py                   # 命令行工具
├── requirements.txt         # 依赖文件
└── README.md               # 说明文档
```

## 数据模型

### 任务(Task)
- request_id: 请求ID（唯一，幂等性）
- patient_id: 患者ID
- assigned_escort_id: 陪检员ID
- status: 状态（pending/assigned/accepted/completed/cancelled/timeout）
- priority: 优先级（normal/urgent/emergency）
- service_type: 服务类型
- from_location: 起始位置
- to_location: 目标位置
- queue_position: 排队位置
- wait_duration: 等待时长（分钟）
- service_duration: 服务时长（分钟）
- total_duration: 总时长（分钟）
- operator_role: 操作人角色
- operator_name: 操作人姓名
- has_exception: 是否异常
- exception_type: 异常类型
- exception_note: 异常说明

### 陪检员(Escort)
- name: 姓名
- phone: 电话
- employee_id: 工号（唯一）
- is_active: 是否激活

### 患者(Patient)
- name: 姓名
- medical_record_no: 病历号
- phone: 电话
- department: 科室
- bed_no: 床号

### 审计日志(AuditLog)
- task_id: 任务ID
- operation_type: 操作类型
- operator_role: 操作人角色
- operator_name: 操作人姓名
- old_status: 原状态
- new_status: 新状态
- old_escort_id: 原陪检员ID
- new_escort_id: 新陪检员ID
- note: 备注
- created_at: 创建时间

## 配置

在 `app/config.py` 中可配置：
- TASK_TIMEOUT_MINUTES: 任务超时时间（默认30分钟）
- EXPORT_DIR: 导出文件目录

## 许可证

MIT
