# 区域流量撤离API

## 项目概述

当某个区域机房出现问题时，需要切走流量前，首先要知道哪些租户还绑定本地资源。本系统提供完整的REST API接口，实现区域流量撤离的全流程管理。

## 核心功能

### 1. 数据模型
- **区域名称**: 标识需要撤离的机房
- **租户绑定**: 记录每个租户绑定的本地资源
- **流量比例**: 按梯度逐步降低区域流量
- **本地依赖**: 检查关键依赖的健康状态
- **撤离计划**: 分阶段的撤离执行计划
- **执行摘要**: 导出完整的执行报告

### 2. 核心规则
- ✅ **依赖检查**: 执行前自动检查所有关键依赖
- ✅ **比例推进**: 按75% → 50% → 25% → 0%梯度推进
- ✅ **撤离幂等**: 重复推进操作不会产生副作用
- ✅ **阻塞原因**: 详细记录撤离被阻塞的具体原因
- ✅ **执行摘要**: 支持导出完整的执行摘要报告

### 3. 返回状态类型
- **SUCCESS**: 操作成功
- **PENDING_REVIEW**: 待复核
- **BLOCKED**: 操作被拦截
- **COMPENSATED**: 已执行补偿

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/plans` | 创建撤离计划 |
| GET | `/api/v1/plans` | 查询所有撤离计划 |
| GET | `/api/v1/plans/{plan_id}` | 查询单个计划详情 |
| POST | `/api/v1/plans/{plan_id}/review` | 复核撤离计划 |
| POST | `/api/v1/plans/{plan_id}/advance` | 推进撤离步骤 |
| POST | `/api/v1/plans/{plan_id}/exception` | 异常处理 |
| POST | `/api/v1/plans/{plan_id}/correct` | 人工修正 |
| GET | `/api/v1/plans/{plan_id}/summary` | 导出执行摘要 |
| GET | `/api/v1/plans/{plan_id}/logs` | 查询执行日志 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动API服务

```bash
python api.py
```

或使用uvicorn:

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问:
- API文档: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

### 3. 运行测试脚本

```bash
python test_api.py
```

测试脚本提供交互式菜单，支持:
1. 完整撤离流程测试
2. 依赖阻塞场景测试
3. 运行所有测试

## 使用示例

### 场景一: 完整撤离流程

```python
# 1. 创建撤离计划
POST /api/v1/plans
{
  "region_name": "华北-北京机房",
  "created_by": "admin_user",
  "tenant_bindings": [...],
  "local_dependencies": [...],
  "target_percentage": 0.0
}

# 2. 复核通过
POST /api/v1/plans/{plan_id}/review
{
  "operator": "reviewer_admin",
  "approved": true
}

# 3. 逐步推进撤离
POST /api/v1/plans/{plan_id}/advance
{
  "operator": "operator_001"
}

# 4. 导出执行摘要
GET /api/v1/plans/{plan_id}/summary
```

### 场景二: 依赖阻塞与人工修正

```python
# 1. 创建计划（含失败的依赖）
# 2. 复核时因依赖检查失败被BLOCKED
# 3. 人工修正依赖状态
POST /api/v1/plans/{plan_id}/correct
{
  "operator": "senior_sre",
  "local_dependencies": [
    {"resource_type": "Database", "resource_name": "MySQL-Main", "check_status": "PASS"}
  ]
}

# 4. 重新复核并继续推进
```

### 场景三: 异常补偿

```python
POST /api/v1/plans/{plan_id}/exception
{
  "operator": "sre_engineer",
  "exception_type": "NETWORK_PARTITION",
  "exception_detail": "机房网络分区，流量切换中断",
  "compensate": true
}
```

## 项目结构

```
.
├── models.py          # 数据模型定义
├── storage.py         # 本地持久化层
├── service.py         # 核心业务逻辑
├── api.py             # REST API接口
├── test_api.py        # 自动化测试脚本
├── requirements.txt   # 依赖文件
└── data/
    └── evacuation_plans.json  # 数据存储文件
```

## 数据持久化

所有数据通过JSON文件存储在`./data/evacuation_plans.json`，包括:
- 所有撤离计划的完整状态
- 历史执行日志
- 租户绑定信息
- 依赖检查结果

重启服务后数据不会丢失，支持完整的历史查询。

## 状态流转

```
DRAFT (草稿)
    ↓ (review/approved)
PENDING_REVIEW (待复核)
    ↓ (review/approved)
IN_PROGRESS (执行中)
    ↓ (advance)
PARTIAL (部分完成)
    ↓ (advance to final)
COMPLETED (已完成)

BLOCKED (被阻塞) - 可在任何阶段进入
COMPENSATED (已补偿) - 异常处理后的最终状态
```
