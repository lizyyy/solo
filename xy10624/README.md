# 桶装水押桶月结系统

一个偏 API 的全栈系统，包含前端导出入口、操作日志查询、详情时间线展示，核心业务逻辑在服务端实现。

## 系统架构

- **后端**: Node.js + Express + SQLite
- **前端**: React + Ant Design

## 核心功能

### 1. 客户地址管理
- 创建、更新、查询客户地址
- 自动记录操作日志
- 保留修改前后值

### 2. 桶编号校验
- 验证桶编号格式（BT + 6位数字）
- 检查桶的可用性状态
- 防止重复使用

### 3. 配送签收管理
- 创建配送单（自动生成编号）
- 验证桶编号
- 防止同一地址同一日期重复配送
- 更新桶状态为"使用中"

### 4. 退桶验收拦截
- 验证退桶编号是否属于配送单
- 规则拦截：单次退桶超过20个需要人工复核
- 人工审核支持通过/驳回

### 5. 破损扣押管理
- 记录破损扣押信息
- 支持修改并保留处理人、修改原因
- 记录影响的记录

### 6. 欠桶余额统计
- 实时计算客户欠桶数量
- 计算欠桶余额（按50元/桶）
- 支持导出余额报表

### 7. 操作日志
- 完整记录所有操作
- 保留修改前后值
- 支持按模块、操作人、时间范围筛选

### 8. 导出功能
- 导出破损扣押记录（支持按责任人、时间筛选）
- 导出欠桶余额报表
- 导出操作日志

## 内置场景

### 1. 正常完成
- 配送签收正常创建
- 退桶验收直接通过
- 桶状态自动更新

### 2. 被规则挡住
- 桶编号格式错误或不可用
- 同一地址同一日期重复配送
- 单次退桶超过20个触发拦截

### 3. 人工复核
- 被规则拦截的退桶申请进入审核状态
- 管理员可通过或驳回
- 记录审核意见

### 4. 重复提交
- 配送单重复提交检测
- 退桶申请重复提交检测

## 项目结构

