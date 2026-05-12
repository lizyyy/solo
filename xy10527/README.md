# 社区团购缺斤赔付 API

社区团购水果称重商品缺斤投诉处理系统，围绕订单、称重、团长确认和赔付规则展开。

## 功能特性

- 完整的投诉处理工作流：创建 → 提交证据 → 团长确认 → 赔付试算 → 审核 → 打款 → 完成
- 规则引擎：称重误差容忍、重复投诉检测、投诉时限检查、部分商品赔付
- 幂等机制：所有关键操作支持幂等键，防止重复执行
- 历史追踪：每一步状态变化、操作人、前后差异都有完整记录
- 人工修正：支持人工干预，记录修正前后差异和操作者
- 异常处理：支付失败等异常可重试
- 统计报告：团长责任统计、状态分布、赔付汇总

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 查看演示（无需启动服务器）

```bash
npm run demo
```

演示脚本会初始化所有样例数据，并展示：
- 正常缺斤赔付的完整闭环
- 称重误差容忍范围内的自动驳回
- 证据不足驳回
- 重复投诉自动检测
- 超时投诉自动驳回
- 部分商品缺斤赔付
- 支付失败进入异常状态
- 人工修正操作
- 统计报告和数据导出

### 3. 启动 API 服务

```bash
npm start
```

服务启动后访问 `http://localhost:3000/health` 检查状态。

启动时会自动初始化样例数据，控制台会输出所有样例投诉单号。

## 主要演示路径

### 路径一：正常缺斤赔付（完整闭环）

**场景**：用户购买红富士苹果2.5kg，实际收到2.2kg，缺斤0.3kg（12%）。

**流程**：
1. **创建投诉** → 状态 `PENDING_REVIEW`
2. **添加证据**（用户称重照片） → 状态 `EVIDENCE_REVIEWING`
3. **提交团长确认** → 状态 `WAITING_LEADER_CONFIRM`
4. **团长确认**（确认称重记录和签收） → 状态 `TRIAL_CALCULATION`
5. **赔付试算**：
   - 缺斤0.3kg × 单价8.8元 = 基础赔付2.64元
   - 缺斤12% ≥ 10%阈值 → 触发2倍惩罚赔付 → 最终赔付5.28元
   - 状态 `APPROVING`
6. **审批通过** → 状态 `APPROVED` → `PAYMENT_PROCESSING`
7. **发起打款** → 支付处理中
8. **支付回调**（成功） → 状态 `COMPLETED`

**关键结果验证**：
- 订单重量链路清晰显示期望重量vs实际重量
- 赔付金额计算正确（含惩罚倍率）
- 审核历史完整记录每一步的操作人和状态变化

### 路径二：称重误差容忍（自动驳回）

**场景**：用户购买橙子1.5kg，实际1.48kg，缺斤0.02kg（20g）。

**规则**：
- 误差容忍：2% 或 0.02kg，取大者
- 0.02kg正好在容忍范围内

**结果**：试算时系统自动判定为正常误差，投诉驳回。

### 路径三：重复投诉检测

**场景**：用户7天内针对同一订单的同一商品发起两次投诉。

**规则**：7天时间窗口内同订单同商品自动识别为重复投诉。

**结果**：第二次投诉创建时自动驳回，关联原始投诉单号。

### 路径四：超时投诉

**场景**：用户收货后第50小时才投诉（规定48小时内）。

**规则**：从配送时间起算，48小时投诉时限。

**结果**：投诉创建时自动驳回，原因`TIME_LIMIT_EXCEEDED`。

## 失败路径演示

### 支付失败进入异常

**场景**：所有流程正常通过，审批通过，发起打款时用户余额不足。

**流程**：
1. 正常完成到 `PAYMENT_PROCESSING` 状态
2. 支付回调返回 `success: false`，原因"用户余额不足"
3. 投诉状态变为 `EXCEPTION`
4. 异常原因记录在 `exceptionReason` 字段
5. 历史记录显示从 `PAYMENT_PROCESSING` → `EXCEPTION` 的状态变化

**恢复方式**：调用重试异常接口 `POST /api/complaints/:id/retry-exception`，系统会将状态回退到 `PAYMENT_PROCESSING`，可再次发起打款。

## API 接口列表

### 订单管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/orders | 创建订单 |
| GET | /api/orders/:id | 查询订单详情 |
| GET | /api/orders/:id/weight-chain | 查询订单重量链路（期望vs实际重量对比） |
| POST | /api/orders/:id/confirm-delivery | 确认配送 |
| POST | /api/orders/:id/weight-confirmation | 添加商品称重确认（含照片） |
| POST | /api/orders/:id/leader-confirm | 团长确认订单签收 |

