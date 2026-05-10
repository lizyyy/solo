# 电梯维保零件换件 API 使用指南

## 核心主线

本 API 围绕 **故障单 → 备件领用 → 备件签收 → 换件确认 → 完成闭环** 这条主线设计，解决故障单、备件批次和维保人员签收记录脱节的问题。

## 快速开始

### 1. 启动服务

```bash
npm install
npm start
```

服务将在 `http://localhost:3001` 启动。

### 2. 查看初始数据

系统预置了3个备件批次：
- SP-2024-001: 电梯门传感器（10个）
- SP-2024-002: 电机控制器（5个）
- SP-2024-003: 制动刹车片（20个）

查看所有备件：
```bash
curl http://localhost:3001/api/spare-parts
```

## 完整流程示例

### 步骤 1：创建故障单

场景：A栋1号电梯门传感器故障，需要更换。

```bash
curl -X POST http://localhost:3001/api/fault-orders \
  -H "Content-Type: application/json" \
  -d '{
    "elevatorId": "ELEV-A-001",
    "elevatorName": "A栋1号电梯",
    "faultType": "DOOR_FAULT",
    "faultDescription": "电梯门开关不灵敏，传感器响应延迟",
    "location": "A栋1层",
    "reporter": "张三",
    "operator": "调度员李"
  }'
```

**响应**：返回故障单详情，状态为 `CREATED`（已创建）。
**记下返回的 `id` 字段**，后续步骤需要使用。

### 步骤 2：申请备件领用

场景：根据故障单申请所需备件。

将下面的 `{faultOrderId}` 替换为步骤1返回的实际ID。

```bash
curl -X POST http://localhost:3001/api/fault-orders/{faultOrderId}/request-parts \
  -H "Content-Type: application/json" \
  -d '{
    "partsRequest": [
      {
        "batchNo": "SP-2024-001",
        "quantity": 2
      }
    ],
    "operator": "仓库管理员A"
  }'
```

**发生了什么**：
- 故障单状态变为 `AWAITING_PARTS`（等待备件领用）
- 生成1条领用记录（RQ开头）
- 备件批次 SP-2024-001 的可用数量从10减为8，已分配数量增加2

### 步骤 3：维保人员签收备件

场景：维保人员到仓库领取备件并签收。

首先查看领用记录（从步骤2的响应中获取 `requisitions[0].id`）：

```bash
curl -X POST http://localhost:3001/api/fault-orders/{faultOrderId}/sign-parts \
  -H "Content-Type: application/json" \
  -d '{
    "signatures": [
      {
        "requisitionId": "{requisitionId}",
        "quantity": 2,
        "receiver": "王维保",
        "signature": "王维保_电子签名_12345"
      }
    ],
    "operator": "仓库管理员A"
  }'
```

**发生了什么**：
- 故障单状态变为 `PARTS_RECEIVED`（备件已签收）
- 生成签收记录（RC开头），记录了签收人、签名、时间
- 领用记录状态变为 `SIGNED`

### 步骤 4：确认换件完成

场景：维保人员完成零件更换，记录新旧零件信息。

```bash
curl -X POST http://localhost:3001/api/fault-orders/{faultOrderId}/confirm-replacement \
  -H "Content-Type: application/json" \
  -d '{
    "replacements": [
      {
        "batchNo": "SP-2024-001",
        "oldPartSerialNo": "OLD-SENSOR-001",
        "newPartSerialNo": "NEW-SENSOR-001",
        "quantity": 2,
        "replacementDate": "2024-05-10",
        "technician": "王维保",
        "remark": "更换后电梯门运行正常"
      }
    ],
    "operator": "王维保"
  }'
```

**发生了什么**：
- 故障单状态变为 `REPLACED`（更换完成待复核）
- 生成换件记录（RP开头）
- 备件批次的已使用数量增加
- **关键闭环**：从故障单可以追溯到领用记录 → 签收记录 → 换件记录，完整链条打通

### 步骤 5：完成故障单（复核通过）

场景：管理人员复核确认换件完成，关闭故障单。

```bash
curl -X POST http://localhost:3001/api/fault-orders/{faultOrderId}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "主管赵",
    "remark": "换件记录完整，复核通过"
  }'
```

### 步骤 6：查看汇总报表

查看所有数据和闭环情况：

```bash
curl http://localhost:3001/api/summary
```

**报表重点关注**：
- `statistics.closedLoopOrders`: 已形成闭环的故障单数量
- `closedLoopDetails`: 每个故障单的闭环详情
  - `isClosedLoop`: 是否形成完整闭环（领用→签收→更换）
  - `partsRequested`: 申请的备件数
  - `partsSigned`: 已签收的备件数
  - `partsReplaced`: 已更换的备件数

## 关键功能详解

### 防重机制

所有写操作（POST）都有防重保护。如果发送完全相同的请求两次，第二次会返回缓存结果，不会写乱状态：

```bash
# 第一次请求 - 正常创建
curl -X POST http://localhost:3001/api/fault-orders ...

# 第二次相同请求 - 返回缓存，标记 isDuplicate: true
curl -X POST http://localhost:3001/api/fault-orders ...
```

响应中会包含 `isDuplicate: true`。

### 状态机保护

