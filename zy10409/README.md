# 误报压制复核 API 服务

安全扫描误报压制复核系统的服务端实现，提供完整的 REST 接口、本地持久化和可追溯的审计机制。

## 核心特性

1. **状态机驱动的复核流程** - 严格的状态转换边界检查
2. **幂等性保证** - 重复提交相同内容返回已有记录
3. **样本归档** - 完整保存命中样本和扫描器输出
4. **有效期管理** - 支持压制有效期设置，自动识别过期
5. **异常追踪** - 保留原始输入和处理结论，支持错误溯源
6. **数据导出** - 支持 JSON/CSV 格式导出，中文可读字段名

## 技术栈

- **Web框架**: Flask 3.0
- **ORM**: Flask-SQLAlchemy
- **数据库**: SQLite (本地)
- **序列化**: 原生 JSON

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据（可选，导入样例数据）

```bash
python sample_data.py
```

### 3. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 4. 运行 API 示例

```bash
python api_examples.py
```

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/suppressions` | 创建误报压制记录 |
| GET | `/api/v1/suppressions` | 查询压制记录列表（支持筛选、分页） |
| GET | `/api/v1/suppressions/{id}` | 获取单条记录详情 |
| POST | `/api/v1/suppressions/{id}/transition` | 状态流转推进 |
| PUT | `/api/v1/suppressions/{id}/correct` | 人工修正记录 |
| GET | `/api/v1/suppressions/export` | 导出压制记录（JSON/CSV） |
| GET | `/api/v1/errors` | 查询异常处理日志 |
| POST | `/api/v1/errors/{id}/handle` | 标记异常已处理 |
| GET | `/api/v1/health` | 健康检查 |

## 数据模型

### SuppressionRecord (压制主记录)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String(32) | 主键，唯一标识 |
| rule_id | String(64) | 扫描规则ID |
| rule_name | String(255) | 扫描规则名称 |
| scanner_type | String(64) | 扫描器类型 |
| sample_hash | String(128) | 命中样本哈希 |
| sample_content | Text | 命中样本内容 |
| file_path | String(512) | 文件路径 |
| line_number | Integer | 行号 |
| reason | Text | 压制理由 |
| suppressor | String(128) | 提交人 |
| reviewer | String(128) | 复核人 |
| state | String(32) | 当前状态 |
| conclusion | String(64) | 复核结论 |
| comment | Text | 复核备注 |
| expires_at | DateTime | 到期时间 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |
| idempotency_key | String(64) | 幂等性键 |
| original_request | Text | 原始请求JSON |
| error_message | Text | 错误信息 |

### StateHistory (状态变更历史)

完整记录每次状态变更的来源、目标、原因和操作人。

### HitSample (命中样本归档)

保存扫描器输出、样本哈希、文件位置等详细信息。

### ProcessingError (异常处理日志)

保留异常发生时的原始输入、错误类型、错误信息，便于事后分析。

## 状态机设计

```
          ┌─────────────────────────────────┐
          │                                 ▼
    ┌─────────┐      ┌──────────────┐   ┌──────────┐
    │ pending │ ───▶ │ under_review │ ─▶│ approved │
    └─────────┘      └──────────────┘   └──────────┘
         │                  │              │
         │                  ▼              ▼
         │             ┌──────────┐   ┌─────────┐
         └────────────▶│ rejected │   │ expired │
                       └──────────┘   └─────────┘
                            │             │
                            ▼             ▼
                       ┌───────────────────────┐
                       │  回到 pending 重新申请 │
                       └───────────────────────┘
```

### 状态转换规则

| 当前状态 | 允许转换到 |
|---------|-----------|
| pending | under_review, rejected, revoked |
| under_review | approved, rejected, pending |
| approved | expired, revoked |
| rejected | pending |
| expired | pending |
| revoked | pending |

## 复核结论

- `true_positive` - 确认为漏洞
- `false_positive` - 确认为误报
- `needs_more_context` - 需要更多信息
- `acceptable_risk` - 可接受风险

## 使用示例

### 创建压制记录

```bash
curl -X POST http://localhost:5000/api/v1/suppressions \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "R001",
    "rule_name": "SQL注入检测",
    "scanner_type": "semgrep",
    "sample_content": "db.execute(f\"SELECT * FROM users WHERE id = {user_input}\")",
    "file_path": "src/auth/login.py",
    "line_number": 42,
    "reason": "该输入已在上游经过严格校验，为误报",
    "suppressor": "developer_a",
    "expires_days": 90
  }'
```

### 状态流转

```bash
curl -X POST http://localhost:5000/api/v1/suppressions/{id}/transition \
  -H "Content-Type: application/json" \
  -d '{
    "to_state": "approved",
    "operator": "security_lead",
    "conclusion": "false_positive",
    "comment": "确认是误报，理由充分",
    "reason": "复核完成"
  }'
```

### 导出数据

```bash
# JSON 格式
curl http://localhost:5000/api/v1/suppressions/export?format=json

# CSV 格式，只导出已批准
curl http://localhost:5000/api/v1/suppressions/export?format=csv&state=approved
```

## 异常处理机制

1. 所有 API 异常都会被捕获并记录到 `ProcessingError` 表
2. 保留原始请求输入快照
3. 记录错误类型和详细错误信息
4. 支持事后标记处理结论
5. 可通过 error_id 从主记录追溯到异常详情

## 项目文件结构

```
.
├── app.py              # 主应用入口，包含所有API和模型
├── config.py           # 配置文件（状态定义、转换规则等）
├── requirements.txt    # Python 依赖
├── sample_data.py      # 样例数据导入脚本
├── api_examples.py     # API调用示例脚本
├── suppression.db      # SQLite数据库文件（运行后生成）
└── README.md           # 本文档
```
