# 农贸摊位卫生扣分 API 系统

## 项目简介

这是一个农贸市场摊位卫生管理系统，支持摊位管理、卫生检查、扣分记录、投诉处理、整改复核、优惠计算和排名查询功能。

## 核心功能

### 1. 摊位管理
- 创建、查询、更新、删除摊位信息
- 摊位基础优惠率配置

### 2. 检查与扣分
- 创建卫生检查记录
- 对不合格摊位进行扣分
- 防止重复扣分（同一检查记录只能扣一次）

### 3. 投诉处理
- 摊主对扣分结果进行投诉
- 处理投诉（支持/驳回）
- 投诉成立时撤销扣分并恢复优惠

### 4. 整改与复核
- 发送整改通知
- 摊主提交整改报告
- 管理员复核整改结果
- 复核通过可返还分数

### 5. 优惠计算
- 基于累计扣分计算优惠率
- 扣分上限 20 分，超过取消优惠资格
- 每次调整记录来源（扣分/投诉/整改/重新计算）

### 6. 排名查询
- 按月份查询摊位卫生排名

### 7. 数据保护
- 历史月份数据锁定，防止篡改
- 所有操作有完整记录

## 技术栈

- Node.js + Express
- Sequelize ORM
- SQLite 数据库
- Joi 参数验证

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 4. 运行演示脚本

```bash
npm run demo
```

## API 接口文档

### 健康检查
```
GET /api/health
```

### 摊位管理

```
POST /api/stalls          - 创建摊位
GET  /api/stalls          - 获取摊位列表
GET  /api/stalls/:id      - 获取单个摊位
PUT  /api/stalls/:id      - 更新摊位
DELETE /api/stalls/:id    - 禁用摊位
```

**创建摊位请求示例：**
```json
{
  "code": "A001",
  "name": "蔬菜摊位",
  "ownerName": "张三",
  "phone": "13800138000",
  "area": "A区",
  "baseDiscountRate": 0.9
}
```

### 检查与扣分

```
POST /api/inspections              - 创建检查记录
GET  /api/inspections              - 获取检查列表
GET  /api/inspections/:id          - 获取单个检查
POST /api/inspections/:id/deductions  - 创建扣分
GET  /api/inspections/deductions/list - 获取扣分列表
```

**创建检查记录请求示例：**
```json
{
  "stallId": 1,
  "inspector": "李管理员",
  "inspectionDate": "2024-05-15T10:00:00Z",
  "remark": "日常检查"
}
```

**创建扣分请求示例：**
```json
{
  "reason": "地面有垃圾未清理",
  "points": 5,
  "category": "卫生"
}
```

### 投诉管理

```
POST /api/complaints              - 创建投诉
GET  /api/complaints              - 获取投诉列表
PUT  /api/complaints/:id/handle   - 处理投诉
```

**创建投诉请求示例：**
```json
{
  "inspectionId": 1,
  "stallId": 1,
  "complainant": "张三",
  "reason": "当时已经清理完毕，扣分不合理"
}
```

**处理投诉请求示例：**
```json
{
  "handler": "王主管",
  "status": "upheld",
  "handleResult": "经核实，投诉成立，撤销扣分"
}
```

### 整改与复核

```
POST /api/rectifications              - 创建整改通知
GET  /api/rectifications              - 获取整改列表
PUT  /api/rectifications/:id/submit   - 提交整改
POST /api/rectifications/:id/reviews  - 复核整改
GET  /api/rectifications/reviews/list - 获取复核列表
```

**创建整改通知请求示例：**
```json
{
  "inspectionId": 1,
  "stallId": 1,
  "requirement": "请在3日内清理摊位周围垃圾，保持地面整洁",
  "deadline": "2024-05-18T23:59:59Z"
}
```

**提交整改请求示例：**
```json
{
  "description": "已完成全部清理工作，地面整洁，垃圾已清运"
}
```

**复核整改请求示例：**
```json
{
  "reviewer": "李管理员",
  "result": "pass",
  "remark": "整改合格",
  "pointsReturned": 3
}
```

### 优惠与排名

```
GET  /api/discounts/stalls/:stallId/:month    - 获取摊位月度优惠
GET  /api/discounts/stalls/:stallId/history    - 获取优惠调整历史
POST /api/discounts/stalls/:stallId/recalculate - 重新计算月度优惠
POST /api/discounts/lock                        - 锁定月份数据
GET  /api/discounts/ranking                     - 获取排名
GET  /api/discounts/config                      - 获取优惠配置
```

**重新计算优惠请求示例：**
```json
{
  "month": "2024-05",
  "operator": "管理员"
}
```

**锁定月份数据请求示例：**
```json
{
  "month": "2024-05"
}
```

