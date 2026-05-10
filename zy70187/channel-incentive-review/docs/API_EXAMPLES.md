# 渠道激励达标复核服务 - API 使用示例

## 1. 基础信息

**服务地址：** `http://localhost:3000`

**请求头要求：**
```json
{
  "x-operator-id": "OP001",
  "x-operator-name": "张三",
  "x-operator-role": "SALES_MANAGER"
}
```

## 2. 完整流程示例

### 场景：渠道季度目标达成激励计算

#### 步骤 1：创建目标快照

```bash
curl -X POST http://localhost:3000/api/target-snapshots \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三" \
  -d '{
    "channelId": "CH001",
    "channelName": "华东总代理",
    "regionId": "REG001",
    "regionName": "华东区",
    "year": 2024,
    "quarter": "Q1",
    "targetType": "REVENUE",
    "targetAmount": 1000000,
    "targetUnit": "CURRENCY",
    "tierConfig": [
      {
        "tier": "TIER_1",
        "minThreshold": 800000,
        "maxThreshold": 999999,
        "incentiveRate": 0.02,
        "incentiveAmount": 16000,
        "description": "基础达标：80%-99%"
      },
      {
        "tier": "TIER_2",
        "minThreshold": 1000000,
        "maxThreshold": 1199999,
        "incentiveRate": 0.03,
        "incentiveAmount": 30000,
        "description": "良好达成：100%-119%"
      },
      {
        "tier": "TIER_3",
        "minThreshold": 1200000,
        "maxThreshold": 1499999,
        "incentiveRate": 0.04,
        "incentiveAmount": 48000,
        "description": "优秀达成：120%-149%"
      },
      {
        "tier": "TIER_4",
        "minThreshold": 1500000,
        "maxThreshold": null,
        "incentiveRate": 0.05,
        "incentiveAmount": 75000,
        "description": "卓越达成：≥150%"
      }
    ],
    "snapshotSource": "年度目标系统",
    "snapshotNotes": "2024年Q1销售目标"
  }'
```

**成功响应（201 Created）：**
```json
{
  "success": true,
  "snapshot": {
    "id": "snap-001",
    "isFinalized": false
  }
}
```

#### 步骤 2：锁定目标快照

```bash
curl -X POST http://localhost:3000/api/target-snapshots/snap-001/finalize \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三"
```

#### 步骤 3：创建达标记录

```bash
curl -X POST http://localhost:3000/api/achievements \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三" \
  -d '{
    "channelId": "CH001",
    "channelName": "华东总代理",
    "year": 2024,
    "quarter": "Q1",
    "targetSnapshotId": "snap-001",
    "achievementAmount": 1250000,
    "achievementSources": [
      {
        "sourceSystem": "ERP",
        "sourceType": "SALES_RECORD",
        "sourceAmount": 1250000,
        "sourceDate": "2024-03-31",
        "sourceReference": "INV-2024-Q1-001",
        "verificationStatus": "VERIFIED"
      }
    ],
    "notes": "2024年Q1实际销售达成"
  }'
```

**自动审核通过响应（201 Created）：**
```json
{
  "success": true,
  "record": {
    "id": "ach-001",
    "currentStatus": "VERIFIED",
    "achievedTier": "TIER_3",
    "achievementRate": 1.25,
    "isAchieved": true
  }
}
```

**需要人工复核响应（202 Accepted）：**
```json
{
  "success": true,
  "record": {
    "id": "ach-001",
    "currentStatus": "MANUAL_REVIEW"
  },
  "needsManualReview": true,
  "manualReviewReason": "存在未验证的数据源，需要人工确认"
}
```

#### 步骤 4：计算激励明细

```bash
curl -X POST http://localhost:3000/api/incentives/calculate \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP002" \
  -H "x-operator-name: 李四" \
  -d '{
    "achievementRecordId": "ach-001",
    "notes": "激励计算"
  }'
```

**成功响应：**
```json
{
  "success": true,
  "incentiveDetail": {
    "id": "inc-001",
    "finalIncentiveAmount": 48000,
    "tier": "TIER_3",
    "calculationDetails": {
      "baseCalculation": {
        "achievementAmount": 1250000,
        "baseRate": 0.05,
        "baseAmount": 62500
      },
      "tierCalculation": {
        "achievedTier": "TIER_3",
        "tierAmount": 48000
      },
      "finalCalculation": {
        "grossAmount": 48000,
        "netAmount": 48000,
        "formula": "最终金额 = 阶梯金额(48000) + 保护期调整(0) - 跨区扣除(0) - 其他扣除(0)"
      }
    }
  }
}
```

#### 步骤 5：审批激励

