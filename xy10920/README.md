# 物业报修催办 API 服务

本地后端 API 服务，用于物业管理报修工单、催办记录、外包派单等功能。

## 项目结构

```
property-repair-api/
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── routes/
│   │   ├── repairOrders.js      # 报修单相关接口
│   │   └── reports.js           # 报告导出接口
│   ├── services/
│   │   └── repairOrderService.js # 核心业务逻辑
│   ├── scripts/
│   │   ├── initDb.js            # 数据库表初始化
│   │   └── seedData.js          # 样例数据初始化
│   └── server.js                # 服务器主文件
├── data/                        # SQLite数据库文件目录
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库表

```bash
npm run init-db
```

### 3. 导入样例数据（可重复执行）

```bash
npm run seed
```
> 每次执行会自动清理旧数据，重新插入干净的样例数据，不会撞唯一约束。

### 4. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## 数据模型

### 核心实体
1. **楼栋 (buildings)** - 楼栋信息
2. **房号 (rooms)** - 房屋信息，关联楼栋
3. **处理人 (handlers)** - 处理人员，包括内部人员和外包公司
4. **报修单 (repair_orders)** - 报修工单主表
5. **催办记录 (reminder_records)** - 催办和重复工单记录
6. **外包派单 (outsource_assignments)** - 外包派单详情
7. **完工证明 (completion_proofs)** - 完工提交的证明材料
8. **状态历史 (status_history)** - 工单状态变更轨迹
9. **异常记录 (exception_records)** - 异常请求记录

### 核心规则

#### 超时规则
- 紧急(urgent): 2小时内完成
- 普通(normal): 24小时内完成
- 低优先级(low): 72小时内完成

#### 重复催办合并
- 同一房号 + 同一报修类型 + 24小时内重复提交 → 自动合并
- 原工单优先级自动提升为紧急
- 保留合并记录

#### 状态流转
```
pending (待处理) → assigned (已分配) → processing (处理中) → completed (已完成) → verified (已复核)
                    ↓
                  outsourced (外包中)
```

## API 接口说明

### 1. 报修单管理

#### 创建报修单
```
POST /api/repair-orders
Content-Type: application/json

{
  "buildingNo": "1栋",
  "roomNo": "101",
  "repairType": "水电",
  "description": "客厅灯不亮",
  "priority": "normal",
  "reportedBy": "张三",
  "reportedPhone": "13800138001"
}
```

#### 查询报修单列表
```
GET /api/repair-orders?status=pending&isTimeout=true&isOutsourced=true

参数说明：
- status: 状态筛选 (pending/assigned/processing/outsourced/completed/verified)
- isTimeout: 是否超时 (true/false)
- isOutsourced: 是否外包 (true/false)
- buildingNo: 楼栋号筛选
- repairType: 报修类型筛选
```

#### 查询单个报修单
```
GET /api/repair-orders/:id
```

#### 查询报修单状态历史
```
GET /api/repair-orders/:id/history
```

#### 更新工单状态
```
PUT /api/repair-orders/:id/status
Content-Type: application/json

{
  "newStatus": "processing",
  "changeReason": "开始处理",
  "changedBy": 1
}
```

#### 分配处理人
```
PUT /api/repair-orders/:id/assign
Content-Type: application/json

{
  "handlerId": 1
}
```

#### 转外包处理
```
POST /api/repair-orders/:id/outsource
Content-Type: application/json

{
  "outsourceCompany": "快修公司",
  "outsourceContact": "陈工",
  "outsourcePhone": "13700137001",
  "promisedCompletionAt": "2026-05-20 18:00:00",
  "cost": 500.00
}
```

#### 人工修正工单
```
PUT /api/repair-orders/:id/correct
Content-Type: application/json

{
  "updateData": {
    "description": "客厅灯不亮（已确认需要更换镇流器）",
    "priority": "urgent",
    "status": "processing"
  },
  "correctedBy": 3
}
```

#### 提交完工证明
```
POST /api/repair-orders/:id/completion-proof
Content-Type: application/json

{
  "proofType": "photo",
  "proofContent": "https://example.com/photo123.jpg",
  "submittedBy": 1
}
```

#### 查询完工证明
```
GET /api/repair-orders/:id/completion-proof
```

#### 完工复核（验证完工证明）
```
POST /api/repair-orders/:id/completion-proof/:proofId/verify
Content-Type: application/json

{
  "verifiedBy": 3,
  "isVerified": true,
  "verifyRemark": "复核通过，维修质量合格"
}
```

#### 查询单个工单的催办记录
```
GET /api/repair-orders/:id/reminders
```

#### 查询所有催办记录（含重复催办）
```
GET /api/repair-orders/reminders/all/list
```

### 2. 报告与异常

#### 导出报告
```
GET /api/reports/export?format=csv&isTimeout=true

