# 证书续期岗位资格补考管理系统

基于 FastAPI + SQLite 的企业级员工证书管理、课程成绩、补考记录、岗位资格检查和续期清单管理后端API。

## 核心功能

- **员工管理**：员工信息增删改查
- **证书类型管理**：证书类型配置（有效期、及格分数等）
- **员工证书管理**：员工证书信息和状态跟踪
- **课程成绩与补考**：成绩录入，不及格自动创建补考记录
- **岗位资格检查**：基于岗位要求自动检查员工资格状态
- **续期清单管理**：证书续期跟踪、状态流转、幂等性保障
- **过期提醒**：证书即将过期/已过期自动提醒
- **人工修正/撤回/关闭**：异常处理，保留原始输入和操作记录
- **数据导出**：CSV格式导出续期清单和过期提醒

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **测试**: pytest + TestClient

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问:
- API文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

### 3. 创建测试数据

```bash
python create_test_data.py
```

这会创建包含以下内容的测试数据:
- 5名员工（张三、李四、王五等）
- 3种证书类型（安全生产、质量管理、技术等级）
- 6条员工证书记录（含已过期、即将过期、有效状态）
- 7条课程成绩记录（含不及格自动创建补考）
- 6条岗位要求配置
- 4条续期清单项

---

## API 主流程示例 (curl)

### 一、基础数据管理

#### 1. 创建员工

```bash
curl -X POST "http://localhost:8000/employees/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP001",
    "name": "张三",
    "department": "生产部",
    "position": "高级工程师",
    "email": "zhangsan@example.com",
    "phone": "13800138001"
  }'
```

#### 2. 创建证书类型

```bash
curl -X POST "http://localhost:8000/certificate-types/" \
  -H "Content-Type: application/json" \
  -d '{
    "type_code": "SAFETY_001",
    "name": "安全生产证书",
    "description": "安全生产培训合格证书",
    "validity_period_months": 36,
    "required_score": 60.0
  }'
```

#### 3. 录入员工证书

```bash
curl -X POST "http://localhost:8000/employee-certificates/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "certificate_type_id": 1,
    "certificate_number": "SAFE2024001",
    "issue_date": "2024-01-01",
    "expiry_date": "2027-01-01",
    "score": 85.0
  }'
```

### 二、课程成绩与补考流程

#### 1. 录入及格成绩

```bash
curl -X POST "http://localhost:8000/course-scores/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "certificate_type_id": 1,
    "course_name": "安全生产基础培训",
    "score": 75.0,
    "exam_date": "2024-03-15"
  }'
```
**结果**: `is_passed = true`，不创建补考记录

#### 2. 录入不及格成绩（自动创建补考）

```bash
curl -X POST "http://localhost:8000/course-scores/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "certificate_type_id": 1,
    "course_name": "安全生产基础培训",
    "score": 55.0,
    "exam_date": "2024-03-15"
  }'
```
**结果**: `is_passed = false`，自动创建补考记录，状态为「未开始」

#### 3. 查询补考记录

```bash
curl "http://localhost:8000/retake-records/?employee_id=1"
```

#### 4. 更新补考记录（补考通过）

```bash
curl -X PUT "http://localhost:8000/retake-records/1" \
  -H "Content-Type: application/json" \
  -d '{
    "retake_date": "2024-04-01",
    "retake_score": 72.0
  }'
```
**结果**: 状态自动变为「已通过」，`is_passed = true`

### 三、岗位资格检查

#### 1. 配置岗位要求

```bash
curl -X POST "http://localhost:8000/position-requirements/" \
  -H "Content-Type: application/json" \
  -d '{
    "position_name": "高级工程师",
    "certificate_type_id": 1,
    "is_required": true,
    "description": "安全生产证书为必备"
  }'
```

#### 2. 检查员工岗位资格

```bash
curl "http://localhost:8000/qualification-check/1/高级工程师"
```

**响应示例**:
```json
[
  {
    "employee_id": "EMP001",
    "employee_name": "张三",
    "position_name": "高级工程师",
    "certificate_type": "安全生产证书",
    "has_certificate": true,
    "is_certificate_valid": true,
    "certificate_status": "有效",
    "has_required_score": true,
    "is_qualified": true,
    "remarks": "符合要求"
  }
]
```

### 四、续期清单管理

#### 1. 创建续期项（幂等）

```bash
curl -X POST "http://localhost:8000/renewal-items/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "certificate_type_id": 1,
    "priority": 2,
    "due_date": "2024-12-31",
    "assigned_to": "人事部小李",
    "remarks": "证书即将过期"
  }'
```
**幂等性保证**: 同一员工+同一证书类型的待处理/处理中续期项不会重复创建

#### 2. 状态推进（待处理 → 处理中 → 已完成）

```bash
# 第一次推进：待处理 → 处理中
curl -X PUT "http://localhost:8000/renewal-items/1/advance"

# 第二次推进：处理中 → 已完成
curl -X PUT "http://localhost:8000/renewal-items/1/advance"
```

#### 3. 获取续期统计

```bash
curl "http://localhost:8000/renewal-statistics/"
```

**响应示例**:
```json
{
  "total": 10,
  "pending": 5,
  "in_progress": 3,
  "completed": 1,
  "cancelled": 0,
  "closed": 1
}
```

### 五、证书过期提醒

