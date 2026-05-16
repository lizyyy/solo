# API变更订阅服务

一个本地可运行的API变更订阅系统，支持订阅方订阅关心的API变更通知、确认已处理、异常处理、人工修正和报告导出。

## 技术栈

- Python 3.8+
- FastAPI - REST API框架
- SQLAlchemy - ORM
- SQLite - 本地持久化
- Pydantic - 数据验证

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python sample_data.py
```

该脚本会：
- 创建数据库
- 初始化4种变更类型（破坏性变更、接口废弃、新增功能、Bug修复）
- 创建3个订阅方团队
- 创建6个API路径
- 创建8个订阅关系
- 创建3个API变更记录并自动处理生成通知

### 3. 运行服务

```bash
python main.py
```

或者使用uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- 备用文档: http://localhost:8000/redoc

### 4. 运行自检

```bash
python test_self_check.py
```

或者使用pytest：

```bash
pytest test_self_check.py -v
```

## 核心功能

### 数据模型

| 模型 | 说明 |
|------|------|
| Subscriber | 订阅方（团队） |
| ApiPath | API路径 |
| ChangeType | 变更类型（BREAKING, DEPRECATION, NEW_FEATURE, BUGFIX） |
| Subscription | 订阅关系（订阅方 + API路径 + 变更类型） |
| ApiChange | API变更记录 |
| NotificationBatch | 通知批次 |
| Notification | 通知记录 |

### 核心规则

1. **订阅匹配**：当有API变更时，自动匹配所有订阅了该API路径和变更类型的订阅方
2. **通知去重**：同一订阅方同一变更只发送一次通知，重复处理时自动跳过
3. **确认超时**：通知确认期限默认为7天，超时后自动标记为expired
4. **批次补发**：支持对通知批次进行重试补发，最多3次
5. **报告导出**：支持JSON和CSV格式的订阅报告导出

## API接口概览

### 订阅方管理
- `POST /subscribers/` - 创建订阅方
- `GET /subscribers/` - 获取订阅方列表
- `GET /subscribers/{id}` - 获取订阅方详情

### API路径管理
- `POST /api-paths/` - 创建API路径
- `GET /api-paths/` - 获取API路径列表

### 变更类型管理
- `POST /change-types/` - 创建变更类型
- `GET /change-types/` - 获取变更类型列表

### 订阅管理
- `POST /subscriptions/` - 创建订阅
- `GET /subscriptions/` - 获取订阅列表

### API变更管理
- `POST /api-changes/` - 创建API变更
- `GET /api-changes/` - 获取变更列表
- `POST /api-changes/{id}/process` - 处理变更（生成通知）
- `POST /api-changes/{id}/mark-correction` - 标记需要人工修正
- `POST /api-changes/{id}/correction-done` - 完成人工修正

### 通知管理
- `GET /notifications/` - 获取通知列表
- `POST /notifications/{id}/confirm` - 确认通知
- `POST /notifications/check-timeout` - 检查并处理超时通知

### 批次管理
- `GET /batches/` - 获取批次列表
- `POST /batches/{id}/retry` - 重试批次补发

### 报告导出
- `GET /reports/subscription` - 获取订阅报告（JSON）
- `GET /reports/subscription/export?format=json|csv` - 导出报告

## 使用示例

### 1. 创建订阅方

```bash
curl -X POST "http://localhost:8000/subscribers/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试团队",
    "email": "test@example.com",
    "description": "测试用"
  }'
```

### 2. 创建API路径

```bash
curl -X POST "http://localhost:8000/api-paths/" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/test",
    "method": "POST",
    "service": "test",
    "description": "测试接口"
  }'
```

### 3. 创建订阅

```bash
curl -X POST "http://localhost:8000/subscriptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_id": 1,
    "api_path_id": 1,
    "change_type_id": 1
  }'
```

### 4. 创建API变更

```bash
curl -X POST "http://localhost:8000/api-changes/" \
  -H "Content-Type: application/json" \
  -d '{
    "api_path_id": 1,
    "change_type_id": 1,
    "title": "测试API变更",
    "description": "这是一个测试变更",
    "change_date": "2024-01-01T00:00:00Z",
    "effective_date": "2024-02-01T00:00:00Z",
    "raw_input": "manual"
  }'
```

### 5. 处理API变更（生成通知）

```bash
curl -X POST "http://localhost:8000/api-changes/1/process"
```

### 6. 确认通知

```bash
curl -X POST "http://localhost:8000/notifications/1/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmation_note": "已收到，确认处理"
  }'
```

### 7. 导出报告

```bash
# JSON格式
curl "http://localhost:8000/reports/subscription/export?format=json"

# CSV格式
curl "http://localhost:8000/reports/subscription/export?format=csv"
```

## 异常处理

系统对异常路径保留原始输入和处理结论：
- 创建API变更失败时保留raw_input和错误信息
- 处理变更失败时记录处理结果
- 人工修正时保留修正备注和最终处理结果

## 测试覆盖

自检脚本覆盖以下场景：

1. **正常流程测试**
   - 创建订阅方
   - 创建订阅
   - 处理API变更生成通知
   - 确认通知
   - 生成订阅报告

2. **重复请求测试**
   - 重复创建订阅（返回已存在的订阅）
   - 重复处理API变更（跳过重复通知）

3. **脏数据测试**
   - 查询不存在的订阅方
   - 查询不存在的API路径
   - 处理不存在的变更
   - 确认不存在的通知

4. **人工修正测试**
   - 标记需要人工修正
   - 完成人工修正
   - 修正后重新计算处理

5. **超时和重试测试**
   - 检查并标记超时通知
   - 批次补发重试
   - 最大重试次数限制

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型和连接
├── schemas.py           # Pydantic数据模型
├── services.py          # 业务逻辑服务
├── sample_data.py       # 样例数据初始化脚本
├── test_self_check.py   # 自检测试脚本
├── requirements.txt     # 依赖列表
└── README.md           # 说明文档
```

运行时生成：
- `api_change_subscription.db` - 主数据库
- `test_api_change_subscription.db` - 测试数据库
