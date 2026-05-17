# 服务目录 Owner 轮转 API

本地可启动的服务负责人交接管理系统，重点关注状态流转、历史追踪和报告导出。

## 功能特性

- 📋 **轮转管理**: 创建、查询、状态推进
- 🔄 **状态机**: PENDING → CONFIRMING → IN_PROGRESS → COMPLETED
- 📝 **回执确认**: 候选负责人电子确认
- ⚠️ **异常处理**: 异常标记、原始输入保留、处理依据记录
- ✋ **人工修正**: 支持管理员手动修正，记录修正原因
- 📊 **报告导出**: CSV导出、审计追踪、服务汇总报告
- ⏰ **逾期提醒**: 自动检测即将逾期的确认请求

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 健康检查

```bash
curl http://localhost:3000/health
```

## API 接口

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |

### 轮转管理接口

#### 创建轮转

```bash
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "user-auth-service",
    "currentOwner": "zhang.san",
    "candidateOwner": "li.si",
    "reason": "轮岗换岗",
    "alertReferences": ["ALERT-2024-001", "ALERT-2024-002"],
    "operator": "admin"
  }'
```

#### 查询轮转列表

```bash
# 查询所有
curl http://localhost:3000/api/rotations

# 按状态筛选
curl "http://localhost:3000/api/rotations?status=in_progress"

# 按服务名称筛选
curl "http://localhost:3000/api/rotations?serviceName=user-auth"
```

#### 查询单个轮转详情

```bash
curl http://localhost:3000/api/rotations/{rotationId}
```

#### 查询轮转历史

```bash
curl http://localhost:3000/api/rotations/{rotationId}/history
```

### 状态推进接口

#### 启动确认流程

```bash
curl -X POST http://localhost:3000/api/rotations/{rotationId}/start-confirm \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'
```

#### 候选负责人确认回执

```bash
curl -X POST http://localhost:3000/api/rotations/{rotationId}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "confirmedBy": "li.si",
    "receiptNote": "已接收告警配置，完成培训"
  }'
```

#### 完成轮转

```bash
curl -X POST http://localhost:3000/api/rotations/{rotationId}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "completedBy": "zhang.san",
    "handoverDetails": "完成所有文档交接，权限已转移",
    "documentLinks": ["http://wiki.example.com/doc1"],
    "remarks": "交接顺利"
  }'
```

#### 拒绝轮转

```bash
curl -X POST http://localhost:3000/api/rotations/{rotationId}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "rejectedBy": "li.si",
    "reason": "工作安排冲突，无法承接"
  }'
```

### 异常处理接口

#### 标记异常

```bash
curl -X POST http://localhost:3000/api/rotations/{rotationId}/exception \
  -H "Content-Type: application/json" \
  -d '{
    "exceptionType": "document_missing",
    "description": "关键交接文档缺失",
    "rawInput": {"documents": ["runbook", "oncall-guide"]},
    "handlingBasis": "交接流程第3.2条",
    "operator": "admin"
  }'
```

#### 解决异常

```bash
curl -X POST http://localhost:3000/api/rotations/exceptions/{exceptionId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolvedBy": "admin",
    "resolution": "补充了缺失的文档",
    "handlingBasis": "紧急处理流程"
  }'
```

#### 查询异常列表

```bash
curl "http://localhost:3000/api/rotations/exceptions/list?resolved=false"
```

### 人工修正接口

```bash
curl -X PATCH http://localhost:3000/api/rotations/{rotationId}/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "candidateOwner": "wang.wu",
      "reason": "原候选人调岗，更换负责人"
    },
    "operator": "admin",
    "reason": "人员调整审批通过"
  }'
```

### 导出接口

#### 导出轮转列表为CSV

```bash
curl -o rotations.csv http://localhost:3000/api/rotations/export/csv
```

#### 导出单轮转报告

```bash
curl http://localhost:3000/api/rotations/export/{rotationId}/report
```

