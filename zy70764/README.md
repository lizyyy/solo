# Postman断言覆盖变量引用审计后端API

用于审计Postman Collection中的断言覆盖和变量引用情况的后端服务。

## 功能特性

- **Collection解析**: 自动解析Postman Collection v2.1格式文件
- **断言识别**: 检测请求中的pm.test、pm.expect等断言脚本
- **变量引用校验**: 提取URL、Header、Body、Script中的{{variable}}变量引用
- **覆盖统计**: 计算断言覆盖率和示例响应覆盖率
- **人工修正**: 支持人工标记请求状态并保留审计日志
- **报告导出**: 生成覆盖度报告并导出JSON
- **环境变量管理**: 支持上传Postman环境变量文件

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问以下地址：
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 造数指南

项目已提供示例Collection文件用于测试：

```bash
data/sample_collection.json
```

该示例文件包含5个请求，覆盖以下场景：
1. 有断言和示例响应的请求
2. 只有断言无示例响应的请求
3. 只有示例响应无断言的请求
4. 既无断言也无示例响应的请求
5. 包含多个变量引用的请求

## API调用示例 (cURL)

### 1. 上传Postman Collection

```bash
curl -X POST "http://localhost:8000/collections/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_collection.json"
```

响应示例：
```json
{
  "collection_id": 1,
  "message": "Collection '示例API Collection - 用于审计测试' 上传并分析成功",
  "total_requests": 5,
  "requests_without_assertions": 3,
  "requests_without_examples": 3
}
```

### 2. 获取Collection列表

```bash
curl -X GET "http://localhost:8000/collections"
```

### 3. 获取Collection详情

```bash
curl -X GET "http://localhost:8000/collections/1"
```

### 4. 获取Collection的所有请求

```bash
curl -X GET "http://localhost:8000/collections/1/requests"
```

### 5. 获取没有断言的请求

```bash
curl -X GET "http://localhost:8000/collections/1/requests/no-assertions"
```

### 6. 获取没有示例响应的请求

```bash
curl -X GET "http://localhost:8000/collections/1/requests/no-examples"
```

### 7. 获取请求详情（包含断言、示例、变量）

```bash
curl -X GET "http://localhost:8000/requests/1"
```

### 8. 更新请求状态（人工修正）

```bash
curl -X PUT "http://localhost:8000/requests/status" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": 1,
    "new_status": "人工处理中",
    "handler": "张三",
    "conclusion": "该接口为内部调试接口，不需要添加断言",
    "raw_input": "根据接口评审记录，标记无需处理"
  }'
```

### 9. 获取请求的审计日志

```bash
curl -X GET "http://localhost:8000/requests/1/audit-logs"
```

### 10. 获取覆盖统计

```bash
curl -X GET "http://localhost:8000/collections/1/coverage"
```

响应示例：
```json
{
  "collection_id": 1,
  "collection_name": "示例API Collection - 用于审计测试",
  "total_requests": 5,
  "assertion_coverage": 40.0,
  "example_coverage": 40.0,
  "requests_without_assertions": 3,
  "requests_without_examples": 3,
  "total_variables": 8,
  "unresolved_variables": 8
}
```

### 11. 生成覆盖报告

```bash
curl -X POST "http://localhost:8000/collections/1/reports?generated_by=张三"
```

### 12. 导出报告

```bash
curl -X GET "http://localhost:8000/reports/1/export"
```

### 13. 上传环境变量

```bash
curl -X POST "http://localhost:8000/environments/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@your_environment.json"
```

### 14. 删除Collection

```bash
curl -X DELETE "http://localhost:8000/collections/1"
```

## 状态流转

请求状态定义：
- `pending`: 待处理（初始状态）
- `analyzing`: 分析中
- `人工处理中`: 人工审核中
- `completed`: 已完成（有断言和示例）
- `无需处理`: 人工标记无需处理
- `已撤回`: 撤回处理

## 数据库模型

- **Collection**: Collection元数据和统计信息
- **Request**: 请求详情和状态
- **Assertion**: 断言脚本详情
- **Example**: 示例响应详情
- **VariableReference**: 变量引用记录
- **Environment**: 环境变量配置
- **Report**: 覆盖报告
- **AuditLog**: 审计日志（记录所有状态变更）

## 运行测试

### 运行pytest测试

```bash
pytest tests/ -v
```

### 运行指定测试

```bash
pytest tests/test_api.py::test_upload_collection -v
```

### 生成测试覆盖率报告

```bash
pytest tests/ --cov=app --cov-report=html
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI应用入口
│   ├── models.py        # SQLAlchemy数据库模型
│   ├── schemas.py       # Pydantic数据模型
│   ├── crud.py          # 数据库操作封装
│   ├── parser.py        # Postman解析器
│   └── database.py      # 数据库连接配置
├── tests/
│   └── test_api.py      # 测试用例
├── data/                # 数据目录
│   ├── sample_collection.json
│   └── postman_audit.db (运行后生成)
├── requirements.txt
└── README.md
```

## 冲突处理

1. **重复上传同一Collection**: 系统会创建新的记录，不会覆盖原有数据
2. **状态并发修改**: 每个状态变更都会记录审计日志，保留完整历史
3. **变量解析冲突**: 无法解析的变量会被记录但不会中断分析流程

## 注意事项

1. 仅支持Postman Collection v2.1格式
2. 大型Collection上传可能需要较长时间
3. 数据库文件默认存储在 `data/postman_audit.db`
4. 建议定期备份数据库文件

## License

MIT
