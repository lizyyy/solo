# Bundle Budget API

前端构建产物包预算管理后端 API，用于监控和分析前端打包后的文件大小，自动识别超预算 chunk。

## 技术栈

- **FastAPI**: Web 框架
- **SQLite**: 数据库
- **SQLAlchemy**: ORM
- **Pandas/OpenPyXL**: Excel 导出

## 核心功能

### 1. 构建产物管理
- 上传构建产物信息（build ID、项目名、分支、commit）
- 支持多个 chunk 和模块级别的详细信息
- 记录文件大小、gzip 大小、初始 chunk 等属性

### 2. 预算规则管理
- 支持 glob 模式匹配 chunk 名称
- 可设置不同项目的大小预算（KB）
- 支持优先级排序

### 3. 违规类型检测
- **SIZE_EXCEEDED**: 文件大小超过设定预算
- **NEW_LARGE_CHUNK**: 新增大型 chunk（超过默认预算）
- **UNEXPECTED_GROWTH**: 相比上一版本异常增长（>20%）
- **DUPLICATE_MODULES**: 重复模块检测

### 4. 审核工作流
- 自动标记需要人工审核的违规
- 审核人员可标记违规已查看
- 处理报告并记录备注

### 5. 报告导出
- 支持 CSV 格式导出
- 支持 Excel 多 Sheet 导出（摘要、违规、chunks）
- 支持按项目、状态等条件筛选

## API 端点

### 构建产物
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/artifacts/` | 创建构建产物 |
| GET | `/api/v1/artifacts/` | 列出所有产物 |
| GET | `/api/v1/artifacts/{id}` | 获取单个产物 |
| POST | `/api/v1/artifacts/{id}/analyze` | 分析预算违规 |

### 预算规则
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/rules/` | 创建预算规则 |
| GET | `/api/v1/rules/` | 列出所有规则 |

### 预算报告
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/reports/` | 筛选报告 |
| GET | `/api/v1/reports/{id}` | 获取单个报告 |
| POST | `/api/v1/reports/{id}/process` | 标记报告已处理 |
| GET | `/api/v1/reports/{id}/export/csv` | 导出 CSV |
| GET | `/api/v1/reports/{id}/export/excel` | 导出 Excel |

### 违规审核
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/violations/{id}/review` | 标记违规已审核 |

## 错误响应

API 返回结构化错误响应，包含错误码、消息和详情：

| 错误码 | HTTP 状态 | 场景 |
|--------|-----------|------|
| `MISSING_REQUIRED_FIELD` | 400 | 缺少必填字段 |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 |
| `DUPLICATE_BUILD` | 409 | 构建 ID 已存在 |
| `ALREADY_PROCESSED` | 409 | 报告已处理 |
| `INVALID_STATUS_TRANSITION` | 409 | 状态不允许操作 |
| `NEEDS_MANUAL_REVIEW` | 412 | 需要先人工审核违规 |

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动。

### API 文档
启动后访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 运行自检
```bash
python3 test_self_check.py
```

## 使用示例

### 1. 创建预算规则
```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/rules/",
    json={
        "project_name": "frontend-app",
        "chunk_pattern": "main.*",
        "budget_size_kb": 200,
        "priority": 10
    }
)
```

### 2. 上传构建产物
```python
response = requests.post(
    "http://localhost:8000/api/v1/artifacts/",
    json={
        "build_id": "build-2024-001",
        "project_name": "frontend-app",
        "branch": "main",
        "commit_hash": "abc123def456",
        "chunks": [
            {
                "chunk_name": "main.js",
                "file_size": 262144,  # 256KB
                "gzip_size": 81920,
                "is_initial": True,
                "modules": [
                    {
                        "module_path": "src/app.tsx",
                        "module_size": 5120,
                        "is_third_party": False
                    }
                ]
            }
        ]
    }
)
artifact_id = response.json()["id"]
```

### 3. 分析预算违规
```python
response = requests.post(
    f"http://localhost:8000/api/v1/artifacts/{artifact_id}/analyze"
)
report = response.json()
print(f"Total violations: {report['total_violations']}")
print(f"Critical violations: {report['critical_violations']}")
```

### 4. 审核并处理报告
```python
# 审核需要人工审核的违规
for violation in report["violations"]:
    if violation["needs_review"]:
        requests.post(
            f"http://localhost:8000/api/v1/violations/{violation['id']}/review",
            params={"reviewed": True, "reviewed_by": "qa-team"}
        )

# 标记报告已处理
requests.post(
    f"http://localhost:8000/api/v1/reports/{report['id']}/process",
    params={"notes": "Approved for release"}
)
```

### 5. 导出报告
```python
# 导出 Excel
response = requests.get(
    f"http://localhost:8000/api/v1/reports/{report['id']}/export/excel"
)
with open("budget_report.xlsx", "wb") as f:
    f.write(response.content)

# 导出 CSV
response = requests.get(
    f"http://localhost:8000/api/v1/reports/{report['id']}/export/csv"
)
with open("budget_report.csv", "wb") as f:
    f.write(response.content)
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── config.py        # 配置管理
│   ├── database.py      # 数据库连接
│   ├── models.py        # SQLAlchemy 模型
│   ├── schemas.py       # Pydantic 序列化
│   ├── crud.py          # 数据操作
│   ├── api.py           # API 路由
│   ├── exporter.py      # 导出功能
│   └── exceptions.py    # 自定义异常
├── requirements.txt
├── pyproject.toml
├── test_self_check.py   # 自检脚本
└── README.md
```

## 状态流转

构建产物状态：

```
PENDING → ANALYZING → NEEDS_REVIEW → PROCESSED
                    ↓
                 COMPLETED (无违规)
```

报告状态：
- 生成后 `is_processed = False`
- 审核所有违规后可标记为已处理
- 已处理报告不可重复处理