状态转换有严格规则：
- CREATED → AWAITING_PARTS（申请备件）
- AWAITING_PARTS → PARTS_RECEIVED（签收备件）
- AWAITING_PARTS → REVERTED（撤回）
- PARTS_RECEIVED → REPLACED（确认换件）
- PARTS_RECEIVED → REVERTED（撤回）
- REPLACED → COMPLETED（完成）
- REPLACED → REVERTED（撤回）
- REVERTED → CREATED（重新启动）

**测试状态冲突**：
```bash
# 创建故障单后，直接尝试确认换件（会失败）
curl -X POST http://localhost:3001/api/fault-orders/{id}/confirm-replacement ...
# 返回错误：当前状态不允许确认更换
```

### 撤回和修正

如果操作有误，可以撤回：

```bash
# 撤回故障单（从 AWAITING_PARTS、PARTS_RECEIVED、REPLACED 状态都可以撤回）
curl -X POST http://localhost:3001/api/fault-orders/{faultOrderId}/revert \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "主管赵",
    "remark": "领用数量有误，需要重新申请"
  }'
```

撤回后可以重新启动：
```bash
curl -X POST http://localhost:3001/api/fault-orders/{faultOrderId}/restart \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "主管赵",
    "remark": "修正信息后重新处理"
  }'
```

**撤回时的库存回滚**：如果在 AWAITING_PARTS 状态撤回，已分配的库存会自动退回。

## 查询接口

### 查看故障单详情（含完整闭环链）

```bash
curl http://localhost:3001/api/fault-orders/{faultOrderId}
```

返回内容包含：
- `faultOrder`: 故障单基本信息和状态历史
- `requisitions`: 领用记录
- `receipts`: 签收记录
- `replacements`: 换件记录
- `statusLabel`: 状态中文说明

**验收关键点**：从这个接口可以清晰看到 **故障单ID → 领用记录ID → 签收记录 → 换件记录** 的完整链条。

### 筛选查询

```bash
# 按状态筛选
curl http://localhost:3001/api/fault-orders?status=COMPLETED

# 按电梯筛选
curl http://localhost:3001/api/fault-orders?elevatorId=ELEV-A-001

# 查看可用备件
curl http://localhost:3001/api/spare-parts?availableOnly=true
```

## 边界情况测试

### 测试 1：重复提交

```bash
# 运行两次相同的创建请求
curl -X POST http://localhost:3001/api/fault-orders \
  -H "Content-Type: application/json" \
  -d '{"elevatorId":"TEST-001","faultDescription":"测试重复提交","operator":"测试员"}'

curl -X POST http://localhost:3001/api/fault-orders \
  -H "Content-Type: application/json" \
  -d '{"elevatorId":"TEST-001","faultDescription":"测试重复提交","operator":"测试员"}'
```

**预期**：第二次返回 `isDuplicate: true`，只创建1条故障单。

### 测试 2：状态冲突

```bash
# 创建故障单（状态：CREATED）
curl -X POST http://localhost:3001/api/fault-orders \
  -H "Content-Type: application/json" \
  -d '{"elevatorId":"TEST-002","faultDescription":"测试状态冲突","operator":"测试员"}'

# 直接尝试完成（跳过中间步骤，应该失败）
curl -X POST http://localhost:3001/api/fault-orders/{id}/complete \
  -H "Content-Type: application/json" \
  -d '{"operator":"测试员"}'
```

**预期**：返回错误 "状态转换不允许"。

### 测试 3：来源记录缺失

```bash
# 用不存在的备件批次申请领用
curl -X POST http://localhost:3001/api/fault-orders/{id}/request-parts \
  -H "Content-Type: application/json" \
  -d '{
    "partsRequest": [{"batchNo":"NONEXISTENT-001","quantity":1}],
    "operator":"测试员"
  }'
```

**预期**：返回错误 "备件批次不存在"。

## 看板/报表数据

`GET /api/summary` 返回的数据可以直接用于构建看板：

```json
{
  "statistics": {
    "totalOrders": 5,
    "byStatus": {
      "CREATED": 1,
      "AWAITING_PARTS": 1,
      "PARTS_RECEIVED": 1,
      "REPLACED": 1,
      "COMPLETED": 1
    },
    "closedLoopOrders": 2,
    "totalParts": 35,
    "usedParts": 5,
    "availableParts": 30
  },
  "closedLoopDetails": [
    {
      "orderNo": "FO-20240510-001",
      "elevatorId": "ELEV-A-001",
      "isClosedLoop": true
    }
  ],
  "recentActivities": [...]
}
```

## 验收清单

验收时请确认以下几点：

1. **闭环链条清晰**：通过 `GET /api/fault-orders/{id}` 能看到：
   - 故障单基本信息
   - 对应的领用记录（requisitions）
   - 对应的签收记录（receipts）
   - 对应的换件记录（replacements）
   - 所有记录通过ID关联

2. **状态流转正确**：
   - 必须按顺序推进
   - 错误的状态转换被拦截

3. **防重有效**：
   - 相同请求不会创建重复数据
   - 返回结果一致

4. **撤回功能**：
   - 可以撤回
   - 库存正确回滚
   - 可以重新启动

5. **汇总报表**：
   - `closedLoopOrders` 统计正确
   - `closedLoopDetails` 显示每个故障单的闭环状态
