# 多步骤导入确认 API

一个基于 Python Flask 的 RESTful API 服务，实现数据导入的分步确认流程。

## 核心特性

- **分步解析**: 上传文件后先进行解析和校验
- **差异预览**: 预览数据变更（新增/更新/删除）
- **确认写入**: 通过令牌机制进行二次确认后写入
- **撤销窗口**: 写入后可在窗口期内撤销操作
- **批次记录**: 大文件分批处理，记录每个批次状态
- **操作历史**: 完整的状态变更审计日志
- **数据持久化**: 使用 SQLite 数据库，服务重启数据不丢失

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 运行测试

```bash
python test_api.py
```

## API 接口

### 基础路径
`/api/v1`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/packages` | 创建上传包 |
| GET | `/packages` | 列出上传包 |
| GET | `/packages/{id}` | 获取包详细状态 |
| POST | `/packages/{id}/parse` | 解析上传包 |
| GET | `/packages/{id}/preview` | 预览数据差异 |
| POST | `/packages/{id}/confirm-token` | 创建确认令牌 |
| POST | `/packages/{id}/write` | 确认并写入数据 |
| POST | `/batches/{id}/revoke` | 撤销写入批次 |
| GET | `/history` | 查询操作历史 |
| GET | `/health` | 健康检查 |

## 核心数据对象

### UploadPackage (上传包)
- 表示一个上传的文件
- 状态流转: UPLOADED → PARSING → PARSED → WRITING → WRITTEN → REVOKED

### ParseResult (解析结果)
- 包含解析统计：总记录数、有效记录数、无效记录数
- 存储原始数据和校验错误

### PreviewDiff (预览差异)
- 每条数据变更的详细对比
- 类型: NEW（新增）、UPDATE（更新）、DELETE（删除）
- 包含置信度评分

### ConfirmationToken (确认令牌)
- 用于写入前的二次确认
- 支持过期时间配置（默认24小时）

### WriteBatch (写入批次)
- 大文件分批写入
- 记录成功/失败记录数
- 关联撤销窗口

### RevocationWindow (撤销窗口)
- 写入后可在窗口期内撤销
- 配置窗口时间（默认30分钟）
- 支持手动撤销和自动过期

### OperationHistory (操作历史)
- 记录所有状态变更
- 包含操作人、时间、详情
- 用于审计和追踪

## 状态流转

```
UPLOADED
    ↓
  PARSING ←─┐
    ↓       │
 PARSED  ───┘ (重新解析)
    ↓
WRITING
    ↓
 WRITTEN
    ↓
 REVOKED
```

## 使用示例

### 完整成功流程

```python
# 1. 创建上传包
POST /api/v1/packages
{
    "filename": "data.csv",
    "file_type": "csv",
    "file_size": 15240,
    "uploaded_by": "admin@example.com"
}

# 2. 解析
POST /api/v1/packages/{id}/parse
{ "parsed_by": "admin@example.com" }

# 3. 预览差异
GET /api/v1/packages/{id}/preview

# 4. 创建确认令牌
POST /api/v1/packages/{id}/confirm-token

# 5. 确认写入
POST /api/v1/packages/{id}/write
{
    "token": "confirmation-token-here",
    "confirmed_by": "admin@example.com"
}
```

### 撤销操作

```python
POST /api/v1/batches/{batch-id}/revoke
{
    "revoked_by": "admin@example.com",
    "reason": "发现数据质量问题"
}
```

## 配置项

在 `config.py` 中可配置：

- `CONFIRMATION_TOKEN_EXPIRE_HOURS`: 确认令牌过期时间（默认24小时）
- `REVOCATION_WINDOW_MINUTES`: 撤销窗口时间（默认30分钟）
- `MAX_BATCH_SIZE`: 最大批次大小（默认1000条）

## 防重复提交

- 相同文件名、大小、上传者的重复提交会返回已存在的包
- 幂等操作不会产生脏数据
- 状态机校验确保操作顺序正确

## 异常处理

所有接口统一返回格式：

```json
{
    "success": true/false,
    "data": {...},
    "error": "错误信息",
    "code": "错误代码"
}
```

## 数据库

使用 SQLite 数据库 `import_confirmation.db`，包含所有表结构和数据。服务重启后，所有状态、历史记录均可查询。
