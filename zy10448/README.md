# 用量异常事故 API

统一管理客户用量暴涨异常事故的检测、归因、处理和导出的本地 REST API 服务。

## 技术栈

- **FastAPI**: 高性能 Web 框架
- **SQLAlchemy**: ORM 数据库工具
- **SQLite**: 本地持久化存储
- **Pydantic**: 数据验证
- **pytest**: 单元测试框架

## 核心功能

### 数据模型
- **租户 (Tenant)**: 客户信息管理
- **用量指标 (UsageMetric)**: 时间序列用量数据
- **异常窗口 (AnomalyWindow)**: 异常时间区间记录
- **归因线索 (AttributionClue)**: 异常原因线索收集
- **处理动作 (ActionItem)**: 跟进和处理动作
- **事故摘要 (IncidentSummary)**: 根因分析和经验总结

### 核心规则
- **异常窗口识别**: 基于基线和阈值自动检测异常
- **线索归并**: 去重合并多来源归因线索
- **状态管理**: detected → analyzing → confirmed → resolved → closed
- **幂等处理**: 相同 incident_key 请求保证幂等
- **原始输入保留**: 完整记录请求原始数据和处理结果
- **人工修正支持**: 支持人工调整后重新计算

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/incidents` | 创建异常事故 |
| GET | `/api/incidents` | 查询事故列表（支持按租户、状态筛选） |
| GET | `/api/incidents/{id}` | 查询单个事故详情 |
| GET | `/api/incidents/key/{key}` | 按唯一键查询事故 |
| PATCH | `/api/incidents/{id}/status` | 更新事故状态 |
| POST | `/api/incidents/{id}/clues` | 添加归因线索 |
| POST | `/api/incidents/{id}/actions` | 添加处理动作 |
| POST | `/api/incidents/{id}/correct` | 人工修正并可重新计算 |
| PUT | `/api/incidents/{id}/summary` | 更新事故摘要 |
| GET | `/api/incidents/{id}/export` | 导出完整事故报告 |
| GET | `/api/tenants` | 查询租户列表 |

完整 API 文档: `http://127.0.0.1:8000/docs`

## 快速开始

### 方式一：一键启动
```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动
```bash
# 安装依赖
pip install -r requirements.txt

# 初始化样例数据
python sample_data.py

# 启动服务
uvicorn app.main:app --reload --port 8000
```

## 运行测试和自检

### 单元测试
```bash
pytest tests/test_api.py -v
```

### 完整自检
```bash
python self_check.py
```

自检覆盖：
- Python 环境检查
- 依赖包完整性
- 单元测试用例
- API 端点功能测试（正常流、幂等、导出等）

## 使用示例

### 创建异常事故
```bash
curl -X POST http://127.0.0.1:8000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": {
      "tenant_id": "tenant_001",
      "name": "客户名称",
      "email": "contact@example.com"
    },
    "metric_name": "api_requests",
    "unit": "requests",
    "window_start": "2024-01-15T18:00:00",
    "window_end": "2024-01-15T20:00:00",
    "threshold_percent": 50.0,
    "title": "API请求量异常暴涨",
    "attribution_clues": [
      {
        "clue_key": "cdn_alert_001",
        "source": "monitoring",
        "title": "CDN流量异常",
        "confidence": 0.85
      }
    ]
  }'
```

### 人工修正
```bash
curl -X POST http://127.0.0.1:8000/api/incidents/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "high",
    "baseline_adjustment": 50.0,
    "comment": "运营反馈大促活动，基线需要上调",
    "reclaculate": true
  }'
```

### 导出事故报告
```bash
curl http://127.0.0.1:8000/api/incidents/1/export
```

## 项目结构
```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── models.py        # SQLAlchemy 数据模型
│   ├── schemas.py       # Pydantic 请求/响应模型
│   ├── services.py      # 核心业务逻辑
│   └── database.py      # 数据库配置
├── tests/
│   ├── __init__.py
│   └── test_api.py      # 单元测试
├── sample_data.py       # 样例数据初始化
├── self_check.py        # 系统自检脚本
├── start.sh             # 一键启动脚本
├── requirements.txt     # Python 依赖
└── README.md
```

## 数据持久化

本地数据库文件: `usage_anomaly.db` (SQLite)

测试数据库: `test.db`

## 状态流转
```
detected (检测到)
    ↓
analyzing (分析中)
    ↓
confirmed (已确认)
    ↓
resolved (已解决)
    ↓
closed (已关闭)
```
