# 车辆年检代办进度台 - 交付说明

## 项目概述
一套完整的车辆年检代办进度管理系统，支持车行客服管理多个客户的年检代办业务。系统包含车辆和客户管理、材料收集、检测预约、结果记录、取证确认等完整流程，并具备严格的状态顺序限制和完整的操作日志追踪。

## 技术栈
- **后端**：Node.js + Express + SQLite
- **前端**：React + Axios + XLSX + dayjs
- **数据库**：SQLite（嵌入式，无需额外安装）
- **功能**：RESTful API、状态机控制、完整操作日志

## 目录结构
```
/Users/mac/pro/solo/workspaces/xy10310/
├── server/                    # 后端代码
│   ├── index.js              # 入口文件
│   ├── database.js           # 数据库配置
│   ├── models.js             # 数据模型
│   ├── routes.js             # API路由
│   ├── seed.js               # 样例数据初始化
│   ├── package.json          # 后端依赖
│   └── data/                 # 数据库文件存放目录
├── client/                    # 前端代码
│   ├── package.json          # 前端依赖
│   ├── public/
│   │   └── index.html        # HTML模板（内嵌样式）
│   └── src/
│       ├── index.js          # 入口
│       └── App.js            # 主应用组件
├── package.json               # 根目录配置
└── DELIVERY.md                # 本文件
```

## 快速启动

### 1. 安装依赖

**后端依赖**（已安装）：
```bash
cd server
npm install
```

**前端依赖**：
```bash
cd ../client
npm install
```

### 2. 启动服务

**方式一：分别启动（推荐开发时使用）**

1. 启动后端（端口 3001）：
```bash
cd server
npm start
```

2. 启动前端（端口 3000）：
```bash
cd client
npm start
```

**方式二：根目录同时启动**
```bash
# 需要先安装根目录依赖
npm install -g concurrently
npm install
npm run dev
```

### 3. 访问应用
- 前端地址：http://localhost:3000
- 后端API：http://localhost:3001/api

## 样例数据说明

系统启动时会自动初始化3辆车的样例数据，覆盖三种典型场景：

### 1. 正常通过流程（京A12345 - 张三）
- **状态**：已取证 (certificate_collected)
- **流程**：创建 → 材料收集 → 预约 → 检测通过 → 取证
- **特点**：所有步骤完整执行，无异常

### 2. 缺交强险（京B67890 - 李四）
- **状态**：已创建 (created)
- **流程**：创建 → 收集部分材料（缺交强险保单）
- **特点**：演示"材料未齐不能预约"的拦截逻辑

### 3. 检测失败后重约（京C11111 - 王五）
- **状态**：已重约 (retest_scheduled)
- **流程**：创建 → 材料收集 → 预约 → 检测失败（刹车不合格）→ 重约
- **特点**：演示检测失败必须记录原因、失败后可重约的流程

## 功能演示路径

### 路径1：完整年检代办流程
**目标**：从创建车辆到完成取证的完整流程

**操作步骤**：
1. 点击"新增车辆"按钮
2. 填写车辆信息（车牌号、品牌、型号等）和客户信息（姓名、电话）
3. 点击"创建"
4. 在列表中找到新车，点击"查看详情"
5. 在详情页点击"收集材料"
6. 勾选所有材料（7种），点击"确认收集"
7. 状态变为"材料已收齐"
8. 点击"安排检测预约"
9. 选择预约日期、时间和检测站，点击"确认预约"
10. 状态变为"已预约"
11. 点击"记录检测结果"
12. 选择"通过"，点击"确认记录"
13. 状态变为"检测通过"
14. 点击"确认取证"
15. 状态变为"已取证"，流程结束

### 路径2：待办事项管理
**目标**：快速查看和处理待办任务

**操作步骤**：
1. 点击顶部的"待办事项"标签
2. 查看四个待办分类：
   - 待收集材料（李四的京B67890）
   - 待预约检测
   - 待检测
   - 待取证
3. 点击任意待办项，直接进入详情页处理
4. 完成操作后返回，待办列表会自动更新