```bash
# 获取90天内即将过期或已过期的证书
curl "http://localhost:8000/certificate-expiry-alerts/?days_threshold=90"
```

### 六、数据导出

```bash
# 导出续期清单
curl -O -J "http://localhost:8000/export/renewal-items/"

# 导出过期提醒
curl -O -J "http://localhost:8000/export/certificate-expiry-alerts/?days_threshold=90"
```

---

## 冲突与异常路径示例

### 1. 员工编号重复（唯一键冲突）

```bash
# 第一次创建（成功）
curl -X POST "http://localhost:8000/employees/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "EMP001", "name": "张三", "department": "生产部"}'

# 第二次创建相同员工编号（失败）
curl -X POST "http://localhost:8000/employees/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "EMP001", "name": "李四", "department": "质量部"}'
```
**HTTP 400**: `{"detail": "员工编号已存在"}`

### 2. 续期状态推进失败（已完成无法继续推进）

```bash
# 创建续期项
curl -X POST "http://localhost:8000/renewal-items/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1, "certificate_type_id": 1}'

# 推进两次到"已完成"状态
curl -X PUT "http://localhost:8000/renewal-items/1/advance"
curl -X PUT "http://localhost:8000/renewal-items/1/advance"

# 第三次推进（失败）
curl -X PUT "http://localhost:8000/renewal-items/1/advance"
```
**HTTP 400**: `{"detail": "当前状态无法推进"}`

### 3. 人工修正续期项（带审计日志）

```bash
curl -X POST "http://localhost:8000/renewal-items/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "王经理",
    "conclusion": "特殊情况处理：员工已转岗无需续期",
    "new_status": "已关闭",
    "remarks": "转岗至不需要此证书的岗位"
  }'
```
**特性**: 
- 原始输入完整记录到异常日志表
- 处理人、处理结论、修改时间全部保留
- 备注自动追加修改记录

### 4. 取消续期项

```bash
curl -X POST "http://localhost:8000/renewal-items/1/cancel?handler=人事部&reason=员工已离职"
```
**状态变更**: 从「待处理」→「已取消」，操作记录到异常日志

### 5. 关闭续期项

```bash
curl -X POST "http://localhost:8000/renewal-items/1/close?handler=人事部&conclusion=续期流程结束，证书已更新"
```
**状态变更**: 从任意状态 →「已关闭」

### 6. 查看异常操作日志

```bash
curl "http://localhost:8000/exception-logs/"
```

---

## pytest 测试

### 运行所有测试

```bash
pytest test_main.py -v
```

### 运行指定测试类

```bash
# 员工管理测试
pytest test_main.py::TestEmployee -v

# 续期清单测试
pytest test_main.py::TestRenewalItem -v

# 资格检查测试
pytest test_main.py::TestQualificationCheck -v
```

### 测试覆盖范围

| 测试类 | 测试内容 | 用例数 |
|--------|----------|--------|
| TestEmployee | 员工增改查、重复编号、不存在记录 | 4 |
| TestCertificateType | 证书类型创建、重复编码 | 2 |
| TestCourseScoreAndRetake | 成绩及格/不及格、补考创建与更新 | 4 |
| TestRenewalItem | 创建、幂等性、状态推进、人工修正、取消、关闭、统计 | 9 |
| TestQualificationCheck | 资格通过/不通过场景 | 2 |
| TestCertificateExpiryAlerts | 过期提醒功能 | 1 |
| TestExport | CSV导出功能 | 2 |

**总计**: 24个测试用例，覆盖正常路径和异常路径

---

## 核心业务规则说明

### 1. 资格匹配规则

员工岗位资格通过 = 有对应证书 AND 证书有效（未过期）AND 有达标成绩（必需要求时）

### 2. 补考状态流转

```
未开始 → 进行中 → 已通过 / 未通过
```
- 成绩不及格时自动创建补考记录，状态为「未开始」
- 录入补考分数时自动判断是否通过

### 3. 续期状态流转

```
待处理 → 处理中 → 已完成
                    ↘
              取消 → 已取消
              关闭 → 已关闭
```
- 正常流程支持两次推进操作
- 取消/关闭为终态，不可继续推进

### 4. 重复续期幂等性

同一员工 + 同一证书类型，只要存在「待处理」或「处理中」的续期项，再次创建时直接返回已有记录，不会重复创建。

### 5. 异常处理审计

所有人工修正、取消、关闭操作均记录到异常日志表，包含：
- 操作类型
- 原始输入JSON
- 处理人
- 处理结论
- 操作时间

---

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI主应用和路由
│   ├── models.py        # SQLAlchemy数据模型
│   ├── schemas.py       # Pydantic请求/响应模型
│   ├── crud.py          # 业务逻辑和数据库操作
│   └── database.py      # 数据库连接配置
├── create_test_data.py  # 测试数据生成脚本
├── test_main.py         # pytest测试文件
├── requirements.txt     # Python依赖
└── README.md           # 项目说明文档
```

## 数据模型关系

- **Employee** 1:N **EmployeeCertificate** (一个员工多个证书)
- **Employee** 1:N **CourseScore** (一个员工多个课程成绩)
- **CourseScore** 1:N **RetakeRecord** (一个成绩多个补考)
- **Employee** 1:N **RenewalItem** (一个员工多个续期项)
- **PositionRequirement** N:1 **CertificateType** (岗位要求对应证书类型)
