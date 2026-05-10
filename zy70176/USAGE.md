# 发票红冲预约 API 服务 - 使用指南

## 一、快速开始

### 1. 启动服务
```bash
# 方式一：运行命令行测试
npm run test

# 方式二：启动 HTTP API 服务
npm start

# 方式三：先初始化样例数据
npm run init-data
```

### 2. 服务访问
- 服务地址：http://localhost:3000
- 健康检查：http://localhost:3000/api/health

---

## 二、核心功能说明

### 2.1 发票管理
- 创建、查询发票
- 管理发票关系（原票、蓝票、红票）
- 追踪发票红冲状态

### 2.2 红冲申请管理
- 提交红冲申请
- 审批流程（通过/拒绝）
- 撤销申请
- 手动重试

### 2.3 排队处理
- 红冲任务排队机制
- 队列状态监控
- 自动重试机制

### 2.4 税控回执
- 模拟税控系统处理
- 生成税控回执
- 错误码和错误信息

### 2.5 报表功能
- 日报表统计
- 发票关系报表
- 问题预警和检测

---

## 三、业务场景说明

### 场景1：正常红冲流程
**业务描述**：客户发现发票金额有误，需要红冲重开

**处理流程**：
1. 操作员提交红冲申请（原因：发票金额有误）
2. 财务主管审批通过
3. 申请进入处理队列
4. 系统调用税控系统处理
5. 生成红票和税控回执
6. 原发票状态更新为"已红冲"

**验收现象**：
- ✅ 红冲申请状态：待审批 → 待排队 → 处理中 → 已完成
- ✅ 原发票红冲状态：未红冲 → 已红冲
- ✅ 生成对应的红票（金额为负数）
- ✅ 生成税控回执（状态：成功）

---

### 场景2：重复提交红冲申请 - 异常拦截
**业务描述**：同一发票被多人重复提交红冲申请

**处理流程**：
1. 张三提交发票A的红冲申请
2. 系统记录申请状态：待审批
3. 李四尝试提交同一张发票的红冲申请
4. 系统检测到已有申请在处理中
5. 系统拒绝重复提交

**验收现象**：
- ✅ 第一次申请成功，状态为"待审批"
- ✅ 第二次申请失败，提示"该发票已有红冲申请在处理中"
- ✅ 申请详情中显示已有申请的状态

---

### 场景3：撤销红冲申请
**业务描述**：客户取消退货，不需要红冲了

**处理流程**：
1. 操作员提交红冲申请
2. 审批通过，进入排队队列
3. 客户通知取消退货
4. 操作员撤销红冲申请
5. 申请状态更新为"已撤销"
6. 队列任务也被取消

**验收现象**：
- ✅ 撤销前：申请状态为"待排队"，队列任务为"等待中"
- ✅ 撤销后：申请状态为"已撤销"，队列任务为"已取消"
- ✅ 记录撤销原因和撤销人
- ✅ 原发票状态保持"未红冲"

---

### 场景4：审批拒绝红冲申请
**业务描述**：红冲理由不充分，财务主管拒绝申请

**处理流程**：
1. 操作员提交红冲申请（理由：测试撤销）
2. 财务主管审核发现理由不充分
3. 审批拒绝并填写拒绝原因
4. 申请状态更新为"已拒绝"

**验收现象**：
- ✅ 申请状态：待审批 → 已拒绝
- ✅ 记录拒绝原因："红冲理由不充分，请补充具体原因"
- ✅ 记录审批人信息
- ✅ 原发票状态保持"未红冲"

---

### 场景5：已红冲发票再次申请 - 异常拦截
**业务描述**：对已完成红冲的发票再次提交申请

**处理流程**：
1. 发票A已完成红冲（状态：已完成）
2. 操作员尝试再次提交红冲申请
3. 系统检测到发票已红冲
4. 系统拒绝申请

