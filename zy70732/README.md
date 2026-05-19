# 租户功能权益试用回收后端API

基于 FastAPI + SQLite 的租户功能权益试用管理系统，支持试用开通、回收、状态追踪、快照导出等功能。

## 功能特性

- 试用开通（幂等处理）
- 回收状态机管理
- 来源追踪
- 权益快照导出
- 异常处理与审计
- 人工修正与撤回

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问: http://localhost:8000/docs

### 3. 造数脚本

```bash
python seed_data.py
```

## API 接口示例

### 创建试用

```bash
curl -X POST "http://localhost:8000/api/trials" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant_001",
    "feature_package": "AI_ANALYTICS",
    "trial_days": 30,
    "source": "SALES_PRESALE",
    "source_id": "presale_2024_001",
    "created_by": "sales_zhang"
  }'
```

### 查询试用列表

```bash
curl "http://localhost:8000/api/trials?tenant_id=tenant_001"
```

### 推进状态

```bash
curl -X POST "http://localhost:8000/api/trials/1/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "system_auto"
  }'
```

### 人工修正

```bash
curl -X POST "http://localhost:8000/api/trials/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "ACTIVE",
    "reason": "客户投诉，重新激活",
    "operated_by": "admin_li"
  }'
```

### 撤回/关闭

```bash
curl -X POST "http://localhost:8000/api/trials/1/close" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "测试结束，提前关闭",
    "operated_by": "tester_wang"
  }'
```

### 导出快照

```bash
curl "http://localhost:8000/api/trials/1/snapshot" -o snapshot.json
```

## 冲突路径测试

### 重复开通（幂等验证）

```bash
# 第一次开通
curl -X POST "http://localhost:8000/api/trials" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant_001",
    "feature_package": "AI_ANALYTICS",
    "trial_days": 30,
    "source": "SALES_PRESALE",
    "source_id": "presale_2024_001",
    "created_by": "sales_zhang"
  }'

# 第二次重复开通（返回已存在的记录）
curl -X POST "http://localhost:8000/api/trials" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant_001",
    "feature_package": "AI_ANALYTICS",
    "trial_days": 30,
    "source": "SALES_PRESALE",
    "source_id": "presale_2024_001",
    "created_by": "sales_zhang"
  }'
```

## 运行测试

```bash
pytest test_api.py -v
```

## 核心数据模型

### 试用状态机

```
PENDING → ACTIVE → EXPIRING → EXPIRED → RECYCLING → RECYCLED
   ↓         ↓          ↓          ↓          ↓
CLOSED    CLOSED     CLOSED     CLOSED     CLOSED
```

- `PENDING`: 待激活
- `ACTIVE`: 试用中
- `EXPIRING`: 即将到期
- `EXPIRED`: 已到期
- `RECYCLING`: 回收中
- `RECYCLED`: 已回收
- `CLOSED`: 已关闭/撤回

### 开通来源

- `SALES_PRESALE`: 售前开通
- `CUSTOMER_SUCCESS`: 客户成功
- `MARKETING_CAMPAIGN`: 营销活动
- `SELF_REGISTER`: 自助注册
- `OTHER`: 其他
