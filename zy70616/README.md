# 证书续期岗位资格补考管理系统

## 项目简介
用于管理员工证书续期、岗位资格匹配和补考状态追踪的后端系统。采用 FastAPI + SQLite 架构。

## 核心功能
- 员工证书管理与过期自动提醒
- 岗位资格自动匹配与评估
- 补考记录与状态全流程追踪
- 续期清单幂等处理（防重复创建）
- 人工修正与操作审计日志
- 多条件筛选与Excel清单导出
- 完整异常路径处理

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务启动在 http://localhost:8000

API文档: http://localhost:8000/docs

### 3. 造测试数据
```bash
python seed_data.py
```

### 4. 运行测试
```bash
pytest -v
pytest -v --tb=short  # 简洁输出
```

## CURL 主流程示例

### 员工管理
```bash
# 创建员工
curl -X POST "http://localhost:8000/employees/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"EMP001","name":"张三","department":"技术部","position":"工程师","status":"active"}'

# 查询所有员工
curl "http://localhost:8000/employees/"

# 查询单个员工
curl "http://localhost:8000/employees/EMP001"
```

### 证书管理
```bash
# 创建证书类型
curl -X POST "http://localhost:8000/certificate-types/" \
  -H "Content-Type: application/json" \
  -d '{"code":"CERT001","name":"软件工程师资格证","validity_period_months":36}'

# 为员工创建证书
curl -X POST "http://localhost:8000/employee-certificates/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "certificate_type_id": 1,
    "certificate_number": "CERT2024001",
    "issue_date": "2024-01-01",
    "expiry_date": "2027-01-01"
  }'

# 查询90天内即将过期的证书
curl "http://localhost:8000/employee-certificates/expiring/?days=90"

# 更新所有证书状态
curl -X PUT "http://localhost:8000/employee-certificates/update-statuses/"
```

### 课程成绩与补考
```bash
# 录入课程成绩（<60分自动创建补考记录）
curl -X POST "http://localhost:8000/course-scores/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "course_code": "CS001",
    "course_name": "Python高级编程",
    "score": 55.0,
    "exam_date": "2024-05-01"
  }'

# 查询员工补考记录
curl "http://localhost:8000/employees/EMP001/retakes/"

# 更新补考成绩
curl -X PUT "http://localhost:8000/retake-records/1" \
  -H "Content-Type: application/json" \
  -d '{"score":75.0,"actual_date":"2024-06-01","status":"completed_passed"}'
```

### 岗位资格匹配
```bash
# 创建岗位资格要求
curl -X POST "http://localhost:8000/position-requirements/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "position_name": "高级工程师",
    "required_certificate_types": "[\"CERT001\"]",
    "required_courses": "[\"CS001\"]"
  }'

# 重新评估资格
curl -X PUT "http://localhost:8000/position-requirements/1/evaluate/"

# 查询员工岗位资格
curl "http://localhost:8000/employees/EMP001/qualifications/"
```

### 续期清单管理
```bash
# 创建续期项目
curl -X POST "http://localhost:8000/renewal-items/" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "employee_certificate_id": 1,
    "renewal_batch": "2024_Q2",
    "due_date": "2024-06-30"
  }'

# 批量创建续期
curl -X POST "http://localhost:8000/renewal-items/batch/?renewal_batch=2024_Q2&certificate_ids=1,2,3"

# 推进状态
curl -X PUT "http://localhost:8000/renewal-items/1/status/?new_status=in_progress&operator=HR001"

# 人工修正
curl -X POST "http://localhost:8000/renewal-items/1/manual-correction/" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "HR_MANAGER",
    "original_status": "pending",
    "new_status": "approved",
    "reason": "特殊情况审批通过",
    "notes": "员工表现优异"
  }'

# 撤回续期
curl -X PUT "http://localhost:8000/renewal-items/1/withdraw/?operator=HR001&reason=员工离职"

# 关闭续期
curl -X PUT "http://localhost:8000/renewal-items/1/close/?operator=HR001&reason=无需续期"

# 多条件筛选查询
curl "http://localhost:8000/renewal-items/?status=pending&department=技术部&renewal_batch=2024_Q2"

# 统计概览
curl "http://localhost:8000/renewal-items/statistics/"

# 导出Excel
curl -O "http://localhost:8000/renewal-items/export/?status=pending"
```

### 操作日志
```bash
# 查询所有操作日志
curl "http://localhost:8000/operation-logs/"

# 查询特定续期项目的操作日志
curl "http://localhost:8000/operation-logs/?renewal_item_id=1"
```

## 异常路径与冲突处理

### 1. 员工编号重复
```bash
# 重复创建相同员工ID会返回400错误
curl -X POST "http://localhost:8000/employees/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"EMP001","name":"重复员工"}'
# 返回: {"detail":"员工编号已存在"}
```

### 2. 续期幂等性
```bash
# 同一员工同一证书同一批次重复创建只会生成一条记录
for i in {1..3}; do
  curl -X POST "http://localhost:8000/renewal-items/" \
    -H "Content-Type: application/json" \
    -d '{"employee_id":1,"employee_certificate_id":1,"renewal_batch":"2024_Q2"}'
done
# 结果: 数据库中只有1条记录
```

### 3. 操作留痕
```bash
# 所有状态变更、人工修正、撤回、关闭都会记录操作日志
# 日志包含: 操作类型、操作人、原始输入、处理结果、结论
curl "http://localhost:8000/operation-logs/?renewal_item_id=1"
```

### 4. 补考状态流转
```bash
# not_started -> scheduled -> completed_passed / completed_failed
# 成绩 >= 60: completed_passed
# 成绩 < 60: completed_failed
```

## 数据模型关系

```
Employee (员工)
├── EmployeeCertificate (员工证书) ← CertificateType (证书类型)
├── CourseScore (课程成绩)
│   └── RetakeRecord (补考记录)
├── PositionRequirement (岗位资格)
└── RenewalItem (续期清单)
    └── OperationLog (操作日志)
```

## 核心状态枚举

### CertificateStatus
- `valid`: 有效
- `expiring_soon`: 即将过期（90天内）
- `expired`: 已过期

### ExamStatus
- `passed`: 通过
- `failed`: 未通过

### RetakeStatus
- `not_started`: 未开始
- `scheduled`: 已安排
- `completed_passed`: 补考通过
- `completed_failed`: 补考未通过

### RenewalStatus
- `pending`: 待处理
- `in_progress`: 进行中
- `approved`: 已通过
- `rejected`: 已拒绝
- `withdrawn`: 已撤回
- `closed`: 已关闭

### QualificationMatch
- `fully_matched`: 完全匹配
- `partially_matched`: 部分匹配
- `not_matched`: 未匹配
