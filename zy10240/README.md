# 绿植租摆换盆记录 API

一个完整的绿植租摆管理系统，支持客户点位管理、植物养护、换盆、枯萎处理、赔偿和续租账单管理。

## 功能特性

### 核心业务模块

- **客户管理**：客户信息增删改查
- **点位管理**：客户点位（位置）管理
- **植物管理**：植物信息、状态管理
- **养护任务**：养护流程、状态流转
- **换盆记录**：换盆操作、花盆更换追踪
- **枯萎处理**：枯萎植物处理记录
- **赔偿管理**：赔偿申请、审批、支付流程
- **续租合同**：合同创建、确认、取消
- **账单管理**：账单生成、开具、支付

### 系统特性

1. **清晰的状态流转设计**：
   - 植物状态：健康 → 需要养护 → 枯萎 → 死亡 / 换盆 / 移动
   - 养护任务：待处理 → 进行中 → 需换盆 / 需赔偿 → 完成 / 取消
   - 赔偿：待处理 → 已审批 → 已支付 / 已豁免
   - 账单：草稿 → 已开具 → 已支付 / 已逾期

2. **重复请求防护**：
   - 基于 request_id 的幂等性控制
   - 防止重复提交导致的数据重复

3. **操作历史记录**：
   - 所有业务操作都有历史记录
   - 支持追溯操作人和操作时间
   - 可查看单条记录的完整变更历史

4. **植物完整历史**：
   - 查看单盆植物的所有养护、换盆、赔偿、移动记录
   - 完整的生命周期追踪

## 技术栈

- Node.js + Express
- SQLite3 数据库
- RESTful API 设计

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 3. 初始化测试数据

（打开新终端）

```bash
npm run init-db
```

### 4. 运行完整业务流程演示

```bash
npm run demo
```

## API 接口列表

### 客户与点位

```
POST   /api/customers           - 创建客户
GET    /api/customers           - 获取所有客户
GET    /api/customers/:id       - 获取单个客户
PUT    /api/customers/:id       - 更新客户

POST   /api/customers/locations - 创建点位
GET    /api/customers/locations - 获取所有点位
GET    /api/customers/:customerId/locations - 获取客户的点位
```

### 植物管理

```
POST   /api/plants              - 创建植物
GET    /api/plants              - 获取所有植物
GET    /api/plants/:id          - 获取单个植物
GET    /api/plants/:id/history  - 获取植物完整历史记录
GET    /api/plants/location/:locationId - 获取点位的植物
POST   /api/plants/move         - 移动植物到其他点位
PUT    /api/plants/:id/status   - 更新植物状态
```

### 养护任务

```
POST   /api/maintenance         - 创建养护任务
GET    /api/maintenance         - 获取所有养护任务
GET    /api/maintenance/:id     - 获取单个任务
GET    /api/maintenance/:id/history - 获取任务历史
POST   /api/maintenance/:id/start - 开始任务
POST   /api/maintenance/:id/complete - 完成任务
POST   /api/maintenance/:id/needs-repotting - 标记需换盆
POST   /api/maintenance/:id/needs-compensation - 标记需赔偿
POST   /api/maintenance/:id/cancel - 取消任务
```

### 换盆记录

```
POST   /api/repotting           - 创建换盆记录
GET    /api/repotting           - 获取所有换盆记录
GET    /api/repotting/:id       - 获取单个记录
GET    /api/repotting/:id/history - 获取记录历史
GET    /api/repotting/plant/:plantId - 获取植物的换盆记录
```

### 赔偿管理

```
POST   /api/compensations       - 创建赔偿记录
GET    /api/compensations       - 获取所有赔偿记录
GET    /api/compensations/:id   - 获取单个赔偿记录
GET    /api/compensations/:id/history - 获取赔偿历史
POST   /api/compensations/:id/approve - 审批赔偿
POST   /api/compensations/:id/mark-paid - 标记已支付
POST   /api/compensations/:id/waive - 豁免赔偿
```

### 续租与账单

```
POST   /api/renewal/contracts   - 创建续租合同
GET    /api/renewal/contracts   - 获取所有合同
GET    /api/renewal/contracts/:id - 获取单个合同
GET    /api/renewal/contracts/:id/history - 获取合同历史
POST   /api/renewal/contracts/:id/confirm - 确认合同
POST   /api/renewal/contracts/:id/cancel - 取消合同
POST   /api/renewal/contracts/:id/generate-bill - 生成账单

GET    /api/renewal/bills       - 获取所有账单
GET    /api/renewal/bills/:id   - 获取单个账单
POST   /api/renewal/bills/:id/issue - 开具账单
POST   /api/renewal/bills/:id/mark-paid - 标记账单已支付
```

## 核心设计要点

### 1. 幂等性设计

所有写操作接口都需要传入 `request_id`，系统会自动去重。相同的 `request_id` 不会重复创建记录。

```json
{
  "request_id": "req_123456789",
  "operated_by": "张三",
  ...
}
```

### 2. 状态机校验

所有状态变更都经过状态机校验，非法的状态流转会被拒绝并返回错误。

### 3. 历史记录

所有操作都记录操作历史，包括：
- 操作类型
- 操作人
- 操作时间
- 变更前后的数据

### 4. 完整的业务流程演示

运行 `npm run demo` 可以看到完整的业务流程：

1. 查询客户和点位
2. 发现异常植物
3. 创建养护任务
4. 执行养护并标记需要赔偿
5. 创建赔偿记录 → 审批 → 支付
6. 完成养护任务
7. 植物跨点位移动
8. 创建换盆记录
9. 创建续租合同 → 确认
10. 生成续租账单 → 开具 → 支付
11. 查看植物完整历史
12. 演示重复请求防护

## 项目结构

```
plant-rental-api/
├── src/
│   ├── app.js                  # 应用入口
│   ├── config/
│   │   └── database.js         # 数据库配置
│   ├── models/                 # 数据模型
│   ├── controllers/            # 控制器
│   ├── routes/                 # 路由
│   ├── services/               # 业务服务
│   ├── middleware/             # 中间件
│   └── scripts/                # 脚本文件
├── data/                       # 数据库文件目录
├── package.json
└── README.md
```

## 数据库表

- customers - 客户表
- locations - 点位表
- plants - 植物表
- maintenance_tasks - 养护任务表
- repotting_records - 换盆记录表
- withering_treatments - 枯萎处理记录表
- compensations - 赔偿记录表
- plant_movements - 植物移动记录表
- renewal_contracts - 续租合同表
- renewal_bills - 续租账单表
- operation_history - 操作历史表
- request_deduplication - 请求去重表

## 健康检查

```bash
curl http://localhost:3000/api/health
```
