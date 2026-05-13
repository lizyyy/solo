# 模型推理配额 API

GPU 配额管理与推理请求调度系统，告别人肉确认，让故障可追溯、责任可界定。

## 快速开始

### 安装依赖

```bash
cd model_quota_api
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

启动后访问:
- API 文档: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

### 运行测试

```bash
python test_api.py
```

## 核心概念

### 数据对象

| 对象 | 说明 | 关键字段 |
|------|------|----------|
| BusinessParty | 业务方 | party_id, name, is_active |
| ModelInfo | 模型 | model_id, name, gpu_units_per_request |
| GpuQuota | GPU 额度 | total_quota, used_quota, effective_date |
| InferenceRequest | 推理请求 | request_id, idempotency_key, status, queue_position |
| QueuePosition | 排队位置 | position, priority, requested_gpu_units |
| ReturnRecord | 返还记录 | request_id, returned_gpu_units, return_reason |
| UsageRecord | 用量记录 | gpu_units, start_time, duration_seconds |

### 请求状态

- `pending`: 待处理
- `queued`: 排队中
- `running`: 运行中
- `success`: 成功
- `failed`: 失败
- `cancelled`: 已取消

### 优先级

- `LOW` (1): 低优先级
- `NORMAL` (2): 普通优先级（默认）
- `HIGH` (3): 高优先级
- `CRITICAL` (4): 紧急优先级

## API 使用指南

### 1. 基础配置

#### 注册业务方

```bash
curl -X POST "http://localhost:8000/parties" \
  -H "Content-Type: application/json" \
  -d '{
    "party_id": "party_001",
    "name": "AI 业务部",
    "description": "大模型推理业务"
  }'
```

#### 注册模型

```bash
curl -X POST "http://localhost:8000/models" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "model_llama_v2",
    "name": "Llama-2-70B",
    "version": "v2",
    "gpu_units_per_request": 8
  }'
```

#### 设置额度

```bash
curl -X POST "http://localhost:8000/quotas" \
  -H "Content-Type: application/json" \
  -d '{
    "party_id": "party_001",
    "model_id": "model_llama_v2",
    "total_quota": 16,
    "used_quota": 0,
    "reserved_quota": 0,
    "effective_date": "2024-01-01T00:00:00",
    "expire_date": "2024-12-31T23:59:59"
  }'
```

### 2. 推理请求流程

#### 创建请求（幂等）

使用 `idempotency-key` 请求头保证幂等性，重复提交不会产生脏数据：

```bash
curl -X POST "http://localhost:8000/requests?party_id=party_001&model_id=model_llama_v2&priority=2" \
  -H "idempotency-key: my_unique_request_key_001"
```

**重要**: 相同的 `idempotency-key` 重复调用会返回同一个请求，不会创建新请求。

#### 校验并处理请求

```bash
curl -X POST "http://localhost:8000/requests/{request_id}/process"
```

处理逻辑：
- 额度充足 → 状态变为 `running`，扣减额度
- 额度不足 → 进入队列，状态变为 `queued`

#### 完成请求（成功）

```bash
curl -X POST "http://localhost:8000/requests/{request_id}/complete?success=true"
```

#### 标记请求失败

```bash
curl -X POST "http://localhost:8000/requests/{request_id}/fail?error_code=GPU_OOM&error_message=GPU内存不足"
```

#### 取消请求

```bash
curl -X POST "http://localhost:8000/requests/{request_id}/cancel"
```

### 3. 排队管理

#### 查看队列

```bash
curl "http://localhost:8000/queues/party_001/model_llama_v2"
```

#### 调整优先级（仅排队中请求）

```bash
curl -X POST "http://localhost:8000/requests/{request_id}/priority?priority=3"
```

### 4. 查询功能

#### 查询单个请求

```bash
curl "http://localhost:8000/requests/{request_id}"
```

#### 通过幂等键查询

```bash
curl "http://localhost:8000/requests/idempotency/my_unique_request_key_001"
```

#### 查询业务方所有请求

```bash
# 全部
curl "http://localhost:8000/parties/party_001/requests"

# 按状态过滤
curl "http://localhost:8000/parties/party_001/requests?status=running"
```

### 5. 用量与记录

#### 查询用量记录

```bash
# 全部用量
curl "http://localhost:8000/usage"

# 按业务方过滤
curl "http://localhost:8000/usage?party_id=party_001"

