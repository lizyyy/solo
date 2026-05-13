# 汽修保养套餐核销系统

## 项目简介

汽修保养套餐核销系统，包含车辆里程管理、套餐订单、保养项目、核销记录、异常看板、下次提醒和报表导出功能。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: Vue 3 + Element Plus + ECharts

## 启动步骤

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 2. 初始化数据库

```bash
npm run init-db
```

该命令会创建数据库表并插入示例数据。

### 3. 启动后端服务

```bash
npm start
# 或开发模式
npm run dev
```

后端服务运行在 `http://localhost:3000`

### 4. 启动前端服务

```bash
cd client
npm run serve
```

前端服务运行在 `http://localhost:8080`

## 功能模块

### 1. 数据概览
- 统计卡片：车辆总数、套餐订单、今日核销、待处理异常
- 月度核销趋势图表
- 经办人排名图表
- 待处理提醒列表
- 最近异常列表

### 2. 车辆里程管理
- 车辆信息增删改查
- 按车牌号、车型、负责人筛选
- 修改日志记录（保留修改前后值）
- 查看修改历史

### 3. 套餐订单管理
- 订单信息增删改查
- 按订单号、车牌号、客户、状态、负责人筛选
- 修改日志记录（保留修改前后值）
- 查看修改历史

### 4. 保养项目管理
- 项目信息增删改查
- 按项目编码、项目名称、负责人筛选
- 修改日志记录（保留修改前后值）
- 查看修改历史

### 5. 核销记录
- 新增核销记录
- 自动计算补差金额
- 自动生成异常记录（超里程时）
- 自动生成下次保养提醒
- 按车牌号、经办人、是否异常筛选

### 6. 异常看板
- 异常记录列表
- 按状态、异常类型筛选
- 异常处理功能（记录修正人和新值）
- 显示异常原因、原值、新值

### 7. 下次提醒
- 待提醒列表
- 标记已提醒功能
- 按状态筛选

### 8. 报表导出
- 核销记录报表导出（Excel）
  - 支持按日期范围筛选
  - 支持按经办人筛选
  - 支持仅导出异常记录
- 异常记录报表导出（Excel）
  - 支持按日期范围筛选
  - 支持按状态筛选
  - 支持按修正人筛选
- 车辆里程报表导出（Excel）
  - 支持按负责人筛选

## 关键接口

### 车辆相关
- `GET /api/vehicles` - 获取车辆列表
- `POST /api/vehicles` - 新增车辆
- `PUT /api/vehicles/:id` - 编辑车辆
- `DELETE /api/vehicles/:id` - 删除车辆
- `GET /api/vehicles/:id/logs` - 获取修改日志

### 订单相关
- `GET /api/orders` - 获取订单列表
- `POST /api/orders` - 新增订单
- `PUT /api/orders/:id` - 编辑订单
- `DELETE /api/orders/:id` - 删除订单
- `GET /api/orders/:id/logs` - 获取修改日志

### 保养项目相关
- `GET /api/items` - 获取项目列表
- `POST /api/items` - 新增项目
- `PUT /api/items/:id` - 编辑项目
- `DELETE /api/items/:id` - 删除项目
- `GET /api/items/:id/logs` - 获取修改日志

### 核销相关
- `GET /api/verifications` - 获取核销记录
- `POST /api/verifications` - 新增核销
- `DELETE /api/verifications/:id` - 删除核销

### 异常相关
- `GET /api/exceptions` - 获取异常列表
- `PUT /api/exceptions/:id/resolve` - 处理异常

### 提醒相关
- `GET /api/reminders` - 获取提醒列表
- `PUT /api/reminders/:id/status` - 更新提醒状态

### 统计相关
- `GET /api/stats` - 获取统计数据
- `GET /api/stats/monthly-data` - 获取月度数据
- `GET /api/stats/handler-ranking` - 获取经办人排名

### 报表导出相关
- `GET /api/reports/verifications` - 导出核销记录报表
- `GET /api/reports/exceptions` - 导出异常记录报表
- `GET /api/reports/vehicles` - 导出车辆里程报表

