# 影棚器材借还 API

本地后端 API 服务，用于影棚器材的借用、归还、检查和押金管理。

## 功能特性

- ✅ 器材和配件管理
- ✅ 借用单创建和状态流转
- ✅ 归还检查（划痕、损坏、配件完整性）
- ✅ 押金扣款申请和审批
- ✅ 逾期自动计费
- ✅ 异常路径日志记录
- ✅ 人工修正记录
- ✅ 借还报告生成和 CSV 导出

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite (本地持久化)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 填充样例数据

```bash
npm run seed
```

### 3. 运行自检脚本

```bash
npm test
```

### 4. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

## API 接口

### 基础路径

所有接口前缀: `/api`

### 健康检查

```
GET /api/health
```

### 器材管理

```
GET    /api/equipment              # 查询所有器材
GET    /api/equipment/:id          # 查询单个器材
POST   /api/equipment              # 创建器材
```

### 配件管理

```
GET    /api/accessories            # 查询所有配件
GET    /api/accessories?equipment_id=xxx  # 按器材查询配件
```

### 借用单管理

```
GET    /api/rental-orders          # 查询所有借用单
GET    /api/rental-orders/:id      # 查询单个借用单
GET    /api/rental-orders/:id/accessories  # 查询借用单配件
POST   /api/rental-orders          # 创建借用单
PATCH  /api/rental-orders/:id/status       # 更新状态
```

**创建借用单请求体:**

```json
{
  "equipment_id": "uuid",
  "borrower_name": "张三",
  "borrower_phone": "13800138000",
  "borrower_id": "320101199001011234",
  "expected_start_date": "2024-01-15",
  "expected_end_date": "2024-01-17",
  "deposit_paid": 1000,
  "notes": "备注信息",
  "accessory_ids": ["uuid1", "uuid2"]
}
```

**状态流转:**

```
pending → confirmed → active → returned → completed
```

### 归还检查

```
POST   /api/return-inspections     # 创建归还检查
```

**请求体:**

```json
{
  "rental_order_id": "uuid",
  "inspector_name": "管理员A",
  "has_scratches": true,
  "scratches_description": "镜头边缘轻微划痕",
  "has_damage": false,
  "damage_description": "",
  "accessories_complete": true,
  "accessories_notes": "",
  "overall_condition": "good",
  "conclusion": "轻微划痕，需扣款200元"
}
```

### 押金扣款

```
POST   /api/deposit-deductions     # 创建扣款申请
PATCH  /api/deposit-deductions/:id/approve  # 审批扣款
```

**创建扣款申请:**

```json
{
  "rental_order_id": "uuid",
  "inspection_id": "uuid",
  "amount": 200,
  "reason": "镜头划痕修复费用",
  "requested_by": "管理员A",
  "notes": "根据归还检查记录"
}
```

**审批扣款:**

```json
{
  "approved_by": "主管B",
  "approve": true
}
```

### 人工修正

```
POST   /api/manual-corrections     # 创建人工修正记录
```

**请求体:**

```json
{
  "rental_order_id": "uuid",
  "correction_type": "amount_adjustment",
  "field_name": "deposit_paid",
  "old_value": "1000",
  "new_value": "1200",
  "reason": "客户额外支付押金200元",
  "corrected_by": "管理员A"
}
```

### 报告导出

```
GET    /api/rental-orders/:id/report        # 获取报告JSON
GET    /api/rental-orders/:id/export/csv    # 导出CSV报告
```

### 异常日志

```
GET    /api/exception-logs          # 查询所有异常日志
GET    /api/exception-logs/:id      # 查询单个异常日志
PATCH  /api/exception-logs/:id      # 更新异常日志（添加处理结论）
```

**更新异常日志（添加处理结论）:**

```json
{
  "processing_conclusion": "已通知用户并协商解决方案",
  "handled_by": "管理员A"
}
```

### 状态流转规则

