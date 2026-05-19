# DNS切换预演TTL API

DNS切换预演系统，用于TTL风险评估和切换流程管理。解决域名切换前口头检查容易遗漏旧解析的问题。

## 技术栈

- **FastAPI**: Web框架
- **SQLite**: 数据库
- **SQLAlchemy**: ORM

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 造数（创建示例数据）

```bash
# 确保服务已启动后执行
python sample_data.py
```

### 4. 查看curl命令示例

```bash
python sample_data.py examples
```

## 核心功能

### 数据模型

- **任务(DNSPreviewTask)**: 包含域名、记录类型、旧目标、新目标、TTL策略、风险等级、状态等
- **记录差异(DNSRecordDiff)**: 每个DNS记录的详细差异和TTL风险评估
- **操作日志(TaskOperationLog)**: 记录所有操作的原始输入、处理人、处理结论

### 状态流转

```
draft(草稿) → pending_audit(待审核) → auditing(审核中) → approved(已批准) 
→ executing(执行中) → completed(已完成) → closed(已关闭)

executing → rollback(回滚中) → rolled_back(已回滚) → closed

approved/auditing → rejected(已拒绝) → draft/closed

所有状态 → closed
```

### TTL风险等级

| 等级 | 条件 | 建议 |
|------|------|------|
| high | 超过半数记录TTL>1小时，或旧TTL未知 | 必须先降低TTL或确认旧记录 |
| medium | 部分记录TTL>30分钟 | 建议提前降低TTL |
| low | TTL配置合理 | 可正常执行切换 |

## API 接口

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks/ | 创建任务 |
| GET | /api/tasks/ | 查询任务列表（支持status和domain过滤） |
| GET | /api/tasks/{id} | 查询任务详情 |

### 状态推进

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks/{id}/status | 推进任务状态 |
| GET | /api/tasks/{id}/valid-statuses | 获取可转换的状态列表 |

### 任务操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks/{id}/correct | 人工修正任务 |
| POST | /api/tasks/{id}/close | 关闭/撤回任务 |
| POST | /api/tasks/{id}/rollback | 执行回滚 |

### 报告与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks/{id}/report | 获取预演报告 |
| GET | /api/tasks/{id}/export | 导出CSV报告 |
| GET | /api/tasks/{id}/logs | 获取操作日志 |

### 工具

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/ttl/evaluate | 批量评估TTL风险 |
| GET | /health | 健康检查 |

## Curl 主流程示例

### 1. 创建任务

```bash
curl -X POST http://localhost:8000/api/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "demo.com",
    "record_type": "A",
    "old_target": "1.1.1.1",
    "new_target": "2.2.2.2",
    "ttl_strategy": 300,
    "created_by": "zhangsan",
    "records": [
      {
        "record_name": "www.demo.com",
        "record_type": "A",
        "old_value": "1.1.1.1",
        "new_value": "2.2.2.2",
        "old_ttl": 3600,
        "new_ttl": 300
      },
      {
        "record_name": "api.demo.com",
        "record_type": "A",
        "old_value": "1.1.1.2",
        "new_value": "2.2.2.3",
        "old_ttl": 7200,
        "new_ttl": 300
      }
    ]
  }'
```

### 2. 查询任务列表

```bash
curl http://localhost:8000/api/tasks/
```

### 3. 推进状态（草稿→待审核）

```bash
curl -X POST http://localhost:8000/api/tasks/1/status \
  -H "Content-Type: application/json" \
  -d '{"target_status": "pending_audit", "operator": "zhangsan", "remark": "提交审核"}'
```

### 4. 人工修正（发现旧TTL不对）

```bash
curl -X POST http://localhost:8000/api/tasks/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "lisi",
    "ttl_strategy": 60,
    "records": [
      {
        "record_name": "www.demo.com",
        "record_type": "A",
        "old_value": "1.1.1.1",
        "new_value": "2.2.2.2",
        "old_ttl": 60,
        "new_ttl": 60
      }
    ],
    "remark": "修正TTL策略，紧急切换使用60秒TTL"
  }'
```

### 5. 查看预演报告

```bash
curl http://localhost:8000/api/tasks/1/report
```

### 6. 导出CSV报告

```bash
curl -o report.csv http://localhost:8000/api/tasks/1/export
```

### 7. 查看操作日志

```bash
curl http://localhost:8000/api/tasks/1/logs
```

### 8. 关闭任务

```bash
curl -X POST http://localhost:8000/api/tasks/1/close \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin", "reason": "切换已完成", "conclusion": "切换顺利，无异常"}'
```

## 冲突路径示例

### 场景1: 无效的状态转换

```bash
# 尝试从 draft 直接跳转到 executing（会失败）
curl -X POST http://localhost:8000/api/tasks/1/status \
  -H "Content-Type: application/json" \
  -d '{"target_status": "executing", "operator": "zhangsan"}'
```

**响应**:
```json
{
  "detail": "无效的状态转换: 从 draft 无法转换到 executing。有效状态: pending_audit, closed"
}
```

### 场景2: 对非执行中任务执行回滚

```bash
# draft 状态不能执行回滚
curl -X POST "http://localhost:8000/api/tasks/1/rollback?operator=zhangsan"
```

**响应**:
```json
{
  "detail": "只有执行中状态的任务才能回滚"
}
```

### 场景3: 查询不存在的任务

```bash
curl http://localhost:8000/api/tasks/9999
```

**响应**:
```json
{
  "detail": "任务不存在"
}
```

## 运行测试

```bash
# 安装 pytest 依赖
pip install pytest httpx

# 运行测试
pytest test_main.py -v
```

## 测试用例说明

测试文件 `test_main.py` 包含以下测试:

1. **基础测试**: 健康检查、创建任务、查询任务
2. **状态流转测试**: 状态推进、无效转换
3. **人工修正测试**: 修改任务信息、重新评估风险
4. **报告测试**: 预演报告、CSV导出
5. **冲突场景测试**: 边界条件验证

## 异常处理

系统会记录所有操作的完整审计日志，包括：

- 原始输入数据
- 操作人
- 操作结论
- 备注信息
- 操作时间

所有异常路径都会保留完整的原始数据，便于后续追溯和审计。