```
xy10624/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   └── init.js          # 数据库初始化
│   │   ├── services/
│   │   │   ├── CustomerAddressService.js    # 客户地址服务
│   │   │   ├── BucketValidationService.js   # 桶校验服务
│   │   │   ├── DeliveryService.js           # 配送服务
│   │   │   ├── BucketReturnService.js       # 退桶服务
│   │   │   ├── DamageSeizureService.js      # 破损扣押服务
│   │   │   ├── BalanceService.js            # 余额计算服务
│   │   │   ├── OperationLogService.js       # 操作日志服务
│   │   │   └── ExportService.js             # 导出服务
│   │   └── index.js              # API 入口
│   ├── package.json
│   └── data/                    # SQLite 数据库文件
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js
│   │   └── App.js              # 前端主页面
│   └── package.json
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 启动后端服务

```bash
cd backend
npm start
```

后端服务将在 http://localhost:3001 启动

### 3. 启动前端

```bash
cd frontend
npm start
```

前端将在 http://localhost:3000 启动

## API 接口说明

### 客户地址
- `POST /api/customer-addresses` - 创建客户地址
- `PUT /api/customer-addresses/:id` - 更新客户地址
- `GET /api/customer-addresses` - 查询客户地址列表
- `GET /api/customer-addresses/:id` - 查询单个客户地址

### 配送签收
- `POST /api/deliveries` - 创建配送签收
- `GET /api/deliveries` - 查询配送列表
- `GET /api/deliveries/:deliveryNo` - 查询单个配送

### 退桶验收
- `POST /api/bucket-returns` - 创建退桶申请
- `POST /api/bucket-returns/:returnNo/review` - 审核退桶申请
- `GET /api/bucket-returns` - 查询退桶列表
- `GET /api/bucket-returns/:returnNo` - 查询单个退桶

### 破损扣押
- `POST /api/damage-seizures` - 创建破损扣押记录
- `PUT /api/damage-seizures/:seizureNo` - 更新破损扣押记录
- `GET /api/damage-seizures` - 查询破损扣押列表
- `GET /api/damage-seizures/:seizureNo` - 查询单个破损扣押

### 欠桶余额
- `GET /api/balances` - 查询所有客户余额
- `GET /api/balances/:customerAddressId` - 查询单个客户余额

### 操作日志
- `GET /api/operation-logs` - 查询操作日志
- `GET /api/timeline/:module/:recordId` - 查询单条记录时间线

### 导出
- `GET /api/export/damage-seizures` - 导出破损扣押记录（支持查询参数：startDate, endDate, handled_by）
- `GET /api/export/balances` - 导出欠桶余额报表
- `GET /api/export/operation-logs` - 导出操作日志（支持查询参数：startDate, endDate, operator）

## 数据库表结构

### customer_addresses - 客户地址
- id: 主键
- customer_id: 客户ID
- customer_name: 客户名称
- phone: 电话
- address: 地址
- area_type: 区域类型（residential/commercial/office）
- bucket_capacity: 桶容量
- is_active: 是否激活

### buckets - 桶
- id: 主键
- bucket_code: 桶编号（唯一）
- status: 状态（available/in_use/damaged/lost/seized）
- bucket_type: 桶类型
- manufacture_date: 生产日期
- last_inspection_date: 最后检查日期

### delivery_signoffs - 配送签收
- id: 主键
- delivery_no: 配送单号
- customer_address_id: 客户地址ID
- bucket_codes: 桶编号（逗号分隔）
- bucket_count: 桶数量
- delivery_date: 配送日期
- delivery_person: 配送人
- receiver_name: 接收人
- receiver_phone: 接收人电话
- signoff_photo: 签收照片
- remarks: 备注
- status: 状态（pending/confirmed/cancelled）

### bucket_returns - 退桶验收
- id: 主键
- return_no: 退桶单号
- delivery_no: 配送单号
- customer_address_id: 客户地址ID
- bucket_codes: 桶编号（逗号分隔）
- bucket_count: 桶数量
- return_date: 退桶日期
- collector_name: 收集人
- inspector_name: 检查人
- inspection_result: 检查结果
- inspection_remarks: 检查备注
- status: 状态（pending/inspecting/accepted/rejected/reviewing/completed）
- is_blocked: 是否被拦截
- block_reason: 拦截原因
- reviewed_by: 审核人
- reviewed_at: 审核时间

### damage_seizures - 破损扣押
- id: 主键
- seizure_no: 扣押单号
- return_no: 退桶单号
- bucket_code: 桶编号
- damage_type: 破损类型（crack/leak/deformation/missing_parts/contamination/other）
- damage_level: 破损程度（minor/moderate/severe）
- seizure_reason: 扣押原因
- is_compensable: 是否赔偿
- compensation_amount: 赔偿金额
- status: 状态（pending/confirmed/appealed/resolved）
- handled_by: 当前处理人
- previous_handler: 前处理人
- change_reason: 修改原因
- affected_records: 影响记录

### bucket_balances - 欠桶余额
- id: 主键
- customer_address_id: 客户地址ID（唯一）
- total_borrowed: 总借桶数
- total_returned: 总还桶数
- total_damaged: 总破损数
- total_seized: 总扣押数
- outstanding_balance: 欠桶数
- balance_amount: 欠桶金额
- last_calculated_at: 最后计算时间

### operation_logs - 操作日志
- id: 主键
- operation_type: 操作类型（CREATE/UPDATE/REVIEW/DELETE）
- module: 模块
- record_id: 记录ID
- record_no: 记录编号
- before_values: 修改前值（JSON）
- after_values: 修改后值（JSON）
- operator: 操作人ID
- operator_name: 操作人姓名
- operation_remark: 操作备注
- ip_address: IP地址
- user_agent: 用户代理
- created_at: 创建时间

## 前端功能

### 数据导出页面
- 支持按时间范围筛选
- 支持按操作人筛选
- 支持按模块筛选
- 一键导出破损扣押记录
- 一键导出欠桶余额报表
- 一键导出操作日志

### 操作日志页面
- 日志列表展示
- 筛选条件：时间范围、操作人、模块
- 点击"查看详情"查看时间线
- 时间线展示：操作人、操作时间、修改前后对比

## 开发说明

### 环境变量
后端支持通过环境变量配置：
- `PORT`: 服务端口，默认 3001

### 请求头
所有 API 请求支持以下请求头：
- `x-operator-id`: 操作人ID
- `x-operator-name`: 操作人姓名

## 注意事项

1. 数据库文件默认存储在 `backend/data/` 目录
2. 首次启动会自动初始化数据库并插入测试数据
3. 测试数据包含 100 个可用桶和 2 个测试客户
4. 破损赔偿金额默认 50 元/桶
5. 单次退桶超过 20 个会触发人工复核规则
