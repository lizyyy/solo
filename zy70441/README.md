# 分布式锁观测服务

客服升级工单观测系统，支持时区异常检测、人工修正、历史追溯等功能。

## 核心功能

### 1. 工单管理
- 创建/查询客服升级工单
- 保留原始输入字段，支持完整追溯
- 自动时区偏移检测和异常判断

### 2. 规则版本管理
- 多版本规则并存
- 规则变更时旧批次仍使用当时的判断口径
- 工单保存规则快照，支持历史解释

### 3. 人工修正
- 不直接覆盖系统判断
- 记录人工判断和备注
- 保留完整操作日志

### 4. 历史查询
- 按批次过滤
- 按操作者过滤
- 按风险类型过滤
- 按来源系统过滤

### 5. 安全清理
- 先生成候选清单，避免误伤真实数据
- 支持多种筛选条件
- 执行前可预览待清理数据

### 6. 跨系统追溯
- 支持云资源申请单补改
- 按来源系统查看改动理由
- 完整变更历史记录

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite (可扩展)
- **时区处理**: pytz

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据

```bash
python init_data.py
```

这将生成:
- 2个规则版本 (v1.0已过期, v2.0生效中)
- 2个批次的工单数据 (包含正常和时区异常记录)
- 云资源申请单补改记录
- 人工修正示例

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 工单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/work-orders/ | 创建工单 |
| GET | /api/v1/work-orders/{id} | 获取工单详情 |
| GET | /api/v1/work-orders/ | 查询工单列表 |
| POST | /api/v1/work-orders/{id}/manual-correct | 人工修正 |

### 规则管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/rules/ | 创建规则版本 |
| GET | /api/v1/rules/active | 获取当前生效规则 |
| GET | /api/v1/rules/ | 获取所有规则版本 |

### 操作日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/operation-logs/ | 查询操作日志 |
| GET | /api/v1/work-orders/{id}/logs | 获取工单操作日志 |

### 批量清理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/clean-candidates/ | 生成清理候选清单 |
| GET | /api/v1/clean-candidates/ | 获取候选清单列表 |
| POST | /api/v1/clean-candidates/{id}/execute | 执行批量清理 |

## 项目结构

```
.
├── main.py              # 应用入口
├── config.py            # 配置管理
├── database.py          # 数据库连接
├── models.py            # 数据模型
├── schemas.py           # Pydantic模式
├── services.py          # 业务逻辑
├── routers.py           # API路由
├── init_data.py         # 初始化数据脚本
└── requirements.txt     # 依赖列表
```

## 数据模型

### WorkOrder (工单)
- 基础信息: 工单号、批次、来源系统
- 客户信息: 客户ID、姓名
- 原始输入: JSON格式完整保留
- 风险评估: 风险类型、风险分数、时区偏移
- 判断记录: 系统判断、人工判断、最终判断
- 规则关联: 规则版本ID、规则快照

### RuleVersion (规则版本)
- 版本号
- 规则内容 (JSON)
- 生效/过期时间
- 是否激活

### OperationLog (操作日志)
- 工单ID/批次号
- 操作类型
- 操作者
- 变更前后数据
- 来源系统
- 改动理由

### CleanCandidate (清理候选)
- 批次号
- 候选工单ID列表
- 筛选条件
- 生成人
- 是否已执行
