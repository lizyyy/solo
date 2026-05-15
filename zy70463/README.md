# 资源预留器后端服务

资源预留管理系统，支持压测资源申请、机器标签管理、演练窗口规划、冲突检测、审批流程、资源释放和占用证明导出。

## 功能特性

- ✅ **创建预留** - 提交压测资源申请，指定机器标签和演练窗口
- ✅ **冲突检测** - 自动检测同一资源被多组人员同时占用的情况
- ✅ **审批流程** - 支持预留申请的审批流程
- ✅ **提前释放** - 支持资源的提前释放操作
- ✅ **占用证明** - 导出占用证明（JSON/CSV格式），包含窗口、审批人、释放时间
- ✅ **采购询价单** - 采购询价单人工备注入库，按原始行号查询
- ✅ **冲突说明** - 显示占用窗口和释放计划

## 技术栈

- Node.js + Express
- MongoDB + Mongoose
- Joi 参数验证
- json2csv 导出

## 项目结构

```
resource-reservation-service/
├── src/
│   ├── models/
│   │   ├── Reservation.js          # 预留记录模型
│   │   └── PurchaseInquiry.js      # 采购询价单模型
│   ├── services/
│   │   ├── reservationService.js   # 预留服务逻辑
│   │   └── inquiryService.js       # 询价单服务逻辑
│   ├── routes/
│   │   ├── reservationRoutes.js    # 预留API路由
│   │   └── inquiryRoutes.js        # 询价单API路由
│   ├── validations/
│   │   └── reservationValidation.js # 参数验证
│   ├── config.js                    # 配置文件
│   └── app.js                       # 应用入口
├── tests/
│   └── verify.js                    # 功能验证脚本
└── package.json
```

## 快速开始

### 前置要求

- Node.js >= 14
- MongoDB >= 4.4

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 运行功能验证

```bash
npm test
```

## API 文档

### 预留管理 API

#### 1. 创建预留

```
POST /api/reservations
Content-Type: application/json

{
  "applicant": "张三",
  "applicantDepartment": "技术部",
  "purpose": "系统性能压测",
  "pressureTestResource": {
    "cpu": 8,
    "memory": 16,
    "memoryUnit": "GB",
    "instances": 4,
    "description": "高性能服务器"
  },
  "machineLabels": [
    { "name": "environment", "value": "production" },
    { "name": "zone", "value": "beijing" }
  ],
  "drillWindow": {
    "start": "2026-06-01T09:00:00.000Z",
    "end": "2026-06-01T12:00:00.000Z"
  }
}
```

#### 2. 查询所有预留

```
GET /api/reservations?status=pending&applicant=张三
```

#### 3. 查询单个预留

```
GET /api/reservations/:id
```

#### 4. 查询预留冲突

```
GET /api/reservations/:id/conflicts
```

#### 5. 检查时间窗口冲突

```
POST /api/reservations/check-conflicts
Content-Type: application/json

{
  "start": "2026-06-01T09:00:00.000Z",
  "end": "2026-06-01T12:00:00.000Z",
  "machineLabels": [
    { "name": "environment", "value": "production" }
  ]
}
```

#### 6. 审批预留

```
POST /api/reservations/:id/approve
Content-Type: application/json

{
  "approver": "李四",
  "comment": "审批通过"
}
```

#### 7. 释放资源

```
POST /api/reservations/:id/release
Content-Type: application/json

{
  "releasedBy": "管理员",
  "reason": "演练提前完成"
}
```

#### 8. 生成占用证明

```
GET /api/reservations/:id/proof
```

#### 9. 导出占用证明

```
GET /api/reservations/:id/proof/export?format=json
GET /api/reservations/:id/proof/export?format=csv
```

### 采购询价单 API

#### 1. 创建询价单

```
POST /api/inquiries
Content-Type: application/json

{
  "title": "2026年Q2服务器采购",
  "applicant": "采购专员",
  "applicantDepartment": "采购部",
  "items": [
    {
      "lineNumber": 1,
      "itemName": "高性能服务器",
      "specification": "16核32GB",
      "quantity": 10,
      "unit": "台",
      "estimatedPrice": 50000
    }
  ]
}
```

#### 2. 添加行备注

```
POST /api/inquiries/:id/items/:lineNumber/remark
Content-Type: application/json

{
  "remark": "需要预装CentOS 7操作系统"
}
```

#### 3. 按行号查询

```
GET /api/inquiries/:id/items/:lineNumber
```

#### 4. 更新整体备注

```
POST /api/inquiries/:id/overall-remark
Content-Type: application/json

{
  "remark": "本次采购为年度预算内项目"
}
```

#### 5. 生成询价单报告

```
GET /api/inquiries/:id/report
```

## 冲突检测说明

冲突检测基于以下两个条件：

1. **时间窗口重叠** - 两个预留的演练窗口有时间交集
2. **机器标签匹配** - 两个预留的机器标签存在匹配项

当两个条件同时满足时，系统会检测到冲突并记录：
- 被占用的预留编号和申请人
- 重叠的时间窗口
- 释放计划（如果已释放）
- 冲突描述信息

## 数据模型

### Reservation (预留记录)

| 字段 | 类型 | 说明 |
|------|------|------|
| reservationNo | String | 预留编号（唯一） |
| applicant | String | 申请人 |
| applicantDepartment | String | 申请部门 |
| purpose | String | 用途 |
| pressureTestResource | Object | 压测资源配置 |
| machineLabels | Array | 机器标签列表 |
| drillWindow | Object | 演练窗口（start, end） |
| status | String | 状态（pending/approved/active/released/expired） |
| conflicts | Array | 冲突列表 |
| approval | Object | 审批信息 |
| release | Object | 释放信息 |

### PurchaseInquiry (采购询价单)

| 字段 | 类型 | 说明 |
|------|------|------|
| inquiryNo | String | 询价单编号（唯一） |
| title | String | 标题 |
| applicant | String | 申请人 |
| applicantDepartment | String | 申请部门 |
| items | Array | 明细列表（含lineNumber和manualRemark） |
| overallRemark | String | 整体备注 |

## 健康检查

```
GET /health
```

## 许可证

MIT