**验收现象**：
- ✅ 申请失败，提示"该发票已完成红冲，不能重复红冲"
- ✅ 提示详细信息："如需再次处理，请先撤销之前的红冲或联系管理员"

---

### 场景6：税控系统异常 - 自动重试
**业务描述**：税控系统连接超时或返回错误

**处理流程**：
1. 红冲申请通过审批，进入队列
2. 处理时税控系统返回错误
3. 系统自动记录失败，并加入重试队列
4. 设置下次重试时间（5分钟后）
5. 重试计数器加1
6. 达到最大重试次数（3次）后，标记为失败

**验收现象**：
- ✅ 申请状态：处理中 → 重试中
- ✅ 记录重试次数（1/3）
- ✅ 记录下次重试时间
- ✅ 记录错误信息："税控系统连接超时，请稍后重试"
- ✅ 日报表中显示"处理失败"和"重试中"的问题

---

## 四、API 接口说明

### 4.1 发票相关接口

#### 创建发票
```bash
POST /api/invoices
Content-Type: application/json

{
  "invoiceType": "蓝票",
  "amount": 1000,
  "taxAmount": 130,
  "totalAmount": 1130,
  "customerName": "北京科技有限公司"
}
```

**响应**：
```json
{
  "success": true,
  "message": "发票创建成功",
  "data": {
    "id": "INV-xxx",
    "invoiceNumber": "A12345678",
    "invoiceType": "蓝票",
    "status": "正常",
    "redemptionStatus": "未红冲"
  }
}
```

#### 查询发票关系
```bash
GET /api/invoices/{invoiceId}/relationship
```

**响应**：
```json
{
  "success": true,
  "data": {
    "currentInvoice": {...},
    "originalInvoice": {...},
    "relatedBlueInvoices": [...],
    "relatedRedInvoices": [...]
  }
}
```

#### 关联发票
```bash
POST /api/invoices/link
Content-Type: application/json

{
  "blueInvoiceId": "INV-xxx",
  "redInvoiceId": "INV-yyy",
  "originalInvoiceId": "INV-zzz"
}
```

---

### 4.2 红冲申请相关接口

#### 提交红冲申请
```bash
POST /api/redemptions
Content-Type: application/json

{
  "originalInvoiceId": "INV-xxx",
  "reason": "发票金额有误，需要红冲重开",
  "operator": "张三"
}
```

**响应**：
```json
{
  "success": true,
  "message": "红冲申请已提交，等待审批",
  "data": {
    "redemptionId": "RED-xxx",
    "originalInvoiceNumber": "A12345678",
    "status": "待审批",
    "estimatedTime": "预计1-2个工作日完成审批"
  }
}
```

#### 审批通过
```bash
POST /api/redemptions/{redemptionId}/approve
Content-Type: application/json

{
  "approver": "财务主管-李四"
}
```

#### 审批拒绝
```bash
POST /api/redemptions/{redemptionId}/reject
Content-Type: application/json

{
  "reason": "红冲理由不充分，请补充具体原因",
  "approver": "财务主管"
}
```

#### 撤销申请
```bash
POST /api/redemptions/{redemptionId}/cancel
Content-Type: application/json

{
  "operator": "操作人",
  "reason": "客户取消退货，不需要红冲了"
}
```

#### 手动重试
```bash
POST /api/redemptions/{redemptionId}/retry
Content-Type: application/json

{
  "operator": "管理员"
}
```

---

### 4.3 队列相关接口

#### 处理队列
```bash
POST /api/queue/process
```

**响应**：
```json
{
  "success": true,
  "message": "红冲处理完成",
  "data": {
    "redemptionId": "RED-xxx",
    "status": "已完成",
    "redInvoiceNumber": "B87654321",
    "taxReceiptNumber": "TAX-20260510-123456"
  }
}
```

#### 查看队列状态
```bash
GET /api/queue/status
```