### 路径3：数据导出
**目标**：导出车辆年检数据为Excel

**操作步骤**：
1. 在"车辆列表"页面
2. 点击右上角的"导出数据"按钮
3. 浏览器会下载一个Excel文件
4. 文件名格式：车辆年检数据_YYYYMMDD.xlsx
5. 包含字段：车牌、客户、电话、品牌、状态、材料情况、预约信息等

### 路径4：历史记录查看
**目标**：追踪操作历史，复盘时不需要翻源码

**操作步骤**：
1. 进入任意车辆详情页
2. 查看两个关键区域：
   - **状态时间线**：按时间顺序展示所有状态变更，包含：
     - 变更时间
     - 状态名称
     - 备注（如检测失败原因）
     - 操作人
     - 来源（web/seed/system）
   - **操作日志**：记录所有操作行为，包含：
     - 操作类型（创建、收集材料、预约等）
     - 详细信息
     - 时间戳
     - 操作人
     - 来源
3. 这些信息全部存储在数据库中，可随时查询

## 状态拦截验证方法

系统实现了严格的状态顺序控制，以下是验证各拦截规则的步骤：

### 验证1：材料未齐不能预约
**预期行为**：在材料未全部收集时，无法创建预约

**验证步骤**：
1. 找到"京B67890"（状态：已创建）
2. 进入详情页
3. 检查是否有"安排检测预约"按钮
4. **预期结果**：不显示预约按钮
5. 收集交强险保单后
6. **预期结果**：状态变为"材料已收齐"，预约按钮出现

**后端验证**（可选）：
```bash
# 尝试为材料未齐的车辆创建预约
curl -X POST http://localhost:3001/api/vehicles/<车辆ID>/appointments \
  -H "Content-Type: application/json" \
  -d '{"appointment_date":"2026-05-15","inspection_station":"测试检测场"}'

# 预期返回：
{"success":false,"message":"只有材料收齐后或检测失败后才能预约"}
```

### 验证2：检测失败必须记录原因
**预期行为**：记录检测失败时，必须填写失败原因

**验证步骤**：
1. 创建一辆新车并完成预约
2. 点击"记录检测结果"
3. 选择"未通过"
4. 不填写失败原因，点击"确认记录"
5. **预期结果**：前端会提示"请输入失败原因"，无法提交

**后端验证**（可选）：
```bash
# 尝试不填原因提交失败
curl -X POST http://localhost:3001/api/vehicles/<车辆ID>/inspection-result \
  -H "Content-Type: application/json" \
  -d '{"result":"failed","failure_reason":""}'

# 预期返回：
{"success":false,"message":"检测失败必须记录原因"}
```

### 验证3：已取证不能继续补交材料
**预期行为**：车辆取证完成后，无法再收集材料

**验证步骤**：
1. 找到"京A12345"（状态：已取证）
2. 进入详情页
3. 检查操作按钮区域
4. **预期结果**：不显示"收集材料"按钮，也不显示其他操作按钮
5. 查看材料列表
6. **预期结果**：所有材料都已收集，状态为绿色

**后端验证**（可选）：
```bash
# 尝试为已取证车辆收集材料
curl -X POST http://localhost:3001/api/vehicles/<京A12345的ID>/collect-materials \
  -H "Content-Type: application/json" \
  -d '{"material_types":["行驶证"]}'

# 预期返回：
{"success":false,"message":"已取证，不能继续补交材料"}
```

### 验证4：状态顺序严格控制
**预期行为**：状态只能按预设顺序流转

**验证步骤**：
1. 创建新车（状态：已创建）
2. 查看可用操作
3. **预期结果**：只能收集材料，不能预约、不能检测
4. 收集所有材料（状态：材料已收齐）
5. **预期结果**：可以预约，不能检测
6. 创建预约（状态：已预约）
7. **预期结果**：可以记录检测结果
8. 记录通过（状态：检测通过）
9. **预期结果**：可以取证
10. 取证（状态：已取证）
11. **预期结果**：无可用操作

