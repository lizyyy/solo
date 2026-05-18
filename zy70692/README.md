# 牙科复诊排班匹配系统

基于 FastAPI + SQLite 的牙科诊所复诊提醒管理后端API，实现治疗方案、医生排班和爽约记录的统一管理。

## 功能特性

- 患者管理：患者信息增删改查
- 医生排班管理：医生排班创建、查询可用排班
- 治疗计划管理：治疗计划创建、待处理计划查询
- 提醒管理：
  - 排班智能匹配
  - 重复提醒拦截
  - 状态推进（待处理→已排班→已发送→已确认→已完成）
  - 人工修正
  - 撤回/关闭
- 爽约记录：爽约标记、原因记录
- 复诊报告：复诊结果记录
- 数据导出：JSON/CSV格式导出
- 异常日志：记录异常操作及处理情况

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
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

### 初始化测试数据

```bash
python seed_data.py
```

将创建测试数据：
- 3名医生（张医生、李医生、王医生）
- 4名患者
- 21个医生排班（未来7天）
- 4个治疗计划

## API 使用示例

### 主流程示例

以下是完整的复诊提醒流程示例：

#### 1. 创建患者
```bash
curl -X POST "http://localhost:8000/patients/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "phone": "13800138888",
    "email": "zhangsan@example.com",
    "age": 35,
    "gender": "男"
  }'
```

#### 2. 创建医生
```bash
curl -X POST "http://localhost:8000/doctors/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张医生",
    "department": "口腔科",
    "title": "主任医师",
    "phone": "13900139999"
  }'
```

#### 3. 创建医生排班
```bash
curl -X POST "http://localhost:8000/schedules/" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 1,
    "schedule_date": "2024-01-15",
    "start_time": "09:00:00",
    "end_time": "12:00:00",
    "max_patients": 10,
    "is_available": true
  }'
```

#### 4. 创建治疗计划
```bash
curl -X POST "http://localhost:8000/treatment-plans/" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 1,
    "doctor_id": 1,
    "treatment_name": "根管治疗复查",
    "treatment_description": "术后一周复查",
    "next_revisit_date": "2024-01-15",
    "revisit_type": "常规复查"
  }'
```

#### 5. 查询待处理治疗计划（提醒窗口内）
```bash
curl -X GET "http://localhost:8000/treatment-plans/pending/"
```

#### 6. 排班匹配 - 创建提醒
```bash
curl -X POST "http://localhost:8000/reminders/match/" \
  -H "Content-Type: application/json" \
  -d '{
    "treatment_plan_id": 1,
    "schedule_id": 1
  }'
```

#### 7. 更新提醒状态（发送提醒）
```bash
curl -X PATCH "http://localhost:8000/reminders/1/status/" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "sent",
    "notes": "已发送短信提醒",
    "operator": "系统"
  }'
```

#### 8. 患者确认
```bash
curl -X PATCH "http://localhost:8000/reminders/1/status/" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "notes": "患者电话确认",
    "operator": "前台"
  }'
```

#### 9. 完成复诊并创建报告
```bash
curl -X POST "http://localhost:8000/revisit-reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 1,
    "reminder_record_id": 1,
    "treatment_plan_id": 1,
    "report_date": "2024-01-15",
    "doctor_name": "张医生",
    "diagnosis": "恢复良好，无感染",
    "treatment_result": "完成",
    "created_by": "张医生"
  }'
```

### 冲突路径示例

#### 1. 重复提醒拦截（同一治疗计划同一日期只能有一个提醒）
```bash
# 第一次匹配
curl -X POST "http://localhost:8000/reminders/match/" \
  -H "Content-Type: application/json" \
  -d '{"treatment_plan_id": 1, "schedule_id": 1}'

# 第二次匹配同一日期 - 会失败
curl -X POST "http://localhost:8000/reminders/match/" \
  -H "Content-Type: application/json" \
  -d '{"treatment_plan_id": 1, "schedule_id": 1}'
```

**预期结果**: 返回400错误，提示"该治疗计划在该日期已有提醒"

#### 2. 医生当日重复排班
```bash
# 第一次排班
curl -X POST "http://localhost:8000/schedules/" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 1,
    "schedule_date": "2024-01-15",
    "start_time": "09:00:00",
    "end_time": "12:00:00",
    "max_patients": 10,
    "is_available": true
  }'

# 同一医生同一日期再次排班 - 会失败
curl -X POST "http://localhost:8000/schedules/" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 1,
    "schedule_date": "2024-01-15",
    "start_time": "14:00:00",
    "end_time": "17:00:00",
    "max_patients": 10,
    "is_available": true
  }'
```

**预期结果**: 返回400错误，提示"该医生当日已有排班"

