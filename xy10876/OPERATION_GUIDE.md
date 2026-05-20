# 退款异常处理 API - 操作指南

## 一、系统概述

这是一个偏技术方向的退款异常处理全栈应用，包含：
- 后端 API：Node.js + Express + SQLite
- 前端控制台：原生 HTML/JS，提供搜索、筛选、详情查看、操作触发
- 核心能力：状态机、幂等、重试、人工复核、归档、脏数据修复

## 二、核心数据模型

### 2.1 退款状态机

```
pending (待提交)
    ↓
    → submit → processing (处理中)
    ↓
    → success (成功) → archive → archived (已归档)
    ↓
    → failed (失败) → retry (最多3次)
                    ↓
                    → need_review (需人工复核)
                        ↓
                        → manual_success (人工确认成功) → archive
                        ↓
                        → manual_failed (人工确认失败) → archive
```

| 状态 | 说明 | 允许操作 |
|------|------|----------|
| pending | 退款单创建后初始状态 | 提交渠道 |
| processing | 渠道处理中 | 查询渠道 |
| success | 退款成功 | 归档 |
| failed | 退款失败 | 重试提交(≤3次) |
| need_review | 达到最大重试次数 | 人工复核 |
| manual_success | 人工确认成功 | 归档 |
| manual_failed | 人工确认失败 | 归档 |
| archived | 已归档，所有操作记录固化 | 只读 |

### 2.2 数据表结构

1. **payments** - 原支付单
   - id, order_no, amount, channel, status, created_at

2. **refunds** - 退款单（核心）
   - id, refund_no, payment_id, payment_order_no, amount, channel
   - status, retry_count, max_retries, operator, reason
   - created_at, updated_at

3. **channel_status** - 渠道交互记录
   - id, refund_id, channel_refund_id, status, channel_response
   - requested_at, responded_at

4. **request_logs** - 操作日志（审计用）
   - id, refund_id, action, request_data, response_data
   - operator, responsibility_node, created_at

5. **manual_reviews** - 人工复核记录
   - id, refund_id, reviewer, comment, decision, created_at

6. **receipts** - 回执归档
   - id, refund_id, receipt_data, archived_at

## 三、重点功能路径说明

### 3.1 重复请求幂等路径

**场景**：客服不知道能不能再点一次，重复点击"创建退款"

**触发方式**：
1. 创建支付单 → POST /api/payments
2. 第一次创建退款 → POST /api/refunds (成功，isDuplicate=false)
3. 第二次创建相同支付单的退款 → POST /api/refunds (幂等命中，isDuplicate=true)

**内部逻辑**：
```javascript
// 检查是否存在进行中的退款
const existingRefund = await dbGet(
  `SELECT * FROM refunds 
   WHERE payment_order_no = ? 
   AND status NOT IN ('manual_failed', 'archived')`,
  [paymentOrderNo]
);

if (existingRefund) {
  // 记录幂等命中日志
  await logRequest(existingRefund.id, 'duplicate_create', 
    requestData, { code: 'DUPLICATE_REFUND' },
    operator, 'create_refund_idempotent_check'
  );
  return { refund: existingRefund, isDuplicate: true };
}
```

**日志特征**：
- action: 'duplicate_create'
- responsibility_node: 'create_refund_idempotent_check'
- response_data: 包含 code: 'DUPLICATE_REFUND'

**验证方式**：在"操作日志"面板查看，或控制台输出黄色警告

---

### 3.2 脏数据修复路径

**场景**：系统状态异常，需要人工干预修正退款状态

**触发方式**：
1. 点击退款单操作栏的"修复数据"按钮
2. 输入目标状态（如 pending, success 等）
3. 输入修复原因（会记录在 operator 字段）

**API 调用**：
```
POST /api/refunds/{id}/fix
Body: {
  "newStatus": "pending",
  "operator": "admin_fix:状态不一致修复"
}
```

**日志特征**：
- action: 'fix_dirty_data'
- responsibility_node: 'data_correction_handler'
- operator: 'admin_fix:xxx'
- request_data: 包含 oldStatus 和 newStatus

**可修复的场景**：
- 渠道响应超时，状态卡在 processing → 手动改为 pending 重试
- 渠道实际成功但系统显示失败 → 手动改为 success
- 测试数据清理 → 改为 archived

---

### 3.3 补偿动作路径

#### 场景 A：渠道返回 processing，客服不知道怎么处理

