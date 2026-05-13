# 装修材料进场验收系统

一个完整的全栈Web应用，用于装修材料订单、送货、验收的全流程管理。

## 功能特性

### 核心功能
- **材料订单管理** - 订单的创建、编辑、查询、筛选
- **送货管理** - 送货单的创建、编辑、与订单关联
- **验收记录管理** - 验收记录的创建、提交、审核
- **异常看板** - 待处理退货、待付款复核的集中展示
- **报表导出** - 支持按责任人、时间范围导出CSV报表

### 业务规则
- **照片变化检测** - 记录验收照片的变更历史
- **退换货拦截** - 自动检测并提示待处理退货
- **付款节点复核** - 验证送货与验收数量一致性、检查未处理退货
- **重复提交检测** - 防止同一送货单重复提交验收

### 审计功能
- 完整的操作审计日志
- 记录修改前后的值
- 流转记录追踪
- 支持按责任人、时间筛选

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- Sequelize ORM
- json2csv 报表导出

### 前端
- React 18
- Ant Design 5
- Axios
- Day.js

## 本地启动

### 前置要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 初始化数据库和样例数据

```bash
cd server
npm run seed
```

这将：
1. 创建SQLite数据库文件
2. 创建所有数据表
3. 插入样例数据（5个订单、4个送货单、4个验收记录）

### 启动开发服务器

```bash
# 方式1 - 分别启动
# 启动后端服务 (端口 3001)
cd server
npm run dev

# 启动前端服务 (端口 3000)
cd ../client
npm start

# 方式2 - 同时启动 (根目录)
npm run dev
```

访问 http://localhost:3000 即可使用系统。

## 项目结构

```
.
├── client/                 # 前端应用
│   ├── public/
│   └── src/
│       ├── api/           # API 调用封装
│       ├── pages/         # 页面组件
│       │   ├── Dashboard.js      # 数据概览
│       │   ├── Orders.js         # 订单管理
│       │   ├── Deliveries.js     # 送货管理
│       │   ├── Inspections.js    # 验收管理
│       │   ├── ExceptionBoard.js # 异常看板
│       │   └── Reports.js        # 报表导出
│       ├── App.js
│       └── index.js
├── server/                # 后端服务
│   ├── src/
│   │   ├── models/       # 数据模型
│   │   ├── controllers/  # 控制器
│   │   ├── services/     # 业务服务
│   │   ├── scripts/      # 脚本（数据初始化）
│   │   ├── routes.js     # 路由定义
│   │   └── index.js      # 入口文件
│   └── database.sqlite   # SQLite数据库文件
├── package.json
└── README.md
```

## API 接口演示

### 订单相关

```bash
# 获取所有订单
GET /api/orders?projectName=花园&responsiblePerson=张三&status=pending

# 创建订单
POST /api/orders
Content-Type: application/json
{
  "orderNo": "MO-2024-006",
  "projectName": "测试项目",
  "materialName": "测试材料",
  "materialType": "建材",
  "quantity": 100,
  "unit": "件",
  "unitPrice": 50,
  "totalAmount": 5000,
  "supplier": "测试供应商",
  "responsiblePerson": "张三",
  "operator": "admin"
}

# 更新订单
PUT /api/orders/:id
```

### 送货相关

```bash
# 获取所有送货单
GET /api/deliveries?status=pending

# 创建送货单
POST /api/deliveries
Content-Type: application/json
{
  "deliveryNo": "DL-2024-005",
  "orderId": "订单ID",
  "deliveryDate": "2024-01-15",
  "deliveredQuantity": 100,
  "driverName": "李师傅",
  "vehicleNo": "京A12345",
  "receivedBy": "张三",
  "operator": "admin"
}
```

### 验收相关

```bash
# 获取所有验收记录
GET /api/inspections?inspector=质检员A&status=submitted

# 创建验收记录
POST /api/inspections
Content-Type: application/json
{
  "inspectionNo": "IN-2024-005",
  "deliveryId": "送货单ID",
  "inspectionDate": "2024-01-16",
  "inspectedQuantity": 100,
  "acceptedQuantity": 95,
  "rejectedQuantity": 5,
  "inspectionResult": "partial",
  "rejectReason": "部分损坏",
  "inspector": "质检员A",
  "status": "draft",
  "operator": "admin"
}

# 提交验收记录 (草稿 -> 已提交)
POST /api/inspections/:id/submit
{
  "operator": "admin"
}

# 处理退货
POST /api/inspections/:id/return
{
  "operator": "admin"
}
```

### 付款节点复核

```bash
POST /api/payment/verify
Content-Type: application/json
{
  "orderId": "订单ID",
  "operator": "财务人员"
}
```

### 报表导出

```bash
# 导出订单报表
GET /api/reports/orders/export?responsiblePerson=张三&startDate=2024-01-01&endDate=2024-12-31

# 导出验收报表
GET /api/reports/inspections/export?inspector=质检员A&startDate=2024-01-01&endDate=2024-12-31
```

### 审计日志和流转记录

```bash
# 获取审计日志
GET /api/audit-logs?entityType=order&operator=admin

# 获取订单流转记录
GET /api/flow-records/:orderId
```

## 失败路径演示

### 1. 重复提交验收记录

**场景**：对同一个送货单提交两次验收记录

