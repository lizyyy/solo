# 库存预占状态机 (Inventory Reservation State Machine)

一个解决活动系统预占库存后订单取消和支付超时释放问题的全栈解决方案。

## 核心功能

### 状态机规则
- **预占扣减**: 创建预占单时自动扣减可用库存，增加预占库存
- **超时释放**: 定时任务自动扫描并释放过期预占
- **取消补偿**: 支持订单取消时的库存补偿
- **重复回调幂等**: 同一订单重复创建预占时返回已有记录
- **库存流水**: 完整记录所有库存变更操作

### 后端 API
- `POST /api/reservations` - 创建预占单
- `GET /api/reservations` - 查询预占单列表
- `GET /api/reservations/:id` - 查询单个预占单
- `POST /api/reservations/:id/confirm` - 确认预占（扣减库存）
- `POST /api/reservations/:id/release` - 释放预占（归还库存）
- `POST /api/reservations/:id/compensate` - 手动补偿释放
- `GET /api/reservations/export/csv` - 导出预占单CSV

- `POST /api/inventory/pool` - 创建库存池
- `GET /api/inventory/pool` - 查询库存池列表
- `GET /api/inventory/logs` - 查询库存流水

- `GET /api/admin/stats` - 获取统计数据
- `GET /api/admin/failed-releases` - 获取释放失败列表
- `POST /api/admin/process-timeouts` - 处理超时任务

### 前端控制台
- **总览页**: 统计看板、库存池状态、快捷操作
- **预占单页**: 创建、查询、确认、释放、导出、搜索筛选
- **库存池页**: 创建库存池、查看流水记录
- **异常释放页**: 失败预占单列表、手动补偿入口、补偿记录

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (数据持久化)
- json2csv (数据导出)

### 前端
- React 18
- React Router
- TypeScript
- Vite
- Axios

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── database/          # 数据库层
│   │   │   ├── db.ts          # 数据库连接和基础操作
│   │   │   └── schema.ts      # 表结构和枚举定义
│   │   ├── services/          # 业务逻辑层
│   │   │   └── StateMachineService.ts  # 状态机核心服务
│   │   ├── routes/            # API路由
│   │   │   ├── reservation.ts
│   │   │   ├── inventory.ts
│   │   │   └── admin.ts
│   │   ├── scripts/           # 工具脚本
│   │   │   ├── initDb.ts      # 数据库初始化
│   │   │   └── runTests.ts    # 集成测试脚本
│   │   └── server.ts          # 服务器入口
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/               # API客户端
│   │   ├── pages/             # 页面组件
│   │   ├── App.tsx            # 应用入口
│   │   ├── main.tsx           # 渲染入口
│   │   └── index.css          # 全局样式
│   └── package.json
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 2. 初始化数据库

```bash
cd backend
npm run init:db
```

### 3. 运行测试（验证核心规则）

```bash
cd backend
npm test
```

测试覆盖以下场景：
- ✅ 创建库存池
- ✅ 获取库存池信息
- ✅ 创建预占单（库存扣减验证）
- ✅ 重复预占幂等性（同一订单不重复扣减）
- ✅ 库存不足时的错误处理
- ✅ 确认预占（库存扣减验证）
- ✅ 释放预占（订单取消场景）
- ✅ 库存流水记录完整性
- ✅ 释放记录查询
- ✅ 统计数据查询
- ✅ 按状态筛选预占单
- ✅ 超时任务自动处理

### 4. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务运行在: http://localhost:3001

### 5. 启动前端服务

```bash
cd frontend
npm run dev
```

前端服务运行在: http://localhost:3000

## 数据模型

### inventory_pool (库存池)
- pool_id: 主键
- pool_name: 名称
- total_quantity: 总库存量
- reserved_quantity: 预占库存量
- available_quantity: 可用库存量
- created_at, updated_at

### reservation (预占单)
- reservation_id: 主键
- order_id: 订单ID（用于幂等）
- pool_id: 所属库存池
- quantity: 预占数量
- status: 状态 (RESERVED/CONFIRMED/RELEASED/RELEASE_FAILED)
- expire_at: 过期时间
- created_at, updated_at

### timeout_task (超时任务)
- task_id: 主键
- reservation_id: 关联预占单
- scheduled_at: 计划执行时间
- executed_at: 实际执行时间
- status: 任务状态
- retry_count: 重试次数
- max_retries: 最大重试次数
- error_message: 错误信息

### release_record (释放记录)
- record_id: 主键
- reservation_id: 关联预占单
- order_id: 订单ID
- pool_id: 库存池ID
- quantity: 释放数量
- release_type: 释放类型 (TIMEOUT/ORDER_CANCEL/MANUAL/COMPENSATION)
- release_reason: 释放原因
- released_by: 操作人

### compensation_action (补偿动作)
- action_id: 主键
- reservation_id: 关联预占单
- action_type: 操作类型
- action_status: 状态 (PENDING/PROCESSING/SUCCESS/FAILED)
- executed_by: 操作人
- error_message: 错误信息
- created_at, executed_at

### inventory_log (库存流水)
- log_id: 主键
- pool_id: 库存池ID
- reservation_id: 关联预占单
- order_id: 订单ID
- change_type: 变更类型 (RESERVE/CONFIRM/RELEASE)
- quantity_change: 数量变更
- before_total/after_total: 变更前后总量
- before_reserved/after_reserved: 变更前后预占量
- operator: 操作人
- remark: 备注
- created_at

## 状态流转图

```
RESERVED (预占中)
    │
    ├──> CONFIRMED (已确认)  [支付成功]
    │       │
    │       └──> [END] 库存永久扣减
    │
    ├──> RELEASING (释放中)  [支付超时/取消订单]
    │       │
    │       ├──> RELEASED (已释放)  [成功]
    │       │       │
    │       │       └──> [END] 库存归还
    │       │
    │       └──> RELEASE_FAILED (释放失败)  [异常]
    │                       │
    │                       └──> MANUAL COMPENSATION  [运营手动补偿]
    │
    └──> [TIMEOUT] 自动触发释放
```

## 核心设计原则

1. **幂等性保障**: 同一订单ID重复创建预占时返回已有记录
2. **事务一致性**: 所有库存操作使用数据库事务确保ACID
3. **状态机严格校验**: 非法状态跳转直接拒绝
4. **完整审计追踪**: 所有操作都有流水记录可追溯
5. **异常重试机制**: 超时任务自动重试，失败后支持手动补偿
6. **前后端规则统一**: 所有核心规则只在后端实现，前端只做展示和触发

## 生产环境建议

1. **数据库**: 将 SQLite 替换为 PostgreSQL/MySQL
2. **定时任务**: 使用 BullMQ 或类似的分布式任务调度系统替代简单扫描
3. **缓存层**: 增加 Redis 缓存热点库存池数据
4. **监控告警**: 接入 Prometheus + Grafana 监控预占成功率、释放延迟等指标
5. **高可用**: 后端服务多实例部署，数据库主从复制
6. **接口鉴权**: 增加 JWT/OAuth 认证和权限控制