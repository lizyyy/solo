# 私教消课请假冻结代课确认系统 API

基于 FastAPI + SQLite 实现的私教课管理后端API，支持预约、请假、代课、消课、课时冻结、报表导出等功能。

## 功能特性

- **会员管理**: 会员卡创建、查询、课时统计
- **课程包管理**: 课程包创建、查询、剩余课时追踪
- **预约管理**: 创建预约、确认、取消、时间冲突检测
- **请假管理**: 申请请假、审批、课时冻结
- **代课管理**: 代课申请、确认、拒绝
- **消课管理**: 消课、重复消课拦截、消课撤回
- **补课安排**: 请假后安排补课
- **人工修正**: 支持后台人工修正课时和状态
- **操作日志**: 完整记录所有操作，便于审计追溯
- **报表导出**: CSV格式消课报表导出

## 核心规则

1. **时间冲突检测**: 同一教练同一时间段不能重复预约
2. **取消窗口**: 上课前24小时内不可取消预约
3. **重复消课拦截**: 已消课的预约不可重复消课
4. **课时冻结**: 请假审批通过后课时自动冻结，安排补课后解冻
5. **代课确认**: 代课需双方确认，确认后状态更新

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问: http://localhost:8000/docs 查看Swagger文档

### 初始化测试数据

```bash
python seed_data.py
```

## API 接口示例 (cURL)

### 1. 教练管理

#### 创建教练
```bash
curl -X POST "http://localhost:8000/coaches/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张教练",
    "phone": "13800138001",
    "specialty": "增肌训练"
  }'
```

#### 查询所有教练
```bash
curl -X GET "http://localhost:8000/coaches/"
```

### 2. 会员卡管理

#### 创建会员卡
```bash
curl -X POST "http://localhost:8000/member-cards/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_name": "张三",
    "member_phone": "13900139001",
    "card_number": "CARD001",
    "total_hours": 48
  }'
```

#### 查询会员卡
```bash
curl -X GET "http://localhost:8000/member-cards/1"
```

### 3. 课程包管理

#### 创建课程包
```bash
curl -X POST "http://localhost:8000/course-packages/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "package_name": "年卡私教课",
    "course_type": "增肌课程",
    "total_hours": 48,
    "coach_id": 1
  }'
```

### 4. 预约管理

#### 创建预约
```bash
curl -X POST "http://localhost:8000/bookings/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "course_package_id": 1,
    "main_coach_id": 1,
    "booking_date": "2024-01-15T10:00:00",
    "start_time": "10:00",
    "end_time": "11:00",
    "hours": 1,
    "created_by": "admin"
  }'
```

#### 确认预约
```bash
curl -X POST "http://localhost:8000/bookings/1/confirm?handler=admin"
```

#### 取消预约
```bash
curl -X POST "http://localhost:8000/bookings/1/cancel?handler=admin&reason=会员临时有事"
```

### 5. 消课管理

#### 消课
```bash
curl -X POST "http://localhost:8000/bookings/1/consume?consumed_by=admin&notes=正常消课"
```

#### 撤回消课
```bash
curl -X POST "http://localhost:8000/consumptions/1/rollback?reason=消课错误&handler=admin"
```

### 6. 请假管理

#### 申请请假
```bash
curl -X POST "http://localhost:8000/leaves/?handler=member" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "reason": "身体不适",
    "freeze_hours": true
  }'
```

#### 批准请假
```bash
curl -X POST "http://localhost:8000/leaves/1/approve?handler=admin"
```

#### 拒绝请假
```bash
curl -X POST "http://localhost:8000/leaves/1/reject?handler=admin&rejection_reason=请假时间过短"
```

### 7. 代课管理

#### 申请代课
```bash
curl -X POST "http://localhost:8000/substitutes/?handler=admin" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "substitute_coach_id": 2,
    "reason": "原教练有事"
  }'
```

#### 确认代课
```bash
curl -X POST "http://localhost:8000/substitutes/1/confirm?handler=admin"
```