#### 3. 无效状态转换
```bash
# 创建提醒
curl -X POST "http://localhost:8000/reminders/" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 1,
    "treatment_plan_id": 1,
    "reminder_date": "2024-01-15",
    "status": "pending"
  }'

# 尝试设置无效状态
curl -X PATCH "http://localhost:8000/reminders/1/status/" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "invalid_status",
    "operator": "测试"
  }'
```

**预期结果**: 返回400错误

### 其他常用接口

#### 人工修正提醒
```bash
curl -X PATCH "http://localhost:8000/reminders/1/correct/" \
  -H "Content-Type: application/json" \
  -d '{
    "reminder_date": "2024-01-20",
    "reminder_time": "14:00:00",
    "notes": "患者要求改期",
    "operator": "前台护士"
  }'
```

#### 撤回/取消提醒
```bash
curl -X POST "http://localhost:8000/reminders/1/cancel/" \
  -G \
  -d "operator=前台" \
  -d "reason=患者临时有事取消"
```

#### 记录爽约
```bash
curl -X POST "http://localhost:8000/missed-appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "reminder_record_id": 1,
    "miss_date": "2024-01-15",
    "reason_code": "P001",
    "reason_description": "患者忘记时间",
    "reported_by": "前台",
    "is_manual": true
  }'
```

#### 导出提醒数据
```bash
# JSON格式
curl -X GET "http://localhost:8000/export/reminders/"

# CSV格式
curl -X GET "http://localhost:8000/export/reminders/?format=csv"

# 按日期范围过滤
curl -X GET "http://localhost:8000/export/reminders/?start_date=2024-01-01&end_date=2024-01-31"

# 按状态过滤
curl -X GET "http://localhost:8000/export/reminders/?status=confirmed"
```

#### 查询异常日志
```bash
# 未解决异常
curl -X GET "http://localhost:8000/exceptions/?is_resolved=false"

# 全部异常
curl -X GET "http://localhost:8000/exceptions/"

# 解决异常
curl -X PATCH "http://localhost:8000/exceptions/1/resolve/" \
  -G \
  -d "handler=管理员" \
  -d "conclusion=已核实并恢复数据"
```

## 运行测试

### 运行所有测试
```bash
pytest test_api.py -v
```

### 运行指定测试
```bash
pytest test_api.py::test_full_workflow -v
```

### 生成测试覆盖率报告
```bash
pytest test_api.py --cov=. --cov-report=html
```

## 数据库模型

### 主要数据表

1. **patients** - 患者表
   - id, name, phone, email, age, gender, created_at, updated_at

2. **doctors** - 医生表
   - id, name, department, title, phone, created_at

3. **doctor_schedules** - 医生排班表
   - id, doctor_id, schedule_date, start_time, end_time, max_patients, booked_count, is_available

4. **treatment_plans** - 治疗计划表
   - id, patient_id, doctor_id, treatment_name, treatment_description, next_revisit_date, revisit_type, status

5. **reminder_records** - 提醒记录表
   - id, patient_id, treatment_plan_id, schedule_id, reminder_date, reminder_time, status, retry_count, notes

6. **missed_appointments** - 爽约记录表
   - id, reminder_record_id, miss_date, reason_code, reason_description, reported_by, is_manual

7. **revisit_reports** - 复诊报告表
   - id, patient_id, reminder_record_id, treatment_plan_id, report_date, doctor_name, diagnosis, treatment_result

8. **exception_logs** - 异常日志表
   - id, operation_type, original_input, error_message, handler, conclusion, is_resolved, created_at, resolved_at

### 提醒状态枚举

- `pending` - 待处理
- `scheduled` - 已排班
- `sent` - 已发送提醒
- `confirmed` - 已确认
- `cancelled` - 已取消
- `missed` - 已爽约
- `completed` - 已完成

## 核心业务规则

1. **提醒窗口**: 默认未来7天内需要复诊的治疗计划会被纳入待处理列表
2. **排班匹配**: 匹配时自动检查医生排班可用性及预约人数
3. **重复提醒拦截**: 同一治疗计划同一日期只能创建一个有效提醒
4. **爽约自动记录**: 当提醒状态设置为`missed`时自动创建爽约记录
5. **排班释放**: 取消提醒时自动释放对应排班预约名额

## 项目结构

```
.
├── main.py              # FastAPI主应用，API路由定义
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic请求/响应模式
├── crud.py              # 业务逻辑和数据库操作
├── database.py          # 数据库连接配置
├── seed_data.py         # 测试数据初始化脚本
├── test_api.py          # pytest测试用例
├── requirements.txt     # 依赖包列表
└── README.md           # 项目说明文档
```

## 注意事项

1. 生产环境请更换数据库连接字符串，不建议使用SQLite
2. 建议添加用户认证和权限控制
3. 可根据实际需求调整提醒窗口天数（在crud.py中修改REMINDER_WINDOW_DAYS）
4. 异常日志需要定期清理和处理
