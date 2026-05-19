# Wheel 元数据入口点后端 API

用于解析、验证和管理 Python Wheel 包元数据的 RESTful API 服务。

## 功能特性

- **Wheel 包解析**: 自动解压 wheel 文件并提取元数据、入口点、依赖关系
- **平台标签验证**: 验证 wheel 文件名中的平台标签是否有效
- **入口点校验**: 检查 entry_points.txt 格式是否规范
- **依赖范围检查**: 验证 Requires-Dist 格式和版本约束
- **状态管理**: 支持 pending/parsing/validating/passed/failed/manual_review/closed/withdrawn 状态
- **人工修正**: 支持手动修正元数据、入口点、依赖关系和平台标签
- **异常处理**: 记录异常审批路径、处理人和结论
- **报告导出**: 支持 JSON/TXT 格式导出验证报告
- **审计日志**: 完整记录所有状态变更操作

## 快速开始

### 环境要求

- Python 3.7+
- pip 或 poetry

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 备用文档: http://localhost:8000/redoc

## API 接口说明

### 1. 上传 Wheel 包

```bash
curl -X POST "http://localhost:8000/api/wheels" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@your_package-1.0.0-py3-none-any.whl" \
  -F "uploader=your_name"
```

响应示例:
```json
{
  "id": 1,
  "filename": "your_package-1.0.0-py3-none-any.whl",
  "status": "pending",
  "package_name": "your_package",
  "package_version": "1.0.0",
  "platform_tag": "any"
}
```

### 2. 查询 Wheel 列表

```bash
curl "http://localhost:8000/api/wheels?skip=0&limit=10"
```

### 3. 查询 Wheel 详情

```bash
curl "http://localhost:8000/api/wheels/1"
```

### 4. 执行验证

```bash
curl -X POST "http://localhost:8000/api/wheels/1/validate?validator=admin"
```

### 5. 更新状态

```bash
curl -X PUT "http://localhost:8000/api/wheels/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "validating",
    "actor": "admin",
    "reason": "Starting validation process"
  }'
```

### 6. 人工修正

```bash
curl -X POST "http://localhost:8000/api/wheels/1/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "corrected_platform_tag": "win_amd64",
    "corrected_dependencies": [
      {"name": "requests", "specifier": ">=2.25.0"}
    ],
    "handler": "admin",
    "notes": "Corrected platform tag for Windows compatibility"
  }'
```

### 7. 记录异常审批路径

```bash
curl -X POST "http://localhost:8000/api/wheels/1/exception-path" \
  -H "Content-Type: application/json" \
  -d '{
    "original_input": "Wheel package contains invalid dependency version",
    "handler": "manager",
    "conclusion": "Approved with exception - internal usage only",
    "notes": "Security review completed"
  }'
```

### 8. 撤回 Wheel

```bash
curl -X POST "http://localhost:8000/api/wheels/1/withdraw?actor=admin&reason=Security%20issue%20found"
```

### 9. 关闭 Wheel

```bash
curl -X POST "http://localhost:8000/api/wheels/1/close?actor=admin&reason=Issue%20resolved"
```

### 10. 导出报告

```bash
# JSON 格式
curl "http://localhost:8000/api/wheels/1/export?format=json" -o report.json

# TXT 格式
curl "http://localhost:8000/api/wheels/1/export?format=txt" -o report.txt
```

### 11. 获取可用状态列表

```bash
curl "http://localhost:8000/api/statuses"
```

## 状态流转

```
pending → parsing → validating → passed
                          ↓
                        failed → manual_review → closed
                                          ↓
                                       withdrawn
```

状态说明:
- **pending**: 等待处理
- **parsing**: 正在解析
- **validating**: 正在验证
- **passed**: 验证通过
- **failed**: 验证失败
- **manual_review**: 人工审核中
- **closed**: 已关闭
- **withdrawn**: 已撤回

## 典型使用流程

### 正常流程

```bash
# 1. 上传 wheel
curl -X POST "http://localhost:8000/api/wheels" \
  -F "file=@package-1.0.0-py3-none-any.whl"

# 2. 执行验证
curl -X POST "http://localhost:8000/api/wheels/1/validate"

# 3. 查看结果
curl "http://localhost:8000/api/wheels/1"

# 4. 导出报告
curl "http://localhost:8000/api/wheels/1/export?format=json"
```

### 冲突处理流程

```bash
# 1. 上传 wheel 验证失败
curl -X POST "http://localhost:8000/api/wheels" \
  -F "file=@problematic-1.0.0-py3-none-any.whl"
curl -X POST "http://localhost:8000/api/wheels/1/validate"

# 2. 申请人工修正
curl -X POST "http://localhost:8000/api/wheels/1/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "corrected_platform_tag": "manylinux2014_x86_64",
    "handler": "reviewer",
    "notes": "Platform tag was incorrect"
  }'

# 3. 记录异常审批
curl -X POST "http://localhost:8000/api/wheels/1/exception-path" \
  -H "Content-Type: application/json" \
  -d '{
    "original_input": "Original wheel had wrong platform tag",
    "handler": "manager",
    "conclusion": "Approved after correction",
    "notes": "Manual review completed"
  }'

# 4. 重新验证
curl -X POST "http://localhost:8000/api/wheels/1/validate"

# 5. 关闭
curl -X POST "http://localhost:8000/api/wheels/1/close"
```

## 测试

### 运行 pytest 测试

```bash
# 运行所有测试
pytest

# 运行测试并显示详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_api.py

# 运行特定测试用例
pytest tests/test_api.py::TestWheelAPI::test_upload_wheel

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

### 测试覆盖范围

- Wheel 包上传（正常/重复/无效文件）
- Wheel 列表查询
- Wheel 详情查询
- 验证流程
- 状态更新（正常/无效状态）
- 人工修正
- 异常审批路径
- 撤回操作
- 关闭操作
- 报告导出（JSON/TXT/无效格式）
- 状态列表查询

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主应用
│   ├── models.py            # SQLAlchemy 数据模型
│   ├── schemas.py           # Pydantic 数据模型
│   ├── database.py          # 数据库配置
│   ├── crud.py              # 数据库操作
│   ├── wheel_parser.py      # Wheel 解析器
│   └── validator.py         # 验证器
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # pytest 配置
│   └── test_api.py          # API 测试
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 数据模型

### WheelFile
- id, filename, file_hash, file_size
- upload_time, uploader, status
- platform_tag, python_version, package_name, package_version

### MetaData
- metadata_version, name, version, summary
- description, keywords, home_page, author
- author_email, license, classifier, requires_python
- raw_metadata

### EntryPoint
- group, name, module, attr, extras
- is_valid, validation_error

### Dependency
- name, specifier, extras, environment_marker
- is_valid, validation_error

### ValidationReport
- report_type, generated_at, generated_by
- overall_status, platform_tag_check/message
- entry_points_check/message
- dependencies_check/message
- metadata_check/message, raw_report

### ExceptionPath
- original_input, handler, conclusion
- notes, handled_at

### AuditLog
- action, old_status, new_status
- actor, timestamp, reason

## 平台标签支持

支持的标准平台标签:
- any
- win32, win_amd64, win_arm64
- manylinux1_x86_64, manylinux2010_x86_64, manylinux2014_x86_64
- manylinux_2_5_x86_64, manylinux_2_12_x86_64, manylinux_2_17_x86_64
- manylinux2014_aarch64, manylinux_2_17_aarch64
- musllinux_1_1_x86_64, musllinux_1_2_x86_64
- macosx_10_9_x86_64, macosx_11_0_arm64 等