### 投诉管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/complaints | 创建投诉 |
| GET | /api/complaints | 查询投诉列表（支持筛选） |
| GET | /api/complaints/:id | 查询投诉详情（含历史记录） |
| POST | /api/complaints/:id/evidence | 上传投诉证据 |
| POST | /api/complaints/:id/submit-leader-confirm | 提交团长确认请求 |
| POST | /api/complaints/:id/leader-confirm | 团长确认操作 |
| POST | /api/complaints/:id/trial-calculate | 赔付试算 |
| POST | /api/complaints/:id/approve | 审批（通过/驳回） |
| POST | /api/complaints/:id/process-payment | 发起打款 |
| POST | /api/complaints/:id/payment-callback | 处理支付回调 |
| POST | /api/complaints/:id/manual-correct | 人工修正（记录差异和操作者） |
| POST | /api/complaints/:id/retry-exception | 重试异常状态 |

### 统计与报告
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/complaints/stats/summary | 统计汇总（状态分布、团长责任） |
| GET | /api/complaints/report/export | 导出完整数据报告 |

## 幂等机制

在以下接口中使用 `X-Idempotency-Key` 请求头：
- 创建投诉
- 添加证据
- 赔付试算
- 审批
- 发起打款
- 处理支付回调

相同的幂等键重复调用时，直接返回第一次的结果，不会重复执行业务逻辑。

## 赔付规则配置

```javascript
{
  weightTolerance: {
    enabled: true,
    tolerancePercent: 2,      // 2%误差容忍
    toleranceFixed: 0.02,      // 或0.02kg固定容忍，取大者
    unit: 'kg'
  },
  duplicateCheck: {
    enabled: true,
    timeWindowDays: 7          // 7天内重复投诉检测
  },
  timeLimit: {
    enabled: true,
    complaintTimeLimitHours: 48 // 48小时投诉时限
  },
  compensationRatio: {
    baseRatio: 1.0,            // 基础赔付倍率
    penaltyRatio: 2.0,         // 惩罚赔付倍率
    applyPenalty: true,
    penaltyThresholdPercent: 10 // 缺斤≥10%触发2倍赔付
  }
}
```

## 状态流转图

```
PENDING_REVIEW → EVIDENCE_REVIEWING → WAITING_LEADER_CONFIRM
                                                       ↓
COMPLETED ← PAYMENT_PROCESSING ← APPROVED ← APPROVING ← TRIAL_CALCULATION
              ↓ (支付失败)
           EXCEPTION ← (可重试)
```

## 项目结构

```
src/
├── index.js              # 服务入口
├── demo.js               # 演示脚本
├── models/
│   ├── Order.js          # 订单模型
│   └── Complaint.js      # 投诉模型和状态定义
├── services/
│   ├── OrderService.js   # 订单服务
│   └── ComplaintService.js # 投诉服务（核心业务逻辑）
├── rules/
│   └── compensationRules.js # 赔付规则引擎
├── data/
│   ├── memoryStore.js    # 内存数据存储
│   └── sampleData.js     # 样例数据生成器
├── routes/
│   ├── orderRoutes.js    # 订单API路由
│   └── complaintRoutes.js # 投诉API路由
└── utils/
    ├── logger.js         # 日志工具
    └── idGenerator.js    # ID生成器
```

## 样例数据说明

启动时自动创建7个订单和8个投诉，覆盖所有主要场景：

| 场景 | 说明 | 结果 |
|------|------|------|
| 场景1 | 苹果缺斤0.3kg（12%） | 正常赔付完成 |
| 场景2 | 橙子缺斤0.02kg（在容忍范围内） | 自动驳回 |
| 场景3 | 西瓜团长称5.02kg，用户无证据声称4kg | 无有效缺斤，驳回 |
| 场景4 | 葡萄重复投诉 | 第二次自动驳回 |
| 场景5 | 梨，配送后50小时才投诉 | 超时驳回 |
| 场景6 | 芒果缺斤0.2kg，桃子在容忍范围内 | 部分赔付，支付失败进入异常 |
| 场景7 | 草莓缺斤0.2kg（25%） | 待审批，演示人工修正 |

通过 `GET /api/complaints/stats/summary` 可以查看团长责任统计，包括：
- 各团长的总投诉数
- 驳回率
- 总赔付金额

通过 `GET /api/complaints/report/export` 可导出包含所有投诉明细的完整报告。