参数：
- format: 导出格式 (json/csv)，默认json
- 其他筛选参数同报修单列表查询
```

#### 查询异常记录
```
GET /api/reports/exceptions
```

#### 健康检查
```
GET /api/health
```

## 验收测试指南

### 场景一：正常创建工单

**步骤：**
1. 创建新报修单
```bash
curl -X POST http://localhost:3000/api/repair-orders \
  -H "Content-Type: application/json" \
  -d '{
    "buildingNo": "1栋",
    "roomNo": "102",
    "repairType": "水电",
    "description": "卫生间水龙头漏水",
    "priority": "normal",
    "reportedBy": "李四",
    "reportedPhone": "13800138002"
  }'
```

2. 查询工单详情，确认状态为 pending
3. 查询状态历史，确认为"创建报修单"
4. 导出报告，确认新工单在列表中

### 场景二：重复提交（合并）

**步骤：**
1. 同一房号24小时内重复提交相同类型报修
```bash
curl -X POST http://localhost:3000/api/repair-orders \
  -H "Content-Type: application/json" \
  -d '{
    "buildingNo": "1栋",
    "roomNo": "102",
    "repairType": "水电",
    "description": "再次报修：水龙头还在漏水",
    "priority": "normal",
    "reportedBy": "李四",
    "reportedPhone": "13800138002"
  }'
```

2. 预期返回：`isDuplicate: true`，提示已合并
3. 查询原工单，确认优先级已提升为 urgent
4. 查看该工单的催办记录
```bash
curl http://localhost:3000/api/repair-orders/1/reminders
```
5. 查看所有催办记录（物业统计重复催办）
```bash
curl http://localhost:3000/api/repair-orders/reminders/all/list
```
6. 导出报告，确认重复催办次数字段已记录

### 场景三：异常拦截

**步骤：**
1. 使用不存在的楼栋创建工单（预期失败）
```bash
curl -X POST http://localhost:3000/api/repair-orders \
  -H "Content-Type: application/json" \
  -d '{
    "buildingNo": "99栋",
    "roomNo": "101",
    "repairType": "水电",
    "description": "测试异常",
    "priority": "normal",
    "reportedBy": "测试用户",
    "reportedPhone": "13800000000"
  }'
```

2. 查看异常记录，确认原始输入和处理结论已保存
```bash
curl http://localhost:3000/api/reports/exceptions
```

3. 尝试无效的状态流转（如从 pending 直接到 completed）
```bash
curl -X PUT http://localhost:3000/api/repair-orders/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "completed",
    "changeReason": "测试无效流转",
    "changedBy": 1
  }'
```

### 场景四：人工修正

**步骤：**
1. 人工修正工单信息
```bash
curl -X PUT http://localhost:3000/api/repair-orders/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "updateData": {
      "description": "客厅灯不亮（经排查为电路问题，非灯泡问题）",
      "priority": "urgent",
      "handler_id": 2
    },
    "correctedBy": 3
  }'
```

2. 查询工单详情，确认字段已更新
3. 查看状态历史，确认有人工修正记录
4. 导出报告，确认修正后的数据与报告一致

### 场景五：完工证明与复核闭环

**步骤：**
1. 先将工单推进到处理中状态
```bash
curl -X PUT http://localhost:3000/api/repair-orders/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "processing",
    "changeReason": "开始处理",
    "changedBy": 1
  }'
```

2. 提交完工证明（自动将工单状态改为 completed）
```bash
curl -X POST http://localhost:3000/api/repair-orders/1/completion-proof \
  -H "Content-Type: application/json" \
  -d '{
    "proofType": "photo",
    "proofContent": "维修完成照片_20260517.jpg",
    "submittedBy": 1
  }'
```

3. 查询完工证明
```bash
curl http://localhost:3000/api/repair-orders/1/completion-proof
```

4. 完工复核（将工单状态改为 verified）
```bash
curl -X POST http://localhost:3000/api/repair-orders/1/completion-proof/1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "verifiedBy": 3,
    "isVerified": true,
    "verifyRemark": "复核通过，维修质量合格"
  }'
```

5. 查询工单状态历史，确认完整流转轨迹
6. 导出报告，确认完工证明和复核状态已记录

### 数据一致性验证

1. 工单状态历史必须完整记录所有状态变更
2. 超时工单必须标记 is_timeout = 1
3. 外包工单必须有对应的 outsource_assignments 记录
4. 完工证明必须有对应的 completion_proofs 记录
5. 已复核工单状态必须为 verified，且完工证明 is_verified = 1
6. 导出报告中的数据必须与数据库实时状态一致

## 预置样例数据

已预置的测试数据：
- 5栋楼，10个房间
- 6个处理人（含2家外包公司）
- 5个报修单（含超时工单、外包工单、已完成工单）
- 状态历史记录
- 催办记录

## 技术栈

- Node.js + Express
- SQLite3 (本地持久化)
- json2csv (CSV导出)