```bash
# 第一次提交 - 成功
POST /api/inspections
{
  "inspectionNo": "IN-2024-006",
  "deliveryId": "已存在的送货单ID",
  "inspector": "质检员A",
  "status": "submitted"
}

# 第二次提交 - 失败 (400 Bad Request)
{
  "success": false,
  "message": "该送货单已由质检员A提交过验收记录",
  "code": "DUPLICATE_SUBMISSION"
}
```

### 2. 付款节点复核失败 (数量不一致)

**场景**：送货数量与验收合格数量不一致时复核

```bash
POST /api/payment/verify
{
  "orderId": "存在数量差异的订单ID",
  "operator": "财务"
}

# 响应 (400 Bad Request)
{
  "success": false,
  "message": "送货数量(100)与验收合格数量(95)不一致，无法通过付款复核",
  "code": "PAYMENT_VERIFY_FAILED"
}
```

### 3. 付款节点复核失败 (存在未处理退货)

**场景**：存在未处理的拒收材料时尝试复核

```bash
POST /api/payment/verify
{
  "orderId": "存在未处理退货的订单ID",
  "operator": "财务"
}

# 响应 (400 Bad Request)
{
  "success": false,
  "message": "存在1笔退换货未处理，无法通过付款复核",
  "code": "PAYMENT_VERIFY_FAILED"
}
```

## 样例数据说明

初始化后系统包含以下样例数据：

**材料订单 (5个)**
- MO-2024-001：实木地板 - 阳光花园一期 - 已完成
- MO-2024-002：抛光瓷砖 - 阳光花园一期 - 已送货
- MO-2024-003：乳胶漆 - 悦府二期 - 部分送货
- MO-2024-004：铝合金门窗 - 悦府二期 - 待送货
- MO-2024-005：PPR水管 - 滨江壹号 - 已验收

**送货单 (4个)**
- DL-2024-001：实木地板送货 - 已验收通过
- DL-2024-002：瓷砖送货 - 部分验收
- DL-2024-003：乳胶漆送货 - 全部拒收 (退货待处理)
- DL-2024-004：PPR水管送货 - 已验收通过

**验收记录 (4个)**
- IN-2024-001：全部通过 - 已完成
- IN-2024-002：部分验收，拒收5㎡ - 退货待处理
- IN-2024-003：全部拒收 - 退货待处理
- IN-2024-004：全部通过 - 已审核

## 数据模型关系

```
MaterialOrder (材料订单)
    ├── id (UUID, 主键)
    ├── orderNo (订单编号)
    ├── projectName (项目名称)
    ├── materialName (材料名称)
    ├── materialType (材料类型)
    ├── specification (规格型号)
    ├── quantity (数量)
    ├── unit (单位)
    ├── unitPrice (单价)
    ├── totalAmount (总金额)
    ├── supplier (供应商)
    ├── status (状态)
    ├── responsiblePerson (责任人)
    └── createdAt/updatedAt

DeliveryNote (送货单)
    ├── id (UUID, 主键)
    ├── deliveryNo (送货单号)
    ├── orderId (关联订单ID)
    ├── deliveryDate (送货日期)
    ├── deliveredQuantity (送货数量)
    ├── driverName (司机)
    ├── vehicleNo (车牌号)
    ├── batchNo (批次号)
    ├── receivedBy (签收人)
    ├── status (状态)
    └── createdAt/updatedAt

InspectionRecord (验收记录)
    ├── id (UUID, 主键)
    ├── inspectionNo (验收单号)
    ├── deliveryId (关联送货单ID)
    ├── orderId (关联订单ID)
    ├── inspectionDate (验收日期)
    ├── inspectedQuantity (验收数量)
    ├── acceptedQuantity (合格数量)
    ├── rejectedQuantity (拒收数量)
    ├── inspectionResult (验收结果)
    ├── rejectReason (拒收原因)
    ├── photos (照片JSON)
    ├── inspector (质检员)
    ├── reviewer (审核人)
    ├── status (状态)
    ├── isReturnProcessed (退货是否处理)
    └── createdAt/updatedAt

AuditLog (审计日志)
    ├── id (UUID, 主键)
    ├── entityType (实体类型)
    ├── entityId (实体ID)
    ├── action (操作类型)
    ├── oldValues (原值JSON)
    ├── newValues (新值JSON)
    ├── changedFields (变更字段JSON)
    ├── operator (操作人)
    └── createdAt

FlowRecord (流转记录)
    ├── id (UUID, 主键)
    ├── flowType (流转类型)
    ├── referenceId (关联ID)
    ├── orderId (订单ID)
    ├── fromStatus (原状态)
    ├── toStatus (目标状态)
    ├── operator (操作人)
    └── createdAt
```

## 状态说明

### 订单状态
- `pending` - 待送货
- `partial_delivered` - 部分送货
- `delivered` - 已送货
- `inspected` - 已验收
- `returned` - 已退货
- `completed` - 已完成 (付款复核通过)

### 送货单状态
- `pending` - 待验收
- `inspecting` - 验收中
- `accepted` - 验收通过
- `rejected` - 全部拒收
- `partial_accepted` - 部分验收
- `returned` - 已退货

### 验收记录状态
- `draft` - 草稿
- `submitted` - 已提交
- `reviewed` - 已审核
- `completed` - 已完成

## 注意事项

1. 数据库文件为 `server/database.sqlite`，删除后重新运行 `npm run seed` 可重置
2. 照片存储为JSON格式，可存储文件路径或URL列表
3. 所有API均需指定 `operator` 参数用于审计日志
4. 报表导出为CSV格式，支持Excel直接打开
5. 前端开发时通过 `proxy` 配置将API请求转发到后端3001端口
