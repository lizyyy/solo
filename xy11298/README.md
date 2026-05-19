# 民宿运营管理系统

基于 Python + FastAPI + SQLAlchemy 的民宿保洁管理系统，支持照片拦截、超时扣分、返工影响、自动结算等功能。

## 功能特性

- ✅ **缺图拦截**: 验收时检查必需的5类照片（客厅、卧室、卫生间、厨房、整体），缺图则无法通过验收
- ✅ **超时扣分**: 超过截止时间完成的任务，按超时小时数自动计算扣款
- ✅ **返工影响**: 返工记录自动影响最终结算金额
- ✅ **幂等性保证**: 重复提交派单、照片、扣款等操作不会重复计算
- ✅ **批量操作**: 支持批量派单、批量上传照片、批量扣款，失败不影响成功记录
- ✅ **操作日志**: 所有关键操作都有完整日志记录
- ✅ **完整流程**: 订单 → 派单 → 上传照片 → 验收 → 返工 → 扣款 → 结算

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload
```

服务将在 http://localhost:8000 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行完整测试流程

```bash
python test_flow.py
```

## 核心API接口

### 订单管理
- `POST /orders/` - 创建订单
- `GET /orders/` - 获取订单列表

### 保洁员管理
- `POST /cleaners/` - 创建保洁员
- `GET /cleaners/` - 获取保洁员列表

### 任务管理 (派单)
- `POST /tasks/` - 创建保洁任务 (派单)
- `POST /tasks/batch` - 批量派单
- `GET /tasks/` - 获取任务列表
- `GET /tasks/{task_id}/detail` - 获取任务完整详情
- `GET /tasks/{task_id}/status` - 获取任务状态及扣款原因

### 照片管理
- `POST /photos/` - 上传保洁照片
- `POST /photos/batch` - 批量上传照片

### 验收管理
- `POST /inspections/` - 创建验收记录

### 返工管理
- `POST /reworks/` - 申请返工
- `PUT /reworks/{rework_id}/complete` - 完成返工

### 扣款管理
- `POST /deductions/` - 创建扣款记录
- `POST /deductions/batch` - 批量扣款

### 结算管理
- `POST /settlements/` - 创建结算单
- `PUT /settlements/{settlement_id}/finalize` - 最终确认结算
- `GET /settlements/` - 获取结算列表

### 日志管理
- `GET /logs/` - 获取操作日志

## 业务规则说明

### 照片要求
必须上传以下5类照片才能通过验收:
- living_room (客厅)
- bedroom (卧室)
- bathroom (卫生间)
- kitchen (厨房)
- overall (整体)

### 扣款规则
1. **缺图扣款**: 缺任何一类照片，扣除基础费用的30%
2. **超时扣款**: 超时每小时扣10元，最高不超过基础费用的50%
3. **返工扣款**: 每次返工扣50元
4. **客诉扣款**: 手动录入的客户投诉扣款

### 幂等性设计
- 同一订单号重复创建会返回已存在的订单
- 同一任务号重复派单会返回已存在的任务
- 同一类型的照片重复上传会返回已存在的照片
- 同一原因的重复扣款会跳过，不重复扣

### 批量操作
批量操作采用逐个处理模式:
- 成功的项目会正常提交
- 失败的项目记录错误信息
- 重试时已成功的项目不会重复处理

## 数据模型

- **Order (订单)**: 民宿订单信息
- **Cleaner (保洁员)**: 保洁人员信息
- **CleaningTask (保洁任务)**: 保洁任务分配
- **CleaningPhoto (保洁照片)**: 保洁前后照片
- **Inspection (验收记录)**: 验收结果
- **Rework (返工记录)**: 返工申请与完成
- **Deduction (扣款记录)**: 各项扣款明细
- **Settlement (结算单)**: 结算汇总
- **SettlementItem (结算明细)**: 单个任务的结算明细
- **OperationLog (操作日志)**: 所有关键操作记录

## 使用示例

### 创建订单
```bash
curl -X POST "http://localhost:8000/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD20240115001",
    "property_name": "海景公寓A栋302",
    "guest_name": "张先生"
  }'
```

### 派单
```bash
curl -X POST "http://localhost:8000/tasks/" \
  -H "Content-Type: application/json" \
  -d '{
    "task_no": "TASK20240115001",
    "order_id": 1,
    "cleaner_id": 1,
    "deadline": "2024-01-15T18:00:00",
    "base_fee": 200
  }'
```

### 验收
```bash
curl -X POST "http://localhost:8000/inspections/" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1,
    "inspector": "王主管",
    "passed": true,
    "comments": "清洁质量良好"
  }'
```

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据验证模式
├── database.py          # 数据库配置
├── business_logic.py    # 核心业务逻辑
├── test_flow.py         # 完整流程测试脚本
├── requirements.txt     # Python 依赖
├── README.md           # 项目说明
└── cleaning_management.db  # SQLite 数据库 (自动创建)
```