**完整状态流转图**：
```
已创建 → 材料已收齐 → 已预约 → 检测通过 → 已取证
                    ↓
               检测失败 → 已重约 → 检测通过/检测失败 → 已取证
```

## API接口说明

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/vehicles | 获取车辆列表 |
| GET | /api/vehicles/:id | 获取车辆详情 |
| POST | /api/vehicles | 创建车辆 |
| POST | /api/vehicles/:id/collect-materials | 收集材料 |
| POST | /api/vehicles/:id/appointments | 创建预约 |
| POST | /api/vehicles/:id/inspection-result | 记录检测结果 |
| POST | /api/vehicles/:id/collect-certificate | 确认取证 |
| GET | /api/todos | 获取待办事项 |
| GET | /api/export | 导出数据 |
| GET | /api/customers | 获取客户列表 |
| POST | /api/customers | 创建客户 |

### 状态码说明

| 状态 | 英文标识 | 说明 |
|------|----------|------|
| 已创建 | created | 车辆刚录入，待收集材料 |
| 材料已收齐 | materials_collected | 所有材料收集完成 |
| 已预约 | appointment_scheduled | 检测预约已创建 |
| 检测通过 | inspection_completed | 检测结果为通过 |
| 检测失败 | inspection_failed | 检测结果为未通过 |
| 已重约 | retest_scheduled | 检测失败后重新预约 |
| 已取证 | certificate_collected | 流程结束，已领取合格证 |

## 数据库说明

### 主要表结构

**customers（客户表）**：存储客户基本信息
- id, name, phone, id_card, address, created_at, updated_at

**vehicles（车辆表）**：存储车辆信息
- id, customer_id, plate_number, brand, model, year, vin, engine_number

**materials（材料表）**：存储车辆材料收集情况
- id, vehicle_id, material_type, is_collected, collected_at, collected_by

**appointments（预约表）**：存储检测预约记录
- id, vehicle_id, appointment_date, appointment_time, inspection_station, status, inspection_result, failure_reason

**vehicle_status（状态历史表）**：记录所有状态变更
- id, vehicle_id, status, notes, operator, source, created_at

**operation_logs（操作日志表）**：记录所有操作
- id, vehicle_id, action, details, operator, source, created_at

**操作日志字段说明**：
- **action**：操作类型（创建车辆、收集材料、状态变更等）
- **details**：详细信息
- **operator**：操作人（如"客服小张"、"系统初始化"）
- **source**：来源（web/seed/system）
- **created_at**：精确到秒的时间戳

## 常见问题

### Q1：数据库文件在哪里？
A：在 `server/data/vehicle_inspection.db`，SQLite格式，可以用任何SQLite客户端打开查看。

### Q2：如何重置样例数据？
A：删除 `server/data/vehicle_inspection.db` 文件，重启后端服务即可重新初始化。

### Q3：前端启动失败怎么办？
A：确保已在 client 目录运行 `npm install`，然后重新 `npm start`。

### Q4：如何添加新的检测站？
A：在 `client/src/App.js` 的 `CreateAppointmentModal` 组件中修改 select 选项，或改为从后端API动态获取。

### Q5：如何修改当前操作员？
A：在 `server/routes.js` 中修改 `CURRENT_OPERATOR` 变量的值。

## 后续优化建议

1. **用户认证**：添加登录系统，支持多个客服账号
2. **权限管理**：根据角色限制操作权限
3. **消息通知**：待办事项提醒、预约提醒
4. **文件上传**：支持上传材料扫描件
5. **统计报表**：月度/季度业务统计
6. **数据备份**：自动备份数据库
7. **移动端适配**：支持手机端操作

## 联系支持

如遇到问题，请检查：
1. 后端是否正常启动（端口3001）
2. 前端是否正常启动（端口3000）
3. 数据库文件是否存在
4. 浏览器控制台是否有报错信息

---

**版本**：v1.0.0  
**发布日期**：2026-05-10  
**最后更新**：2026-05-10
