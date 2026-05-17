# 报名表清洗监护人字段异常行后端API

## 项目简介

游学报名表数据清洗工具，解决来自不同老师的报名表字段格式不一致问题，重点是规则清楚、结果可复查。

## 技术栈

- FastAPI - Web框架
- SQLite - 数据库
- SQLAlchemy - ORM
- Pandas - 数据处理
- Pytest - 测试框架

## 项目结构

```
.
├── main.py              # FastAPI主程序
├── database.py          # 数据库模型和连接
├── schemas.py           # Pydantic数据模型
├── cleaning_service.py  # 清洗业务逻辑
├── requirements.txt     # 依赖列表
├── tests/
│   ├── __init__.py
│   └── test_main.py     # pytest测试用例
├── scripts/
│   └── generate_test_data.py  # 测试数据生成脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成测试数据

```bash
cd scripts
python generate_test_data.py
```

生成的测试数据文件：
- `test_data_normal.xlsx` - 15条正常数据
- `test_data_exception.xlsx` - 5条异常数据（格式错误）
- `test_data_duplicate.xlsx` - 3条重复数据
- `test_data_combined.xlsx` - 混合数据
- `test_data_combined.csv` - CSV格式混合数据

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. API文档

启动后访问: http://localhost:8000/docs

## 核心功能

- **表头映射**: 支持不同老师的表头自动映射（王老师、李老师、张老师等）
- **字段校验**: 护照号（字母+8位数字）、监护人电话（11位手机号）格式校验
- **重复报名合并**: 基于护照号或手机号自动检测重复报名
- **异常行留存**: 异常数据保留原始输入，支持人工修正
- **Excel/CSV导出**: 支持清洗结果导出，包含处理状态和审计信息
- **审计日志**: 所有操作记录处理人和处理结论

## API接口说明

### 任务管理

#### 创建任务

```bash
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "2024暑假游学报名",
    "source_teacher": "王老师",
    "remark": "第一批报名数据"
  }'
```

**响应示例：**
```json
{
  "id": 1,
  "task_name": "2024暑假游学报名",
  "source_teacher": "王老师",
  "status": "created",
  "total_records": 0,
  "valid_records": 0,
  "exception_records": 0,
  "duplicate_records": 0,
  "created_at": "2024-01-01T10:00:00",
  "updated_at": "2024-01-01T10:00:00",
  "remark": "第一批报名数据"
}
```

#### 查询任务列表

```bash
# 查询所有任务
curl "http://localhost:8000/api/tasks"

# 按状态筛选
curl "http://localhost:8000/api/tasks?status=cleaned"
```

#### 查询单个任务详情

```bash
curl "http://localhost:8000/api/tasks/1"
```

#### 更新任务信息

```bash
curl -X PATCH "http://localhost:8000/api/tasks/1" \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "2024暑假游学报名-更新",
    "handler": "管理员",
    "remark": "更新备注信息"
  }'
```

### 文件上传与数据清洗

#### 上传报名表

```bash
# 上传Excel文件
curl -X POST "http://localhost:8000/api/tasks/1/upload" \
  -F "file=@scripts/test_data_combined.xlsx"

# 上传CSV文件
curl -X POST "http://localhost:8000/api/tasks/1/upload" \
  -F "file=@scripts/test_data_combined.csv"
```

**响应示例：**
```json
{
  "task_id": 1,
  "filename": "test_data_combined.xlsx",
  "records_count": 23,
  "columns": ["学生姓名", "护照号", "性别", "出生日期", "学校", "年级", "监护人姓名", "监护人电话", "监护人关系", "饮食禁忌"]
}
```

#### 执行数据清洗

```bash
curl -X POST "http://localhost:8000/api/tasks/1/clean"
```

**响应示例：**
```json
{
  "task_id": 1,
  "total_processed": 23,
  "valid_count": 15,
  "exception_count": 5,
  "duplicate_count": 3,
  "exceptions": [...],
  "duplicates": [...]
}
```

### 查询清洗结果

#### 查询所有清洗结果

```bash
curl "http://localhost:8000/api/tasks/1/results"

