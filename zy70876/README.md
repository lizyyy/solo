# 研究生院导师分配系统

## 项目简介

本系统是为研究生院秘书设计的导师分配管理系统，支持导师CSV导入、学生志愿JSON导入、调剂记录管理，并提供完整的审计追踪功能。

## 核心功能

### 1. 数据导入
- **导师CSV导入**: 支持批量导入导师信息（工号、姓名、院系、专业、研究方向、名额）
- **学生志愿JSON导入**: 支持批量导入学生信息及志愿选择
- **调剂记录导入**: 支持批量导入学生调剂信息

### 2. 批次管理
- 新增分配批次
- 批次状态管理

### 3. 分配管理
- 创建分配记录
- 标记处理（通过/退回）
- 退回修改并记录原因
- 状态流转记录

### 4. 智能校验
- **名额占用检查**: 自动检查导师已用名额是否超过总名额
- **跨专业限制**: 检查学生与导师专业一致性
- **重复录取检查**: 防止学生被重复录取

### 5. 查询功能
- 按导师方向查询
- 按学生志愿查询
- 按调剂批次查询
- 按状态筛选
- 支持多条件组合查询

### 6. 导出功能
- 导出Excel格式的分配明细
- 导出数量与查询结果一致
- 包含完整的审计追踪信息

### 7. 审计追踪
- 记录每一次状态变更
- 记录操作人、操作时间
- 记录变更原因
- 可追溯从明细到最终报告

## 技术栈

- **后端框架**: FastAPI
- **数据库**: SQLite（可扩展为MySQL/PostgreSQL）
- **ORM**: SQLAlchemy
- **数据处理**: Pandas
- **Excel导出**: openpyxl

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 导师管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/advisors/import` | 导入导师CSV文件 |
| GET | `/api/advisors` | 获取导师列表 |

### 学生管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/students/preferences/import` | 导入学生志愿JSON |
| GET | `/api/students` | 获取学生列表 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches` | 创建新批次 |
| GET | `/api/batches` | 获取批次列表 |

### 调剂管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/adjustments/import` | 导入调剂记录 |
| GET | `/api/adjustments` | 获取调剂记录列表 |

### 分配管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/allocations` | 创建分配记录 |
| POST | `/api/allocations/{id}/process` | 处理分配记录（通过/退回） |
| GET | `/api/allocations` | 查询分配记录（多条件） |
| GET | `/api/allocations/{id}` | 获取分配记录详情 |
| POST | `/api/allocations/export` | 导出分配记录 |

### 审计追踪

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/allocations/{id}/audit-logs` | 获取分配记录的审计日志 |

### 校验接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/validation/allocation` | 预校验分配是否可行 |

## 使用示例

### 1. 导入导师数据

```bash
curl -X POST "http://localhost:8000/api/advisors/import" \
  -F "file=@sample_data/advisors.csv" \
  -F "created_by=admin"
```

### 2. 导入学生志愿

```bash
curl -X POST "http://localhost:8000/api/students/preferences/import" \
  -F "file=@sample_data/student_preferences.json" \
  -F "created_by=admin"
```

### 3. 创建批次

```bash
curl -X POST "http://localhost:8000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_code": "BATCH2024_1",
    "batch_name": "2024年第一批次",
    "batch_type": "normal",
    "created_by": "admin"
  }'
```

### 4. 创建分配记录

```bash
curl -X POST "http://localhost:8000/api/allocations" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "advisor_id": 1,
    "batch_id": 1,
    "allocation_type": "first_choice",
    "created_by": "admin"
  }'
```

### 5. 处理分配记录

```bash
curl -X POST "http://localhost:8000/api/allocations/1/process" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reason": "材料齐全，符合录取条件",
    "operator": "张老师"
  }'
```

### 6. 退回修改

```bash
curl -X POST "http://localhost:8000/api/allocations/1/process" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "returned",
    "reason": "成绩单缺失，需要补充材料",
    "operator": "李老师"
  }'
```

### 7. 查询分配记录

```bash
curl "http://localhost:8000/api/allocations?status=approved&major=计算机科学与技术"
```

### 8. 导出分配记录

```bash
curl -X POST "http://localhost:8000/api/allocations/export" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}' \
  -o allocation_records.xlsx
```

## 状态说明

### 分配记录状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| approved | 已通过 |
| rejected | 已拒绝 |
| returned | 退回修改 |
| supplemental | 待补材料 |

### 自动拒绝场景

系统在校验失败时会自动将状态置为`rejected`，包括：
1. 导师名额已满
2. 学生与导师专业不符
3. 学生已被其他导师录取

## 数据库结构

### 主要表

- **advisors**: 导师表
- **students**: 学生表
- **preferences**: 学生志愿表
- **batches**: 批次表
- **adjustment_records**: 调剂记录表
- **allocation_records**: 分配记录表
- **audit_logs**: 审计日志表

## 项目结构

```
.
├── main.py              # 主应用入口
├── models.py            # 数据库模型
├── schemas.py           # Pydantic数据模型
├── services.py          # 业务逻辑服务
├── database.py          # 数据库连接
├── requirements.txt     # 依赖配置
├── sample_data/         # 示例数据
│   ├── advisors.csv
│   ├── student_preferences.json
│   └── adjustments.json
└── README.md
```

## 注意事项

1. 系统使用SQLite数据库，数据保存在`graduate_school.db`文件中
2. 重启服务后数据不会丢失
3. 导出的Excel文件包含完整的审计追踪信息，便于后续排查
4. 所有操作都记录操作人、时间和原因，满足审计要求

## 扩展建议

1. 添加用户认证和权限管理
2. 支持MySQL/PostgreSQL等企业级数据库
3. 添加前端管理界面
4. 支持邮件通知功能
5. 添加统计报表功能