**响应**：
```json
{
  "success": true,
  "data": {
    "waiting": 1,
    "processing": 0,
    "completed": 5,
    "failed": 1,
    "cancelled": 2,
    "waitingList": [...]
  }
}
```

---

### 4.4 报表相关接口

#### 日报表
```bash
GET /api/reports/daily
GET /api/reports/daily?date=2026-05-10
```

**响应**：
```json
{
  "success": true,
  "data": {
    "reportDate": "2026-05-10",
    "summary": {
      "totalInvoicesToday": 10,
      "blueInvoices": { "count": 8, "totalAmount": 10000 },
      "redInvoices": { "count": 2, "totalAmount": -2000 },
      "redemptionRequests": 5,
      "completedRedemptions": 3,
      "netAmount": 8000
    },
    "redemptionStatus": {
      "待审批": 1,
      "已完成": 3,
      "已拒绝": 1
    },
    "issues": [
      {
        "type": "处理失败",
        "severity": "高",
        "description": "1个红冲任务处理失败"
      }
    ]
  }
}
```

#### 发票关系报表
```bash
GET /api/reports/invoices/{invoiceId}/relationship
```

**响应**：
```json
{
  "success": true,
  "data": {
    "currentInvoice": {
      "number": "A12345678",
      "type": "蓝票",
      "status": "正常",
      "redemptionStatus": "已红冲"
    },
    "relationshipChain": [
      { "relation": "原发票", "number": "A12345678", "type": "蓝票" },
      { "relation": "关联红票", "number": "B87654321", "type": "红票" }
    ],
    "warnings": [...]
  }
}
```

---

## 五、数据文件说明

服务使用 JSON 文件存储数据，位于 `data/` 目录：

- `invoices.json` - 发票信息
- `redemptions.json` - 红冲申请记录
- `queue.json` - 排队任务记录
- `taxReceipts.json` - 税控回执记录

---

## 六、测试命令

```bash
# 运行完整测试套件
npm run test

# 初始化样例数据
npm run init-data

# 启动 API 服务
npm start
```

---

## 七、状态说明

### 发票状态
- `正常` - 发票有效
- `作废` - 发票已作废
- `异常` - 发票状态异常

### 发票红冲状态
- `未红冲` - 未进行红冲处理
- `处理中` - 红冲申请处理中
- `已红冲` - 已完成红冲
- `红冲失败` - 红冲处理失败

### 红冲申请状态
- `待审批` - 等待财务审批
- `已拒绝` - 审批被拒绝
- `待排队` - 审批通过，等待进入队列
- `排队中` - 正在排队等待处理
- `处理中` - 正在调用税控系统
- `重试中` - 处理失败，等待重试
- `已完成` - 红冲完成
- `已撤销` - 申请被撤销
- `失败` - 处理失败且已达最大重试次数

### 队列任务状态
- `等待中` - 等待处理
- `处理中` - 正在处理
- `已完成` - 处理完成
- `失败` - 处理失败
- `已取消` - 任务被取消

---

## 八、常见问题

### Q1: 如何查看某张发票的红冲历史？
**A**: 使用发票关系查询接口 `GET /api/invoices/{invoiceId}/relationship`，可以查看发票的完整关系链。

### Q2: 红冲处理失败后会怎样？
**A**: 系统会自动重试最多3次，每次间隔5分钟。如果3次都失败，状态变为"失败"，需要管理员手动重试。

### Q3: 已红冲的发票还能再次红冲吗？
**A**: 不能。系统会检测发票的红冲状态，已红冲的发票不允许再次提交红冲申请。

### Q4: 如何撤销红冲申请？
**A**: 只有状态为"待审批"、"待排队"或"排队中"的申请可以撤销。使用 `POST /api/redemptions/{id}/cancel` 接口。

### Q5: 日报表中的"问题"是什么？
**A**: 日报表会自动检测异常情况，包括：
- 处理失败的任务
- 正在重试的任务
- 发票关系异常
- 可能的重复申请
