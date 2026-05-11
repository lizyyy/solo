# 外卖骑手装备领用 API 文档

## 系统概述

本 API 系统用于管理外卖站点的骑手装备领用流程，包括头盔、餐箱、雨衣等装备的发放、回收、损坏赔付和对账功能。

## 核心验证功能

系统提供三大核心验证能力：

1. **骑手档案验证**：确认骑手是否处于生效状态，可以领用装备
2. **装备批次验证**：确认装备批次是否通过质检，可以发放
3. **签收一致性验证**：确认领用签收签名与原始数据匹配

## 输出含义说明

### 成功响应 (HTTP 200/201)

```json
{
  "success": true,
  "data": {...},
  "message": "操作成功描述"
}
```

**判断标准：**
- `success: true` 表示操作成功完成
- HTTP 状态码为 200（查询/更新）或 201（创建）
- 可以直接查看 `message` 字段获取操作结果说明

### 业务错误响应 (HTTP 400/403/404)

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {...}
  }
}
```

**判断标准：**
- `success: false` 表示操作失败
- HTTP 状态码标识错误类型
- `error.code` 是唯一的错误码，可用于程序判断
- `error.details` 提供详细的错误上下文

## 通过标准（无需人工处理）

以下情况代表业务流程正常完成，系统自动通过：

### 1. 骑手档案验证通过
- **响应码**：200
- **判断**：`data.is_active == true`
- **含义**：骑手档案已激活，可以正常领用装备

### 2. 装备批次验证通过
- **响应码**：200
- **判断**：`data.is_qualified == true`
- **含义**：装备批次已通过质检，可以发放

### 3. 领用记录确认通过
- **响应码**：200
- **判断**：`data.status == 'confirmed'`
- **含义**：签收签名验证通过，装备已正式领用

### 4. 记录一致性验证通过
- **响应码**：200
- **判断**：`data.is_consistent == true` 且 `data.requires_manual_review == false`
- **含义**：签收数据与原始记录完全匹配

### 5. 归还记录确认通过
- **响应码**：200
- **判断**：`data.status == 'confirmed'`
- **含义**：归还流程完成

### 6. 赔付对账完成
- **响应码**：200
- **判断**：`data.reconciliation_status == 'reconciled'`
- **含义**：赔付金额已核对并记录

### 7. 全局对账清洁
- **对账报告**：`GET /api/records/reconciliation`
- **判断**：`reconciliation_status == 'clean'` 且 `inconsistent_count == 0`
- **含义**：所有记录一致，无需人工介入

## 需要人工处理的场景

以下情况需要站点管理员或财务人员人工介入：

### 1. 骑手档案未生效 (RIDER_NOT_ACTIVE)
- **错误码**：`RIDER_NOT_ACTIVE`
- **HTTP 状态**：403
- **处理步骤**：
  1. 联系骑手确认入职流程
  2. 核实入职材料完整性
  3. 通过 `POST /api/riders/{rider_id}/activate` 激活档案

### 2. 装备批次未质检 (BATCH_NOT_QUALIFIED)
- **错误码**：`BATCH_NOT_QUALIFIED`
- **HTTP 状态**：400
- **处理步骤**：
  1. 安排质检员对批次进行检验
  2. 通过 `POST /api/equipment/batches/{batch_no}/inspect` 记录质检结果
  3. 确认 `is_qualified: true` 后才可领用

### 3. 签收签名不匹配 (SIGNATURE_MISMATCH)
- **错误码**：`SIGNATURE_MISMATCH`
- **HTTP 状态**：400
- **记录状态**：`anomaly`（异常）
- **处理步骤**：
  1. 检查 `error.details.original_data` 确认原始数据
  2. 核实骑手签名是否真实
  3. 如签名造假：拒绝记录并重新办理
  4. 如操作失误：重置装备状态，重新创建领用记录
  5. 对账报告会显示此异常记录

### 4. 骑手有未归还装备 (RIDER_HAS_OUTSTANDING_EQUIPMENT)
- **错误码**：`RIDER_HAS_OUTSTANDING_EQUIPMENT`
- **HTTP 状态**：400
- **处理步骤**：
  1. 查看 `error.details.outstanding_equipment` 列表
  2. 联系骑手归还装备
  3. 对于损坏/丢失的装备，走赔付流程
  4. 所有装备处理完成后才可办理离职

### 5. 装备状态不可用 (EQUIPMENT_NOT_AVAILABLE)
- **错误码**：`EQUIPMENT_NOT_AVAILABLE`
- **HTTP 状态**：400
- **处理步骤**：
  1. 检查装备当前状态
  2. 如已领用：分配其他装备
  3. 如已损坏：走报废流程，补充新装备

### 6. 对账报告显示异常
- **报告状态**：`reconciliation_status == 'needs_review'`
- **处理步骤**：
  1. 查看 `inconsistent_records` 列表
  2. 对每条异常记录进行人工核查
  3. 修正数据或备注原因
  4. 确认所有异常处理完毕

### 7. 赔付对账有差异
- **对账状态**：`reconciliation_status == 'discrepancy'`
- **处理步骤**：
  1. 核对赔付金额是否正确
  2. 检查支付凭证
  3. 如金额错误：调整赔付记录
  4. 确认后通过 `POST /api/compensation/{no}/reconcile` 标记

## 核心 API 接口

### 骑手管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/riders/` | POST | 创建骑手档案 |
| `/api/riders/{rider_id}` | GET | 查询骑手详情 |
| `/api/riders/{rider_id}/verify` | POST | 验证骑手是否生效 |
| `/api/riders/{rider_id}/activate` | POST | 激活骑手档案 |
| `/api/riders/{rider_id}/deactivate` | POST | 停用骑手档案 |
| `/api/riders/{rider_id}/resign` | POST | 办理骑手离职 |
| `/api/riders/{rider_id}/equipment-status` | GET | 查询骑手装备状态 |