# 按时间范围
curl "http://localhost:8000/usage?start_time=2024-01-01T00:00:00&end_time=2024-01-02T00:00:00"
```

#### 查询返还记录

```bash
curl "http://localhost:8000/returns?party_id=party_001"
```

## 造数据指南

测试环境快速构造各种场景：

### 场景1：正常流程（创建→运行→成功）

```python
from datetime import datetime, timedelta
from models import BusinessParty, ModelInfo, GpuQuota

# 1. 准备基础数据
engine.register_party(BusinessParty(party_id="p1", name="测试业务"))
engine.register_model(ModelInfo(model_id="m1", name="测试模型", version="v1", gpu_units_per_request=1))
engine.set_quota(GpuQuota(party_id="p1", model_id="m1", total_quota=5, effective_date=datetime.now()))

# 2. 创建并处理请求
req = engine.create_request("key1", "p1", "m1")
req = engine.validate_and_process(req.request_id)  # running
req = engine.complete_request(req.request_id)  # success
```

### 场景2：排队场景

```python
# 额度设为 1，创建 3 个请求
engine.set_quota(GpuQuota(party_id="p1", model_id="m1", total_quota=1, effective_date=datetime.now()))

req1 = engine.create_request("key1", "p1", "m1")
req2 = engine.create_request("key2", "p1", "m1")
req3 = engine.create_request("key3", "p1", "m1")

req1 = engine.validate_and_process(req1.request_id)  # running
req2 = engine.validate_and_process(req2.request_id)  # queued, position=1
req3 = engine.validate_and_process(req3.request_id)  # queued, position=2
```

### 场景3：优先级插队

```python
req_normal = engine.create_request("key_normal", "p1", "m1", priority=PriorityLevel.NORMAL)
req_high = engine.create_request("key_high", "p1", "m1", priority=PriorityLevel.HIGH)

req_normal = engine.validate_and_process(req_normal.request_id)  # queued, position=1
req_high = engine.validate_and_process(req_high.request_id)    # queued, position=1 (插队)
```

### 场景4：异常触发

| 异常 | 触发方式 | 错误码 |
|------|----------|--------|
| 业务方不存在 | 使用不存在的 party_id | PARTY_NOT_FOUND |
| 模型不存在 | 使用不存在的 model_id | MODEL_NOT_FOUND |
| 业务方已停用 | 设置 party.is_active = False | PARTY_INACTIVE |
| 额度未生效 | effective_date 设为未来时间 | QUOTA_NOT_EFFECTIVE |
| 额度已过期 | expire_date 设为过去时间 | QUOTA_EXPIRED |
| 状态不合法 | 对非 running 请求调用 complete | INVALID_STATUS |

## 核心规则详解

### 1. 额度扣减规则

- 请求进入 `running` 状态时，从可用额度中扣减
- 扣减公式：`available = total - used - reserved`
- 额度不足时自动进入排队

### 2. 队列排位规则

- 按优先级排序，高优先级在前
- 相同优先级按进入队列顺序
- 优先级调整后重新排序

### 3. 失败返还规则

- 请求失败、取消时自动返还额度
- 返还时触发队列处理，队首请求自动尝试启动

### 4. 幂等性保证

- 以 `idempotency_key` 作为唯一标识
- 重复提交返回已存在的请求
- 适用于创建请求接口

## 故障排查指南

### 问题1：请求一直排队

检查步骤：
1. 查看额度配置：`GET /quotas/{party_id}/{model_id}`
2. 查看队列：`GET /queues/{party_id}/{model_id}`
3. 查看运行中的请求：`GET /parties/{party_id}/requests?status=running`
4. 检查是否有请求卡住未返还

### 问题2：额度对不上

检查步骤：
1. 查看用量记录：`GET /usage?party_id=xxx`
2. 查看返还记录：`GET /returns?party_id=xxx`
3. 核对：`used = 运行请求 GPU 总和`
4. 核对：`available = total - used - reserved`

### 问题3：重复提交产生脏数据

检查：
1. 确认每次请求都带了 `idempotency-key` 请求头
2. 通过 `GET /requests/idempotency/{key}` 查询对应关系
3. 幂等键建议格式：`业务标识_时间戳_随机数`

## 项目结构

```
model_quota_api/
├── models.py          # 数据模型定义
├── engine.py          # 核心业务规则引擎
├── api.py             # FastAPI 接口层
├── test_api.py        # 测试脚本
├── requirements.txt   # 依赖列表
└── README.md         # 使用文档
```
