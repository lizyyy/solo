# 票据影像报销单匹配重复检测后端API

基于 FastAPI + SQLite 的企业级票据影像管理系统，支持文件名智能解析、报销单自动比对、重复检测、缺失字段提示、人工修正、审计追踪和归档报告导出。

## 功能特性

- **真实目录扫描**：自动扫描指定目录下的票据影像文件（支持 JPG、PNG、PDF、TIFF、BMP 等格式）
- **文件上传支持**：支持单个文件上传和批量文件上传
- **文件名智能解析**：支持中文和英文多种命名规范，自动提取发票代码、发票号码、报销单号、金额
- **报销单比对**：与报销明细表进行精确匹配
- **重复检测**：基于发票代码+号码、金额等维度检测重复票据
- **缺失字段提示**：自动识别并提示缺失的关键字段
- **人工修正**：支持人工干预修正解析错误，保留完整审计记录
- **状态流转**：支持撤回、关闭等业务操作
- **导出报告**：生成完整的归档报告
- **审计日志**：所有异常路径保留原始输入、处理人、处理结论
- **示例数据模式**：可选内置示例数据用于演示和测试

## 快速启动

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
- ReDoc文档：http://localhost:8000/redoc

## 数据构造（造数）

系统支持通过API直接创建测试数据，包含：
- 正常匹配的票据
- 重复票据
- 字段缺失票据
- 金额不匹配票据

## cURL 真实业务流程示例

### 方式一：扫描真实票据目录（推荐生产环境使用）

```bash
curl -X POST "http://localhost:8000/directories/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "directory_path": "/data/invoices/2024/05",
    "use_sample_data": false,
    "reimbursement_data": [
      {
        "reimbursement_id": "BX2024001",
        "invoice_code": "123456789012",
        "invoice_number": "12345678",
        "amount": 1500.00,
        "applicant": "张三",
        "department": "财务部"
      },
      {
        "reimbursement_id": "BX2024002",
        "invoice_code": "123456789013",
        "invoice_number": "87654321",
        "amount": 2300.50,
        "applicant": "李四",
        "department": "技术部"
      }
    ]
  }'
```

### 方式二：演示模式（使用内置示例数据）

```bash
curl -X POST "http://localhost:8000/directories/" \
  -H "Content-Type: application/json" \
  -d '{
    "directory_path": "/demo/invoices",
    "reimbursement_data": []
  }'
```

### 方式三：批量上传票据文件

```bash
# 先创建目录
curl -X POST "http://localhost:8000/directories/" \
  -H "Content-Type: application/json" \
  -d '{"directory_path": "/upload/invoices"}'

# 批量上传多个票据文件
curl -X POST "http://localhost:8000/directories/1/upload-batch" \
  -F "files=@/path/to/invoice1.jpg" \
  -F "files=@/path/to/invoice2.png" \
  -F "files=@/path/to/invoice3.pdf"
```

### 方式四：导入文件名列表

```bash
curl -X POST "http://localhost:8000/directories/1/import-files" \
  -H "Content-Type: application/json" \
  -d '{
    "directory_id": 1,
    "filenames": [
      "BX2024001_发票代码123456789012_号码12345678_1500.00.jpg",
      "报销单_BX2024002_87654321_2300.50.pdf"
    ]
  }'
```

### 执行匹配处理

```bash
curl -X POST "http://localhost:8000/directories/1/process"
```

### 查看目录概览

```bash
curl "http://localhost:8000/directories/1/overview"
```

### 查看匹配结果详情

```bash
curl "http://localhost:8000/directories/1/matching-results"
```

### 生成归档报告

```bash
curl -X POST "http://localhost:8000/reports/?directory_id=1&generated_by=finance_user"
```

### 导出报告

```bash
curl "http://localhost:8000/reports/1/export"
```

### 查看支持的文件格式

```bash
curl "http://localhost:8000/supported-formats"
```

## 冲突处理路径示例

### 1. 人工修正缺失字段

```bash
curl -X POST "http://localhost:8000/invoices/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": 3,
    "invoice_code": "999999999999",
    "invoice_number": "88888888",
    "reimbursement_id": "BX2024005",
    "amount": 500.00,
    "processed_by": "admin",
    "reason": "OCR识别失败，人工补录"
  }'
```

### 2. 查看审计日志

```bash
curl "http://localhost:8000/directories/1/audit-logs"
```

### 3. 撤回目录（异常退回）

```bash
curl -X POST "http://localhost:8000/directories/1/withdraw?processed_by=manager&reason=发现重复报销，退回重审"
```

### 4. 关闭目录

```bash
curl -X POST "http://localhost:8000/directories/1/close?processed_by=manager&note=审核完成，已归档"
```

## 状态流转说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| parsing | 解析中 |
| processed | 已处理 |
| manual_corrected | 人工修正 |
| withdrawn | 已撤回 |
| closed | 已关闭 |

## 匹配状态说明

| 状态 | 说明 |
|------|------|
| pending | 待匹配 |
| matched | 匹配成功 |
| duplicate | 重复票据 |
| missing_fields | 字段缺失 |
| amount_mismatch | 金额不匹配 |
| not_found | 未找到报销记录 |

## pytest 测试

创建测试文件 `test_api.py`，运行测试：

```bash
pytest test_api.py -v
```

### 测试用例说明

- `test_create_directory`：测试创建影像目录
- `test_process_matching`：测试匹配处理流程
- `test_duplicate_detection`：测试重复检测功能
- `test_missing_fields_detection`：测试缺失字段检测
- `test_manual_correction`：测试人工修正功能
- `test_audit_log`：测试审计日志记录
- `test_withdraw_directory`：测试撤回功能
- `test_generate_report`：测试报告生成和导出

## 项目结构

```
.
├── main.py              # FastAPI主应用，API路由定义
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic数据模式
├── crud.py              # 数据库操作层
├── utils.py             # 核心业务逻辑（解析、匹配、检测）
├── database.py          # 数据库配置
├── requirements.txt     # 依赖列表
└── test_api.py          # 测试用例
```

## 核心数据模型

### ImageDirectory（影像目录）
- 目录路径、状态、创建时间、处理人

### Invoice（票据影像）
- 原始文件名、文件路径
- 发票代码、发票号码、报销单号、金额
- 是否重复、重复关联ID
- 状态、匹配状态

### ReimbursementSheet（报销明细表）
- 报销单号、发票代码、发票号码、金额
- 申请人、部门

### ArchiveReport（归档报告）
- 报告内容、统计数据（总文件数、匹配数、重复数、缺失数）

### AuditLog（审计日志）
- 操作类型、原始输入、处理人、处理结论
