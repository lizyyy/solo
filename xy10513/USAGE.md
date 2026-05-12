# 会员积分过期 API 使用指南

## 项目概述

本系统提供完整的会员积分管理 API，解决了运营中积分可追溯的问题。每笔积分发放都有独立的批次和有效期，消费时按"先到期先抵扣"原则，支持冻结、退款回原批次、过期回收等功能，所有操作都有完整的账本记录。

## 核心功能

| 功能 | 说明 |
|------|------|
| 批次管理 | 积分按批次发放，每批有独立的有效期 |
| FIFO抵扣 | 消费时优先抵扣最早到期的批次 |
| 冻结功能 | 风控冻结后不可消费 |
| 退款回原批次 | 退款精确退回原消费批次 |
| 过期回收 | 定时任务回收已过期批次 |
| 幂等性 | 重复执行不重复操作 |
| 人工修正 | 留痕、记录前后差异和操作者 |
| 完整账本 | 所有操作可追溯 |

## 快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10513
npm install
```

### 2. 启动服务

```bash
npm start
```

服务地址: http://localhost:3001

### 3. 健康检查

```bash
curl http://localhost:3001/health
```

## 演示数据

系统启动时自动加载演示数据：

### DEMO001 - 张三（黄金会员）
- 5个批次，总共 7300 积分
- 包含已过期批次（演示过期回收）
- 即将过期批次（演示过期提醒）

| 批次 | 来源 | 金额 | 有效期 | 状态 |
|------|------|------|--------|------|
| 批次1 | 注册奖励 | 1000 | 已过期 | 待过期回收 |
| 批次2 | 消费返利 | 500 | 今日到期 | 今日过期 |
| 批次3 | 生日礼遇 | 2000 | 一年后 | 正常 |
| 批次4 | 活动奖励 | 800 | 15天后 | 即将过期 |
| 批次5 | 周年庆 | 3000 | 半年后 | 正常 |

### DEMO002 - 李四（普通会员）
- 2个批次，总共 2000 积分
- 1个已过期，1个正常

## API 接口说明

### 会员管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/members | 获取所有会员列表 |
| GET | /api/members/:memberId | 获取单个会员信息 |
| GET | /api/members/:memberId/summary | 获取会员详细摘要 |
| POST | /api/members | 创建新会员 |

### 积分批次

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/issue | 发放积分 |
| GET | /api/batches/member/:memberId | 获取会员所有批次 |
| GET | /api/batches/:batchId/member/:memberId | 获取批次详情 |
| GET | /api/batches/expiring-soon/:memberId | 即将过期批次 |

### 冻结/解冻

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/freeze | 冻结积分 |
| POST | /api/freeze/:freezeId/unfreeze | 解冻积分 |

### 消费/退款

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/consume | 消费抵扣 |
| POST | /api/refund | 订单退款 |

### 过期处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/expire/process | 执行过期回收任务 |

### 账本查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ledger/:memberId | 查询账本记录 |

### 人工修正

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/adjust | 人工修正积分 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/member/:memberId | 会员报告 (JSON/CSV) |
| GET | /api/reports/all | 所有会员报告 (JSON/CSV) |

## 主要演示路径

### 运行完整演示：

```bash
./demo.sh
```

### 演示步骤：

**步骤 1**: 获取会员信息和初始余额
- 查看当前可用余额、冻结余额
- 确认初始状态

**步骤 2**: 获取所有积分批次（按到期时间排序）
- 展示 FIFO 顺序
- 查看每批的有效期

**步骤 3**: 查看即将过期积分（30天内）
- 运营提醒的基础数据
- 可用于短信提醒功能

**步骤 4**: 消费积分 800（FIFO 先到期先抵扣）
- 按 expire_date 从小到大抵扣
- 记录消费批次明细

**步骤 5**: 消费后余额变化
- 可用余额减少
- 已消费增加

**步骤 6**: 冻结积分 500
- 风控审查场景
- 从可用余额转入冻结

**步骤 7**: 冻结后余额（可用减少，冻结增加）
- 可用余额：-500
- 冻结余额：+500

**步骤 8**: 退款 300（退回原批次）
- 精确退回原消费批次
- 不打乱有效期

**步骤 9**: 退款后余额
- 可用余额恢复

**步骤 10**: 解冻积分
- 冻结余额转回可用

**步骤 11**: 执行过期任务（今日）
- 回收已过期批次
- 记录过期明细

**步骤 12**: 过期后余额
- 可用余额减少
- 已过期增加

**步骤 13**: 幂等性测试 - 重复执行过期任务
- 同一日期只执行一次
- 返回幂等结果

**步骤 14**: 查询账本记录
- 完整的操作历史
- 每笔变更都可追溯

**步骤 15**: 导出会员报告
- 完整的会员积分报告

**步骤 16**: 人工修正（留痕演示）
- 记录操作者
- 记录前后差异
- 记录原因

**步骤 17**: 最终余额和完整报告
- 确认业务闭环

## 异常处理路径

### 运行异常演示：

```bash
./demo-fail.sh
```

### 异常场景：

| 场景 | 错误码 | 说明 |
|------|--------|------|
| 消费超过可用余额 | INSUFFICIENT_BALANCE | 可用积分不足 |
| 冻结超过可用余额 | INSUFFICIENT_BALANCE | 可用积分不足 |
| 退款不存在的订单 | ORDER_NOT_FOUND | 找不到消费订单 |
| 退款超过已消费金额 | REFUND_EXCEEDED | 可退积分不足 |
| 解冻不存在记录 | FREEZE_NOT_FOUND | 冻结记录不存在 |
| 人工修正负数 | INVALID_POINTS | 可用积分不能为负 |
| 查询不存在会员 | MEMBER_NOT_FOUND | 会员不存在 |

## 核心规则

### 先到期先抵扣 (FIFO)

消费时按 `expire_date` 从小到大抵扣，保证最早到期批次优先消费。

示例：
- 批次A：1000分，2026-04-12到期
- 批次B：500分，2026-05-12到期

消费 800 分时：
- 先抵扣批次A的 800 分
- 批次A剩余 200 分
- 批次B保持 500 分

### 冻结不可消费

冻结状态积分不计入可用余额。

示例：
- 可用余额：1000
- 冻结余额：500

消费时只能使用 1000 可用积分。

### 订单退款回原批次

退款精确退回原消费批次，不会打乱原有批次的有效期。

示例：
- 消费时抵扣：批次A 800 分
- 退款 300 分时：
  - 退回批次A 300 分
  - 批次A恢复为 500 分
  - 有效期保持不变

### 幂等性

- 使用 `X-Idempotent-Key` 头保证重复调用只执行一次
- 过期任务按日期幂等，同一天重复执行只处理一次

### 人工修正

- 记录操作者
- 记录前后差异
- 记录原因
- 账本记录可追溯

## 报告说明

### 报告包含：

- 可用余额
- 冻结余额
- 已消费积分
- 已过期积分
- 即将过期批次
- 完整账本记录

### 导出 CSV：

```bash
# 单个会员报告
curl -o report.csv "http://localhost:3001/api/reports/member/DEMO001?format=csv"