```bash
curl -X POST http://localhost:3000/api/incentives/inc-001/approve \
  -H "x-operator-id: OP003" \
  -H "x-operator-name: 王五"
```

#### 步骤 6：安排付款

```bash
curl -X POST http://localhost:3000/api/incentives/inc-001/schedule-payout \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP004" \
  -H "x-operator-name: 赵六" \
  -d '{
    "scheduledDate": "2024-04-15"
  }'
```

#### 步骤 7：标记付款完成

```bash
curl -X POST http://localhost:3000/api/incentives/inc-001/mark-paid \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP004" \
  -H "x-operator-name: 赵六" \
  -d '{
    "paymentReference": "PAY-20240415-001"
  }'
```

## 3. 争议流程示例

### 场景：销售团队对达成金额提出争议

#### 步骤 1：提出争议

```bash
curl -X POST http://localhost:3000/api/disputes \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP005" \
  -H "x-operator-name: 钱七" \
  -d '{
    "achievementRecordId": "ach-001",
    "disputeType": "ACHIEVEMENT_AMOUNT",
    "disputeReason": "ACHIEVEMENT_CRITERIA_DISAGREEMENT",
    "disputeDetails": {
      "description": "实际达成金额应为130万，系统记录为125万",
      "expectedOutcome": "将达成金额调整为130万，阶梯提升至TIER_3",
      "affectedItems": [
        {
          "itemType": "ACHIEVEMENT_AMOUNT",
          "itemId": "ach-001",
          "itemDescription": "2024年Q1达成金额",
          "currentValue": "1250000",
          "expectedValue": "1300000"
        }
      ]
    },
    "comment": "附件为补充的销售合同"
  }'
```

**成功响应：**
```json
{
  "success": true,
  "dispute": {
    "id": "disp-001",
    "currentStatus": "OPEN"
  }
}
```

#### 步骤 2：分配争议

```bash
curl -X POST http://localhost:3000/api/disputes/disp-001/assign \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP006" \
  -H "x-operator-name: 孙八" \
  -d '{
    "assigneeId": "OP007"
  }'
```

#### 步骤 3：开始复核

```bash
curl -X POST http://localhost:3000/api/disputes/disp-001/start-review \
  -H "x-operator-id: OP007" \
  -H "x-operator-name: 周九"
```

#### 步骤 4：要求补充证据

```bash
curl -X POST http://localhost:3000/api/disputes/disp-001/request-evidence \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP007" \
  -H "x-operator-name: 周九" \
  -d '{
    "requestMessage": "请提供3月25日的销售合同原件扫描件"
  }'
```

#### 步骤 5：提交证据

```bash
curl -X POST http://localhost:3000/api/disputes/disp-001/submit-evidence \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP005" \
  -H "x-operator-name: 钱七" \
  -d '{
    "evidenceType": "DOCUMENT",
    "evidenceTitle": "销售合同扫描件",
    "evidenceDescription": "2024年3月25日签订的大额销售合同",
    "evidenceUrl": "/documents/contract-20240325.pdf",
    "uploadedBy": {
      "operatorId": "OP005",
      "operatorName": "钱七",
      "operatorRole": "SALES",
      "timestamp": "2024-04-10T10:00:00Z"
    },
    "uploadedAt": "2024-04-10T10:00:00Z"
  }'
```

#### 步骤 6：解决争议

```bash
curl -X POST http://localhost:3000/api/disputes/disp-001/resolve \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP007" \
  -H "x-operator-name: 周九" \
  -d '{
    "resolutionType": "UPHELD",
    "resolutionDetails": "经核实，补充的销售合同有效，达成金额确认为130万",
    "impact": {
      "statusChange": true,
      "newStatus": "VERIFIED",
      "amountAdjustment": 50000,
      "tierAdjustment": "TIER_3",
      "notes": "调整达成金额从125万到130万"
    }
  }'
```

## 4. 保护期示例

### 场景：新渠道享受保护期

```bash
curl -X POST http://localhost:3000/api/protections \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三" \
  -d '{
    "channelId": "CH002",
    "channelName": "新渠道A",
    "year": 2024,
    "quarter": "Q1",
    "protectionType": "TIER_PROTECTION",
    "protectionReason": "NEW_CHANNEL",
    "effectiveStartDate": "2024-01-01",
    "effectiveEndDate": "2024-03-31",
    "protectionTerms": {
      "protectedTier": "TIER_2",
      "protectedThreshold": null,
      "protectedRate": null,
      "protectedAmount": null,
      "applicationRules": [
        {
          "ruleName": "新渠道保护",
          "ruleCondition": "渠道创建时间 < 6个月",
          "ruleAction": "保证最低TIER_2",
          "isActive": true
        }
      ]
    },
    "notes": "新渠道首季度保护期"
  }'
```

