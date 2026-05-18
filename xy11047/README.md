# 短租公寓前台押金扣项系统

一个完整的短租公寓押金扣项管理 API 系统，支持状态流转、冲突检测、操作追溯等功能。

## 功能特性

### 1. 状态流转管理
- **完整的状态流转规则**：草稿 → 已提交 → 审核中 → 已通过 → 已执行
- **角色权限控制**：前台、主管、经理、收银各有不同权限
- **可测试的动作验证**：每个状态转换都有明确的允许/拒绝规则

### 2. 冲突检测系统
- **续住/退房重叠检测**：同一订单不能同时有续住和退房扣项
- **押金金额校验**：扣款金额不能超过剩余可用押金
- **明细计算验证**：扣项明细总金额必须与申请金额一致
- **重复提交检测**：同一订单不能同时存在同类型的有效扣项

### 3. 审计追溯
- **提交来源记录**：前台电脑、移动应用、微信小程序、后台管理
- **操作时间戳**：精确记录每个操作的时间
- **操作者信息**：完整记录操作人身份
- **状态变更历史**：完整的状态流转日志

### 4. 真实业务字段
- 订单信息：订单号、客人姓名、房间号、房型、入住/退房日期
- 押金信息：押金总额、已使用金额、剩余可用金额
- 扣项明细：项目编码、项目名称、数量、单价、金额、备注
- 申请信息：申请人、申请时间、审核人、审核时间、执行时间

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化测试数据

```bash
npm run init
```

这将创建：
- 3个测试订单（张三-806房、李四-1208房、王五-1503房）
- 预置的冲突测试数据（李四订单已有退房扣项）

### 3. 运行测试

**测试正常流程**（完整的创建→提交→审核→扣款流程）：
```bash
npm run test:normal
```

**测试冲突场景**（4种冲突检测验证）：
```bash
npm run test:conflict
```

**运行所有测试**：
```bash
npm run test:all
```

### 4. 启动服务

```bash
npm run dev
```

访问 http://localhost:3000 查看演示页面。

## 项目结构

```
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── config/
│   │   └── constants.ts      # 常量配置
│   ├── store/
│   │   └── database.ts       # 数据存储层
│   ├── services/
│   │   ├── state-machine.service.ts    # 状态机服务
│   │   ├── conflict-detector.service.ts # 冲突检测服务
│   │   └── deduction.service.ts        # 扣项业务服务
│   ├── routes/
│   │   ├── deduction.routes.ts         # 扣项API路由
│   │   ├── order.routes.ts             # 订单API路由
│   │   └── state-machine.routes.ts     # 状态机API路由
│   ├── scripts/
│   │   └── init.ts           # 初始化脚本
│   ├── test/
│   │   ├── normal-flow.test.ts      # 正常流程测试
│   │   └── conflict-flow.test.ts    # 冲突场景测试
│   └── public/
│       └── index.html        # 演示页面
├── data/                     # 数据文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## API 接口

### 押金扣项接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/deductions | 创建押金扣项申请 |
| GET | /api/deductions | 查询所有扣项申请 |
| GET | /api/deductions/:id | 查询单个扣项详情 |
| POST | /api/deductions/action | 执行状态转换操作 |
| GET | /api/deductions/:id/audit-logs | 查询扣项操作日志 |
| GET | /api/deductions/:id/available-actions | 查询可用操作 |

### 订单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/orders | 查询所有订单 |
| GET | /api/orders/:id | 查询单个订单详情 |

### 状态机接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/state-machine/transitions | 查询所有状态转换规则 |
| POST | /api/state-machine/can-perform | 验证是否可以执行某个动作 |

## 状态流转图

```
DRAFT (草稿)
   ↓ SUBMIT (前台/经理)
SUBMITTED (已提交)
   ↓ START_REVIEW (主管/经理)
REVIEWING (审核中)
   ↓ APPROVE (主管/经理)
APPROVED (已通过)
   ↓ EXECUTE (收银/经理)
EXECUTED (已执行)

