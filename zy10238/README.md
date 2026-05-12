# 充电桩故障工单管理系统

一个完整的充电桩故障工单API系统，用于管理充电桩故障、远程操作、维修派单和退款流程。

## 核心特性

- ✅ **故障去重**：30分钟内同一桩相同故障码自动去重
- ✅ **状态机流转**：完整的工单状态流转管理
- ✅ **操作历史**：记录每次业务动作的完整历史
- ✅ **远程操作**：支持远程重启/复位，最多2次重试
- ✅ **维修派单**：远程失败后自动建议派单维修
- ✅ **退款管理**：订单退款申请和审批流程
- ✅ **重新打开**：维修完成2小时内复发标记为重新打开
- ✅ **事件重放**：模拟完整业务流程脚本
- ✅ **汇总查询**：数据分析和工单链路追踪

## 技术栈

- Node.js + TypeScript
- Express.js
- Sequelize ORM
- SQLite (可切换为MySQL/PostgreSQL)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 3. 运行事件重放脚本（新开终端）

```bash
npm run replay
```

### 4. 运行汇总查询

```bash
npm run summary
```

## API 接口文档

### 健康检查
```
GET /api/v1/health
```

### 工单管理

#### 创建故障工单
```
POST /api/v1/tickets
Content-Type: application/json

{
  "stationId": "STATION-A",
  "pileId": "PILE-001",
  "faultCode": "E001",
  "faultMessage": "通信模块异常",
  "faultLevel": "high",
  "orderId": "ORDER-001",
  "userId": "user-123"
}
```

**去重规则说明**：30分钟内同一充电桩相同故障码视为重复工单，不会创建新工单。

#### 查询工单详情
```
GET /api/v1/tickets/:id
```

#### 更新工单状态
```
PUT /api/v1/tickets/:id/status
{
  "newStatus": "remote_restart_pending",
  "description": "状态变更说明",
  "operatorId": "op-001",
  "operatorName": "张运营",
  "failureReason": "hardware_failure"
}
```

#### 关闭工单
```
PUT /api/v1/tickets/:id/close
{
  "description": "维修完成，设备正常",
  "operatorId": "op-001",
  "operatorName": "张运营"
}
```

#### 工单时间线查询
```
GET /api/v1/tickets/timeline?pileId=PILE-001&startTime=2024-01-01&endTime=2024-12-31
```

### 远程操作管理

#### 触发远程操作
```
POST /api/v1/remote-operations
{
  "ticketId": "uuid",
  "stationId": "STATION-A",
  "pileId": "PILE-001",
  "command": "restart",
  "operatorId": "op-001",
  "operatorName": "张运营"
}
```

**命令类型**：restart(重启) | stop_charging(停止充电) | unlock_gun(解锁枪头) | reset(复位)

**注意**：每个工单最多允许2次远程操作，超过后系统会拒绝并建议派单维修。

#### 更新远程操作结果
```
PUT /api/v1/remote-operations/:id
{
  "status": "success",
  "resultMessage": "重启成功，设备恢复在线"
}
```

**状态类型**：pending(待执行) | success(成功) | failed(失败) | timeout(超时)

#### 查询工单远程操作记录
```
GET /api/v1/tickets/:ticketId/remote-operations
```

### 订单管理

#### 创建/更新订单
```
POST /api/v1/orders
{
  "orderCode": "ORDER-001",
  "stationId": "STATION-A",
  "pileId": "PILE-001",
  "userId": "user-123",
  "startTime": "2024-05-20T10:00:00Z",
  "chargedKwh": 10.5,
  "totalAmount": 25.50,
  "status": "completed",
  "failureReason": "充电中断"
}
```

#### 查询订单
```
GET /api/v1/orders/:orderCode
```

### 退款管理

#### 申请退款
```
POST /api/v1/refunds/request
{
  "orderCode": "ORDER-001",
  "refundAmount": 25.50,
  "operatorId": "op-002",
  "operatorName": "李客服",
  "reason": "充电中断，全额退款"
}
```

#### 批准退款
```
POST /api/v1/refunds/:orderCode/approve
{
  "operatorId": "op-002",
  "operatorName": "李客服"
}
```

#### 拒绝退款
```
POST /api/v1/refunds/:orderCode/reject
{
  "reason": "用户主动结束充电，不符合退款条件",
  "operatorId": "op-002",
  "operatorName": "李客服"
}
```

### 维修管理

#### 创建维修派单
```
POST /api/v1/maintenances
{
  "ticketId": "uuid",
  "stationId": "STATION-A",
  "pileId": "PILE-001",
  "technicianId": "tech-001",
  "technicianName": "王师傅",
  "problemDescription": "通信模块故障，需要更换硬件"
}
```

#### 更新维修记录
```
PUT /api/v1/maintenances/:id
{
  "status": "completed",
  "solution": "更换了新的4G通信模块",
  "partsReplaced": "4G通信模块 x1",
  "startTime": "2024-05-20T14:00:00Z",
  "endTime": "2024-05-20T14:30:00Z",
  "notes": "测试充电正常"
}
```

#### 查询工单维修记录
```
GET /api/v1/tickets/:ticketId/maintenances
```

## 工单状态流转