**审批保护期：**
```bash
curl -X POST http://localhost:3000/api/protections/prot-001/approve \
  -H "x-operator-id: OP003" \
  -H "x-operator-name: 王五"
```

## 5. 跨区归属示例

### 场景：客户迁移导致跨区归属

```bash
curl -X POST http://localhost:3000/api/cross-region \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三" \
  -d '{
    "achievementRecordId": "ach-002",
    "originalChannelId": "CH001",
    "originalChannelName": "华东总代理",
    "originalRegionId": "REG001",
    "originalRegionName": "华东区",
    "assignedChannelId": "CH003",
    "assignedChannelName": "华南总代理",
    "assignedRegionId": "REG002",
    "assignedRegionName": "华南区",
    "assignmentType": "PARTIAL_SPLIT",
    "assignmentReason": "CUSTOMER_MIGRATION",
    "year": 2024,
    "quarter": "Q1",
    "splitPercentage": 30,
    "notes": "客户ABC从华东迁移到华南，30%业绩归属华南"
  }'
```

**审批跨区归属：**
```bash
curl -X POST http://localhost:3000/api/cross-region/cra-001/approve \
  -H "x-operator-id: OP003" \
  -H "x-operator-name: 王五"
```

## 6. 查询历史记录

### 查看实体操作历史

```bash
curl -X GET http://localhost:3000/api/logs/history/AchievementRecord/ach-001 \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三"
```

**响应示例：**
```json
{
  "success": true,
  "history": [
    "[2024-04-01 10:00:00] 张三 执行「CREATE_RECORD」成功 - 创建渠道CH001的2024年Q1达标记录",
    "[2024-04-01 10:00:01] SYSTEM 执行「AUTO_VERIFY」成功 - 自动审核通过",
    "[2024-04-05 14:20:00] 钱七 执行「RAISE_DISPUTE」成功 - 针对达标记录ach-001提出争议",
    "[2024-04-05 15:00:00] 孙八 执行「ASSIGN_DISPUTE」成功 - 分配争议给周九",
    "[2024-04-06 09:00:00] 周九 执行「START_REVIEW」成功 - 开始复核争议",
    "[2024-04-07 11:00:00] 周九 执行「RESOLVE_DISPUTE」成功 - 解决争议：UPHELD"
  ],
  "count": 6
}
```

### 查看状态历史

```bash
curl -X GET http://localhost:3000/api/achievements/ach-001/history \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三"
```

## 7. 错误处理示例

### 场景 1：重复提交已锁定的目标快照

**请求：**
```bash
curl -X POST http://localhost:3000/api/target-snapshots \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三" \
  -d '{
    "channelId": "CH001",
    "year": 2024,
    "quarter": "Q1",
    ...
  }'
```

**响应（400 Bad Request）：**
```json
{
  "success": false,
  "errorMessage": "该渠道(CH001)在2024年Q1的目标快照已锁定，无法重复创建。如需修改，请联系管理员解锁。"
}
```

### 场景 2：非法状态流转

**请求：**
```bash
# 尝试从 VERIFIED 直接流转到 PAID
curl -X POST http://localhost:3000/api/incentives/inc-001/mark-paid \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP004" \
  -H "x-operator-name: 赵六" \
  -d '{
    "paymentReference": "PAY-001"
  }'
```

**响应（400 Bad Request）：**
```json
{
  "success": false,
  "errorMessage": "不能从「已验证」直接流转到「已付款」。允许的流转状态：「有争议」、「已审批」、「已拒绝」"
}
```

### 场景 3：重复提交达标记录

**请求：**
```bash
# 已存在处于 VERIFIED 状态的记录
curl -X POST http://localhost:3000/api/achievements \
  -H "Content-Type: application/json" \
  -H "x-operator-id: OP001" \
  -H "x-operator-name: 张三" \
  -d '{
    "channelId": "CH001",
    "year": 2024,
    "quarter": "Q1",
    ...
  }'
```

**响应（400 Bad Request）：**
```json
{
  "success": false,
  "errorMessage": "该渠道(CH001)在2024年Q1的达标记录已存在且处于VERIFIED状态，不能重复提交。如需修改，请先将状态改为「已拒绝」或「初始状态」。"
}
```

## 8. 健康检查

```bash
curl -X GET http://localhost:3000/api/health
```

**响应：**
```json
{
  "success": true,
  "message": "渠道激励达标复核服务运行正常",
  "version": "1.0.0",
  "timestamp": "2024-04-15T10:30:00.000Z"
}
```
