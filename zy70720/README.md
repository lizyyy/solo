# 事故状态页公告版本回执后端API

管理事故公告版本、订阅方确认回执、复盘摘要的后端服务。

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **测试**: pytest + httpx

## 核心功能

| 功能 | 说明 |
|------|------|
| **事故管理** | 创建、查询、状态推进（调查中→已识别→监控中→已解决→已关闭） |
| **公告版本化** | 每个事故的公告自动版本递增，记录服务状态变化 |
| **订阅方管理** | 添加事故关注团队，状态追踪 |
| **确认回执** | 订阅方对每个公告版本进行确认回执，防止重复确认 |
| **人工修正日志** | 记录异常路径处理，保留原始输入、处理人、处理结论 |
| **复盘摘要** | 事故结案后添加复盘总结 |
| **数据导出** | 导出完整事故数据，用于复盘存档 |

## 事故状态流转

```
investigating (调查中)
      ↓
identified (已识别)
      ↓
monitoring (监控中)
      ↓
resolved (已解决)
      ↓
closed (已关闭)
```

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
- API文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 运行测试

```bash
pytest tests/ -v
```

### 4. 造数脚本

启动服务后运行：

```bash
python seed_data.py
```

脚本会自动创建完整的事故流程样例数据。

## API 使用示例（curl 主流程）

### 1. 创建事故

```bash
curl -X POST "http://localhost:8000/api/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "INC-2024-001",
    "title": "数据库连接异常导致服务响应缓慢",
    "description": "从上午10:30开始，多个用户报告API服务响应缓慢或超时"
  }'
```

### 2. 推进事故状态

```bash
curl -X POST "http://localhost:8000/api/incidents/INC-2024-001/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "identified"}'
```

### 3. 创建公告（自动版本化）

```bash
curl -X POST "http://localhost:8000/api/announcements" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "service_status": "服务部分不可用",
    "content": "正在调查数据库连接问题，已发现连接池耗尽",
    "created_by": "运维团队"
  }'
```

### 4. 添加订阅方

```bash
curl -X POST "http://localhost:8000/api/subscribers" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "name": "产品团队",
    "email": "product@example.com"
  }'
```

### 5. 确认回执

```bash
curl -X POST "http://localhost:8000/api/confirmations" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "announcement_id": 1,
    "subscriber_id": 1,
    "notes": "已同步至产品周报"
  }'
```

### 6. 添加人工修正日志（异常路径）

```bash
curl -X POST "http://localhost:8000/api/correction-logs" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "original_input": "用户报告数量统计错误，初报100+实际为47",
    "processed_by": "数据团队",
    "conclusion": "已修正影响用户数量统计，实际受影响用户为47人",
    "correction_type": "数据修正"
  }'
```

### 7. 添加复盘摘要

```bash
curl -X PUT "http://localhost:8000/api/incidents/INC-2024-001" \
  -H "Content-Type: application/json" \
  -d '{
    "review_summary": "本次事故持续约2小时，根因为数据库max_connections配置不足。已将连接池配置从100调整至500，并添加连接池监控告警。"
  }'
```

### 8. 关闭事故

```bash
curl -X POST "http://localhost:8000/api/incidents/INC-2024-001/close"
```

### 9. 导出完整数据

```bash
curl -X GET "http://localhost:8000/api/incidents/INC-2024-001/export"
```

### 10. 查询列表

```bash
# 所有事故
curl "http://localhost:8000/api/incidents"

# 仅活跃事故
curl "http://localhost:8000/api/incidents?is_active=true"

# 事故公告列表
curl "http://localhost:8000/api/incidents/INC-2024-001/announcements"

# 订阅方列表
curl "http://localhost:8000/api/incidents/INC-2024-001/subscribers"

# 确认回执列表
curl "http://localhost:8000/api/incidents/INC-2024-001/confirmations"
```

## 冲突路径示例（关键规则验证）

### 1. 重复确认回执（自动去重）

