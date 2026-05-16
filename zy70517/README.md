# SLO 错误预算 API

服务灰度发布决策系统，基于错误预算实现统一的发布拦截和豁免审批机制。

## 核心功能

### 数据模型
- **服务SLO配置**: 服务名、SLO指标、目标值、描述
- **错误预算**: 总预算、剩余预算、已消费预算
- **发布批次**: 批次名称、预算消费额、状态、决策类型、豁免理由、决策摘要、审批人
- **审计记录**: 原始输入、处理依据、指标快照、人工修正记录

### 关键规则
1. **预算扣减**: 发布批准时自动扣减对应预算
2. **发布拦截**: 预算耗尽时自动拦截发布
3. **豁免审批**: 预算不足时可申请豁免审批
4. **指标快照**: 每次决策保留当时的指标数据
5. **决策导出**: 支持导出所有决策历史用于审计
6. **失败路径**: 异常处理保留完整上下文信息

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/services/slo` | 创建服务SLO配置 |
| POST | `/api/budget` | 初始化错误预算 |
| GET | `/api/budget/{service}/{slo}` | 查询预算状态 |
| POST | `/api/release/evaluate` | 评估发布决策 |
| POST | `/api/release/{id}/approve-exemption` | 批准豁免 |
| POST | `/api/release/{id}/reject-exemption` | 拒绝豁免 |
| POST | `/api/release/{id}/exception` | 标记异常 |
| POST | `/api/release/{id}/manual-correction` | 人工修正 |
| POST | `/api/release/{id}/complete` | 标记发布完成 |
| GET | `/api/batches` | 查询批次列表 |
| GET | `/api/release/{id}` | 查询批次详情 |
| GET | `/api/export` | 导出决策数据 |
| GET | `/api/export/download` | 下载导出JSON |

### 发布状态流转
```
PENDING (待审批)
    ↓
APPROVED / EXEMPTED (已批准/已豁免)
    ↓
COMPLETED (已完成)

或

BLOCKED (已拦截)
FAILED (异常失败)
```

### 决策类型
- **ALLOW**: 预算充足，自动批准
- **REQUIRE_APPROVAL**: 预算不足，需审批
- **BLOCK**: 预算耗尽，拦截发布

## 快速开始

### 1. 安装依赖
```bash
pip3 install -r requirements.txt
```

### 2. 运行测试
```bash
python3 test_slo.py
```

### 3. 启动API服务
```bash
python3 api.py
```
服务将在 `http://localhost:8080` 启动

### 4. API 使用示例

#### 创建服务SLO
```bash
curl -X POST http://localhost:8080/api/services/slo \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order-service",
    "slo_name": "availability",
    "slo_target": 0.999,
    "description": "订单服务可用性SLO"
  }'
```

#### 初始化错误预算
```bash
curl -X POST http://localhost:8080/api/budget \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order-service",
    "slo_name": "availability",
    "total_budget": 100.0
  }'
```

#### 评估发布
```bash
curl -X POST http://localhost:8080/api/release/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order-service",
    "batch_name": "v1.0.0-rc1",
    "slo_name": "availability",
    "budget_consumption": 30.0,
    "requester": "engineer_a",
    "metrics_snapshot": {"error_rate": 0.0005, "throughput": 1000},
    "raw_input": {"ci_build_id": "12345"}
  }'
```

#### 批准豁免（强制扣减预算）
```bash
curl -X POST http://localhost:8080/api/release/{batch_id}/approve-exemption \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager_a",
    "override_budget": true
  }'
```

#### 人工修正（重新计算预算）
```bash
curl -X POST http://localhost:8080/api/release/{batch_id}/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "corrector": "admin_user",
    "correction_note": "修正预算消费值从30到15",
    "new_budget_consumption": 15.0,
    "new_status": "approved",
    "recalculate_budget": true
  }'
```

#### 导出决策数据
```bash
curl "http://localhost:8080/api/export?service_name=order-service"
```

## 测试覆盖

测试脚本 `test_slo.py` 覆盖以下场景：

1. **正常流程测试** (10个断言)
   - 创建SLO、初始化预算
   - 预算充足 → 批准发布
   - 预算不足 → 待审批
   - 批准豁免 → 强制扣减
   - 预算耗尽 → 拦截发布
   - 标记完成 → 导出数据

2. **脏数据测试** (8个断言)
   - SLO target 无效值 (0 < target < 1)
   - 负预算初始化
   - SLO不存在
   - 重复初始化预算
   - 审批非待审批批次
   - 操作不存在的批次

3. **重复请求测试** (4个断言)
   - 多次请求创建唯一批次
   - 预算正确累加扣减
   - 重复豁免审批被拒绝

4. **人工修正后重新计算** (7个断言)
   - 修改预算消费值
   - 预算重新计算
   - 处理证据保留修正记录
   - 只修改状态不修改预算

5. **异常处理测试** (3个断言)
   - 标记异常状态
   - 保留异常信息
   - 导出统计包含失败记录

6. **数据持久化测试** (5个断言)
   - 服务重启后预算数据保留
   - 服务重启后批次数据保留
   - 重启后可正常继续操作

## 数据持久化

所有数据存储在 `./data/` 目录下的JSON文件中：
- `budgets.json` - 预算数据
- `batches.json` - 发布批次数据
- `services.json` - 服务SLO配置数据

服务重启后所有历史数据完整保留，支持回溯查询所有决策记录。

## 核心代码文件

| 文件 | 说明 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy70517/models.py) | 数据模型定义（枚举、数据类） |
| [storage.py](file:///Users/lzy/pro/solo/workspaces/zy70517/storage.py) | JSON持久化存储层 |
| [slo_service.py](file:///Users/lzy/pro/solo/workspaces/zy70517/slo_service.py) | 核心业务逻辑（预算扣减、审批、导出等） |
| [api.py](file:///Users/lzy/pro/solo/workspaces/zy70517/api.py) | Flask HTTP API接口层 |
| [test_slo.py](file:///Users/lzy/pro/solo/workspaces/zy70517/test_slo.py) | 测试套件（42个断言） |
| [requirements.txt](file:///Users/lzy/pro/solo/workspaces/zy70517/requirements.txt) | 依赖包列表 |