```
新建(new)
    ↓
远程重启待处理(remote_restart_pending)
    ↓
┌─ 远程重启成功(remote_restart_success) ──→ 关闭(closed)
└─ 远程重启失败(remote_restart_failed)
    ↓
派单待处理(dispatch_pending)
    ↓
维修中(maintenance_in_progress)
    ↓
维修完成(maintenance_completed) ──→ 关闭(closed)

退款中(refunded) ──→ 关闭(closed)

* 维修完成2小时内复发 → 重新打开(reopened)
```

## 故障原因代码

| 代码 | 说明 |
|------|------|
| unknown | 未知原因 |
| communication_error | 通信异常 |
| power_supply_issue | 电源问题 |
| hardware_failure | 硬件故障 |
| software_bug | 软件问题 |
| overheat | 过热保护 |
| gun_lock_failure | 枪锁故障 |
| payment_failure | 支付问题 |

## 数据模型

### FaultTicket (故障工单表)
- id: UUID主键
- ticketCode: 工单编号
- stationId: 充电站ID
- pileId: 充电桩ID
- faultCode: 故障码
- faultMessage: 故障描述
- faultLevel: 故障级别
- failureReason: 故障原因枚举
- status: 工单状态枚举
- orderId: 关联订单号
- userId: 用户ID
- remoteRestartAttempts: 远程重启次数
- maxRemoteRestarts: 最大重试次数
- isDuplicate: 是否重复工单
- originalTicketId: 原始工单ID（重新打开时）
- reportedAt: 上报时间
- lastStatusChangeAt: 最后状态变更时间
- closedAt: 关闭时间

### OperationHistory (操作历史表)
- id: UUID主键
- ticketId: 关联工单ID
- operationType: 操作类型枚举
- operatorId: 操作人ID
- operatorName: 操作人姓名
- description: 操作描述
- details: 详细信息(JSON)
- oldStatus: 旧状态
- newStatus: 新状态
- operatedAt: 操作时间

### RemoteOperation (远程操作表)
- id: UUID主键
- ticketId: 关联工单ID
- stationId: 充电站ID
- pileId: 充电桩ID
- command: 操作命令枚举
- operatorId: 操作人ID
- operatorName: 操作人姓名
- status: 操作状态枚举
- resultMessage: 结果描述
- requestedAt: 请求时间
- executedAt: 执行时间
- completedAt: 完成时间

### MaintenanceRecord (维修记录表)
- id: UUID主键
- ticketId: 关联工单ID
- stationId: 充电站ID
- pileId: 充电桩ID
- technicianId: 维修人员ID
- technicianName: 维修人员姓名
- status: 维修状态枚举
- problemDescription: 问题描述
- solution: 解决方案
- partsReplaced: 更换配件
- startTime: 开始时间
- endTime: 结束时间
- notes: 备注
- createdAt: 创建时间
- updatedAt: 更新时间

### OrderInfo (订单信息表)
- id: UUID主键
- orderCode: 订单编号
- stationId: 充电站ID
- pileId: 充电桩ID
- userId: 用户ID
- startTime: 开始时间
- endTime: 结束时间
- chargedKwh: 充电度数
- totalAmount: 订单金额
- status: 订单状态枚举
- failureReason: 失败原因
- refundRequestedAt: 退款申请时间
- refundCompletedAt: 退款完成时间
- refundAmount: 退款金额
- createdAt: 创建时间
- updatedAt: 更新时间

## 业务规则

### 1. 故障去重规则
- 30分钟时间窗口
- 同一充电桩ID + 同一故障码
- 满足条件时，不创建新工单，只追加历史记录

### 2. 远程操作限制
- 每个工单最多允许2次远程操作
- 超过限制时返回错误，建议派单维修

### 3. 工单重新打开
- 维修完成后2小时时间窗口
- 同一桩再次上报相同故障码
- 新工单状态标记为 `reopened`（重新打开）
- 关联原始工单ID

### 4. 退款联动
- 订单退款完成时，关联工单自动标记为 `refunded` 状态
- 退款申请和审批均记录到工单操作历史

## 辅助脚本

### 事件重放脚本
```bash
npm run replay
```
模拟完整的业务流程：
1. 用户充电 → 故障上报 → 重复上报测试
2. 两次远程重启 → 均失败
3. 用户申请退款 → 客服批准
4. 派单维修 → 维修完成 → 关闭工单
5. 2小时后故障复发 → 重新打开

### 汇总查询脚本
```bash
npm run summary
```
提供以下数据分析：
- 整体统计（总工单、待处理、已关闭）
- 故障TOP排行
- 按充电站统计
- 工单处理效率分析
- 24小时故障趋势
- 重复故障桩预警
- 单个工单完整链路追踪

## 生产部署建议

1. **数据库切换**：将SQLite替换为MySQL或PostgreSQL
   ```typescript
   // src/config/database.ts
   new Sequelize('database', 'username', 'password', {
     host: 'localhost',
     dialect: 'mysql' | 'postgres'
   })
   ```

2. **添加认证**：API接口添加JWT认证

3. **日志系统**：集成Winston日志

4. **监控告警**：对接Prometheus + Grafana

5. **消息队列**：使用RabbitMQ/Kafka处理异步事件

6. **限流保护**：添加API限流中间件

## License

MIT