同时支持：
DRAFT → CANCELLED (取消草稿)
SUBMITTED → CANCELLED (撤回申请)
REVIEWING → REJECTED (审核驳回)
REJECTED → DRAFT (修改后重新提交)
APPROVED → CANCELLED (经理取消审批)
```

## 角色权限说明

| 角色 | 权限说明 |
|------|----------|
| **FRONT_DESK 前台员工** | 创建草稿、提交申请、撤回申请、取消草稿、修改驳回后的申请 |
| **SUPERVISOR 主管** | 开始审核、审核通过、审核驳回 |
| **MANAGER 经理** | 拥有所有权限 |
| **CASHIER 收银** | 执行扣款操作 |

## 冲突检测说明

### 1. 续住/退房重叠冲突
- **场景**：同一订单同时存在退房扣项和续住补扣申请
- **检测点**：提交申请时自动检测
- **处理方式**：拒绝提交，提示先处理现有申请

### 2. 押金金额不足冲突
- **场景**：申请扣款金额超过订单剩余可用押金
- **检测点**：提交申请时自动检测
- **处理方式**：拒绝提交，显示金额差额

### 3. 扣项明细计算错误
- **场景**：扣项明细的计算总金额与申请总金额不符
- **检测点**：提交申请时自动检测
- **处理方式**：拒绝提交，提示具体哪一项有问题

### 4. 同类型重复提交冲突
- **场景**：同一订单存在同类型的未完成扣项申请
- **检测点**：提交申请时自动检测
- **处理方式**：拒绝提交，提示冲突的申请编号

## 测试场景说明

### 正常流程测试
1. 使用张三-806房订单创建扣项草稿
2. 前台员工提交申请 → 状态变为 SUBMITTED
3. 主管开始审核 → 状态变为 REVIEWING
4. 主管审核通过 → 状态变为 APPROVED
5. 收银执行扣款 → 状态变为 EXECUTED
6. 验证订单押金已更新
7. 查看完整的审计日志

### 冲突场景测试
1. **续住/退房重叠冲突**：李四-1208房已存在退房扣项，尝试提交续住扣项
2. **押金金额不足冲突**：王五-1503房剩余押金50元，尝试提交100元扣款
3. **扣项明细计算错误**：手动修改总金额，验证检测功能
4. **同类型重复提交冲突**：同一订单再次提交相同类型的扣项

## 数据字段说明

### 订单 (Order)
- `orderNo`: 订单编号 (如 ORD202401150001)
- `orderType`: 订单类型 (NORMAL 正常入住 / EXTEND 续住)
- `guestName`: 客人姓名
- `guestPhone`: 客人电话
- `roomNo`: 房间号
- `roomType`: 房型
- `checkInDate`: 入住日期
- `checkOutDate`: 退房日期
- `depositAmount`: 押金总额
- `usedDepositAmount`: 已使用押金
- `status`: 订单状态

### 押金扣项 (DepositDeduction)
- `deductionNo`: 扣项编号 (如 DK202401150001)
- `deductionType`: 扣款类型 (CHECK_OUT/EXTEND_STAY/DAMAGE/CLEANING/OTHER)
- `status`: 状态 (DRAFT/SUBMITTED/REVIEWING/APPROVED/REJECTED/EXECUTED/CANCELLED)
- `totalDeductionAmount`: 扣款总金额
- `items`: 扣项明细列表
- `applicantId/applicantName`: 申请人ID/姓名
- `submitSource`: 提交来源
- `reviewerId/reviewerName`: 审核人ID/姓名
- `executorId/executorName`: 执行人ID/姓名
- `conflictDetected`: 是否检测到冲突
- `conflictDetails`: 冲突详情

### 审计日志 (AuditLog)
- `action`: 操作动作
- `fromStatus`: 源状态
- `toStatus`: 目标状态
- `operatorId/operatorName`: 操作人ID/姓名
- `submitSource`: 提交来源
- `operateTime`: 操作时间
- `remark`: 备注

## 演示页面功能

访问 http://localhost:3000 可以看到：

1. **订单列表**：查看所有订单及其押金情况
2. **押金扣项管理**：查看和创建扣项申请
3. **状态流转演示**：
   - 选择不同角色
   - 可视化查看当前状态位置
   - 执行可用的状态转换
   - 实时查看冲突提示
   - 查看完整的操作日志
4. **系统配置**：查看角色权限、状态流转规则、冲突检测规则

## 技术栈

- **运行时**：Node.js
- **框架**：Express.js
- **语言**：TypeScript
- **数据存储**：JSON 文件
- **前端**：原生 HTML + JavaScript

## License

MIT