### 装备管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/equipment/batches` | POST | 创建装备批次 |
| `/api/equipment/batches/{batch_no}/inspect` | POST | 质检批次 |
| `/api/equipment/batches/{batch_no}/verify` | POST | 验证批次是否合格 |
| `/api/equipment/batches/{batch_no}/details` | GET | 获取批次详细信息 |
| `/api/equipment/` | POST | 创建设备实例 |
| `/api/equipment/{equipment_no}` | GET | 查询设备详情 |
| `/api/equipment/{equipment_no}/verify` | POST | 验证设备是否可用 |

### 领用/回收记录

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/records/issue` | POST | 创建领用记录 |
| `/api/records/return` | POST | 创建归还记录 |
| `/api/records/{record_no}/confirm` | POST | 确认记录（签名验证） |
| `/api/records/{record_no}/reject` | POST | 拒绝记录 |
| `/api/records/{record_no}/verify` | POST | 验证记录一致性 |
| `/api/records/reconciliation` | GET | 获取对账报告 |

### 赔付管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/compensation/` | POST | 创建赔付记录 |
| `/api/compensation/{compensation_no}/pay` | POST | 标记已支付 |
| `/api/compensation/{compensation_no}/waive` | POST | 豁免赔付 |
| `/api/compensation/{compensation_no}/reconcile` | POST | 对账赔付记录 |
| `/api/compensation/reconciliation` | GET | 获取赔付对账报告 |

## 状态流转图

### 骑手状态流转
```
pending (待审核) -> active (生效中) -> inactive (已停用)
                                      -> resigned (已离职)
```

### 装备状态流转
```
in_stock (在库) -> issued (已领用) -> returned (已归还) -> in_stock
                                     -> damaged (已损坏) -> compensated (已赔付)
                                     -> lost (已丢失)
```

### 记录状态流转
```
pending (待确认) -> confirmed (已确认)
                -> rejected (已拒绝)
                -> anomaly (异常) [签名不匹配时]
```

### 赔付状态流转
```
pending (待支付) -> paid (已支付)
                -> waived (已豁免)
```

## 错误码总览

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `RIDER_NOT_FOUND` | 404 | 骑手不存在 |
| `RIDER_NOT_ACTIVE` | 403 | 骑手未生效 |
| `RIDER_HAS_OUTSTANDING_EQUIPMENT` | 400 | 有未归还装备 |
| `BATCH_NOT_FOUND` | 404 | 批次不存在 |
| `BATCH_NOT_QUALIFIED` | 400 | 批次未通过质检 |
| `EQUIPMENT_NOT_FOUND` | 404 | 装备不存在 |
| `EQUIPMENT_NOT_AVAILABLE` | 400 | 装备不可用 |
| `SIGNATURE_MISMATCH` | 400 | 签名不匹配 |
| `RECORD_NOT_FOUND` | 404 | 记录不存在 |
| `RECORD_ALREADY_CONFIRMED` | 400 | 记录已确认 |
| `INVALID_STATUS_TRANSITION` | 400 | 无效状态流转 |
| `COMPENSATION_NOT_FOUND` | 404 | 赔付记录不存在 |
| `RECONCILIATION_ERROR` | 400 | 对账错误 |

## 快速开始

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 启动服务：
```bash
python run.py
```

3. 运行测试：
```bash
pip install requests
python scripts/test_scenario.py
```

## 测试场景说明

测试脚本 `scripts/test_scenario.py` 包含三个核心场景：

### Scenario 1: 正常处理流程
验证完整的正常业务流程：
- 创建并激活骑手
- 创建并质检装备批次
- 领用装备并验证一致性
- 所有步骤预期通过

### Scenario 2: 失败场景测试
验证系统的错误处理能力：
- 未激活骑手无法领用
- 未质检批次无法使用
- 错误签名导致确认失败
- 有未归还装备无法离职
- 所有步骤预期失败并返回明确错误

### Scenario 3: 修正后重跑流程
验证异常处理和修复能力：
- 首次尝试使用错误签名（失败）
- 检查对账报告显示异常
- 重置装备状态重新领用
- 使用正确签名确认（成功）
- 归还装备并处理赔付
- 完成最终对账

## 验收要点

验收时需确认以下三个结果都能复现：

### ✅ 正常处理
- HTTP 状态码 200/201
- `success: true`
- 状态流转正确
- 数据一致性验证通过

### ❌ 失败原因
- 返回明确的错误码
- `error.details` 包含足够的调试信息
- 记录状态正确标记（如 anomaly）
- 不影响其他正常流程

### 🔄 修正后重跑
- 错误可以被修正
- 修正后流程恢复正常
- 对账报告最终显示 clean
- 赔付记录可以完成对账
