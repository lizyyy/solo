# 配额发放后端服务

## 项目概述

这是一个企业级配额发放管理系统，支持多版本规则控制、离线合同补充页管理、临时白名单复核、以及完整的报告生成和支付回执管理功能。

## 启动方式

### 前置要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化演示数据

```bash
npm run seed
```

### 启动开发服务器

```bash
npm run dev
```

### 生产环境部署

```bash
npm run build
npm start
```

服务将在 http://localhost:3000 启动

## 样例来源

### 部门数据 (贴近真实场景)

| 部门名称 | 部门编码 |
|---------|---------|
| 金融科技部 | FIN-TECH-001 |
| 零售业务部 | RETAIL-002 |
| 公司业务部 | CORP-003 |
| 风险管理部 | RISK-004 |
| 运营管理部 | OPS-005 |

### 规则版本设计

| 版本 | 生效日期 | 规则描述 |
|------|---------|---------|
| v1.0.0 | 2024-01-01 | 基础配额算法，按部门历史发放记录加权 |
| v1.1.0 | 2024-03-15 | 增加临时白名单权重系数1.2倍 |
| v2.0.0 | 2024-06-01 | 引入合同补充页作为审批依据，加成15% |

### 离线合同补充页样例

**合同编号**: HT-2024-JRKJ-001 (补-003)
**内容**: 关于2024年度金融科技部系统升级项目专项配额补充协议。经双方协商，同意在原合同基础上增加专项配额500万元，用于核心系统分布式改造。

### 临时白名单复核专用记录

风险管理部保留一条专门用于复核测试的未撤销白名单记录，用于验证复核流程。

## 主流程说明

### 1. 配额发放流程

```
部门提交申请 → 根据规则版本计算配额 → 校验限额 → 执行发放
     ↓
成功路径: 记录发放明细 → 可生成报告 → 可关联支付回执
失败路径: 记录错误原因 → 同一查询入口可查
```

### 2. 配额发放API调用示例

**成功路径示例**:

```bash
curl -X POST http://localhost:3000/api/quota/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "金融科技部ID",
    "ruleVersion": "v2.0.0",
    "requestedAmount": 3000000
  }'
```

**返回结果** (金融科技部有200万白名单额度 + 合同补充页加成):
- 计算过程: 300万(基础) + 200万 × 1.2(白名单) = 540万 → × 1.15(合同) = 621万
```json
{
  "success": true,
  "data": {
    "batchId": "xxx",
    "beforeQuota": 0,
    "afterQuota": 6210000,
    "changeAmount": 6210000,
    "executionDuration": 45
  }
}
```

### 3. 报告生成流程

```
发放完成 → 调用报告生成接口 → 生成包含以下内容的报告:
  - 处理前后对比
  - 执行时间
  - 下一步建议
```

### 4. 统一查询入口

```bash
# 查询所有记录
curl http://localhost:3000/api/quota/records

# 按状态筛选
curl http://localhost:3000/api/quota/records?status=completed
curl http://localhost:3000/api/quota/records?status=failed

# 按部门筛选
curl http://localhost:3000/api/quota/records?departmentId=xxx

# 按批次查询
curl http://localhost:3000/api/quota/records?batchId=xxx
```

## 失败路径示例

### 场景1: 规则版本不存在

**请求**:
```json
{
  "departmentId": "xxx",
  "ruleVersion": "v999.0.0",
  "requestedAmount": 1000000
}
```

**返回**:
```json
{
  "success": false,
  "data": {
    "errorMessage": "规则版本 v999.0.0 不存在",
    "executionDuration": 12
  }
}
```

### 场景2: 超过最大限额

**请求**:
```json
{
  "departmentId": "xxx",
  "ruleVersion": "v2.0.0",
  "requestedAmount": 9000000
}
```

**(计算后超过1000万限额)**

**返回**:
```json
{
  "success": false,
  "data": {
    "errorMessage": "配额超过最大限额1000万，请拆分申请",
    "executionDuration": 28
  }
}
```

## 规则版本说明

系统支持多版本规则并存，旧批次记录会保留当时使用的规则版本号，便于追溯和审计。

| 版本 | 白名单权重 | 合同补充页加成 | 适用场景 |
|------|-----------|---------------|---------|
| v1.0.0 | 无 | 无 | 基础配额 |
| v1.1.0 | 1.2倍 | 无 | 引入白名单机制 |
| v2.0.0 | 1.2倍 | 1.15倍 | 完整审批流程 |

## 支付回执人工备注功能

### 上传回执

```bash
curl -X POST http://localhost:3000/api/quota/payment/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "批次ID",
    "channelCode": "ALIPAY-001",
    "transactionId": "TXN-20240515-0001",
    "amount": 5000000,
    "manualRemark": "金融科技部首季度配额款，已核对发票编号FP-2024-0588",
    "callerId": "FIN-USER-001"
  }'
```

### 按调用方查询

```bash
curl http://localhost:3000/api/quota/payment/receipts?callerId=FIN-USER-001
```

## 白名单复核

查看所有未撤销的白名单记录:

```bash
curl http://localhost:3000/api/quota/whitelist/review
```

## API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/quota/allocate | 配额发放 |
| GET | /api/quota/records | 统一查询入口 |
| GET | /api/quota/whitelist/review | 白名单复核 |
| POST | /api/quota/report/generate | 生成报告 |
| GET | /api/quota/reports | 报告列表 |
| GET | /api/quota/report/:id | 报告详情 |
| POST | /api/quota/payment/receipt | 上传支付回执 |
| GET | /api/quota/payment/receipts | 查询回执 |
| GET | /api/quota/departments | 部门列表 |
| GET | /api/quota/rules | 规则版本列表 |
| GET | /api/quota/contracts | 合同补充页列表 |

## 数据库表结构

- `rule_versions`: 规则版本表
- `departments`: 部门表
- `offline_contracts`: 离线合同补充页表
- `temporary_whitelist`: 临时白名单表
- `quota_batches`: 配额批发表
- `allocation_records`: 发放记录表
- `payment_receipts`: 支付回执表(含manual_remark字段)
- `reports`: 报告表

## 注意事项

1. 同一查询入口可以同时查询成功和失败记录，便于统一审计
2. 旧批次会保留规则版本号，即使规则变更，仍可追溯当时的计算口径
3. 支付回执人工备注支持按调用方查询，满足审计需求
