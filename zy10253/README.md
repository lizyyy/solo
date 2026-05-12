# 教培退费分期 API

一个完整的教培机构退费管理系统，支持合同管理、排课消课、分期付款、退费试算、审批流程和历史记录。

## 功能特性

### 核心功能
- ✅ **合同管理**: 支持创建和查询合同，包含付费课时、赠课、教材费、分期手续费等
- ✅ **排课消课**: 课程排课和签到记录，区分付费课和赠课
- ✅ **分期付款**: 多期分期管理，支持跟踪付款状态
- ✅ **退费试算**: 智能计算退款金额，支持多种场景
- ✅ **审批流程**: 退费申请提交、审批、撤销全流程管理
- ✅ **历史记录**: 完整的业务操作历史和审批轨迹

### 业务规则处理
1. **赠课区分**: 赠课和付费课分别计算，不退费但计入已上课时
2. **分期手续费**: 未付清分期的手续费不予退还
3. **教材费**: 支持教材费全额退还或扣除逻辑
4. **重复提交防护**: 同一合同待审批期间不允许重复提交退费申请
5. **审批修改防护**: 已审批退费不能重复修改

## 技术栈
- Node.js + TypeScript
- Express.js (Web框架)
- SQLite (数据库)
- uuid (唯一标识)

## 快速开始

### 安装依赖
```bash
npm install
```

### 构建项目
```bash
npm run build
```

### 初始化种子数据
```bash
npm run seed
```

### 启动服务

**开发模式** (ts-node 直接运行，不需要先构建)
```bash
npm run dev
```

**生产模式** (运行编译后的 JS 产物，需要先执行 build)
```bash
npm run build
npm start
```

服务运行在: http://localhost:3000

## API 接口文档

### 合同接口

| 方法 | 路径 | 说明 |
|------|------|------|
| **POST** | /api/contracts | 创建合同 |
| **GET** | /api/contracts/:id | 查询合同详情 |
| **GET** | /api/contracts/no/:contractNo | 按合同编号查询 |
| **PUT** | /api/contracts/:id | 更新合同信息 |

### 排课接口

| 方法 | 路径 | 说明 |
|------|------|------|
| **POST** | /api/contracts/:id/schedules | 创建排课 |
| **GET** | /api/contracts/:id/schedules | 查询排课记录 |
| **PUT** | /api/contracts/schedules/:scheduleId/status | 更新排课状态 |

### 消课接口

| 方法 | 路径 | 说明 |
|------|------|------|
| **POST** | /api/contracts/:id/attendances | 签到消课 |
| **GET** | /api/contracts/:id/attendances | 查询消课记录 |

### 分期接口

| 方法 | 路径 | 说明 |
|------|------|------|
| **POST** | /api/contracts/:id/installments | 创建分期计划 |
| **GET** | /api/contracts/:id/installments | 查询分期记录 |
| **POST** | /api/contracts/installments/:installmentId/pay | 分期支付 |

### 退费接口

| 方法 | 路径 | 说明 |
|------|------|------|
| **GET** | /api/refunds/calculate/:contractId | 退费试算 |
| **POST** | /api/refunds | 提交退费申请 |
| **POST** | /api/refunds/:id/approve | 审批退费 |
| **POST** | /api/refunds/:id/cancel | 撤销退费 |
| **GET** | /api/refunds/:id | 查询退费详情（含扣款项和审批历史）|
| **GET** | /api/refunds/contract/:contractId | 查询合同的所有退费申请 |

### 健康检查
```
GET /health
```

## 业务闭环流程示例

```
1. 创建合同
   POST /api/contracts
   
2. 创建分期计划
   POST /api/contracts/:id/installments
   
3. 支付分期
   POST /api/contracts/installments/:installmentId/pay
   
4. 创建排课
   POST /api/contracts/:id/schedules
   
5. 签到消课
   POST /api/contracts/:id/attendances
   
6. 退费试算
   GET /api/refunds/calculate/:contractId
   
7. 提交退费申请
   POST /api/refunds
   
8. 审批退费
   POST /api/refunds/:id/approve
```

## 退费试算示例

### 【方案1】分期未付清情况
- **学生**: 张三 (CONT001)
- **合同情况**: 总课时52节（48节付费+4节赠课）
- **已上课时**: 付费课8节 + 赠课2节
- **分期情况**: 3期已付2期，第3期未付

**计算结果**:
```
应退总额: 5300元
实际退款: 5200元
扣款项明细:
  - 已上课时费: 1600元 (已上付费课8节，赠课2节)
  - 教材费返还: 500元 (未使用教材全额退还)
  - 分期手续费: 100元 (未付清分期1期，手续费不予退还)
```

### 【方案2】全额付清情况
- **学生**: 李四 (CONT002)
- **合同情况**: 总课时24节（全部付费，无赠课）
- **已上课时**: 付费课5节
- **分期情况**: 3期全部付清

**计算结果**:
```
应退总额: 6000元
实际退款: 6000元
扣款项明细:
  - 已上课时费: 1500元 (已上付费课5节，赠课0节)
  - 教材费返还: 300元 (未使用教材全额退还)
  - 分期手续费: 0元
```

## 数据库结构

### 主要数据表
1. **contracts**: 合同表
2. **schedules**: 排课表
3. **attendances**: 消课记录表
4. **installments**: 分期付款表
5. **refund_applications**: 退费申请表
6. **refund_items**: 退费扣款项明细表
7. **approval_history**: 审批历史表
8. **business_history**: 业务操作历史表

## 错误处理

系统返回标准化的错误响应：
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_APPLICATION",
    "message": "该合同已有待审批或已批准的退费申请",
    "details": { ... }
  }
}
```

### 主要错误码
- `CONTRACT_NOT_FOUND`: 合同不存在
- `CONTRACT_ALREADY_REFUNDED`: 合同已完成退费
- `REFUND_NOT_FOUND`: 退费申请不存在
- `REFUND_ALREADY_APPROVED`: 退费已审批
- `DUPLICATE_APPLICATION`: 重复提交申请
- `INVALID_STATUS_TRANSITION`: 状态流转不合法

## 项目结构

```
├── src/
│   ├── config/          # 配置文件
│   ├── models/          # 数据模型
│   ├── services/        # 业务逻辑层
│   ├── routes/          # API路由
│   ├── middleware/      # 中间件
│   ├── utils/           # 工具函数
│   ├── scripts/         # 脚本
│   └── types/           # 类型定义
├── data/                # 数据库文件
└── package.json
```
