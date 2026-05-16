# 沙箱清理保全API

基于 FastAPI + SQLAlchemy 的沙箱清理保全管理系统，提供状态机驱动的清理流程、保全拦截机制、撤销留痕和摘要导出功能。

## 项目结构

```
├── main.py              # FastAPI 主应用，REST接口
├── models.py            # 数据模型（Pydantic + SQLAlchemy）
├── state_machine.py     # 清理状态机和核心业务逻辑
├── database.py          # 数据库配置
├── sample_data.py       # 样例数据和完整功能演示脚本
├── requirements.txt     # Python依赖
└── sandbox_cleanup.db   # SQLite数据库（自动创建）
```

## 核心功能

### 1. 状态机驱动的清理流程（10个状态）

```
pending → inventorying → inventory_done → preservation_checking → ready_to_clean → cleaning → completed
                                 ↓                    ↓                    ↓           ↓
                               error              revoked           cancelled       error
                                 ↓
                        pending/inventorying/cancelled/revoked
```

### 2. 保全标签和拦截机制

- `under_investigation` - 正在调查的样本，禁止清理
- `evidence` - 取证证据，禁止清理
- `pending_review` - 待人工复核，暂不清理
- `no_preservation` - 无保全，可正常清理

### 3. 审计留痕

所有状态变更、撤销操作、异常记录、人工修正都有完整的审计日志，包含：
- 操作前后状态
- 操作人
- 时间戳
- 原始输入快照
- 处理结论

## API接口列表

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/cleanups` | 创建清理任务 |
| GET | `/api/v1/cleanups` | 查询任务列表（支持多条件过滤） |
| GET | `/api/v1/cleanups/{id}` | 获取任务详情（可选含审计日志） |
| PUT | `/api/v1/cleanups/{id}` | 更新任务信息 |
| POST | `/api/v1/cleanups/{id}/transition` | 状态推进 |
| POST | `/api/v1/cleanups/{id}/revoke` | 撤销清理任务 |
| POST | `/api/v1/cleanups/{id}/error` | 记录异常 |
| POST | `/api/v1/cleanups/{id}/manual-correction` | 人工修正状态 |
| POST | `/api/v1/cleanups/export` | 导出清理摘要（支持过滤） |
| GET | `/api/v1/cleanups/{id}/summary` | 获取任务摘要详情 |
| GET | `/api/v1/status/valid-transitions` | 查看合法状态转换图 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行功能演示

```bash
pip install requests
python sample_data.py
```

## 使用示例

### 创建带保全标签的清理任务

```python
import requests

data = {
    "sandbox_id": "SANDBOX-001",
    "preservation_tag": "under_investigation",
    "created_by": "analyst",
    "remarks": "样本正在分析中",
    "resource_inventory": [
        {
            "resource_id": "FILE-001",
            "resource_type": "file",
            "resource_name": "sample.exe",
            "should_preserve": True,
            "preserve_reason": "正在分析"
        }
    ],
    "raw_input": {"source": "manual"}
}

response = requests.post("http://localhost:8000/api/v1/cleanups", json=data)
```

### 状态推进

```python
data = {
    "target_status": "inventorying",
    "operator": "operator_a",
    "processing_conclusion": "开始清点资源"
}
requests.post("http://localhost:8000/api/v1/cleanups/1/transition", json=data)
```

### 撤销任务

```python
data = {
    "revoke_reason": "样本需要进一步分析",
    "revoked_by": "manager",
    "details": {"priority": "high"}
}
requests.post("http://localhost:8000/api/v1/cleanups/1/revoke", json=data)
```

### 导出摘要

```python
# 导出所有有保全标签的任务
data = {
    "has_preservation": True,
    "export_format": "json"
}
response = requests.post("http://localhost:8000/api/v1/cleanups/export", json=data)
```

## 关键设计特点

### 状态机边界检查

- 防止非法状态转换（如已完成的任务不能再次清理）
- 终端状态（completed/cancelled/revoked）无法再变更

### 保全拦截机制

在 `ready_to_clean` 状态前自动检查保全标签，如有保全则抛出异常，防止误删正在调查的样本。

### 异常路径追踪

- 所有异常都保留原始输入快照
- 处理结论和操作人信息完整记录
- 支持从ERROR状态人工修正恢复

### 导出字段可读性

摘要包含完整的业务字段：
- 沙箱编号、状态、保全标签
- 资源统计（总数、保全数、清理数、失败数）
- 撤销原因、错误信息、处理结论
- 人工修正标记、修正原因

## 数据库表结构

1. **sandbox_cleanups** - 清理任务主表
2. **cleanup_summaries** - 清理摘要表
3. **audit_logs** - 审计日志表
