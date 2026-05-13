# 异常工单归因 API

基于 FastAPI + SQLAlchemy 实现的标准 API 服务。

## 功能特性

- **数据对象**
  - 错误事件 (ErrorEvent)
  - 接口路径 (API Path) - 内嵌于错误事件
  - 归属规则 (AttributionRule)
  - 相似工单 (SimilarTicket)
  - 根因标签 (RootCauseLabel)
  - 派单记录 (DispatchRecord)
  - 状态历史 (StatusHistory)

- **核心规则**
  - 归属匹配：基于错误码、API路径、关键词正则匹配
  - 相似合并：基于错误码、API路径、标题相似度计算
  - 根因标注：支持置信度评分
  - 派单状态：完整的工单生命周期管理
  - 归因报告：聚合展示完整归因信息

- **接口能力**
  - 创建工单（幂等性保证
  - 参数校验
  - 状态推进
  - 异常返回标准化
  - 历史查询
  - 归因报告导出## 技术栈- Python 3.8+
- FastAPI 0.104
- SQLAlchemy 2.0
- SQLite

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 工单管理

- `POST /api/v1/tickets` - 创建工单（幂等）
- `GET /api/v1/tickets` - 查询工单列表
- `GET /api/v1/tickets/{id}` - 查询工单详情
- `POST /api/v1/tickets/{id}/match-rules` - 执行归属规则匹配
- `POST /api/v1/tickets/{id}/find-similar` - 查找相似工单
- `POST /api/v1/tickets/{id}/merge/{similar_id}` - 合并相似工单
- `GET /api/v1/tickets/{id}/status-history` - 查询状态历史
- `GET /api/v1/tickets/{id}/report` - 获取归因报告

### 归属规则

- `POST /api/v1/attribution-rules` - 创建归属规则
- `GET /api/v1/attribution-rules` - 查询规则列表

### 根因标注

- `POST /api/v1/root-cause-labels` - 标注根因

### 派单管理

- `POST /api/v1/dispatch-records` - 创建派单记录

### 状态管理

- `POST /api/v1/status-transitions` - 状态流转

## 测试流程

```bash
chmod +x test_flow.sh
./test_flow.sh
```

## 状态枚举

- `pending` - 待处理
- `matching` - 匹配中
- `merged` - 已合并
- `analyzing` - 分析中
- `root_cause_labelled` - 已标注根因
- `dispatched` - 已派单
- `completed` - 已完成
- `failed` - 处理失败

## 幂等性设计

通过 `idempotency_key` 实现重复提交检测：

- 相同 `idempotency_key` 返回 409 Conflict
- 相同 `ticket_id` 也返回 409 Conflict

## 项目结构

```
.
├── main.py              # 应用入口
├── models.py            # 数据模型
├── schemas.py           # Pydantic 校验模型
├── services.py          # 业务逻辑层
├── api.py               # API 路由
├── database.py          # 数据库配置
├── exceptions.py        # 异常处理
├── requirements.txt    # 依赖
└── test_flow.sh         # 测试脚本
```