# 按状态筛选
curl "http://localhost:8000/api/tasks/1/results?status=exception"
```

#### 查询异常记录

```bash
curl "http://localhost:8000/api/tasks/1/exceptions"
```

#### 查询重复记录

```bash
curl "http://localhost:8000/api/tasks/1/duplicates"
```

#### 查询单条记录详情

```bash
curl "http://localhost:8000/api/records/1"
```

### 人工修正异常记录

```bash
curl -X PATCH "http://localhost:8000/api/records/1" \
  -H "Content-Type: application/json" \
  -d '{
    "student_name": "张三",
    "passport_number": "E12345678",
    "guardian_phone": "13800138000",
    "guardian_name": "张父",
    "diet_restriction": "花生过敏",
    "handler": "数据管理员",
    "conclusion": "电话确认后修正护照号和手机号"
  }'
```

**响应说明：**
- 异常记录修正后状态变为 `valid`
- 标记 `is_manual_corrected: true`
- 记录处理人和处理结论
- 自动生成审计日志

### 重复记录合并

```bash
curl -X POST "http://localhost:8000/api/records/merge" \
  -H "Content-Type: application/json" \
  -d '{
    "keep_record_id": 1,
    "merge_record_ids": [2, 3],
    "handler": "数据管理员",
    "conclusion": "保留最早报名记录，合并其他两条"
  }'
```

**处理逻辑：**
- `keep_record_id` 为主记录，保留
- `merge_record_ids` 中的记录状态变为 `merged`
- 记录处理人和处理结论

### 任务状态推进

#### 审核任务

```bash
curl -X POST "http://localhost:8000/api/tasks/1/review?handler=审核员&remark=异常已全部修正"
```

#### 关闭任务

```bash
curl -X POST "http://localhost:8000/api/tasks/1/close?handler=管理员&remark=数据清洗完成，导出给主办方"
```

#### 重新打开任务

```bash
curl -X POST "http://localhost:8000/api/tasks/1/reopen?handler=管理员&remark=发现新问题，需要重新处理"
```

### 导出清洗结果

```bash
# 导出Excel格式
curl "http://localhost:8000/api/tasks/1/export?format=xlsx" -o result.xlsx

# 导出CSV格式
curl "http://localhost:8000/api/tasks/1/export?format=csv" -o result.csv

# 只导出有效记录
curl "http://localhost:8000/api/tasks/1/export?format=xlsx&status=valid" -o valid_records.xlsx
```

**导出字段包含：**
- ID、学生姓名、护照号、身份证号
- 性别、出生日期、学校、年级
- 监护人姓名、监护人电话、监护人关系、监护人邮箱
- 饮食禁忌、特殊需求、状态、是否重复
- 异常原因、是否人工修正、最后处理人、最后处理结论

### 审计日志

```bash
curl "http://localhost:8000/api/tasks/1/audit-logs"
```

## 完整业务流程示例

### 流程一：正常清洗流程

```bash
# 1. 创建任务
TASK_ID=$(curl -s -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"task_name": "2024夏令营", "source_teacher": "王老师"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "创建任务ID: $TASK_ID"

# 2. 上传数据
curl -X POST "http://localhost:8000/api/tasks/$TASK_ID/upload" \
  -F "file=@scripts/test_data_combined.xlsx"

# 3. 执行清洗
curl -X POST "http://localhost:8000/api/tasks/$TASK_ID/clean"

# 4. 查看异常
curl "http://localhost:8000/api/tasks/$TASK_ID/exceptions"

# 5. 查看重复
curl "http://localhost:8000/api/tasks/$TASK_ID/duplicates"

# 6. 导出结果
curl "http://localhost:8000/api/tasks/$TASK_ID/export?format=xlsx" -o final_result.xlsx

# 7. 审核关闭
curl -X POST "http://localhost:8000/api/tasks/$TASK_ID/review?handler=管理员"
curl -X POST "http://localhost:8000/api/tasks/$TASK_ID/close?handler=管理员"
```

## 冲突路径与异常处理

### 场景一：字段格式异常

**异常原因：**
- 护照号格式错误（如：12345、E1234567）
- 手机号格式错误（如：1234、021-12345678、13800xxxxx）

**处理流程：**
```bash
# 1. 查看异常记录
curl "http://localhost:8000/api/tasks/1/exceptions"

# 2. 查看原始数据
curl "http://localhost:8000/api/records/1"

# 3. 人工修正
curl -X PATCH "http://localhost:8000/api/records/1" \
  -H "Content-Type: application/json" \
  -d '{
    "passport_number": "E12345678",
    "guardian_phone": "13800138000",
    "handler": "数据员",
    "conclusion": "电话联系家长确认后修正"
  }'

