# 门店库存管理系统 - 架构设计

## 系统概述

这是一个企业级门店库存管理系统，重点解决以下核心问题：
- 数据一致性问题（改价、调拨）
- 重复提交问题
- 并发操作冲突
- 异步任务顺序错乱
- 缓存不一致
- 数据回滚失败

## 技术栈

### 后端
- **框架**: Node.js + Express
- **ORM**: Sequelize
- **数据库**: SQLite (可扩展到 PostgreSQL/MySQL)
- **认证**: JWT + bcryptjs
- **Excel导出**: ExcelJS
- **PDF导出**: PDFKit

### 前端
- **框架**: React 18
- **UI组件**: Ant Design 5
- **状态管理**: React Hooks + Context
- **HTTP客户端**: Axios
- **路由**: React Router 6

## 核心架构设计

### 1. 数据模型设计

#### 核心表结构

**Inventory (库存表)**
- 包含 `version` 字段用于乐观锁
- 每次更新自动递增版本号
- 事务中验证版本一致性

**OperationLog (操作日志表)**
- 记录每次操作的 `beforeState` 和 `afterState`
- 包含自动递增的 `sequence` 字段保证顺序
- 记录 `requestId` 用于追踪
- 记录完整的 `changeDetails`

**OperationRequest (幂等性表)**
- 唯一 `requestId` 索引
- 记录请求状态 (PENDING/PROCESSING/COMPLETED/DUPLICATE)
- 存储请求结果，重复请求直接返回

**LockRecord (锁记录表)**
- 分布式锁实现
- 支持锁超时自动释放
- 防止并发修改冲突

**InventorySnapshot (快照表)**
- 每次库存变更创建快照
- 用于数据审计和回滚
- 按版本号追踪历史

### 2. 并发控制机制

#### 乐观锁 (Optimistic Locking)
- 库存表使用 `version` 字段
- 更新时验证版本号是否匹配
- 不匹配则说明数据已被修改

#### 分布式锁 (Distributed Locking)
- 基于数据库的悲观锁实现
- 锁超时机制 (默认30秒)
- 操作完成后自动释放

#### 使用场景
- **乐观锁**: 读取多、写入少的场景
- **分布式锁**: 库存调整、改价、调拨等关键操作

### 3. 幂等性设计

#### 实现原理
1. 客户端每次请求生成唯一 `X-Request-ID`
2. 服务端先检查 `OperationRequest` 表
3. 已处理则直接返回结果
4. 处理中则返回错误或等待
5. 未处理则执行并记录结果

#### 关键代码位置
- 后端: `server/services/idempotencyService.js`
- 前端: `client/src/utils/api.js` (拦截器自动生成)

### 4. 操作回放机制

#### 实现方式
- 每次操作完整记录:
  - 操作前状态 (`beforeState`)
  - 操作后状态 (`afterState`)
  - 变更详情 (`changeDetails`)
- 回放时对比展示状态差异
- 支持时间线追踪

#### 支持的操作类型
- CREATE: 创建库存
- UPDATE: 更新库存
- ADJUST: 调整库存
- TRANSFER_IN: 调入
- TRANSFER_OUT: 调出
- PRICE_CHANGE: 改价
- SYNC: 同步

### 5. 事务处理

#### 完整事务流程
```
1. 检查幂等性 (OperationRequest)
2. 开启数据库事务
3. 记录操作请求状态 (PROCESSING)
4. 获取分布式锁 (如需要)
5. 执行业务操作
6. 创建状态快照 (InventorySnapshot)
7. 记录操作日志 (OperationLog)
8. 提交事务
9. 释放锁
10. 标记请求完成
```

#### 回滚策略
- 任何步骤失败 -> 事务回滚
- 操作日志记录失败状态
- 错误信息持久化
- 分布式锁自动超时释放

### 6. 导出功能

#### 支持的格式
- **Excel (.xlsx)**: 数据分析、打印
- **Markdown (.md)**: 文档记录、版本控制
- **PDF (.pdf)**: 正式报告、归档

#### 报表类型
- 库存报表: 包含汇总统计
- 操作日志报表: 审计追踪

## API 设计

### 认证相关
```
POST /api/auth/register    - 用户注册
POST /api/auth/login       - 用户登录
```

### 库存管理
```
GET    /api/inventory          - 获取库存列表
GET    /api/inventory/:id      - 获取库存详情
POST   /api/inventory          - 创建库存 (需要X-Request-ID)
POST   /api/inventory/:id/adjust - 调整库存 (需要X-Request-ID)
POST   /api/inventory/:id/price  - 修改价格 (需要X-Request-ID)
POST   /api/inventory/transfer  - 库存调拨 (需要X-Request-ID)
GET    /api/inventory/:id/snapshots - 获取历史快照
```

