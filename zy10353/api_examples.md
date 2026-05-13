# 压缩包安全解包 API - 使用示例

## 启动服务
```bash
go run cmd/api/main.go
```

## API 端点

### 1. 创建解包任务
**POST** `/api/v1/unpack/tasks`

请求体：
```json
{
  "archive_name": "test.zip",
  "archive_type": "zip",
  "archive_size": 102400,
  "file_hash": "a1b2c3d4e5f6"
}
```

响应（201 Created）：
```json
{
  "task_id": "uuid-task-id",
  "status": "created"
}
```

**重复提交处理：** 使用相同 file_hash 提交会返回已存在的任务，不会创建新任务。

### 2. 获取任务详情
**GET** `/api/v1/unpack/tasks/{task_id}`

响应（200 OK）：
```json
{
  "task": {
    "task_id": "uuid-task-id",
    "archive_name": "test.zip",
    "archive_type": "zip",
    "archive_size": 102400,
    "file_hash": "a1b2c3d4e5f6",
    "status": "created",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "isolation_dir": "/tmp/secure-unpack/uuid-task-id"
  },
  "result": null,
  "risks": []
}
```

### 3. 校验任务
**POST** `/api/v1/unpack/tasks/{task_id}/validate`

响应（200 OK）：
```json
{
  "task_id": "uuid-task-id",
  "validated": true,
  "risk_count": 0,
  "risks": []
}
```

### 4. 执行解包处理
**POST** `/api/v1/unpack/tasks/{task_id}/process`

请求体（模拟文件清单）：
```json
{
  "files": [
    {
      "path": "docs/readme.txt",
      "file_name": "readme.txt",
      "file_size": 1024,
      "is_dir": false,
      "file_mode": 420
    },
    {
      "path": "../etc/passwd",
      "file_name": "passwd",
      "file_size": 2048,
      "is_dir": false,
      "file_mode": 420
    }
  ]
}
```

响应（200 OK）：
```json
{
  "task_id": "uuid-task-id",
  "status": "failed",
  "total_files": 2,
  "total_size": 3072,
  "file_list": [...],
  "risk_count": 1,
  "risks": [
    {
      "risk_id": "abc123",
      "task_id": "uuid-task-id",
      "file_path": "../etc/passwd",
      "risk_type": "path_traversal",
      "risk_level": "critical",
      "message": "Path traversal detected in file path: ../etc/passwd",
      "detected_at": "2024-01-01T00:00:00Z"
    }
  ],
  "started_at": "2024-01-01T00:00:00Z",
  "completed_at": "2024-01-01T00:00:00Z",
  "output_dir": "/tmp/secure-unpack/uuid-task-id"
}
```

### 5. 列出任务
**GET** `/api/v1/unpack/tasks?status=completed&limit=20&offset=0`

查询参数：
- `status` - 按状态筛选 (created/validated/processing/completed/failed)
- `limit` - 每页数量 (默认20，最大100)
- `offset` - 偏移量

响应（200 OK）：
```json
{
  "tasks": [...],
  "count": 10
}
```

### 6. 导出结果
**GET** `/api/v1/unpack/tasks/{task_id}/result`

响应（200 OK）：
```json
{
  "task": {...},
  "result": {...},
  "risks": [...],
  "exported_at": "2024-01-01T00:00:00Z"
}
```

### 7. 获取风险列表
**GET** `/api/v1/unpack/tasks/{task_id}/risks`

响应（200 OK）：
```json
{
  "task_id": "uuid-task-id",
  "risks": [...],
  "count": 1
}
```

## 错误响应格式

所有错误统一返回格式：
```json
{
  "code": "TASK_NOT_FOUND",
  "message": "task not found",
  "detail": "Optional detail message"
}
```

常见错误码：
- `TASK_NOT_FOUND` - 任务不存在 (404)
- `INVALID_STATUS` - 无效的任务状态 (400)
- `PATH_TRAVERSAL` - 检测到路径遍历 (400)
- `FILE_TOO_LARGE` - 文件超过大小限制 (400)
- `BLOCKED_EXTENSION` - 被阻止的文件扩展名 (400)
- `DUPLICATE_TASK` - 重复任务 (409)

## 风险级别

- `low` - 低风险
- `medium` - 中风险
- `high` - 高风险
- `critical` - 严重风险

## 任务状态流转

```
created → validated → processing → completed
                                    ↘ failed
```

## 安全规则

1. **路径遍历检测**：禁止包含 `..` 的文件路径
2. **文件大小限制**：单文件最大 100MB
3. **总大小限制**：压缩包最大 1GB
4. **文件数量限制**：最多 10000 个文件
5. **阻止的扩展名**：.exe, .bat, .cmd, .ps1, .sh, .vbs, .js
6. **阻止的路径模式**：../, ..\, /etc/, /root/, C:\Windows\
