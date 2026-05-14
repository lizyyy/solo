# PWA离线同步调试系统

一个轻量级的PWA离线同步调试工具，包含Python Flask后端和纯HTML/JS前端。

## 快速开始

### 1. 本地启动

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 2. 初始化数据

访问 `http://localhost:5000`，点击工具栏的「初始化数据」按钮，或直接调用API：

```bash
curl -X POST http://localhost:5000/api/init
```

## 核心功能

### 前端功能

- **搜索框**：按类型或数据内容搜索离线队列
- **批量导入**：支持JSON格式批量导入离线队列项目
- **用户提示**：显示未读的警告和信息提示
- **冲突解决**：手动选择解决方式（服务器/客户端/合并）
- **重试记录**：记录失败原因和重试策略
- **日志导出**：按负责人、日期、冲突分组导出CSV

### 后端接口

#### 离线队列

```bash
# 获取队列（支持搜索）
GET /api/offline-queue?search=xxx

# 批量添加
POST /api/offline-queue
Body: [{ "type": "...", "data": "...", "owner": "..." }]

# 校验队列
POST /api/validate-queue
Body: { "ids": [1, 2, 3] }  # 空数组表示校验全部
```

#### 同步冲突

```bash
# 获取冲突列表
GET /api/sync-conflicts

# 解决冲突
POST /api/sync-conflicts/{id}/resolve
Body: { "resolution": "server|client|merge", "owner": "..." }
```

#### 重试策略

```bash
# 获取重试策略
GET /api/retry-strategies

# 记录重试
POST /api/retry
Body: { "queue_id": 1, "reason": "网络超时" }
```

#### 用户提示

```bash
# 获取提示
GET /api/user-hints

# 添加提示
POST /api/user-hints
Body: { "message": "...", "type": "warning|info" }
```

#### 同步日志

```bash
# 获取日志
GET /api/sync-logs

# 导出CSV（按负责人、日期、冲突分组）
GET /api/sync-logs/export
```

#### 缓存资源

```bash
# 获取缓存资源列表
GET /api/cache-resources
```

## 数据结构说明

### 离线队列 (offline_queue)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 唯一标识 |
| type | string | 操作类型（user_update/order_create等） |
| data | string | JSON格式数据 |
| status | string | pending/failed |
| owner | string | 负责人 |
| retry_count | int | 重试次数 |
| last_failure_reason | string | 上次失败原因 |
| created_at | string | ISO时间戳 |
| validated | bool | 是否已校验 |
| validated_at | string | 校验时间 |

### 同步冲突 (sync_conflicts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 唯一标识 |
| type | string | 冲突类型 |
| queue_id | int | 关联队列ID |
| server_version | int | 服务器版本 |
| client_version | int | 客户端版本 |
| status | string | pending/resolved |
| resolution | string | server/client/merge |
| owner | string | 负责人 |
| created_at | string | 创建时间 |
| resolved_at | string | 解决时间 |

### 重试策略 (retry_strategies)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 唯一标识 |
| queue_id | int | 关联队列ID |
| retry_count | int | 重试次数 |
| failure_reason | string | 失败原因 |
| timestamp | string | 记录时间 |
| next_retry_at | string | 下次重试时间 |

### 用户提示 (user_hints)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 唯一标识 |
| message | string | 提示内容 |
| type | string | warning/info |
| read | bool | 是否已读 |
| created_at | string | 创建时间 |

### 同步日志 (sync_logs)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 唯一标识 |
| type | string | 操作类型 |
| conflict_id | int | 关联冲突ID |
| resolution | string | 解决方式 |
| owner | string | 负责人 |
| timestamp | string | 操作时间 |

### 缓存资源 (cache_resources)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 唯一标识 |
| url | string | 资源URL |
| size | int | 大小（字节） |
| status | string | valid/stale |
| cached_at | string | 缓存时间 |

## 会被规则挡住的操作示例

系统提供了一个测试规则阻挡的接口：

```bash
curl -X POST http://localhost:5000/api/blocked-operation \
  -H "Content-Type: application/json" \
  -d '{"rule": "敏感操作频率限制"}'
```

返回示例：
```json
{
  "success": false,
  "blocked": true,
  "reason": "操作被规则阻挡: 敏感操作频率限制",
  "rule": "敏感操作频率限制"
}
```

在前端页面点击「测试规则阻挡」按钮即可体验。

## 日志导出示例

导出的CSV文件按以下方式分组：
1. **负责人**：按前端负责人分组
2. **日期**：按操作日期分组
3. **同步冲突**：按冲突ID分组

CSV列说明：
- 负责人：操作执行人员
- 日期：操作发生日期
- 同步冲突ID：关联的冲突记录
- 冲突类型：data_version_conflict/merge_conflict等
- 操作类型：conflict_resolved/sync_success/sync_failed等
- 解决方式：server/client/merge（仅冲突解决时有值）
- 时间：完整时间戳

## 项目结构

```
.
├── app.py              # Flask后端服务
├── index.html          # 前端页面
├── requirements.txt    # Python依赖
├── data.json           # 数据存储（运行时自动生成）
└── README.md           # 本文档
```

## 注意事项

- 数据使用JSON文件存储，适合开发和调试使用
- 生产环境请替换为真实数据库
- 重试策略默认5分钟后自动重试
- 日志导出使用UTF-8 BOM编码，兼容Excel
