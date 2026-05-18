# 灰度发布系统 - 批次暂停恢复API

## 项目概述

本项目实现了灰度发布系统中的批次暂停、恢复和回滚功能，核心特性包括：

- 保存应用、批次、暂停原因、恢复条件和机器进度
- 暂停期间机器继续发布时自动冻结批次并返回冲突原因
- 支持重复恢复请求检测
- 状态越级检测

## API接口

### 1. 创建批次
**接口**: `POST /api/v1/batch/create`

**输入**:
```json
{
  "app_name": "demo-app",
  "batch_no": 1,
  "machines": ["host1", "host2", "host3"]
}
```

**输出**:
```json
{
  "success": true,
  "message": "Batch created successfully",
  "data": {
    "id": "uuid",
    "app_name": "demo-app",
    "batch_no": 1,
    "status": "RUNNING",
    "created_at": "2024-01-01T00:00:00Z",
    "machines": [...]
  }
}
```

### 2. 暂停批次
**接口**: `POST /api/v1/batch/pause`

**输入**:
```json
{
  "app_name": "demo-app",
  "batch_no": 1,
  "pause_reason": "发现严重bug需要修复",
  "resume_condition": "Bug修复完成并验证通过"
}
```

**处理**:
- 验证批次是否存在
- 验证批次状态是否为RUNNING
- 更新状态为PAUSED，记录暂停时间和原因

**输出**:
```json
{
  "success": true,
  "message": "Batch paused successfully",
  "data": {
    "status": "PAUSED",
    "pause_reason": "发现严重bug需要修复",
    "resume_condition": "Bug修复完成并验证通过",
    "paused_at": "2024-01-01T00:00:00Z"
  }
}
```

### 3. 恢复批次
**接口**: `POST /api/v1/batch/resume`

**输入**:
```json
{
  "app_name": "demo-app",
  "batch_no": 1
}
```

**处理**:
- 验证批次是否存在
- 验证批次状态是否为PAUSED或FROZEN
- 如果是FROZEN状态，拒绝恢复并返回冲突原因
- 更新状态为RESUMED，记录恢复时间

**输出**:
```json
{
  "success": true,
  "message": "Batch resumed successfully",
  "data": {
    "status": "RESUMED",
    "resumed_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 回滚批次
**接口**: `POST /api/v1/batch/rollback`

**输入**:
```json
{
  "app_name": "demo-app",
  "batch_no": 1,
  "reason": "发布出现问题"
}
```

**处理**:
- 验证批次是否存在
- 验证批次状态是否允许回滚
- 更新状态为ROLLBACK

**输出**:
```json
{
  "success": true,
  "message": "Batch rollback initiated",
  "data": {
    "status": "ROLLBACK"
  }
}
```

### 5. 更新机器进度
**接口**: `POST /api/v1/batch/machine-progress`

**输入**:
```json
{
  "app_name": "demo-app",
  "batch_no": 1,
  "hostname": "host1",
  "progress": 50,
  "completed": false,
  "failed": false
}
```

**处理**:
- 如果批次处于PAUSED/FROZEN状态且未恢复，冻结批次并返回冲突
- 否则更新机器进度状态

**输出**（冲突场景）:
```json
{
  "success": false,
  "message": "Batch is paused/frozen, machine progress update not allowed. Batch has been frozen.",
  "data": {
    "status": "FROZEN",
    "conflict_reason": "MACHINE_PROGRESS",
    "frozen_at": "2024-01-01T00:00:00Z"
  }
}
```

### 6. 查询批次
**接口**: `GET /api/v1/batch/:app_name/:batch_no`

**输出**: 返回批次详细信息

### 7. 列出应用所有批次
**接口**: `GET /api/v1/batch/:app_name`

**输出**: 返回批次列表

## 状态流转

```
RUNNING -> PAUSED -> RESUMED -> COMPLETED
   |          |          |
   v          v          v
ROLLBACK    FROZEN    ROLLBACK
              |
              v
            RESUMED (需人工介入)
```

## 测试命令

### 前置条件
```bash
# 安装依赖
go mod tidy

# 启动服务
go run main.go
```

### 测试场景1: 正常恢复流程
```bash
# 1. 创建批次
curl -X POST http://localhost:8080/api/v1/batch/create \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":1,"machines":["host1","host2"]}'

# 2. 暂停批次
curl -X POST http://localhost:8080/api/v1/batch/pause \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":1,"pause_reason":"测试暂停","resume_condition":"测试完成"}'

# 3. 恢复批次
curl -X POST http://localhost:8080/api/v1/batch/resume \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":1}'

# 4. 查询批次状态
curl http://localhost:8080/api/v1/batch/test-app/1
```

### 测试场景2: 暂停中误发布（冲突冻结）
```bash
# 1. 创建批次
curl -X POST http://localhost:8080/api/v1/batch/create \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":2,"machines":["host1","host2"]}'

# 2. 暂停批次
curl -X POST http://localhost:8080/api/v1/batch/pause \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":2,"pause_reason":"测试暂停"}'

# 3. 尝试更新机器进度（暂停状态下）- 应该触发冻结
curl -X POST http://localhost:8080/api/v1/batch/machine-progress \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":2,"hostname":"host1","progress":50}'

# 4. 尝试恢复已冻结的批次 - 应该失败
curl -X POST http://localhost:8080/api/v1/batch/resume \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":2}'
```

### 测试场景3: 恢复后回滚
```bash
# 1. 创建批次
curl -X POST http://localhost:8080/api/v1/batch/create \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":3,"machines":["host1"]}'

# 2. 暂停
curl -X POST http://localhost:8080/api/v1/batch/pause \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":3,"pause_reason":"测试"}'

# 3. 恢复
curl -X POST http://localhost:8080/api/v1/batch/resume \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":3}'

# 4. 回滚
curl -X POST http://localhost:8080/api/v1/batch/rollback \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":3,"reason":"需要回滚"}'
```

### 测试场景4: 重复恢复请求
```bash
# 1. 创建并暂停
curl -X POST http://localhost:8080/api/v1/batch/create \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":4,"machines":["host1"]}'

curl -X POST http://localhost:8080/api/v1/batch/pause \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":4,"pause_reason":"测试"}'

# 2. 第一次恢复（成功）
curl -X POST http://localhost:8080/api/v1/batch/resume \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":4}'

# 3. 第二次恢复（状态已为RESUMED，应该失败）
curl -X POST http://localhost:8080/api/v1/batch/resume \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":4}'
```

### 测试场景5: 状态越级（直接从RUNNING恢复）
```bash
# 1. 创建批次（状态为RUNNING）
curl -X POST http://localhost:8080/api/v1/batch/create \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":5,"machines":["host1"]}'

# 2. 直接尝试恢复RUNNING状态的批次 - 应该失败
curl -X POST http://localhost:8080/api/v1/batch/resume \
  -H "Content-Type: application/json" \
  -d '{"app_name":"test-app","batch_no":5}'
```

## 项目结构

```
.
├── main.go                 # 主程序入口
├── go.mod                  # Go模块文件
├── models/
│   └── models.go           # 数据模型定义
├── storage/
│   └── storage.go          # 存储层实现（内存存储）
├── api/
│   └── handler.go          # API处理器
└── README.md               # 本文档
```
