# 小贷还款宽限 API 示例请求

## 基础信息
- 基础URL: `http://localhost:3000/api`
- 数据格式: JSON

---

## 1. 合同管理

### 1.1 创建合同
```bash
POST /api/contracts
Content-Type: application/json

{
  "contractNo": "LOAN20250101",
  "customerName": "张三",
  "customerIdNo": "110101199001011234",
  "principal": 100000,
  "interestRate": 8.5,
  "term": 12,
  "startDate": "2025-01-01T00:00:00.000Z"
}
```

### 1.2 查询合同详情
```bash
GET /api/contracts/{contractId}
```

### 1.3 通过合同号查询
```bash
GET /api/contracts/no/LOAN20250101
```

### 1.4 查询宽限资格
```bash
GET /api/contracts/{contractId}/forbearance-eligibility/{installmentId}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "reasons": [],
    "maxDays": 30,
    "remainingForbearanceTimes": 3,
    "requiresSpecialApproval": false
  }
}
```

---

## 2. 还款管理

### 2.1 创建还款（全额）
```bash
POST /api/repayments
Content-Type: application/json

{
  "contractId": "contract-uuid-here",
  "installmentId": "installment-uuid-here",
  "amount": 4357.62,
  "repaymentDate": "2025-01-15T00:00:00.000Z",
  "repaymentMethod": "alipay",
  "type": "full",
  "operator": "客服A",
  "remark": "用户主动还款"
}
```

### 2.2 创建部分还款
```bash
POST /api/repayments
Content-Type: application/json

{
  "contractId": "contract-uuid-here",
  "installmentId": "installment-uuid-here",
  "amount": 2000,
  "repaymentDate": "2025-01-15T00:00:00.000Z",
  "repaymentMethod": "wechat",
  "type": "partial",
  "operator": "客服A"
}
```

### 2.3 防重提交（使用sourceId）
```bash
POST /api/repayments
Content-Type: application/json

{
  "contractId": "contract-uuid-here",
  "amount": 2000,
  "repaymentDate": "2025-01-15T00:00:00.000Z",
  "repaymentMethod": "bank_transfer",
  "type": "partial",
  "sourceId": "BANK_TRANSFER_20250115_001",
  "operator": "客服A"
}
```

### 2.4 还款试算
```bash
POST /api/repayments/trial
Content-Type: application/json

{
  "contractId": "contract-uuid-here",
  "repaymentAmount": 5000
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "contractId": "contract-uuid-here",
    "repaymentAmount": 5000,
    "totalInstallmentsAffected": 2,
    "trialDetails": [
      {
        "installmentId": "installment-uuid-1",
        "installmentNo": 1,
        "dueDate": "2025-02-01T00:00:00.000Z",
        "totalAmount": 4357.62,
        "remainingAmount": 4357.62,
        "paymentAmount": "4357.62",
        "newRemainingAmount": "0.00",
        "statusAfter": "paid"
      },
      {
        "installmentId": "installment-uuid-2",
        "installmentNo": 2,
        "dueDate": "2025-03-01T00:00:00.000Z",
        "totalAmount": 4385.23,
        "remainingAmount": 4385.23,
        "paymentAmount": "642.38",
        "newRemainingAmount": "3742.85",
        "statusAfter": "partial"
      }
    ],
    "remainingUnapplied": "0.00"
  }
}
```

### 2.5 查询合同还款记录
```bash
GET /api/repayments/contract/{contractId}
```

---

## 3. 宽限申请管理

### 3.1 提交宽限申请
```bash
POST /api/forbearance
Content-Type: application/json

{
  "contractId": "contract-uuid-here",
  "installmentId": "installment-uuid-here",
  "applicantName": "张三",
  "applicantPhone": "13800138000",
  "reason": "暂时资金周转困难，工资延迟发放",
  "requestedDays": 15,
  "partialPaymentAmount": 1000,
  "sourceId": "FORBEARANCE_20250115_001",
  "operator": "客服A",
  "remark": "用户承诺宽限期内全额还款"
}
```

### 3.2 审批通过
```bash
POST /api/forbearance/{applicationId}/approve
Content-Type: application/json

{
  "approvedDays": 15,
  "approver": "审批经理",
  "approvalRemark": "情况属实，同意宽限15天"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "application-uuid",
    "applicationNo": "FBA20250115123456001",
    "status": "approved",
    "approvedDays": 15,
    "approver": "审批经理",
    "approvalRemark": "情况属实，同意宽限15天",
    "approvalTime": "2025-01-15T12:34:56.000Z",
    "installment": {
      "id": "installment-uuid",
      "currentDueDate": "2025-02-16T00:00:00.000Z",
      "status": "forborne",
      "isForborne": true
    }
  }
}
```

### 3.3 审批拒绝
```bash
POST /api/forbearance/{applicationId}/reject
Content-Type: application/json

{
  "approver": "审批经理",
  "approvalRemark": "不符合宽限条件，已逾期超过90天"
}
```

### 3.4 查询合同宽限申请
```bash
GET /api/forbearance/contract/{contractId}
```

---

## 4. 催收管理

### 4.1 创建催收记录
```bash
POST /api/collections
Content-Type: application/json

{
  "contractId": "contract-uuid-here",
  "type": "phone",
  "collector": "催收员A",
  "collectionDate": "2025-01-15T00:00:00.000Z",
  "result": "contacted",
  "promisePayDate": "2025-01-20T00:00:00.000Z",
  "promisePayAmount": 4357.62,
  "remark": "用户承诺5日内还款"
}
```

### 4.2 催收冻结
```bash
POST /api/collections/freeze/{contractId}
Content-Type: application/json

{
  "freezeReason": "已申请宽限，暂停催收",
  "freezeDays": 30
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "contractId": "contract-uuid",
    "freezeReason": "已申请宽限，暂停催收",
    "freezeUntil": "2025-02-14T12:34:56.000Z",
    "message": "催收已冻结，截止日期: 2025-02-14"
  }
}
```

### 4.3 解除催收冻结
```bash
POST /api/collections/unfreeze/{contractId}
```

### 4.4 查询催收状态
```bash
GET /api/collections/status/{contractId}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "isInCollection": true,
    "isFrozen": true,
    "freezeUntil": "2025-02-14T12:34:56.000Z",
    "daysRemaining": 28
  }
}
```

---

## 特殊业务场景

### 场景1: 催收中仍可宽限
- **前提**: 合同在催收中（isInCollection = true）
- **处理**: 宽限资格校验返回 `eligible: true`，但标记 `requiresSpecialApproval: true`
- **结果**: 需要特别审批流程

### 场景2: 部分还款重复入账
- **前提**: 使用相同 `sourceId` 重复提交还款
- **处理**: 系统检测重复，返回 `isDuplicate: true`
- **结果**: 不会重复扣账

### 场景3: 宽限超过次数限制
- **前提**: 已使用宽限次数 `>=` 最大宽限次数
- **处理**: 资格校验返回 `eligible: false`
- **结果**: 不可提交宽限申请

### 场景4: 审批后账期自动更新
- **前提**: 宽限申请审批通过
- **处理**: 自动更新账期还款日、状态、宽限标记
- **结果**: `currentDueDate` 延后，`status = 'forborne'`，`isForborne = true`

---

## 快速测试脚本

使用以下命令运行演示脚本:
```bash
# 安装依赖
npm install

# 初始化数据库并添加种子数据
npm run seed

# 运行完整演示
npm run demo

# 启动API服务
npm start
```
