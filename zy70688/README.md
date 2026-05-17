# 试驾排期保养冲突里程归档后端API

基于 FastAPI + SQLite 的汽车门店试驾管理系统，解决试驾与保养、加油冲突问题。

## 核心功能
- 车辆锁定与状态管理
- 预约与保养时段冲突检测
- 里程归档记录
- 预约取消与车辆释放
- 异常路径日志（原始输入、处理人、处理结论）
- 排期报告导出（CSV/JSON）

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
或
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务地址: http://localhost:8000
API文档: http://localhost:8000/docs

### 3. 造数初始化
```bash
curl -X POST http://localhost:8000/seed-data
```

## Curl 主流程示例

### 1. 基础数据查询
```bash
# 查询车辆列表
curl http://localhost:8000/vehicles/

# 查询销售列表
curl http://localhost:8000/salespersons/

# 查询客户列表
curl http://localhost:8000/customers/
```

### 2. 创建试驾预约
```bash
curl -X POST http://localhost:8000/appointments/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "salesperson_id": 1,
    "customer_id": 1,
    "start_time": "2024-06-15T10:00:00",
    "end_time": "2024-06-15T11:00:00",
    "notes": "首次试驾"
  }'
```

### 3. 查询预约列表
```bash
curl http://localhost:8000/appointments/
curl http://localhost:8000/appointments/?vehicle_id=1
curl http://localhost:8000/appointments/?status=confirmed
```

### 4. 状态推进（开始试驾）
```bash
curl -X PATCH "http://localhost:8000/appointments/1/status?status=in_progress"
```

### 5. 里程归档（完成试驾）
```bash
curl -X POST "http://localhost:8000/appointments/1/archive-mileage?end_mileage=5050.5&recorded_by=张三"
```

### 6. 取消预约
```bash
curl -X POST "http://localhost:8000/appointments/1/cancel?handler=门店经理"
```

### 7. 人工修正
```bash
curl -X POST http://localhost:8000/appointments/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "店长",
    "conclusion": "客户要求改期，已重新安排",
    "new_start_time": "2024-06-16T14:00:00",
    "new_end_time": "2024-06-16T15:00:00",
    "new_status": "confirmed"
  }'
```

### 8. 创建保养
```bash
curl -X POST http://localhost:8000/maintenances/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "start_time": "2024-06-17T09:00:00",
    "end_time": "2024-06-17T12:00:00",
    "type": "常规保养",
    "notes": "更换机油和机滤"
  }'
```

### 9. 车辆锁定/解锁
```bash
curl -X POST http://localhost:8000/vehicles/1/lock
curl -X POST http://localhost:8000/vehicles/1/unlock
```

### 10. 导出报告
```bash
# CSV格式
curl "http://localhost:8000/reports/export?format=csv" -o report.csv

# JSON格式
curl "http://localhost:8000/reports/export?format=json"

# 按日期范围
curl "http://localhost:8000/reports/export?start_date=2024-06-01T00:00:00&end_date=2024-06-30T23:59:59"
```

### 11. 查询异常日志
```bash
curl http://localhost:8000/exception-logs/
curl http://localhost:8000/exception-logs/?appointment_id=1
```

## 冲突路径示例

### 场景1: 预约时间重叠
```bash
# 创建第一个预约（成功）
curl -X POST http://localhost:8000/appointments/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "salesperson_id": 1,
    "customer_id": 1,
    "start_time": "2024-06-20T10:00:00",
    "end_time": "2024-06-20T11:00:00"
  }'

# 尝试创建同一时间段的第二个预约（冲突）
curl -X POST http://localhost:8000/appointments/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "salesperson_id": 1,
    "customer_id": 2,
    "start_time": "2024-06-20T10:30:00",
    "end_time": "2024-06-20T11:30:00"
  }'
```

### 场景2: 预约与保养冲突
```bash
# 创建保养
curl -X POST http://localhost:8000/maintenances/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "start_time": "2024-06-21T09:00:00",
    "end_time": "2024-06-21T12:00:00",
    "type": "大保养"
  }'

# 尝试在保养时段创建预约（冲突）
curl -X POST http://localhost:8000/appointments/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "salesperson_id": 1,
    "customer_id": 1,
    "start_time": "2024-06-21T10:00:00",
    "end_time": "2024-06-21T11:00:00"
  }'
```

### 场景3: 车辆已锁定
```bash
# 锁定车辆
curl -X POST http://localhost:8000/vehicles/1/lock

# 尝试创建预约（冲突）
curl -X POST http://localhost:8000/appointments/ \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "salesperson_id": 1,
    "customer_id": 1,
    "start_time": "2024-06-22T10:00:00",
    "end_time": "2024-06-22T11:00:00"
  }'
```

## 运行测试

```bash
pytest test_main.py -v
```

## 数据模型

- **Vehicle**: 试驾车（车牌、型号、品牌、状态、当前里程）
- **Salesperson**: 销售（姓名、电话、员工号）
- **Customer**: 客户（姓名、电话、驾照号）
- **Appointment**: 预约记录（车辆、销售、客户、时间段、状态、里程）
- **Maintenance**: 保养记录（车辆、时间段、类型）
- **MileageRecord**: 里程记录（车辆、预约、里程、记录人）
- **ExceptionLog**: 异常日志（预约、原始输入、处理人、结论、异常类型）
