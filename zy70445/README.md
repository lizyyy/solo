# 临时令牌发放后端服务

## 功能特性

1. **批量令牌发放** - 支持批量创建临时访问令牌
2. **重复提交检测** - 通过内容哈希检测相同内容的重复提交
3. **失败项管理** - 单独保存处理失败的项目，支持手动解决
4. **候选清单机制** - 清理/回滚操作需要先创建候选清单并审批，避免误伤真实数据
5. **多维度过滤查询** - 按批次、操作者、风险类型等过滤历史记录
6. **处理报告** - 包含处理前后对比、执行时间和下一步建议
7. **复盘追踪** - 从状态变化定位到审批催办列表

## 项目结构

```
zy70445/
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型定义
│   ├── schemas.py           # Pydantic 模式定义
│   ├── services.py          # 业务逻辑服务
│   └── main.py              # API 路由入口
├── scripts/
│   └── seed_demo_data.py    # 演示数据生成脚本
├── requirements.txt         # Python 依赖
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化演示数据

```bash
python -m scripts.seed_demo_data
```

演示数据包含：
- 3 个批次（包含过期版本冻结通知和合并错误的脏情况）
- 16 个令牌
- 2 个处理失败的项目（合并错误）
- 2 个待审批项目（带催办记录）
- 2 个候选清单（回滚和清理）
- 1 份处理报告

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问: http://localhost:8000/docs

## 主要 API 接口

### 批次管理
- `POST /api/batches` - 创建新批次并发放令牌
- `GET /api/batches` - 查询批次列表（支持过滤）
- `GET /api/batches/{batch_id}` - 获取批次详情
- `GET /api/batches/{batch_no}/check-duplicate` - 检查重复提交
- `GET /api/batches/{batch_id}/review` - 获取复盘数据

### 令牌管理
- `GET /api/batches/{batch_id}/tokens` - 获取批次的令牌列表
- `GET /api/tokens/{token_id}` - 获取令牌详情
- `POST /api/tokens/{token_id}/revoke` - 撤销令牌

### 失败项管理
- `GET /api/failed-items` - 查看失败项列表
- `POST /api/failed-items/{item_id}/resolve` - 标记失败项已解决

### 候选清单
- `POST /api/candidate-lists` - 创建候选清单（清理/回滚）
- `GET /api/candidate-lists` - 查询候选清单
- `POST /api/candidate-lists/{id}/approve` - 审批候选清单
- `POST /api/candidate-lists/{id}/execute` - 执行候选清单

### 审批管理
- `POST /api/batches/{batch_id}/approval-items` - 创建审批项
- `GET /api/approval-items` - 查询审批项
- `POST /api/approval-items/{id}/send-reminder` - 发送催办
- `POST /api/approval-items/{id}/approve` - 审批通过

### 报告管理
- `POST /api/reports/{batch_id}` - 生成处理报告
- `GET /api/reports` - 查询报告列表

## 数据模型

### RiskType（风险类型）
- `expired_version` - 过期版本
- `merge_error` - 合并错误
- `data_inconsistency` - 数据不一致
- `permission_violation` - 权限违规
- `unknown` - 未知

### ProcessingStatus（处理状态）
- `pending` - 待处理
- `processing` - 处理中
- `success` - 成功
- `failed` - 失败
- `partial` - 部分成功
- `conflict` - 冲突
- `reused` - 复用
- `rollback` - 已回滚

### TokenStatus（令牌状态）
- `active` - 有效
- `expired` - 过期
- `revoked` - 已撤销
- `used` - 已使用

## 使用示例

### 创建批次发放令牌

```bash
curl -X POST "http://localhost:8000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-001",
    "operator": "admin",
    "description": "测试批次",
    "risk_type": "expired_version",
    "items": [
      {"subject": "item1", "expires_days": 7},
      {"subject": "item2", "expires_days": 7}
    ]
  }'
```

### 按风险类型过滤查询

```bash
curl "http://localhost:8000/api/batches?risk_type=expired_version"
```

### 创建回滚候选清单

```bash
curl -X POST "http://localhost:8000/api/candidate-lists?created_by=admin" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "list_type": "rollback",
    "name": "回滚有问题的令牌",
    "description": "回滚因为合并错误的令牌",
    "items": [
      {"token_id": 1, "reason": "合并错误"},
      {"token_id": 2, "reason": "合并错误"}
    ]
  }'
```

### 生成处理报告

```bash
curl -X POST "http://localhost:8000/api/reports/1?generated_by=admin"
```
