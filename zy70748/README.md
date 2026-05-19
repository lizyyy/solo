# 用量异常事故归因处理摘要 API

## 项目概述

当客户用量突然暴涨时，运营和研发团队需要协同调查不同系统的数据，难以形成统一的事故结论。本项目提供了一个完整的后端 API 服务，用于：
- 异常事故的创建、跟踪和管理
- 多源归因线索的统一收集
- 处理状态流转
- 事故摘要生成与导出

## 技术栈

- **Web 框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **测试**: pytest

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 初始化演示数据

```bash
python seed_data.py
```

## API 接口说明

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/incidents | 创建事故 |
| GET | /api/v1/incidents | 查询事故列表 |
| GET | /api/v1/incidents/{id} | 获取单个事故详情 |
| POST | /api/v1/incidents/{id}/status | 状态流转 |
| POST | /api/v1/incidents/{id}/clues | 添加归因线索 |
| GET | /api/v1/incidents/{id}/clues | 获取事故线索列表 |
| GET | /api/v1/incidents/{id}/actions | 获取操作历史 |
| PATCH | /api/v1/incidents/{id} | 人工修正 |
| POST | /api/v1/incidents/{id}/withdraw | 撤回事故 |
| POST | /api/v1/incidents/{id}/close | 关闭事故 |
| GET | /api/v1/incidents/{id}/export | 导出事故摘要 |

## curl 主流程示例

### 1. 创建事故

```bash
curl -X POST "http://localhost:8000/api/v1/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-demo-001",
    "tenant_name": "演示客户",
    "metric_name": "API调用次数",
    "metric_value": 2500000,
    "baseline_value": 1000000,
    "deviation_ratio": 2.5,
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T12:00:00Z",
    "title": "演示客户 - API调用次数异常暴涨",
    "created_by": "ops_zhang",
    "raw_input": "{\"alert_id\": \"alert-001\"}"
  }'
```

### 2. 查询事故列表

```bash
curl "http://localhost:8000/api/v1/incidents?status=created&page=1&page_size=10"
```

### 3. 状态流转 - 开始调查

```bash
INCIDENT_ID="你的事故ID"

curl -X POST "http://localhost:8000/api/v1/incidents/${INCIDENT_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "investigating",
    "operator": "ops_li",
    "conclusion": "开始调查异常原因"
  }'
```

### 4. 添加归因线索

```bash
curl -X POST "http://localhost:8000/api/v1/incidents/${INCIDENT_ID}/clues" \
  -H "Content-Type: application/json" \
  -d '{
    "source_system": "cloud_monitor",
    "clue_type": "log_anomaly",
    "description": "发现客户端IP 10.0.0.5 发起大量批量请求",
    "confidence": 0.95,
    "is_primary": true,
    "created_by": "dev_wang"
  }'
```

### 5. 人工修正

```bash
curl -X PATCH "http://localhost:8000/api/v1/incidents/${INCIDENT_ID}?operator=manager" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "经过初步分析，确认是客户端批量任务导致",
    "metric_value": 3000000
  }'
```

### 6. 导出事故摘要

```bash
curl "http://localhost:8000/api/v1/incidents/${INCIDENT_ID}/export"
```

### 7. 关闭事故

```bash
curl -X POST "http://localhost:8000/api/v1/incidents/${INCIDENT_ID}/close?operator=manager&conclusion=已协助用户进行请求限流和错峰处理，系统恢复正常"
```

## 冲突路径（409 场景）

### 场景1: 重复创建（幂等）

当提供相同 `id` 重复创建时，返回 409：

```bash
# 第一次创建（成功）
curl -X POST "http://localhost:8000/api/v1/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "inc-demo-001",
    "tenant_id": "tenant-demo-001",
    "tenant_name": "演示客户",
    "metric_name": "API调用次数",
    "metric_value": 2500000,
    "baseline_value": 1000000,
    "deviation_ratio": 2.5,
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T12:00:00Z",
    "title": "演示客户 - API调用次数异常暴涨",
    "created_by": "ops_zhang"
  }'

# 第二次创建（返回 409 Conflict）
curl -X POST "http://localhost:8000/api/v1/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "inc-demo-001",
    "tenant_id": "tenant-demo-001",
    "tenant_name": "演示客户",
    "metric_name": "API调用次数",
    "metric_value": 2500000,
    "baseline_value": 1000000,
    "deviation_ratio": 2.5,
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T12:00:00Z",
    "title": "演示客户 - API调用次数异常暴涨",
    "created_by": "ops_zhang"
  }'
```

### 场景2: 重叠时间窗口

相同租户、相同指标在重叠时间窗口已存在事故：

```bash
# 第一个事故（成功）
curl -X POST "http://localhost:8000/api/v1/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-demo-002",
    "tenant_name": "重叠窗口测试",
    "metric_name": "存储使用量",
    "metric_value": 5000,
    "baseline_value": 1000,
    "deviation_ratio": 5.0,
    "start_time": "2024-01-15T08:00:00Z",
    "end_time": "2024-01-15T12:00:00Z",
    "title": "重叠窗口测试 - 第一组",
    "created_by": "ops_zhang"
  }'

# 第二个事故（重叠，返回 409）
curl -X POST "http://localhost:8000/api/v1/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-demo-002",
    "tenant_name": "重叠窗口测试",
    "metric_name": "存储使用量",
    "metric_value": 6000,
    "baseline_value": 1000,
    "deviation_ratio": 6.0,
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T14:00:00Z",
    "title": "重叠窗口测试 - 第二组",
    "created_by": "ops_li"
  }'
```

## 状态流转说明

```
created → investigating → attributed → resolved → closed
    ↓              ↓              ↓            ↓
  withdrawn    withdrawn    withdrawn    withdrawn
```

- **created**: 初始状态，已创建待处理
- **investigating**: 调查中，运营/研发正在分析
- **attributed**: 已归因，确认根本原因
- **resolved**: 已解决，指标恢复正常
- **closed**: 已关闭，完成归档
- **withdrawn**: 已撤回，误报或无需处理

## 运行测试

```bash
pytest test_main.py -v
```

运行特定测试类：

```bash
pytest test_main.py::TestIncidentCreation -v
```

## 项目结构

```
.
├── main.py           # FastAPI 主应用和路由
├── database.py       # 数据库配置和模型
├── schemas.py        # Pydantic 数据模型
├── services.py       # 业务逻辑服务层
├── seed_data.py      # 演示数据初始化脚本
├── test_main.py      # pytest 测试用例
├── requirements.txt  # 依赖列表
└── README.md         # 项目文档
```

## 核心特性

1. **幂等创建**: 支持通过自定义 ID 实现幂等
2. **窗口检测**: 自动检测相同租户相同指标的重叠异常窗口
3. **线索归并**: 统一收集多系统归因线索
4. **状态审计**: 完整记录所有状态变更和操作历史
5. **摘要导出**: 结构化导出事故完整信息
6. **人工修正**: 支持运营人员修正事故信息
