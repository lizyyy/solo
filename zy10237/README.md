# 线上问诊处方流转 API

一个完整的处方流转系统，包含问诊建单、医生开方、药师审核、支付确认、出库配送、驳回撤销等核心业务流程。

## 业务流程

```
患者
  ↓
问诊建单 (CREATED)
  ↓
医生开方 (PRESCRIBED)
  ↓
药师审核 ── 审核通过 (PHARMACIST_APPROVED)
  │              ↓
  │         支付确认 (PAID)
  │              ↓
  │         出库配送 (SHIPPED)
  │              ↓
  │           完成 (COMPLETED)
  │
  └── 驳回 (REJECTED) ── 医生重新开方
```

## 核心特性

- ✅ **幂等性保证**：每个接口都需要 `idempotentKey`，重复提交不会造成重复操作
- ✅ **状态流转校验**：严格的状态机控制，防止非法状态转换
- ✅ **异常场景处理**：
  - 已支付/已发货的订单不能修改处方
  - 已驳回的处方不能支付
  - 驳回必须填写原因
  - 已发货的订单不能撤销
- ✅ **状态变更日志**：所有状态变更都有完整记录，可追溯
- ✅ **金额校验**：支付金额必须与处方金额一致

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 运行测试流程（可选）

```bash
npm run test-flow
```

### 4. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API 接口

所有接口前缀：`http://localhost:3000/api/prescription`

### 1. 问诊建单

**POST** `/consultation`

```json
{
  "patientId": "P001",
  "patientName": "张三",
  "doctorId": "D001",
  "doctorName": "李医生",
  "idempotentKey": "consult_001"
}
```

### 2. 医生开方

**POST** `/prescription`

```json
{
  "consultationId": "问诊单ID",
  "doctorId": "D001",
  "items": [
    {
      "medicineId": "M001",
      "medicineName": "阿莫西林胶囊",
      "specification": "0.5g*24粒",
      "quantity": 2,
      "unit": "盒",
      "dosage": "每日3次，每次1粒",
      "price": 25.00
    }
  ],
  "idempotentKey": "presc_001"
}
```

### 3. 药师审核

**POST** `/pharmacist-review`

审核通过：
```json
{
  "prescriptionId": "处方ID",
  "pharmacistId": "PH001",
  "pharmacistName": "王药师",
  "approved": true,
  "idempotentKey": "review_001"
}
```

驳回（必须填写原因）：
```json
{
  "prescriptionId": "处方ID",
  "pharmacistId": "PH001",
  "pharmacistName": "王药师",
  "approved": false,
  "rejectReason": "用药剂量不准确",
  "idempotentKey": "review_001"
}
```

### 4. 支付确认

**POST** `/payment`

```json
{
  "consultationId": "问诊单ID",
  "amount": 68.50,
  "paymentNo": "PAY20240101001",
  "idempotentKey": "pay_001"
}
```

### 5. 出库配送

**POST** `/ship`

```json
{
  "consultationId": "问诊单ID",
  "logisticsNo": "SF1234567890",
  "logisticsCompany": "顺丰速运",
  "operatorId": "O001",
  "operatorName": "库管员",
  "idempotentKey": "ship_001"
}
```

### 6. 驳回撤销

**POST** `/cancel`

```json
{
  "consultationId": "问诊单ID",
  "operatorId": "O001",
  "operatorName": "客服",
  "reason": "患者取消订单",
  "idempotentKey": "cancel_001"
}
```

### 7. 查询问诊详情

**GET** `/consultation/:id`

返回：问诊单信息 + 处方信息 + 所有状态变更日志

### 8. 状态汇总

**GET** `/summary`

返回：总订单数、各状态分布、总支付金额

### 9. 所有状态日志

**GET** `/logs`

返回：最近100条状态变更记录

## 状态说明

### 问诊单状态

| 状态 | 说明 |
|------|------|
| CREATED | 已创建（问诊建单完成） |
| PRESCRIBED | 已开方（医生已开处方） |
| PHARMACIST_APPROVED | 药师已审核 |
| PAID | 已支付 |
| SHIPPED | 已发货 |
| COMPLETED | 已完成 |
| REJECTED | 已驳回（药师驳回处方） |
| CANCELLED | 已取消 |

### 处方状态

| 状态 | 说明 |
|------|------|
| DRAFT | 草稿 |
| SUBMITTED | 已提交（待审核） |
| PHARMACIST_APPROVED | 药师已审核通过 |
| PHARMACIST_REJECTED | 药师已驳回 |

## 测试流程示例

运行 `npm run test-flow` 将执行以下测试：

1. **正常流程**：建单 → 开方 → 审核通过 → 支付 → 发货 → 查询
2. **驳回流程**：建单 → 开方 → 药师驳回（验证驳回原因必填）→ 尝试支付已驳回订单
3. **幂等性测试**：重复提交相同请求，验证只执行一次
4. **取消流程**：建单后取消
5. **汇总统计**：查看所有数据统计

## 数据库结构

- **consultations**：问诊单表
- **prescriptions**：处方表
- **prescription_items**：处方明细表（药品）
- **status_logs**：状态变更日志表

所有操作都会在 `status_logs` 中留下记录，包括操作人、时间、前后状态、幂等Key等信息。
