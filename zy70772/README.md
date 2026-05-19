# Feature Flag Cleanup API

后端 API 服务，用于管理和清理 Feature Flag（功能开关），支持风险评估、代码引用扫描、审计追踪和 Excel 导出。

## 技术栈

- **FastAPI**: Web 框架
- **SQLAlchemy**: ORM
- **SQLite**: 数据库
- **openpyxl**: Excel 导出
- **pytest**: 单元测试

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- Redoc: http://localhost:8000/redoc

### 3. 初始化测试数据

```bash
python scripts/seed_data.py
```

## 核心 API 接口 (curl 示例)

### 创建 Feature Flag

```bash
curl -X POST "http://localhost:8000/api/flags/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "checkout_v2_flow",
    "description": "启用新版结账流程",
    "default_value": false,
    "owner": "ecommerce@company.com",
    "experiment_status": "completed",
    "code_references": [
      {
        "file_path": "src/checkout/main.py",
        "line_number": 42,
        "code_snippet": "if flag_v2.is_enabled():",
        "language": "python"
      }
    ]
  }'
```

### 查询所有 Feature Flag

```bash
curl "http://localhost:8000/api/flags/"

# 按状态过滤
curl "http://localhost:8000/api/flags/?status=pending"
```

### 查询单个 Feature Flag

```bash
curl "http://localhost:8000/api/flags/1/"
```

### 扫描分析 (风险等级和删除建议

```bash
curl -X POST "http://localhost:8000/api/flags/1/scan/"
```

### 人工修正 (覆盖系统建议)

```bash
curl -X POST "http://localhost:8000/api/flags/1/correct/" \
  -H "Content-Type: application/json" \
  -d '{
    "risk_level": "safe",
    "deletion_suggestion": "safe_to_delete",
    "processed_by": "senior_dev",
    "notes": "经过代码审查，确认可以安全删除"
  }'
```

### 推进状态

```bash
curl -X POST "http://localhost:8000/api/flags/1/status/" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "reviewing",
    "processed_by": "team_lead",
    "conclusion": "等待团队代码审查"
  }'
```

### 撤回/关闭

```bash
curl -X POST "http://localhost:8000/api/flags/1/cancel/?processed_by=admin&reason=该功能已经合并到主代码库，不需要再作为 Feature Flag"
```

### 添加代码引用

```bash
curl -X POST "http://localhost:8000/api/flags/1/references/" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "src/utils/helpers.js",
    "line_number": 156,
    "code_snippet": "featureFlag.check('checkout_v2_flow')",
    "language": "javascript"
  }'
```

### 生成清理报告

```bash
curl -X POST "http://localhost:8000/api/reports/?generated_by=cleanup_bot"
```

### 导出 Excel

```bash
curl -o feature_flags_report.xlsx "http://localhost:8000/api/export/flags/"
```

### 查看审计日志

```bash
curl "http://localhost:8000/api/flags/1/audit/"
```

### 健康检查

```bash
curl "http://localhost:8000/health"
```

## 冲突场景示例

### 场景: 系统建议 vs 人工修正

```bash
# 1. 创建一个高风险 Flag
curl -X POST "http://localhost:8000/api/flags/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "critical_payment_flow",
    "default_value": true,
    "experiment_status": "active"
  }'

# 2. 系统扫描后会建议 DO_NOT_DELETE
curl -X POST "http://localhost:8000/api/flags/1/scan/"

# 3. 查看系统建议 (应该是 do_not_delete)
curl "http://localhost:8000/api/flags/1/" | jq '.deletion_suggestion'

# 4. 资深工程师人工修正
curl -X POST "http://localhost:8000/api/flags/1/correct/" \
  -H "Content-Type: application/json" \
  -d '{
    "risk_level": "low",
    "deletion_suggestion": "safe_to_delete",
    "processed_by": "staff_engineer",
    "notes": "该功能已经全面迁移，代码引用都是死代码，可以安全删除"
  }'

# 5. 查看审计日志，追踪整个过程
curl "http://localhost:8000/api/flags/1/audit/"
```

## 核心规则说明

### 风险等级 (Risk Level)

- **SAFE**: 无风险，默认关闭 + 引用极少
- **LOW**: 低风险
- **MEDIUM**: 中等风险，需要人工确认
- **HIGH**: 高风险，建议保留
- **CRITICAL**: 极高风险，必须保留

### 删除建议 (Deletion Suggestion)

- **SAFE_TO_DELETE**: 可以安全删除
- **NEEDS_REVIEW**: 需要人工审查
- **DO_NOT_DELETE**: 不建议删除

### 状态流转 (Flag Status)

```
pending → scanning → analyzing → reviewing → approved → deleting → completed
                                    ↓
                                rejected / cancelled
```

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_main.py::test_scan_and_analyze -v

# 查看覆盖率
pytest tests/ --cov=app -v
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用和路由
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic 序列化
│   ├── services.py      # 业务逻辑
│   ├── database.py      # 数据库连接
│   └── export.py        # Excel 导出
├── scripts/
│   ├── __init__.py
│   └── seed_data.py     # 测试数据脚本
├── tests/
│   ├── __init__.py
│   └── test_main.py     # 单元测试
├── requirements.txt
├── .gitignore
└── README.md
```

## 审计日志

所有关键操作都会记录审计日志，包括：
- 创建/更新 Flag
- 状态变更
- 扫描分析
- 人工修正
- 撤回/关闭

每条审计日志包含：
- 操作类型
- 原始输入
- 处理人
- 处理结论
- 时间戳