**获取排名请求示例：**
```
GET /api/discounts/ranking?month=2024-05&limit=10
```

## 优惠计算规则

1. **基础优惠率**：9折（0.9）
2. **扣分上限**：20 分
3. **计算方式**：
   - 累计扣分 0 分：9折（0.9）
   - 每扣 1 分，优惠率减少 0.005
   - 累计扣分 ≥ 20 分：取消优惠（1.0 即无折扣）

## 数据模型

### Stall（摊位）
- code: 摊位编号
- name: 摊位名称
- ownerName: 摊主姓名
- phone: 联系电话
- area: 所在区域
- baseDiscountRate: 基础优惠率
- isActive: 是否启用

### Inspection（检查记录）
- inspectionNo: 检查编号
- stallId: 摊位ID
- inspector: 检查员
- inspectionDate: 检查日期
- month: 月份（YYYY-MM）
- status: 状态（pending/deducted/complained/rectified/reviewed/closed）
- isLocked: 是否已锁定
- remark: 备注

### Deduction（扣分记录）
- deductionNo: 扣分编号
- inspectionId: 检查记录ID
- stallId: 摊位ID
- reason: 扣分原因
- points: 扣分数
- category: 扣分类别
- month: 月份
- isReversed: 是否已撤销
- reversedReason: 撤销原因
- reversedAt: 撤销时间

### Complaint（投诉记录）
- complaintNo: 投诉编号
- inspectionId: 检查记录ID
- stallId: 摊位ID
- complainant: 投诉人
- reason: 投诉原因
- status: 状态（pending/processing/upheld/rejected）
- handler: 处理人
- handleResult: 处理结果
- handledAt: 处理时间

### Rectification（整改记录）
- rectificationNo: 整改编号
- inspectionId: 检查记录ID
- stallId: 摊位ID
- requirement: 整改要求
- deadline: 截止日期
- submittedAt: 提交时间
- submitDescription: 提交说明
- status: 状态（pending/submitted/reviewed）

### Review（复核记录）
- reviewNo: 复核编号
- rectificationId: 整改记录ID
- inspectionId: 检查记录ID
- stallId: 摊位ID
- reviewer: 复核人
- result: 结果（pass/fail）
- remark: 备注
- pointsReturned: 返还分数
- reviewedAt: 复核时间

### DiscountAdjustment（优惠调整记录）
- adjustmentNo: 调整编号
- stallId: 摊位ID
- month: 月份
- sourceType: 来源类型（deduction/complaint_reversal/review_pass/manual/recalculation）
- sourceId: 来源ID
- sourceDescription: 来源描述
- beforeRate: 调整前优惠率
- afterRate: 调整后优惠率
- pointsChange: 分数变化
- totalPoints: 当前累计分数
- operator: 操作人
- createdAt: 创建时间

### MonthlyDiscount（月度优惠）
- stallId: 摊位ID
- month: 月份
- totalPoints: 累计扣分
- discountRate: 优惠率
- isEligible: 是否有优惠资格
- maxPointsLimit: 扣分上限
- isCalculated: 是否已计算
- calculatedAt: 计算时间
- isLocked: 是否已锁定

## 项目结构

```
market-deduction-api/
├── src/
│   ├── app.js                 # 应用入口
│   ├── models/
│   │   └── index.js           # 数据模型
│   ├── controllers/
│   │   ├── stallController.js
│   │   ├── inspectionController.js
│   │   ├── complaintController.js
│   │   ├── rectificationController.js
│   │   └── discountController.js
│   ├── services/
│   │   └── discountService.js # 优惠计算服务
│   └── routes/
│       ├── stalls.js
│       ├── inspections.js
│       ├── complaints.js
│       ├── rectifications.js
│       └── discounts.js
├── scripts/
│   ├── init-db.js            # 数据库初始化
│   └── demo.js               # 演示脚本
├── database/                 # SQLite 数据库文件
├── package.json
└── README.md
```

## 注意事项

1. **数据锁定**：月度数据锁定后无法修改，请谨慎操作
2. **重复操作**：系统已防止重复扣分、重复投诉、重复复核
3. **事务处理**：关键操作使用事务，保证数据一致性
4. **历史记录**：所有优惠调整都有完整记录，可追溯来源

## 演示流程

运行 `npm run demo` 将执行完整的演示流程：

1. 创建 3 个摊位
2. 创建卫生检查记录
3. 进行扣分（优惠降低）
4. 查看优惠调整历史
5. 创建投诉并处理（撤销扣分，优惠恢复）
6. 创建整改通知
7. 提交整改报告
8. 复核整改并返还分数（优惠提升）
9. 查看最终优惠
10. 查询月度排名
11. 锁定月份数据