```bash
# 第一次确认
curl -X POST "http://localhost:8000/api/confirmations" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "announcement_id": 1,
    "subscriber_id": 1
  }'

# 重复确认（返回已存在，不创建新记录）
curl -X POST "http://localhost:8000/api/confirmations" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "announcement_id": 1,
    "subscriber_id": 1
  }'
```

**预期结果**: 第二次返回 `message: "回执已存在，跳过重复确认"`

### 2. 已关闭事故无法创建新公告

```bash
# 先关闭事故
curl -X POST "http://localhost:8000/api/incidents/INC-2024-001/close"

# 尝试创建公告（应失败）
curl -X POST "http://localhost:8000/api/announcements" \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "INC-2024-001",
    "service_status": "测试",
    "content": "测试内容"
  }'
```

**预期结果**: HTTP 400，返回 `{"detail": "事故已关闭，无法创建新公告"}`

### 3. 重复事故编号

```bash
# 重复创建同一ID事故
curl -X POST "http://localhost:8000/api/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "INC-2024-001",
    "title": "重复事故"
  }'
```

**预期结果**: HTTP 400，返回 `{"detail": "事故编号已存在"}`

### 4. 已关闭事故无法更新状态

```bash
# 关闭后尝试更新状态
curl -X POST "http://localhost:8000/api/incidents/INC-2024-001/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "monitoring"}'
```

**预期结果**: HTTP 400，返回 `{"detail": "事故已关闭，无法更新状态"}`

## Pytest 测试

项目包含完整的测试用例：

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_incident.py -v
pytest tests/test_announcement.py -v
pytest tests/test_export.py -v

# 生成覆盖率报告
pytest tests/ -v --cov=app --cov-report=html
```

测试覆盖场景：
- ✅ 事故创建、查询、状态推进、关闭
- ✅ 公告版本自动递增
- ✅ 订阅方添加、重复去重
- ✅ 确认回执去重、状态自动更新
- ✅ 人工修正日志记录
- ✅ 完整数据导出
- ✅ 各种边界条件和冲突场景

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用主入口，路由定义
│   ├── models.py        # SQLAlchemy ORM 数据模型
│   ├── schemas.py       # Pydantic 请求/响应 Schema
│   ├── crud.py          # 数据库操作层（增删改查）
│   └── database.py      # 数据库连接配置
├── tests/
│   ├── __init__.py
│   ├── conftest.py      # pytest 配置和 Fixture
│   ├── test_incident.py # 事故管理测试
│   ├── test_announcement.py # 公告和确认测试
│   └── test_export.py   # 导出和修正日志测试
├── requirements.txt     # Python 依赖
├── pyproject.toml       # pytest 配置
├── seed_data.py         # 造数脚本
└── README.md
```

## 数据模型

### Incident（事故）
- id: 事故编号（主键）
- title: 标题
- description: 描述
- current_status: 当前状态（investigating/identified/monitoring/resolved/closed）
- is_active: 是否活跃
- review_summary: 复盘摘要
- created_at/updated_at: 时间戳

### Announcement（公告）
- id: 自增ID
- incident_id: 关联事故
- version: 版本号（自动递增）
- service_status: 服务状态描述
- content: 公告内容
- created_by: 创建人
- created_at: 时间戳

### Subscriber（订阅方）
- id: 自增ID
- incident_id: 关联事故
- name: 团队/人员名称
- email: 邮箱
- status: 状态（pending/confirmed/acknowledged）

### Confirmation（确认回执）
- id: 自增ID
- incident_id: 关联事故
- announcement_id: 关联公告
- subscriber_id: 关联订阅方
- notes: 备注
- **唯一约束**: (incident_id, announcement_id, subscriber_id) 组合唯一

### CorrectionLog（人工修正日志）
- id: 自增ID
- incident_id: 关联事故
- original_input: 原始输入
- processed_by: 处理人
- conclusion: 处理结论
- correction_type: 修正类型