```
pending → confirmed → active → returned → completed
         ↓
      cancelled
```

- pending（待确认）: 借用单已创建，等待确认
- confirmed（已确认）: 借用已确认，等待取件
- active（使用中）: 器材已借出，正在使用
- returned（已归还）: 器材已归还，等待检查
- completed（已完成）: 所有流程完成，押金已结清
- cancelled（已取消）: 借用单已取消

## 数据模型

### 器材 (Equipment)

- id: UUID
- name: 名称
- category: 分类 (相机/镜头/灯光/配件/音频)
- model: 型号
- serial_number: 序列号
- status: 状态 (available/rented/maintenance/damaged)
- deposit_amount: 押金金额
- daily_rate: 日租金
- description: 描述
- created_at/updated_at: 时间戳

### 借用单 (RentalOrder)

- id: UUID
- order_no: 订单号
- equipment_id: 器材ID
- borrower_name/phone/id: 借用人信息
- expected_start/end_date: 预计借用时间
- actual_start/end_date: 实际借用时间
- deposit_paid: 已付押金
- status: 状态 (pending/confirmed/active/returned/completed/cancelled)
- notes: 备注
- created_at/updated_at: 时间戳

### 归还检查 (ReturnInspection)

- id: UUID
- rental_order_id: 借用单ID
- inspector_name: 检查员
- inspection_date: 检查日期
- has_scratches: 是否有划痕
- scratches_description: 划痕描述
- has_damage: 是否有损坏
- damage_description: 损坏描述
- accessories_complete: 配件是否齐全
- accessories_notes: 配件备注
- overall_condition: 整体状况 (excellent/good/fair/poor)
- conclusion: 结论
- status: 状态
- created_at: 时间戳

### 押金扣款 (DepositDeduction)

- id: UUID
- rental_order_id: 借用单ID
- inspection_id: 检查ID (可选)
- amount: 扣款金额
- reason: 扣款原因
- requested_by: 申请人
- requested_at: 申请时间
- approved_by: 审批人
- approved_at: 审批时间
- status: 状态 (pending/approved/rejected)
- notes: 备注

### 异常日志 (ExceptionLog)

- id: UUID
- operation_type: 操作类型
- original_input: 原始输入(JSON)
- error_message: 错误信息
- processing_conclusion: 处理结论
- handled_by: 处理人
- handled_at: 处理时间
- created_at: 创建时间
- status: 状态

### 人工修正 (ManualCorrection)

- id: UUID
- rental_order_id: 借用单ID (可选)
- correction_type: 修正类型
- field_name: 字段名
- old_value: 旧值
- new_value: 新值
- reason: 修正原因
- corrected_by: 修正人
- corrected_at: 修正时间

## 核心业务规则

1. **配件核对**: 借用和归还时核对配件清单和数量
2. **归还复核**: 归还时检查划痕、损坏、配件完整性
3. **扣款审批**: 所有扣款需要双人审批
4. **逾期计费**: 逾期按日租金的1.5倍计费
5. **异常记录**: 所有错误路径保存原始输入供审计

## 测试覆盖

- ✅ 正常流程测试
- ✅ 重复请求处理
- ✅ 脏数据验证
- ✅ 报告导出数据一致性
- ✅ 状态流转验证
- ✅ 计费逻辑验证

## 项目结构

```
.
├── src/
│   ├── database.ts       # 数据库初始化和连接
│   ├── types.ts          # 类型定义
│   ├── services.ts       # 业务逻辑层
│   ├── routes.ts         # API路由
│   ├── server.ts         # 服务器入口
│   └── seed.ts           # 样例数据填充
├── test/
│   └── self-check.ts     # 自检脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run build` | 编译 TypeScript |
| `npm start` | 生产环境启动 |
| `npm run dev` | 开发环境启动 |
| `npm test` | 运行自检脚本 |
| `npm run seed` | 填充样例数据 |