# 所有会员报告
curl -o all_report.csv "http://localhost:3001/api/reports/all?format=csv"
```

## 数据模型

### 积分批次字段

| 字段 | 说明 |
|------|------|
| batch_id | 批次ID |
| member_id | 会员ID |
| total_points | 总积分 |
| available_points | 可用积分 |
| frozen_points | 冻结积分 |
| consumed_points | 已消费 |
| expired_points | 已过期 |
| expire_date | 过期日期 |
| status | 状态 (active/expired) |

### 账本记录

所有变更都会记录：

| 字段 | 说明 |
|------|------|
| transaction_type | 类型 (issue/consume/refund/freeze/unfreeze/expire/adjust) |
| balance_before | 变更前余额 |
| balance_after | 变更后余额 |
| operator | 操作者 |
| description | 说明 |

## 使用示例

### 发放积分

```bash
curl -X POST http://localhost:3001/api/batches/issue \
  -H "Content-Type: application/json" \
  -H "X-Idempotent-Key: issue_001" \
  -d '{
    "memberId": "DEMO001",
    "points": 1000,
    "sourceType": "活动奖励",
    "sourceRef": "PROMO_001",
    "expireDate": "2026-12-31"
  }'
```

### 消费积分

```bash
curl -X POST http://localhost:3001/api/consume \
  -H "Content-Type: application/json" \
  -H "X-Idempotent-Key: consume_001" \
  -d '{
    "memberId": "DEMO001",
    "points": 500,
    "orderNo": "ORDER_001",
    "description": "商品抵扣"
  }'
```

### 执行过期任务

```bash
curl -X POST http://localhost:3001/api/expire/process \
  -H "Content-Type: application/json" \
  -d '{
    "executeDate": "2026-05-12"
  }'
```

## 注意事项

1. **数据存储**：内存存储，重启后数据重置（演示用）
2. **服务端口**：默认 3001
3. **演示数据**：每次启动会自动加载
4. **重置数据**：重启服务即可

## 业务闭环验证

运行完整演示后，验证：

✅ 可用余额 + 冻结余额 + 已消费 + 已过期 = 总发放  
✅ 每笔消费可追溯到具体批次  
✅ 退款精确退回原批次  
✅ 过期批次状态正确  
✅ 账本记录完整  
✅ 幂等性保证  

## 技术栈

- Node.js 18+
- Express 4.x
- sql.js (纯 JavaScript SQLite)
- 无需数据库服务器

## 支持的环境

- macOS / Linux / Windows
- Node.js 18.0 及以上
