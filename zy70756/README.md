# CSV to NDJSON Converter API

基于 FastAPI + SQLite 的 CSV 转 NDJSON 后端服务，支持编码探测、列名归一、坏行留存、幂等导入等核心功能。

## 功能特性

- **编码探测**: 自动检测 CSV 文件编码，支持自定义编码覆盖
- **列名归一 & 映射**: 自动规范化列名，支持用户自定义列名映射和忽略列
- **坏行留存 & 自动重生成**: 记录转换失败的行，支持人工修正并自动重生成 NDJSON
- **幂等导入**: 相同文件哈希避免重复导入
- **空值规则**: 支持自定义空值处理规则
- **审计日志**: 记录所有操作、处理人及结论，支持追溯
- **状态管理**: uploaded -> converting -> completed / cancelled / closed

## 核心闭环说明

```
1. 上传CSV -> 自动生成默认列映射 -> 状态: uploaded
   ↓
2. 可选项: 用户修改列映射（自定义列名、设置忽略列）
   ↓
3. 开始转换 -> 应用列映射规则 -> 输出NDJSON
   ↓
4. 如有坏行 -> 记录坏行详细信息 -> 状态: completed (含失败计数)
   ↓
5. 人工修正坏行 -> 自动重生成NDJSON -> 更新转换摘要
   ↓
6. 导出稳定NDJSON输出
```

## 快速启动

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
- 健康检查: http://localhost:8000/health

## 造数脚本

生成测试 CSV 文件:

```bash
python scripts/generate_test_data.py
```

脚本会在 `test_data/` 目录下生成:
- `normal.csv` - 正常格式 CSV
- `gbk_encoded.csv` - GBK 编码 CSV
- `with_bad_rows.csv` - 包含坏行的 CSV
- `chinese_columns.csv` - 中文列名 CSV

## CURL 主流程示例

### 1. 上传 CSV 文件

```bash
# 上传正常 CSV
curl -X POST "http://localhost:8000/api/v1/csv/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_data/normal.csv;type=text/csv"

# 上传带坏行的 CSV
curl -X POST "http://localhost:8000/api/v1/csv/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_data/with_bad_rows.csv;type=text/csv"
```

### 2. 获取文件列表

```bash
curl -X GET "http://localhost:8000/api/v1/csv?skip=0&limit=10" \
  -H "accept: application/json"
```

### 3. 获取文件详情（含列映射、坏行、转换摘要）

```bash
# 替换 {file_id} 为实际文件 ID
curl -X GET "http://localhost:8000/api/v1/csv/{file_id}" \
  -H "accept: application/json"
```

### 4. 修改列映射

```bash
# 替换 {mapping_id} 为实际映射 ID
curl -X PUT "http://localhost:8000/api/v1/column-mapping/{mapping_id}" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "normalized_column": "custom_column_name",
    "is_ignored": false
  }'
```

### 5. 开始转换

```bash
# 替换 {file_id} 为实际文件 ID
curl -X POST "http://localhost:8000/api/v1/csv/{file_id}/convert" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "admin",
    "auto_detect_encoding": true
  }'
```

### 6. 人工修正坏行

```bash
# 替换 {bad_row_id} 为实际坏行 ID
curl -X PUT "http://localhost:8000/api/v1/bad-row/{bad_row_id}/fix" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "fixed_data": {
      "id": "100",
      "name": "Fixed Name",
      "email": "fixed@example.com"
    }
  }'
```

### 7. 撤回或关闭文件

```bash
# 替换 {file_id} 为实际文件 ID
curl -X PUT "http://localhost:8000/api/v1/csv/{file_id}/status" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "handler": "admin",
    "conclusion": "Data quality issue, cancelled by admin"
  }'
```

### 8. 导出 NDJSON

```bash
# 替换 {file_id} 为实际文件 ID
curl -X GET "http://localhost:8000/api/v1/csv/{file_id}/export" \
  -H "accept: application/x-ndjson" \
  -o output.ndjson
```

### 9. 查看审计日志

```bash
# 替换 {file_id} 为实际文件 ID
curl -X GET "http://localhost:8000/api/v1/csv/{file_id}/audit-logs" \
  -H "accept: application/json"
```

## 冲突路径示例

### 1. 幂等导入（重复上传相同文件）

```bash
# 第一次上传（成功）
curl -X POST "http://localhost:8000/api/v1/csv/upload" \
  -F "file=@test_data/normal.csv;type=text/csv"

# 第二次上传相同文件（返回已存在的记录，不重复创建）
curl -X POST "http://localhost:8000/api/v1/csv/upload" \
  -F "file=@test_data/normal.csv;type=text/csv"
```

### 2. 导出未转换的文件（错误）

```bash
# 先上传但不转换
curl -X POST "http://localhost:8000/api/v1/csv/upload" \
  -F "file=@test_data/normal.csv;type=text/csv"

# 尝试导出（会返回 400 错误）
curl -X GET "http://localhost:8000/api/v1/csv/{file_id}/export"
```

### 3. 指定自定义编码覆盖自动检测

```bash
curl -X POST "http://localhost:8000/api/v1/csv/{file_id}/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "admin",
    "auto_detect_encoding": false,
    "custom_encoding": "gbk"
  }'
```

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_csv_converter.py -v

# 生成覆盖率报告
pytest tests/ --cov=app --cov-report=html
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # API 路由
│   ├── core/
│   │   ├── __init__.py
│   │   └── database.py      # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # SQLAlchemy 模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic 模式
│   └── services/
│       ├── __init__.py
│       ├── converter.py     # 转换核心逻辑
│       └── csv_service.py   # 业务逻辑
├── tests/
│   └── test_csv_converter.py
├── scripts/
│   └── generate_test_data.py
├── uploads/                  # 上传文件存储
├── output/                   # NDJSON 输出存储
├── requirements.txt
└── README.md
```

## 数据库表说明

| 表名 | 说明 |
|------|------|
| csv_files | CSV 文件元数据 |
| column_mappings | 列名映射规则 |
| null_rules | 空值处理规则 |
| bad_rows | 坏行记录（含原始数据和错误信息） |
| conversion_summaries | 转换摘要统计 |
| audit_logs | 审计日志（含原始输入、处理人、结论） |

## 状态流转

```
uploaded
    │
    ├─> converting
    │    │
    │    └─> completed
    │
    ├─> cancelled (撤回)
    │
    └─> closed (关闭)
```