#### 导出所有服务汇总报告

```bash
curl http://localhost:3000/api/rotations/export/services/report
```

#### 导出审计追踪CSV

```bash
curl -o audit.csv http://localhost:3000/api/rotations/export/{rotationId}/audit
```

### 提醒与维护接口

#### 查询即将逾期的提醒

```bash
curl http://localhost:3000/api/rotations/reminders/overdue
```

#### 检查并标记已逾期

```bash
curl -X POST http://localhost:3000/api/rotations/maintenance/check-expired
```

## 被拦截的异常路径示例

### 1. 创建轮转时缺少告警引用（被拦截）

```bash
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "test-service",
    "currentOwner": "user.a",
    "candidateOwner": "user.b",
    "reason": "测试",
    "alertReferences": []
  }'
```

**响应（400）**:
```json
{ "error": "必须至少需要关联至少一条告警记录" }
```

### 2. 状态非法转换（被拦截）

```bash
# 试图直接从 pending 完成
curl -X POST http://localhost:3000/api/rotations/{rotationId}/complete \
  -H "Content-Type: application/json" \
  -d '{"completedBy": "user.a"}'
```

**响应（400）**:
```json
{ "error": "当前状态 pending 无法完成轮转" }
```

### 3. 非候选人确认回执（被拦截）

```bash
curl -X POST http://localhost:3000/api/rotations/{rotationId}/confirm \
  -H "Content-Type: application/json" \
  -d '{"confirmedBy": "wrong.user"}'
```

**响应（400）**:
```json
{ "error": "只有候选负责人才能确认回执" }
```

## 状态流转图

```
PENDING
   │
   ├─→ start-confirm() → CONFIRMING
   │                       │
   │                       ├─→ confirm() → IN_PROGRESS
   │                       │                       │
   │                       │                       ├─→ complete() → COMPLETED
   │                       │                       │
   │                       │                       └─→ markException() → EXCEPTION
   │                       │                                                 │
   │                       │                                                 └─→ resolveException() → IN_PROGRESS
   │                       │
   │                       ├─→ markExpired() → EXPIRED
   │                       │                       │
   │                       │                       └─→ restartConfirm() → CONFIRMING
   │                       │
   │                       └─→ reject() → REJECTED
   │                                               │
   │                                               └─→ restart() → PENDING
   │
   └─→ reject() → REJECTED
```

## 数据模型

### 轮转 (Rotation)

| 字段 | 说明 |
|------|------|
| id | 轮转ID |
| serviceName | 服务名称 |
| currentOwner | 当前负责人 |
| candidateOwner | 候选负责人 |
| reason | 交接原因 |
| alertReferences | 告警引用列表 |
| status | 当前状态 |
| confirmationReceipt | 确认回执 |
| createdAt | 创建时间 |
| expireAt | 逾期时间 |
| completedAt | 完成时间 |

### 异常 (Exception)

| 字段 | 说明 |
|------|------|
| id | 异常ID |
| rotationId | 关联轮转ID |
| type | 异常类型 |
| description | 异常描述 |
| rawInput | 原始输入（保留） |
| handlingBasis | 处理依据 |
| resolved | 是否已解决 |
| resolution | 解决方案 |

## 项目结构

```
.
├── src/
│   ├── server.js              # 服务入口
│   ├── routes/
│   │   └── rotations.js       # 路由定义
│   ├── services/
│   │   ├── RotationService.js # 业务逻辑
│   │   └── ExportService.js   # 导出服务
│   ├── models/
│   │   └── RotationStatus.js  # 状态定义
│   └── store/
│       └── memoryStore.js     # 内存存储
├── scripts/
│   └── init-sample-data.js    # 示例数据初始化
├── package.json
└── README.md
```

## 注意事项

- 数据存储在内存中，重启服务后数据会丢失
- 确认回执有效期为 3 天
- 所有操作均有审计追踪，可导出为CSV
- 异常路径保留原始输入和处理依据
