# 保洁耗材区域核算系统

一个完整的全栈应用，用于管理保洁耗材的全生命周期，包括SKU管理、班次领用、区域管理、退回验收、补货预警和成本差异分析。

## 功能特性

### 核心业务模块
1. **耗材SKU管理** - 管理耗材基础信息，包括分类、单位、单价、安全库存等
2. **班次领用管理** - 管理各区域各班次的耗材领用申请和审批
3. **区域管理** - 管理清洁区域信息，包括面积、负责人等
4. **退回验收** - 管理耗材退回的验收流程，支持拦截不合格退回
5. **补货预警** - 库存低于安全库存时自动预警，支持补货处理
6. **成本差异分析** - 分析预期成本与实际成本的差异

### 关键功能实现
- ✅ **退回验收拦截** - 对不符合要求的退回申请进行拦截，记录原因
- ✅ **补货预警留痕** - 所有预警处理操作都有完整日志记录
- ✅ **重复回调不重复扣减** - 通过回调记录防止重复操作
- ✅ **详情时间线** - 每个业务记录都有完整的操作时间线
- ✅ **状态按钮** - 可视化的状态流转操作按钮

### 报告功能
- ✅ 责任节点报告导出（Excel格式）
- ✅ 按责任人筛选
- ✅ 按处理时间筛选
- ✅ 完整记录修改前后的值

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- ExcelJS (Excel导出)
- uuid

### 前端
- React 18
- Ant Design 5
- Axios
- Day.js

## 快速开始

### 1. 安装依赖

```bash
# 方式一：根目录一键安装
npm install

# 方式二：分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 2. 初始化数据库

数据库文件会在首次启动时自动创建在 `backend/data/` 目录下。

### 3. 启动项目

```bash
# 同时启动前后端（推荐）
npm run dev

# 或者分别启动
# 启动后端 (端口 3001)
cd backend && npm start

# 启动前端 (端口 3000)
cd frontend && npm start
```

### 4. 初始化样例数据

登录系统后，点击右上角的"创建样例数据"按钮，系统将自动生成：
- 2个耗材SKU
- 2个区域
- 2条领用记录
- 1条退回验收记录（问题流）
- 1条补货预警记录（已处理）
- 1条成本差异记录（已复核）

## 项目结构

```
cleaning-supplies-accounting/
├── backend/                    # 后端项目
│   ├── src/
│   │   ├── server.js          # 服务器入口
│   │   ├── database/          # 数据库配置
│   │   │   └── db.js
│   │   ├── routes/            # 路由文件
│   │   │   ├── skuRoutes.js
│   │   │   ├── shiftUsageRoutes.js
│   │   │   ├── areaRoutes.js
│   │   │   ├── returnInspectionRoutes.js
│   │   │   ├── replenishmentAlertRoutes.js
│   │   │   ├── costVarianceRoutes.js
│   │   │   ├── reportRoutes.js
│   │   │   └── logRoutes.js
│   │   ├── utils/             # 工具函数
│   │   │   ├── logger.js      # 操作日志
│   │   │   └── callbackGuard.js  # 重复回调防护
│   │   └── scripts/
│   ├── data/                  # 数据库文件目录（自动创建）
│   └── package.json
│
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── services/          # API 服务
│   │   │   └── api.js
│   │   └── components/        # 组件
│   │       ├── SkuList.js
│   │       ├── ShiftUsageList.js
│   │       ├── AreaList.js
│   │       ├── ReturnInspectionList.js
│   │       ├── ReplenishmentAlertList.js
│   │       ├── CostVarianceList.js
│   │       └── ReportPage.js
│   └── package.json
│
└── package.json
```

## 数据库设计

### 核心表
- `sku` - 耗材SKU表
- `shift_usage` - 班次领用表
- `area` - 区域表
- `return_inspection` - 退回验收表
- `replenishment_alert` - 补货预警表
- `cost_variance` - 成本差异表
- `operation_log` - 操作日志表（记录所有变更）
- `callback_record` - 回调记录表（防止重复回调）

## API 接口

### SKU管理
- `GET /api/sku` - 获取SKU列表
- `GET /api/sku/:id` - 获取单个SKU
- `POST /api/sku` - 创建SKU
- `PUT /api/sku/:id` - 更新SKU

### 班次领用
- `GET /api/shift-usage` - 获取领用列表
- `POST /api/shift-usage/:id/approve` - 审批领用

### 区域管理
- `GET /api/area` - 获取区域列表
- `POST /api/area` - 创建区域
- `PUT /api/area/:id` - 更新区域

### 退回验收
- `GET /api/return-inspection` - 获取验收列表
- `POST /api/return-inspection/:id/inspect` - 验收操作

### 补货预警
- `GET /api/replenishment-alert` - 获取预警列表
- `POST /api/replenishment-alert/:id/handle` - 处理预警

### 成本差异
- `GET /api/cost-variance` - 获取差异列表
- `POST /api/cost-variance/calculate` - 计算差异
- `POST /api/cost-variance/:id/review` - 复核差异

### 报告
- `GET /api/report/export` - 导出Excel报告
- `GET /api/report/sample-data/create` - 创建样例数据

### 日志
- `GET /api/logs` - 获取操作日志（支持筛选）
- `GET /api/logs/:businessType/:businessId` - 获取特定业务的日志

## 业务流程说明

### 正常流程
1. 创建SKU → 设置安全库存
2. 创建区域 → 分配负责人
3. 创建领用申请 → 审批通过 → 扣减库存
4. 库存不足 → 自动触发补货预警 → 处理预警 → 补货入库

### 问题流程
1. 创建领用申请 → 审批通过
2. 发起退回申请 → 验收不合格 → 拦截退回 → 记录原因

### 复核流程
1. 计算成本差异 → 分析差异原因
2. 复核差异 → 记录复核意见

## 特色功能说明

### 1. 操作日志系统
- 所有增删改操作都自动记录日志
- 记录修改前后的值（old_value / new_value）
- 按业务类型、业务ID、操作人、时间筛选
- 详情页显示时间线

### 2. 重复回调防护
- 通过 `callback_record` 表记录所有回调
- 相同 callback_id 第二次调用时自动跳过
- 覆盖所有关键状态变更接口

### 3. 时间线展示
- 每个业务记录详情都有操作时间线
- 直观展示业务流转过程
- 支持追溯责任人和操作时间

### 4. Excel报告导出
- 使用 ExcelJS 生成专业报告
- 包含完整的责任节点信息
- 支持按条件筛选导出

## 开发说明

### 后端开发
```bash
cd backend
npm run dev  # 使用 nodemon 自动重启
```

### 前端开发
```bash
cd frontend
npm start    # 使用 create-react-app dev server
```

### 数据库
- 数据库文件路径：`backend/data/cleaning_supplies.db`
- 如需重置数据库，直接删除该文件即可重新初始化

## 注意事项

1. 首次启动前请确保已安装所有依赖
2. 后端默认端口 3001，前端默认端口 3000
3. 数据库文件会自动创建，无需手动初始化
4. 样例数据包含完整的业务流程演示

## License

MIT