#### 拒绝代课
```bash
curl -X POST "http://localhost:8000/substitutes/1/reject?handler=admin&rejection_reason=代课教练时间冲突"
```

### 8. 补课安排

#### 安排补课
```bash
curl -X POST "http://localhost:8000/makeups/?original_booking_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "course_package_id": 1,
    "main_coach_id": 1,
    "booking_date": "2024-01-20T10:00:00",
    "start_time": "10:00",
    "end_time": "11:00",
    "hours": 1,
    "created_by": "admin"
  }'
```

### 9. 人工修正

#### 人工调整课时
```bash
curl -X POST "http://localhost:8000/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "member_card",
    "target_id": 1,
    "correction_type": "adjust_hours",
    "new_value": "10",
    "reason": "赠送课时",
    "handler": "admin"
  }'
```

### 10. 报表管理

#### 生成消课报表
```bash
curl -X POST "http://localhost:8000/report/" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 导出CSV报表
```bash
curl -X POST "http://localhost:8000/report/export" \
  -H "Content-Type: application/json" \
  -d '{}' --output report.csv
```

### 11. 操作日志

#### 查询操作日志
```bash
curl -X GET "http://localhost:8000/operation-logs/"
```

## 冲突场景测试

### 1. 时间冲突测试
```bash
# 创建第一个预约
curl -X POST "http://localhost:8000/bookings/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "course_package_id": 1,
    "main_coach_id": 1,
    "booking_date": "2024-01-15T10:00:00",
    "start_time": "10:00",
    "end_time": "11:00",
    "hours": 1,
    "created_by": "admin"
  }'

# 创建冲突预约（同一教练同一时间段）- 应该返回400错误
curl -X POST "http://localhost:8000/bookings/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "course_package_id": 1,
    "main_coach_id": 1,
    "booking_date": "2024-01-15T10:00:00",
    "start_time": "10:30",
    "end_time": "11:30",
    "hours": 1,
    "created_by": "admin"
  }'
```

### 2. 重复消课测试
```bash
# 第一次消课 - 成功
curl -X POST "http://localhost:8000/bookings/1/consume?consumed_by=admin"

# 第二次消课 - 应该返回400错误
curl -X POST "http://localhost:8000/bookings/1/consume?consumed_by=admin"
```

### 3. 课时不足测试
```bash
# 创建一个只有1小时的课程包
curl -X POST "http://localhost:8000/course-packages/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "package_name": "体验课",
    "total_hours": 1,
    "coach_id": 1
  }'

# 预约2小时 - 应该返回400错误
curl -X POST "http://localhost:8000/bookings/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_card_id": 1,
    "course_package_id": 2,
    "main_coach_id": 1,
    "booking_date": "2024-01-15T10:00:00",
    "start_time": "10:00",
    "end_time": "12:00",
    "hours": 2,
    "created_by": "admin"
  }'
```

## 运行测试

```bash
pytest test_api.py -v
```

运行指定测试:
```bash
pytest test_api.py::test_consume_booking -v
```

生成测试覆盖率报告:
```bash
pytest test_api.py --cov=. --cov-report=html
```

## 数据库结构

主要数据表：

- `coaches`: 教练表
- `member_cards`: 会员卡表
- `course_packages`: 课程包表
- `bookings`: 预约表
- `leave_applications`: 请假申请表
- `substitute_records`: 代课记录表
- `consumption_records`: 消课记录表
- `operation_logs`: 操作日志表

## 状态流转

### 预约状态
- `pending`: 待确认
- `confirmed`: 已确认
- `consumed`: 已消课
- `cancelled`: 已取消
- `leave_applied`: 已申请请假
- `leave_approved`: 已批准请假
- `substitute_requested`: 已申请代课
- `substitute_confirmed`: 已确认代课
- `makeup_scheduled`: 已安排补课

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── models.py            # 数据库模型
├── schemas.py           # Pydantic模型
├── crud.py              # 业务逻辑
├── database.py          # 数据库配置
├── seed_data.py         # 测试数据脚本
├── test_api.py          # pytest测试用例
├── requirements.txt     # 依赖列表
└── README.md            # 项目文档
```