### 操作日志
```
GET    /api/operations              - 获取操作日志列表
GET    /api/operations/inventory/:id - 获取库存操作历史
GET    /api/operations/:id          - 获取操作详情
GET    /api/operations/:id/replay   - 操作回放
GET    /api/operations/transfers    - 获取调拨单列表
GET    /api/operations/price-changes - 获取价格变更记录
```

### 报表导出
```
GET /api/reports/inventory/excel     - 库存Excel
GET /api/reports/inventory/markdown  - 库存Markdown
GET /api/reports/inventory/pdf       - 库存PDF
GET /api/reports/operations/excel    - 操作日志Excel
```

### 仪表盘
```
GET /api/dashboard/stats            - 统计数据
GET /api/dashboard/recent-operations - 最近操作
GET /api/dashboard/low-stock-alerts  - 低库存预警
```

## 目录结构

```
.
├── server/                     # 后端代码
│   ├── index.js               # 入口文件
│   ├── models/                # 数据库模型
│   │   ├── index.js           # 模型初始化
│   │   ├── user.js            # 用户
│   │   ├── store.js           # 门店
│   │   ├── product.js         # 商品
│   │   ├── inventory.js       # 库存 (核心)
│   │   ├── inventorySnapshot.js # 快照
│   │   ├── operationLog.js    # 操作日志
│   │   ├── operationRequest.js # 幂等性记录
│   │   ├── transferOrder.js   # 调拨单
│   │   ├── priceChangeRecord.js # 价格变更
│   │   └── lockRecord.js      # 锁记录
│   ├── services/              # 业务逻辑
│   │   ├── inventoryService.js    # 库存操作
│   │   ├── auditService.js        # 审计/日志
│   │   ├── idempotencyService.js  # 幂等性
│   │   ├── lockService.js         # 分布式锁
│   │   └── exportService.js       # 导出
│   └── routes/                # 路由
│       ├── auth.js            # 认证
│       ├── inventory.js       # 库存
│       ├── operations.js      # 操作日志
│       ├── reports.js         # 报表
│       └── dashboard.js       # 仪表盘
├── client/                    # 前端代码
│   ├── src/
│   │   ├── index.js           # 入口
│   │   ├── App.js             # 路由配置
│   │   ├── components/        # 公共组件
│   │   ├── pages/             # 页面
│   │   │   ├── Login.js           # 登录
│   │   │   ├── Dashboard.js       # 仪表盘
│   │   │   ├── Inventory.js       # 库存管理
│   │   │   ├── Operations.js      # 操作日志
│   │   │   ├── OperationDetail.js # 操作详情
│   │   │   └── Reports.js         # 报表导出
│   │   ├── services/          # 前端服务
│   │   └── utils/             # 工具函数
│   └── package.json
├── scripts/
│   └── initData.js           # 初始化数据
├── package.json
└── ARCHITECTURE.md
```

## 核心特性说明

### 1. 防重复提交
- 每个请求带唯一 `X-Request-ID`
- 服务端检查是否已处理
- 重复请求返回上次结果

### 2. 并发控制
- **乐观锁**: 版本号校验
- **分布式锁**: 关键操作加锁
- **事务隔离**: 数据库事务保障

### 3. 操作追踪
- 完整的操作日志
- 变更前后状态快照
- 操作回放功能
- 请求ID全链路追踪

### 4. 数据一致性
- 完整的事务管理
- 失败自动回滚
- 错误信息持久化
- 版本号保证数据新鲜度

### 5. 报表导出
- 多种格式支持
- 灵活的筛选条件
- 汇总统计

## 部署说明

### 开发环境
```bash
# 1. 安装依赖
npm run install-all

# 2. 初始化数据
node scripts/initData.js

# 3. 启动开发服务器
npm run dev
```

### 生产环境
```bash
# 1. 构建前端
npm run build

# 2. 启动后端
npm run server
```

## 扩展建议

### 性能优化
1. 引入 Redis 缓存热点数据
2. 使用消息队列处理异步任务
3. 添加数据库索引
4. 实现分页查询优化

### 功能扩展
1. 实时库存同步 (WebSocket)
2. 库存预测算法
3. 多维度数据分析
4. 权限精细化管理
5. 移动端支持

### 可靠性增强
1. 数据库读写分离
2. 服务集群部署
3. 监控告警系统
4. 自动备份机制
