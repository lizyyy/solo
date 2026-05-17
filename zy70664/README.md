# 部门订餐取消冲抵忌口统计系统

公司食堂订餐管理系统，支持多部门订餐导入、取消冲抵、忌口统计、异常处理和备餐报告导出。

## 技术栈

- **FastAPI**: Web框架
- **SQLite**: 数据库
- **SQLAlchemy**: ORM
- **Pandas + OpenPyXL**: Excel导出
- **Pytest**: 测试框架

## 项目结构

```
.
├── app/
│   ├── api/              # API路由
│   │   ├── base.py       # 基础数据API
│   │   └── orders.py     # 订餐管理API
│   ├── core/             # 核心配置
│   │   └── database.py   # 数据库配置
│   ├── models/           # 数据模型
│   │   └── models.py     # 实体模型
│   ├── schemas/          # Pydantic模式
│   │   └── schemas.py    # 请求/响应模式
│   ├── services/         # 业务逻辑
│   │   ├── base_service.py
│   │   └── order_service.py
│   └── main.py           # 应用入口
├── scripts/              # 脚本
│   └── seed_data.py      # 造数脚本
├── tests/                # 测试
├── requirements.txt      # 依赖
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问:
- API文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

### 3. 造数

```bash
python scripts/seed_data.py
```

将创建测试数据：
- 5个部门
- 3种餐别（早餐、午餐、晚餐）
- 20-30名员工
- 订餐记录（今天和明天）
- 取消记录（含匹配和未匹配）

## 核心业务流程

### 主流程

```
1. 维护基础数据（部门、员工、餐别）
2. 批量导入订餐记录
3. 导入取消记录并自动冲抵
4. 处理异常（未匹配的取消记录）
5. 生成备餐报告
6. 确认/关闭报告
7. 导出Excel报告
```

### 异常处理流程

```
异常记录 → 查看详情 → 人工处理 → 记录处理人/处理结论
```

## CURL示例

### 基础数据

```bash
# 获取部门列表
curl http://localhost:8000/api/v1/base/departments

# 获取餐别列表
curl http://localhost:8000/api/v1/base/meal-types

# 获取员工列表
curl http://localhost:8000/api/v1/base/employees
```

### 订餐管理

```bash
# 批量导入订餐
curl -X POST http://localhost:8000/api/v1/orders/batch-import \
  -H "Content-Type: application/json" \
  -d '[{
    "department_id": 1,
    "employee_id": 1,
    "meal_date": "2024-01-15",
    "meal_type_id": 2,
    "quantity": 1,
    "diet_restriction": "不吃辣",
    "remarks": "打包"
  }]'

# 获取订餐列表
curl "http://localhost:8000/api/v1/orders?meal_date=2024-01-15"
```

### 取消冲抵

```bash
# 取消记录冲抵
curl -X POST http://localhost:8000/api/v1/orders/cancellation-offset \
  -H "Content-Type: application/json" \
  -d '[{
    "cancel_date": "2024-01-15",
    "cancel_quantity": 1,
    "reason": "临时有事",
    "employee_no": "EMP1001",
    "department_code": "TECH",
    "meal_type_code": "LUNCH"
  }]'

# 获取取消记录
curl http://localhost:8000/api/v1/orders/cancellations
```

### 异常处理

```bash
# 获取异常列表
curl http://localhost:8000/api/v1/orders/exceptions?status=pending

# 处理异常
curl -X PUT "http://localhost:8000/api/v1/orders/exceptions/1/handle" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "管理员",
    "handle_result": "已人工匹配",
    "handle_notes": "手动关联订餐记录"
  }'
```

### 人工修正与撤回

```bash
# 人工修正订餐
curl -X PUT "http://localhost:8000/api/v1/orders/1/correct?handler=管理员" \
  -H "Content-Type: application/json" \
  -d '{"diet_restriction": "素食", "remarks": "已修正"}'

# 撤回订餐
curl -X PUT "http://localhost:8000/api/v1/orders/1/withdraw?handler=管理员&reason=重复录入"
```

### 备餐报告

```bash
# 生成备餐报告
curl -X POST http://localhost:8000/api/v1/orders/generate-report \
  -H "Content-Type: application/json" \
  -d '{"report_date": "2024-01-15"}'

# 获取报告列表
curl "http://localhost:8000/api/v1/orders/reports?report_date=2024-01-15"

# 确认报告
curl -X PUT "http://localhost:8000/api/v1/orders/reports/1/confirm?confirmed_by=管理员"

# 关闭报告
curl -X PUT "http://localhost:8000/api/v1/orders/reports/1/close?closed_by=管理员"

# 获取忌口统计汇总
curl "http://localhost:8000/api/v1/orders/diet-restriction-summary?report_date=2024-01-15"

# 导出Excel报告
curl -O -J "http://localhost:8000/api/v1/orders/export-report?report_date=2024-01-15"
```

## 数据模型

### Department (部门)
- id, name, code, contact, phone, is_active

### Employee (员工)
- id, department_id, name, employee_no, default_diet_restriction, is_active

### MealType (餐别)
- id, name, code, start_time, end_time, sort_order, is_active

### OrderRecord (订餐记录)
- id, batch_id, department_id, employee_id, meal_date, meal_type_id
- quantity, diet_restriction, remarks, source_file, raw_data, status

### CancellationRecord (取消记录)
- id, order_record_id, batch_id, cancel_date, cancel_quantity
- reason, source_file, raw_data, matched, status

### OrderException (异常记录)
- id, order_record_id, batch_id, exception_type, description
- raw_data, handler, handle_result, handle_notes, handled_at, status

### MealReport (备餐报告)
- id, report_date, meal_type_id, department_id
- total_orders, total_cancelled, net_quantity
- diet_restrictions, restriction_count, status

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_orders.py -v

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

## 核心规则说明

### 取消冲抵规则
1. 优先按 `order_record_id` 精确匹配
2. 其次按 `员工号 + 部门代码 + 餐别代码 + 日期` 模糊匹配
3. 无法匹配的取消记录标记为异常
4. 所有异常保留原始输入和处理痕迹

### 忌口统计规则
1. 按餐别 + 部门聚合
2. 统计每种忌口类型的数量
3. 区分统计来源（订餐备注/员工默认）
4. 报告中保留原始备注

### 状态流转
```
订餐: pending → manual_updated → withdrawn
取消: pending → matched / unmatched
报告: draft → confirmed → closed
异常: pending → handled
```

## 配置说明

### 数据库
默认使用 SQLite，数据库文件为 `canteen.db`

如需修改，编辑 `app/core/database.py`:
```python
SQLALCHEMY_DATABASE_URL = "sqlite:///./canteen.db"
```
