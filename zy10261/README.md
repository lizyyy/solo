# 小贷还款宽限 API

一个完整的小额贷款还款宽限管理系统，提供合同管理、还款处理、宽限申请审批、催收管理等功能。

## 功能特性

### 核心功能
- ✅ **合同管理**: 创建、查询合同，自动生成分期账期
- ✅ **账期管理**: 自动计算每期本金、利息、应还金额
- ✅ **还款处理**: 支持全额还款、部分还款，自动更新账期状态
- ✅ **宽限申请**: 提交宽限申请，自动校验宽限资格
- ✅ **审批流程**: 宽限申请审批通过/拒绝，自动延后还款日
- ✅ **催收管理**: 催收记录、催收冻结/解冻

### 特殊业务逻辑
- ✅ **催收中仍可宽限**: 合同在催收中时，宽限需特别审批
- ✅ **部分还款重复入账**: 使用 sourceId 防重机制
- ✅ **宽限超过次数限制**: 校验最大宽限次数
- ✅ **审批后账期自动更新**: 审批通过后自动更新账期还款日和状态

### 技术特性
- ✅ 本地 SQLite 持久化存储
- ✅ 事务处理保证数据一致性
- ✅ 防重提交机制
- ✅ 可复现的演示脚本
- ✅ 完整的 API 文档

## 技术栈

- **Node.js**: 运行环境
- **Express.js**: Web 框架
- **Sequelize**: ORM 框架
- **SQLite**: 本地数据库
- **Moment.js**: 日期处理

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库并添加种子数据
```bash
npm run seed
```

### 3. 运行完整功能演示
```bash
npm run demo
```

### 4. 启动 API 服务
```bash
npm start
```

服务将运行在 `http://localhost:3000`

## API 端点

### 合同管理
- `POST /api/contracts` - 创建合同
- `GET /api/contracts` - 查询合同列表
- `GET /api/contracts/:id` - 查询合同详情
- `GET /api/contracts/no/:contractNo` - 按合同号查询
- `GET /api/contracts/:contractId/forbearance-eligibility/:installmentId` - 查询宽限资格

### 还款管理
- `POST /api/repayments` - 创建还款
- `POST /api/repayments/trial` - 还款试算
- `GET /api/repayments/:id` - 查询还款详情
- `GET /api/repayments/contract/:contractId` - 查询合同还款记录

### 宽限申请管理
- `POST /api/forbearance` - 提交宽限申请
- `POST /api/forbearance/:id/approve` - 审批通过
- `POST /api/forbearance/:id/reject` - 审批拒绝
- `GET /api/forbearance/:id` - 查询申请详情
- `GET /api/forbearance/contract/:contractId` - 查询合同宽限申请

### 催收管理
- `POST /api/collections` - 创建催收记录
- `POST /api/collections/freeze/:contractId` - 催收冻结
- `POST /api/collections/unfreeze/:contractId` - 解除催收冻结
- `GET /api/collections/status/:contractId` - 查询催收状态
- `GET /api/collections/:id` - 查询催收详情
- `GET /api/collections/contract/:contractId` - 查询合同催收记录

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── models/
│   │   ├── index.js           # 模型关联
│   │   ├── Contract.js        # 合同模型
│   │   ├── Installment.js     # 账期模型
│   │   ├── Repayment.js       # 还款记录模型
│   │   ├── ForbearanceApplication.js  # 宽限申请模型
│   │   └── Collection.js      # 催收记录模型
│   ├── services/
│   │   ├── ContractService.js      # 合同服务
│   │   ├── RepaymentService.js     # 还款服务
│   │   ├── ForbearanceService.js   # 宽限服务
│   │   └── CollectionService.js    # 催收服务
│   ├── routes/
│   │   ├── contracts.js       # 合同路由
│   │   ├── repayments.js      # 还款路由
│   │   ├── forbearance.js     # 宽限路由
│   │   └── collections.js     # 催收路由
│   └── scripts/
│       ├── seed.js            # 种子数据脚本
│       └── demo.js            # 功能演示脚本
├── package.json
├── README.md
└── API_EXAMPLES.md            # API 示例文档
```

## 业务流程示例

### 宽限申请流程
1. 客服查询客户宽限资格
2. 符合条件时提交宽限申请
3. 审批经理审批申请
4. 审批通过后自动延后账期还款日
5. 冻结该合同的催收

### 部分还款流程
1. 客户申请部分还款
2. 进行还款试算，确认还款分配
3. 创建还款记录
4. 自动更新对应账期的已还金额和剩余金额
5. 账期状态更新为 partial（部分还款）

## 防重机制

所有支持外部调用的接口都支持 `sourceId` 参数，用于防止重复提交：

- 还款接口: `sourceId` 字段
- 宽限申请接口: `sourceId` 字段

使用相同的 `sourceId` 重复提交时，系统会检测到重复并返回已存在的记录。

## 健康检查

```bash
GET /health
```

## 完整 API 文档

详细的 API 示例请参考: [API_EXAMPLES.md](./API_EXAMPLES.md)

## License

MIT