**补偿路径**：
1. 状态为 processing 的退款单，显示"查询渠道"按钮
2. 点击"查询渠道" → POST /api/refunds/{id}/query
3. 系统模拟再次查询渠道，根据随机结果更新状态：
   - success → 直接成功
   - processing → 保持，可继续查询
   - failed → 失败，可重试

```javascript
// 每点击一次查询，都会记录新的渠道交互记录
await dbRun(
  `INSERT INTO channel_status (...) VALUES (...)`
);
```

#### 场景 B：重试3次都失败，进入 need_review 状态

**补偿路径**：
1. 当 retry_count >= max_retries 时，自动进入 need_review
2. 显示"人工复核"按钮
3. 点击后选择：
   - approve → 改为 manual_success（人工确认成功）
   - reject → 改为 manual_failed（人工确认失败）
4. 所有复核记录都会写入 manual_reviews 表

#### 场景 C：终态数据归档

**补偿路径**：
1. success / manual_success / manual_failed 状态可归档
2. 点击"归档"按钮 → POST /api/refunds/{id}/archive
3. 系统将所有相关数据序列化存入 receipts 表：
   - 退款单基本信息
   - 所有渠道交互记录
   - 人工复核记录
   - 所有操作日志
4. 退款单状态变为 archived，不可再操作

## 四、完整 API 接口列表

### 4.1 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/statuses | 状态枚举 |

### 4.2 支付单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/payments | 创建模拟支付单 |

### 4.3 退款单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/refunds | 创建退款单（幂等） |
| GET | /api/refunds | 查询退款单列表 |
| GET | /api/refunds/{id} | 查询退款单详情 |
| POST | /api/refunds/{id}/submit | 提交到渠道 |
| POST | /api/refunds/{id}/query | 查询渠道状态 |
| POST | /api/refunds/{id}/review | 人工复核 |
| POST | /api/refunds/{id}/archive | 归档回执 |
| POST | /api/refunds/{id}/fix | 修复脏数据 |

### 4.4 日志与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/logs?limit=100 | 查询操作日志 |
| GET | /api/export/refunds?startDate=xxx&endDate=xxx | 导出退款数据 |
| GET | /api/export/logs?startDate=xxx&endDate=xxx | 导出日志数据 |

## 五、前端控制台使用指南

### 5.1 仪表盘
- 查看服务运行状态
- 查看退款单统计（总数、处理中、待复核）
- 快速操作指南

### 5.2 退款单管理
- 多条件搜索：退款单号、支付单号、状态、渠道
- 列表展示所有退款单
- 操作按钮根据当前状态动态显示
- 点击"详情"查看完整信息，包含：
  - 基本信息
  - 渠道交互记录
  - 人工复核记录
  - 操作日志
  - 归档回执

### 5.3 操作日志
- 按时间倒序展示所有操作
- 显示每个操作的责任节点（responsibility_node）
- 记录完整的请求和响应数据
- 用于审计和问题排查

### 5.4 测试工具
- 创建模拟支付单
- 创建退款单
- 重复创建测试幂等
- 控制台实时输出操作结果

## 六、操作流程示例

### 标准退款流程
```
1. 创建支付单 (TEST_001, ¥99.99, alipay)
2. 创建退款单 → pending
3. 提交渠道 → (随机) processing/success/failed
   - 若 processing → 点击"查询渠道"再次确认
   - 若 failed → 重试提交 (最多3次)
4. 3次失败 → need_review
5. 人工复核 → manual_success / manual_failed
6. 归档 → archived
```

### 幂等测试流程
```
1. 创建支付单
2. 创建退款单 A → 成功
3. 再次点击创建退款（相同支付单号）→ 幂等命中，返回A
4. 查看日志，有 duplicate_create 记录
```

### 脏数据修复流程
```
1. 创建一个退款单并提交，假设卡在 processing
2. 点击"修复数据"
3. 输入目标状态: pending
4. 输入原因: "渠道超时，重置重试"
5. 状态重置为 pending，retry_count 不变
6. 可再次提交渠道
```

## 七、启动方式

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问地址
# 控制台: http://localhost:3001
# API:     http://localhost:3001/api
```

## 八、注意事项

1. **数据持久化**：SQLite 数据库文件保存在 data/refund.db，刷新页面不丢失
2. **渠道模拟**：返回结果是随机的，用于演示各种异常场景
3. **最大重试**：默认3次，可在数据库修改 max_retries 字段
4. **责任节点**：每个操作都有 responsibility_node，便于快速定位问题代码位置
