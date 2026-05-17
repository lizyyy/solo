# 二课学分多源合并驳回原因后端API

基于 FastAPI + SQLite 实现的第二课堂学分管理系统，支持多源学分合并、学分上限控制、重复活动去重、驳回原因追踪、学生申诉处理、审计日志、报告导出等功能。

## 功能特性

- **多源学分合并**：按活动类型（讲座、竞赛、志愿服务）分别统计
- **学分上限控制**：各类型学分独立设置上限，超额不计入
- **重复活动自动驳回**：系统自动检测并标记重复申请
- **驳回原因记录**：完整记录驳回原因、处理人、原始输入
- **学生申诉处理**：支持人工修正学分，记录申诉详情
- **状态流转**：pending → approved/rejected → withdrawn
- **审计日志**：完整记录所有操作历史
- **报告导出**：支持导出CSV格式学分报告

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API文档：http://localhost:8000/docs
- 根路径：http://localhost:8000

### 3. 填充测试数据

```bash
python seed_data.py
```

## API 接口说明

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 服务健康检查 |
| POST | /students/ | 创建学生 |
| GET | /students/{student_id} | 查询学生信息 |
| POST | /activity-types/ | 创建活动类型 |
| GET | /activity-types/ | 查询活动类型列表 |

### 学分申请接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /credit-applications/ | 创建学分申请 |
| GET | /credit-applications/{application_id} | 查询申请详情 |
| GET | /students/{student_id}/credit-applications/ | 查询学生的所有申请 |
| PUT | /credit-applications/{application_id}/status | 更新申请状态 |
| PUT | /credit-applications/{application_id}/manual-correction | 人工修正学分 |
| PUT | /credit-applications/{application_id}/withdraw | 撤回申请 |
| GET | /credit-applications/{application_id}/audit-logs | 查询审计日志 |

### 学分汇总与报告接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /students/{student_id}/credit-summary | 查询学生学分汇总 |
| POST | /credit-reports/ | 生成学分报告 |
| GET | /credit-reports/{report_id} | 查询报告详情 |
| GET | /credit-reports/{report_id}/export | 导出CSV报告 |

## CURL 主流程示例

### 1. 创建学生

```bash
curl -X POST "http://localhost:8000/students/" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "name": "张三",
    "grade": "2024级",
    "major": "计算机科学与技术"
  }'
```

### 2. 创建活动类型

```bash
curl -X POST "http://localhost:8000/activity-types/" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "lecture",
    "name": "讲座",
    "max_credit": 2.0,
    "description": "各类学术讲座"
  }'
```

### 3. 创建学分申请

```bash
curl -X POST "http://localhost:8000/credit-applications/" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "activity_type_code": "lecture",
    "activity_name": "人工智能前沿讲座",
    "credit": 0.5,
    "proof_material": "https://example.com/proof.pdf"
  }'
```

### 4. 审核通过申请

```bash
curl -X PUT "http://localhost:8000/credit-applications/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "approved",
    "handler": "admin",
    "comment": "材料齐全，审核通过"
  }'
```

### 5. 审核驳回申请（带驳回原因）

```bash
curl -X PUT "http://localhost:8000/credit-applications/2/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "rejected",
    "handler": "admin",
    "comment": "材料不全",
    "rejection_reason": "证明材料模糊，无法辨认参与信息"
  }'
```

### 6. 学生申诉 - 人工修正学分

```bash
curl -X PUT "http://localhost:8000/credit-applications/2/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "new_credit": 0.5,
    "handler": "admin",
    "comment": "学生补充了签到照片，确认参与",
    "original_input": "学生申诉：当时坐在后排，系统签到成功，补充现场照片"
  }'
```

### 7. 查询学分汇总

```bash
curl -X GET "http://localhost:8000/students/2024001/credit-summary"
```

### 8. 生成学分报告

```bash
curl -X POST "http://localhost:8000/credit-reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "generated_by": "admin"
  }'
```

### 9. 导出CSV报告

```bash
curl -X GET "http://localhost:8000/credit-reports/1/export" -o report.csv
```

## 冲突路径示例

### 1. 重复活动申请 - 自动驳回

```bash
# 第一次申请
curl -X POST "http://localhost:8000/credit-applications/" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "activity_type_code": "lecture",
    "activity_name": "重复讲座",
    "credit": 0.5
  }'

# 第二次申请 - 系统自动驳回，标记为重复
curl -X POST "http://localhost:8000/credit-applications/" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "activity_type_code": "lecture",
    "activity_name": "重复讲座",
    "credit": 0.5
  }'
```

### 2. 学分超额 - 上限控制

```bash
# 讲座学分上限为2.0，申请5个0.5学分的讲座，实际只计2.0
for i in {1..5}; do
  curl -X POST "http://localhost:8000/credit-applications/" \
    -H "Content-Type: application/json" \
    -d "{\"student_id\": \"2024001\", \"activity_type_code\": \"lecture\", \"activity_name\": \"讲座$i\", \"credit\": 0.5}"
done

# 审核通过后查询学分汇总 - 只显示2.0学分
curl -X GET "http://localhost:8000/students/2024001/credit-summary"
```

### 3. 撤回已审核的申请

```bash
curl -X PUT "http://localhost:8000/credit-applications/1/withdraw?handler=student"
```

## 运行测试

### 运行所有测试

```bash
pytest test_main.py -v
```

### 运行指定测试

```bash
pytest test_main.py::test_duplicate_application_rejection -v
pytest test_main.py::test_credit_summary_with_cap -v
```

### 测试覆盖范围

- ✅ 学生和活动类型创建
- ✅ 学分申请创建与查询
- ✅ 重复申请自动驳回
- ✅ 状态流转与驳回原因
- ✅ 人工修正与申诉处理
- ✅ 申请撤回
- ✅ 学分上限控制
- ✅ 报告生成与导出
- ✅ 审计日志记录

## 数据模型

### Student（学生）
- student_id: 学号
- name: 姓名
- grade: 年级
- major: 专业

### ActivityType（活动类型）
- code: 类型代码
- name: 类型名称
- max_credit: 学分上限
- description: 描述

### CreditApplication（学分申请）
- student_id: 学生ID
- activity_type_id: 活动类型ID
- activity_name: 活动名称
- credit: 申请学分
- status: 状态(pending/approved/rejected/withdrawn)
- is_duplicate: 是否重复
- duplicate_of: 重复源申请ID
- proof_material: 证明材料

### RejectionReason（驳回原因）
- application_id: 申请ID
- reason: 驳回原因
- handler: 处理人
- original_input: 原始申诉内容
- conclusion: 处理结论

### AuditLog（审计日志）
- application_id: 申请ID
- action: 操作类型
- handler: 操作人
- previous_status: 之前状态
- new_status: 新状态
- comment: 备注
- original_data: 原始数据快照