## 数据库表结构

### vehicle_mileage（车辆里程）
- id: 主键
- plate_number: 车牌号
- vehicle_model: 车型
- current_mileage: 当前里程
- last_maintenance_date: 上次保养日期
- next_maintenance_mileage: 下次保养里程
- responsible_person: 负责人
- created_at: 创建时间
- updated_at: 更新时间

### package_orders（套餐订单）
- id: 主键
- order_no: 订单号
- plate_number: 车牌号
- customer_name: 客户姓名
- package_name: 套餐名称
- total_amount: 总金额
- purchase_date: 购买日期
- expire_date: 过期日期
- remaining_times: 剩余次数
- used_times: 已用次数
- responsible_person: 负责人
- status: 状态
- created_at: 创建时间
- updated_at: 更新时间

### maintenance_items（保养项目）
- id: 主键
- item_code: 项目编码
- item_name: 项目名称
- description: 描述
- standard_mileage: 标准里程
- standard_days: 标准天数
- price: 价格
- responsible_person: 负责人
- created_at: 创建时间
- updated_at: 更新时间

### supplement_rules（补差规则）
- id: 主键
- rule_name: 规则名称
- item_id: 项目ID
- condition_type: 条件类型
- condition_value: 条件值
- supplement_amount: 补差金额
- description: 描述
- created_at: 创建时间

### verification_records（核销记录）
- id: 主键
- verification_no: 核销单号
- order_id: 订单ID
- vehicle_id: 车辆ID
- item_id: 项目ID
- mileage_at: 核销日期
- actual_mileage: 实际里程
- supplement_amount: 补差金额
- total_amount: 总金额
- handler: 经办人
- remarks: 备注
- exception_reason: 异常原因
- created_at: 创建时间

### next_reminders（下次提醒）
- id: 主键
- vehicle_id: 车辆ID
- item_id: 项目ID
- reminder_mileage: 提醒里程
- reminder_date: 提醒日期
- status: 状态
- created_at: 创建时间

### exceptions（异常记录）
- id: 主键
- exception_no: 异常单号
- related_id: 关联ID
- related_type: 关联类型
- exception_type: 异常类型
- exception_reason: 异常原因
- handler: 经办人
- old_value: 原值
- new_value: 新值
- status: 状态
- corrected_by: 修正人
- corrected_at: 修正时间
- created_at: 创建时间

### 日志表
- vehicle_mileage_log: 车辆修改日志
- package_orders_log: 订单修改日志
- maintenance_items_log: 项目修改日志

## 业务流程

### 核销流程
1. 用户选择订单、车辆、保养项目
2. 输入实际里程和经办人
3. 系统自动计算是否超里程
4. 如果超里程（超过标准10%），生成补差金额和异常记录
5. 生成核销记录
6. 更新车辆当前里程
7. 更新订单剩余次数
8. 生成下次保养提醒

### 异常处理流程
1. 在异常看板查看待处理异常
2. 点击"处理"按钮
3. 输入修正人和新值
4. 异常状态更新为"已解决"
5. 记录修正时间

## 报表导出说明

所有报表均导出为 Excel 格式（.xlsx），包含完整的数据列。

### 核销记录报表包含
- 核销单号、车牌号、车型、客户姓名、保养项目
- 核销日期、实际里程、补差金额、总金额
- 经办人、异常原因、备注

### 异常记录报表包含
- 异常单号、关联类型、异常类型、异常原因
- 经办人、原值、新值、状态、修正人、修正时间、创建时间

### 车辆里程报表包含
- 车牌号、车型、当前里程、上次保养日期
- 下次保养里程、负责人、创建时间

## 注意事项

1. 数据库文件默认存储在 `data/maintenance.db`
2. 修改操作会自动记录日志，包含修改前后的值
3. 核销时会自动检查是否超里程，超里程10%以上会生成异常记录并计算补差
4. 报表导出支持按责任人和处理时间筛选
5. 前端开发模式支持热更新，修改代码后会自动刷新
