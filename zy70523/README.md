# 公网出口备案API

将公网出口申请、使用和关闭全流程追溯系统

## 项目概述

本系统旨在解决临时开公网出口后经常忘记关的问题，提供完整的备案流程管理，特别关注异常路径的追溯能力。

## 核心特性

### 数据模型
- **服务名称 (serviceName): 申请开放公网出口的服务
- **出口地址 (egressAddress): 需要开放的公网出口地址
- **开放窗口 (openWindow): 开始/结束时间，时区
- **访问目的 (purpose): 开放公网出口的原因
- **关闭条件 (closeCondition): 手动/自动/超时关闭方式
- **备案报告 (report): 完整流程审计报告

### 状态定义
- `pending`: 待处理
- `confirmed`: 已确认开放
- `blocked`: 被拦截
- `revoked`: 已撤销
- `compensated`: 已补偿
- `closed`: 已关闭
- `expired`: 已过期

## 关键业务规则

1. **开放审批**: 所有备案申请需审批通过才能确认开放
2. **窗口到期**: 自动检查并自动关闭已到期的备案
3. **访问记录**: 记录所有通过备案的访问日志
4. **关闭确认**: 备案关闭需记录关闭人和原因
5. **备案导出**: 支持生成完整报告和CSV导出

## 异常路径追溯

每次异常都保留：
- 原始输入 (originalInput)
- 处理依据 (processingBasis)
- 最终结论 (conclusion)
- 错误代码/信息
- 操作人

## API接口

| 方法 | 路径 | 说明
|------|------|------
POST | /api/filings | 创建备案
GET | /api/filings | 查询备案列表
GET | /api/filings/:id | 查询单个备案详情
POST | /api/filings/:id/advance-status | 推进状态
POST | /api/filings/:id/approve | 审批通过
POST | /api/filings/:id/reject | 审批拒绝
POST | /api/filings/:id/exceptions | 记录异常
GET | /api/filings/:id/exceptions | 查询异常记录
POST | /api/filings/:id/manual-correction | 人工修正
POST | /api/filings/:id/close | 关闭备案
GET | /api/filings/:id/report | 生成备案报告
GET | /api/filings/:id/export | 导出CSV
POST | /api/filings/check-expired | 检查到期窗口

## 项目结构

src/
├── types/           # 类型定义
├── database/         # 数据库层
├── services/         # 业务服务层
│   ├── StateMachineService.ts   # 状态机服务
│   └── FilingService.ts         # 备案业务服务
├── routes/           # API路由层
└── server.ts         # 服务入口

## 快速开始

### 安装依赖
npm install

### 运行测试
npx ts-node scripts/test-flow.ts

### 启动服务
npm run dev

### 构建
npm run build
npm start

## 使用示例

### 创建备案
curl -X POST http://localhost:3000/api/filings \
-H "Content-Type: application/json" \
-d '{
"serviceName": "order-service",
"egressAddress": "https://api.external.com",
"openWindow": {
"startTime": "2024-01-01T00:00:00Z",
"endTime": "2024-01-02T00:00:00Z"
},
"purpose": "对接第三方支付接口",
"closeCondition": {
"type": "manual"
},
"creator": "zhangsan"
}'

### 审批通过
curl -X POST http://localhost:3000/api/filings/{id}/approve \
-H "Content-Type: application/json" \
-d '{"approver": "security-admin"}'

### 记录异常
curl -X POST http://localhost:3000/api/filings/{id}/exceptions \
-H "Content-Type: application/json" \
-d '{
"step": "security_check",
"originalInput": {"serviceName": "order-service", "egressAddress": "..."},
"processingBasis": "根据安全策略第3.2条",
"conclusion": "检测到异常访问，已记录审计日志"
}'

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite
- Joi (参数验证
- dayjs (日期处理)
- json2csv (CSV导出)

## 数据库表结构

1. **filing_records**: 备案主表
2. **status_history**: 状态变更历史
3. **exception_traces**: 异常追溯记录
4. **access_logs**: 访问日志
5. **manual_corrections**: 人工修正记录