# 4. 验证修正结果
curl "http://localhost:8000/api/records/1"
```

### 场景二：重复报名冲突

**异常原因：**
- 同一护照号多次报名
- 同一监护人电话对应多条记录

**处理流程：**
```bash
# 1. 查看重复记录组
curl "http://localhost:8000/api/tasks/1/duplicates"

# 2. 查看每组重复记录的详情
curl "http://localhost:8000/api/records/1"
curl "http://localhost:8000/api/records/2"
curl "http://localhost:8000/api/records/3"

# 3. 选择保留记录，合并其他
curl -X POST "http://localhost:8000/api/records/merge" \
  -H "Content-Type: application/json" \
  -d '{
    "keep_record_id": 1,
    "merge_record_ids": [2, 3],
    "handler": "主管",
    "conclusion": "保留最早报名的第1条记录，其他两条为重复报名"
  }'

# 4. 查看审计日志
curl "http://localhost:8000/api/tasks/1/audit-logs"
```

### 场景三：撤回关闭任务

**场景：**
- 任务已关闭，但发现数据问题需要重新处理

**处理流程：**
```bash
# 1. 重新打开任务
curl -X POST "http://localhost:8000/api/tasks/1/reopen?handler=管理员&remark=发现遗漏记录，需要重新处理"

# 2. 重新上传或修正数据
# ...

# 3. 再次清洗
curl -X POST "http://localhost:8000/api/tasks/1/clean"

# 4. 审核关闭
curl -X POST "http://localhost:8000/api/tasks/1/review?handler=管理员"
curl -X POST "http://localhost:8000/api/tasks/1/close?handler=管理员"
```

### 场景四：表头映射不匹配

**问题：**
- 新老师的表头与预设映射不匹配
- 自定义表头无法识别

**解决方案：**
1. 查看上传响应中的 `columns` 字段
2. 在数据库 `header_mappings` 表中添加新的映射规则
3. 重新上传文件

## 状态机说明

任务状态流转：
```
created → uploaded → cleaning → cleaned → reviewed → closed
                           ↓
                      (异常处理)
```

记录状态：
- `pending`: 待处理
- `valid`: 有效记录
- `exception`: 异常记录
- `duplicate`: 重复记录
- `merged`: 已合并

## 测试

### 运行所有测试

```bash
pytest tests/ -v
```

### 运行特定测试类

```bash
pytest tests/test_main.py::TestValidationFunctions -v
pytest tests/test_main.py::TestTaskAPI -v
pytest tests/test_main.py::TestFileUploadAndClean -v
pytest tests/test_main.py::TestRecordCorrection -v
pytest tests/test_main.py::TestExport -v
```

### 生成测试覆盖率报告

```bash
pytest tests/ --cov=. --cov-report=html
```

## 数据模型说明

### Task（任务表）
- 存储清洗任务的基本信息
- 包含统计数据（总记录、有效、异常、重复数量）
- 记录任务状态流转

### RawRecord（原始记录表）
- 完整保存原始文件的每一行数据
- JSON格式存储，保留原始输入
- 可追溯，支持重新解析

### CleanedRecord（清洗记录表）
- 解析后的结构化数据
- 记录状态和异常原因
- 标记人工修正信息

### Guardian（监护人表）
- 监护人详细信息
- 支持多监护人

### DietRestriction（饮食禁忌表）
- 结构化存储饮食禁忌
- 区分类型和严重程度

### CleanReport（清洗报告）
- 存储清洗过程中的详细报告
- JSON格式，包含异常和重复详情

### AuditLog（审计日志）
- 记录所有操作
- 包含处理人、处理结论
- 保留原始值和新值，支持回滚追溯

### HeaderMapping（表头映射）
- 不同老师的表头映射规则
- 可动态配置
- 支持启用/禁用

## 健康检查

```bash
curl "http://localhost:8000/api/health"
```

响应：
```json
{"status": "healthy"}
```
