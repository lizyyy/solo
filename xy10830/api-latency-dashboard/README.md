# 接口延迟事故板 (API Latency Incident Dashboard)

一个面向技术团队的全栈Web应用，用于监控和管理API延迟告警事故。

## 功能特性

### 前端功能
- **列表筛选**: 按状态、严重程度、接口路径、时间范围过滤事故
- **详情时间线**: 查看事故完整事件流和状态变更历史
- **慢请求样本**: 查看具体延迟超标的请求详情
- **批量导入**: 支持JSON格式批量导入事故数据
- **报告导出**: 导出Excel格式的事故报告，包含完整状态解释
- **排查备注**: 记录排查过程和解决方案

### 后端功能
- **RESTful API**: 完整的创建、查询、更新、导出接口
- **本地持久化**: SQLite数据库存储
- **延迟分桶**: 按P99延迟自动分桶（NORMAL/WARNING/ALERT/CRITICAL/FATAL）
- **样本留存**: 智能筛选保留关键慢请求样本
- **租户识别**: 识别受影响的租户列表
- **状态流转**: 规范化的事故状态流转机制
- **状态解释**: 每个状态都有对应的中文说明

## 数据模型

### 事故 (Incident)
- `incident_id`: 唯一事故ID
- `api_path`: 接口路径
- `status`: 当前状态（DETECTED/INVESTIGATING/ESCALATED/RESOLVED/FALSE_POSITIVE/CLOSED）
- `severity`: 严重程度（info/warning/error/critical/fatal）
- `avg_latency`: 平均延迟
- `p95_latency`: P95延迟
- `p99_latency`: P99延迟
- `total_requests`: 总请求数
- `slow_requests`: 慢请求数
- `affected_tenants`: 受影响租户数量
- `tenant_list`: 租户列表
- `current_bucket`: 延迟分桶
- `start_time`: 开始时间
- `end_time`: 结束时间

### 关联数据
- **慢请求样本**: 请求ID、租户ID、延迟、时间、HTTP方法、状态码
- **事件时间线**: 事件类型、消息、状态变更、操作人
- **排查备注**: 作者、内容、是否解决方案

## 项目结构

```
api-latency-dashboard/
├── backend/
│   ├── main.py          # FastAPI主应用
│   ├── database.py      # 数据库模型和初始化
│   ├── schemas.py       # Pydantic数据模型
│   ├── rules.py         # 业务规则引擎
│   ├── sample_data.py   # 样例数据生成脚本
│   └── requirements.txt # Python依赖
├── frontend/
│   └── index.html       # 单页应用
└── data/                # SQLite数据库文件目录
```

## 快速开始

### 1. 安装后端依赖

```bash
cd api-latency-dashboard/backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

打开浏览器访问: `http://localhost:8000/docs`

### 4. 打开前端页面

直接在浏览器中打开 `frontend/index.html` 文件

### 5. 生成样例数据（可选）

```bash
# 确保后端服务已启动
python sample_data.py
```

## API接口

### 事故管理
- `POST /api/incidents` - 创建新事故
- `GET /api/incidents` - 查询事故列表（支持分页和过滤）
- `GET /api/incidents/{incident_id}` - 获取事故详情
- `PUT /api/incidents/{incident_id}/status` - 更新事故状态
- `POST /api/incidents/{incident_id}/remarks` - 添加排查备注
- `POST /api/incidents/batch` - 批量导入事故

### 导出和统计
- `GET /api/incidents/export/report` - 导出事故报告
- `GET /api/stats/summary` - 获取统计摘要

### 基础数据
- `GET /api/buckets` - 获取延迟分桶配置

## 状态流转规则

```
DETECTED (已发现)
    ├──→ INVESTIGATING (排查中)
    └──→ FALSE_POSITIVE (误报)

INVESTIGATING (排查中)
    ├──→ ESCALATED (已升级)
    ├──→ RESOLVED (已恢复)
    └──→ FALSE_POSITIVE (误报)

ESCALATED (已升级)
    ├──→ RESOLVED (已恢复)
    └──→ FALSE_POSITIVE (误报)

RESOLVED (已恢复)
    └──→ CLOSED (已关闭)

FALSE_POSITIVE (误报)
    └──→ CLOSED (已关闭)
```

## 延迟分桶配置

| 分桶名称 | 延迟范围 | 严重程度 |
|---------|---------|---------|
| NORMAL | 0-500ms | info |
| WARNING | 500-1000ms | warning |
| ALERT | 1000-3000ms | error |
| CRITICAL | 3000-10000ms | critical |
| FATAL | >10000ms | fatal |

## 批量导入格式

```json
{
    "operator": "your_name",
    "items": [
        {
            "api_path": "/api/v1/users/profile",
            "avg_latency": 1200,
            "p95_latency": 1800,
            "p99_latency": 2500,
            "total_requests": 10000,
            "slow_requests": 500,
            "start_time": "2024-01-15T10:30:00",
            "tenant_ids": ["TENANT_A", "TENANT_B", "TENANT_C"]
        }
    ]
}
```

## 技术栈

- **后端**: Python 3.8+, FastAPI, SQLAlchemy, Pandas, OpenPyXL
- **前端**: HTML5, Tailwind CSS, JavaScript (原生)
- **数据库**: SQLite
- **部署**: 单文件前端，可直接运行

## 报告导出说明

导出的Excel报告包含以下字段：
- 事故ID、接口路径、当前状态、严重程度
- **状态说明**: 解释当前状态的具体含义
- 延迟分桶、平均延迟、P95/P99延迟
- 总请求数、慢请求数、慢请求占比
- 受影响租户数量、租户列表
- 开始/结束时间、持续时间
- 恢复备注、时间线事件详情、排查备注
- 创建时间、更新时间

每个记录都自动生成相应的状态解释，方便值班同学快速理解事故情况。
