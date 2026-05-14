# 售后退款状态机管理系统

完整的全栈售后退款状态机管理系统，包含后端服务和前端管理界面。

## 功能特性

### 后端功能
- 完整的售后订单状态机流转
- 质检流程管理（质检中 → 通过/不通过）
- 退款流程管理（退款中 → 成功/失败）
- 补偿券发放流程
- 拒绝原因复核流程
- 幂等性保证（重复调用不重复写入）
- 失败重试限制（最多3次重试）
- 补偿券失败修正路径
- 售后账本导出（Excel格式）

### 前端功能
- 数据看板（统计卡片 + 状态分布图）
- 售后订单列表
- 订单详情时间线展示
- 质检处理抽屉
- 复核处理抽屉
- 补偿券修正抽屉
- 状态流转操作按钮

## 技术栈

### 后端
- Node.js + TypeScript
- Express
- SQLite + Sequelize ORM
- XLSX (Excel导出)

### 前端
- React 18 + TypeScript
- Ant Design 5
- ECharts (图表)
- Vite

## 快速开始

### 启动后端服务

```bash
cd backend
npm install
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 状态流转图

```
CREATED(已创建)
    ↓
QA_IN_PROGRESS(质检中)
    ↓
    ├─→ QA_PASSED(质检通过) ──→ REFUND_IN_PROGRESS(退款中)
    │                            ↓
    │                            ├─→ REFUND_SUCCESS(退款成功) ──→ CLOSED(已关闭)
    │                            └─→ REFUND_FAILED(退款失败) ──→ COMPENSATION_IN_PROGRESS(补偿券发放中)
    │                                                                 ↓
    │                                                                 ├─→ COMPENSATION_SUCCESS(发放成功) ──→ CLOSED
    │                                                                 └─→ COMPENSATION_FAILED(发放失败) ──→ CORRECT(修正) ──→ REVIEW_PENDING
    │
    └─→ QA_FAILED(质检不通过) ──→ REVIEW_PENDING(待复核)
                                      ↓
                                      ├─→ REVIEW_APPROVED(复核通过) ──→ 继续退款/补偿券流程
                                      └─→ REVIEW_REJECTED(复核驳回) ──→ CLOSED
```

## 验收操作指南

1. **页面操作流程**
   - 创建售后订单
   - 开始质检 → 提交质检结果
   - 开始退款 → 标记成功/失败
   - 发放补偿券 → 标记成功/失败
   - 查看详情时间线

2. **幂等性测试**
   - 使用相同的 `idempotencyKey` 重复调用创建订单接口
   - 验证不会重复创建订单，只会返回已有数据

3. **补偿券修正路径**
   - 将补偿券标记为发放失败
   - 点击"修正补偿券"
   - 填写修正原因和新金额
   - 进入复核流程重新处理

4. **导出账本**
   - 点击"导出售后账本"按钮
   - 下载Excel文件查看所有操作记录

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/after-sales/orders | 创建售后订单 |
| GET | /api/after-sales/orders | 获取订单列表 |
| GET | /api/after-sales/orders/:id | 获取订单详情 |
| POST | /api/after-sales/orders/:id/start-qa | 开始质检 |
| POST | /api/after-sales/orders/:id/submit-qa | 提交质检结果 |
| POST | /api/after-sales/orders/:id/start-refund | 开始退款 |
| POST | /api/after-sales/orders/:id/process-refund | 处理退款结果 |
| POST | /api/after-sales/orders/:id/start-compensation | 开始发放补偿券 |
| POST | /api/after-sales/orders/:id/process-compensation | 处理补偿券结果 |
| POST | /api/after-sales/orders/:id/correct-compensation | 修正补偿券 |
| POST | /api/after-sales/orders/:id/review | 复核拒绝原因 |
| POST | /api/after-sales/orders/:id/close | 关闭订单 |
| POST | /api/after-sales/orders/:id/recalculate | 重新计算状态 |
| GET | /api/after-sales/statistics | 获取统计数据 |
| GET | /api/after-sales/ledger/export | 导出售后账本 |