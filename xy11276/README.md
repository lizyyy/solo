# 仓库夜班管理系统

一个专门为仓库夜班管理设计的后端服务系统，解决叉车电量管理、充电桩占用、任务排班冲突等实际问题。

## ✨ 功能特性

### 🚜 叉车管理
- 叉车基础信息管理（编号、名称、操作员信息）
- 实时电量监控和低电量预警
- 状态管理（空闲、工作中、充电中、维护中、低电量）
- 敏感字段自动脱敏处理

### 🔌 充电桩管理
- 充电桩状态监控（可用、占用、维护中）
- 智能充电开始/停止控制
- 充电时长预估和剩余时间计算
- 自动更新叉车电量和状态

### 📅 班次管理
- 夜班/白班排班管理
- 班次状态追踪（计划、进行中、已完成、已取消）
- 班次任务摘要和统计

### 📋 任务管理
- 任务创建、分配、状态流转
- 优先级管理（低、普通、高、紧急）
- 任务冲突检测（叉车过载、低电量工作）
- 按叉车分配限制

### 📊 报告导出
- 班次任务报表导出（CSV）
- 叉车状态报表导出
- 充电桩状态报表导出
- 操作历史记录导出

### 📜 历史记录
- 所有实体变更自动记录
- 操作人、操作时间、变更内容完整追踪
- 支持按实体类型、时间范围查询

### 🔒 数据安全
- 敏感字段（手机号、身份证号）自动脱敏
- API返回、导出文件、日志全链路脱敏
- 不可逆向还原设计

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 导入示例数据
```bash
npm run import
```
> 示例数据包含：5台叉车、4个充电桩、3个班次、6个任务，覆盖正常和异常场景

### 4. 验证数据
```bash
npm run verify
```
> 检查数据完整性、冲突检测、脱敏效果

### 5. 启动服务
```bash
npm start
```
> 服务运行在 http://localhost:3000

### 6. 导出数据
```bash
npm run export
```
> 所有报表导出到 `exports/` 目录

## 📡 API 接口

### 健康检查
```bash
GET /api/health
```

### 叉车管理
```bash
GET    /api/forklifts                    # 获取所有叉车
GET    /api/forklifts/low-battery        # 获取低电量叉车
GET    /api/forklifts/available          # 获取可用叉车
GET    /api/forklifts/:id                # 获取叉车详情
POST   /api/forklifts                    # 创建叉车
PATCH  /api/forklifts/:id/battery        # 更新电量
DELETE /api/forklifts/:id                # 删除叉车
```

### 充电桩管理
```bash
GET    /api/charging-stations            # 获取所有充电桩
GET    /api/charging-stations/status     # 获取充电状态（含剩余时间）
POST   /api/charging-stations            # 创建充电桩
POST   /api/charging-stations/:id/start  # 开始充电
POST   /api/charging-stations/:id/stop   # 停止充电
```

### 班次管理
```bash
GET    /api/shifts                       # 获取所有班次
GET    /api/shifts/:id                   # 获取班次详情
GET    /api/shifts/:id/summary           # 获取班次摘要
GET    /api/shifts/:id/conflicts         # 检测任务冲突
POST   /api/shifts                       # 创建班次
PATCH  /api/shifts/:id/status            # 更新班次状态
```

### 任务管理
```bash
GET    /api/tasks                        # 获取所有任务
GET    /api/tasks/shift/:shiftId         # 获取班次任务
POST   /api/tasks                        # 创建任务
POST   /api/tasks/:id/assign             # 分配任务
POST   /api/tasks/:id/start              # 开始任务
POST   /api/tasks/:id/complete           # 完成任务
POST   /api/tasks/:id/cancel             # 取消任务
```

### 报告和历史
```bash
GET    /api/history                      # 获取操作历史
GET    /api/reports/shift/:shiftId/summary  # 班次摘要报告
GET    /api/reports/shift/:shiftId/export   # 导出班次任务CSV
GET    /api/reports/forklifts/export        # 导出叉车状态CSV
```

## 🧪 示例场景

### 正常场景
```bash
# 1. 创建任务
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"T-TEST","shiftId":"<shift-id>","type":"loading","priority":"normal","description":"测试任务","estimatedDuration":30}'

# 2. 分配叉车
curl -X POST http://localhost:3000/api/tasks/<task-id>/assign \
  -H "Content-Type: application/json" \
  -d '{"forkliftId":"<forklift-id>","operatorName":"张三"}'

# 3. 开始任务
curl -X POST http://localhost:3000/api/tasks/<task-id>/start

# 4. 完成任务
curl -X POST http://localhost:3000/api/tasks/<task-id>/complete
```

### 异常场景（系统自动拦截）
```bash
# ❌ 分配低电量叉车 → 返回错误："叉车电量不足，无法分配任务"
# ❌ 分配非空闲叉车 → 返回错误："叉车不可用"
# ❌ 叉车超过任务限制 → 返回错误："该叉车已达到最大任务数限制"
# ❌ 开始已取消任务 → 返回错误："只能开始已分配的任务"
# ❌ 删除有任务的叉车 → 返回错误："该叉车有未完成的任务，无法删除"
```

### 充电流程
```bash
# 开始充电
curl -X POST http://localhost:3000/api/charging-stations/<station-id>/start \
  -H "Content-Type: application/json" \
  -d '{"forkliftId":"<forklift-id>"}'

# 停止充电（自动计算最终电量）
curl -X POST http://localhost:3000/api/charging-stations/<station-id>/stop
```

## 📁 项目结构

```
warehouse-night-shift-system/
├── config/
│   └── default.js              # 配置文件
├── src/
│   ├── database/
│   │   └── index.js           # 数据库连接和初始化
│   ├── services/
│   │   ├── forklift.service.js    # 叉车服务
│   │   ├── charging.service.js    # 充电桩服务
│   │   ├── shift.service.js       # 班次服务
│   │   ├── task.service.js        # 任务服务
│   │   ├── report.service.js      # 报告服务
│   │   └── history.service.js     # 历史记录服务
│   ├── validations/
│   │   └── forklift.validation.js # 数据验证规则
│   ├── utils/
│   │   ├── logger.js           # 日志工具
│   │   └── security.js         # 安全工具（脱敏）
│   ├── routes/
│   │   └── index.js            # API路由
│   └── server.js               # 服务入口
├── scripts/
│   ├── init-db.js             # 数据库初始化
│   ├── import-data.js         # 示例数据导入
│   ├── verify-data.js         # 数据验证
│   └── export-data.js         # 数据导出
├── data/                       # SQLite数据库文件（运行后创建）
├── logs/                       # 日志文件（运行后创建）
├── exports/                    # 导出文件（运行后创建）
├── package.json
└── README.md
```

## ⚙️ 配置说明

编辑 `config/default.js` 自定义配置：

```javascript
{
  server: {
    port: 3000                    // 服务端口
  },
  forklift: {
    minSafeBattery: 20,          // 最低安全电量（%）
    chargingRatePerMinute: 2,     // 每分钟充电量（%）
    consumptionPerHour: 15        // 每小时耗电量（%）
  },
  shift: {
    maxTasksPerForklift: 5        // 每叉车最大任务数
  }
}
```

## 📊 数据模型

### 叉车 (Forklift)
- `code`: 叉车编号（唯一）
- `name`: 叉车名称
- `batteryLevel`: 当前电量（0-100）
- `status`: 状态（idle/working/charging/maintenance/low_battery）
- `operatorName`: 操作员姓名
- `operatorPhone`: 操作员电话（脱敏）
- `operatorIdCard`: 操作员身份证（脱敏）

### 充电桩 (Charging Station)
- `code`: 充电桩编号（唯一）
- `name`: 充电桩名称
- `status`: 状态（available/occupied/maintenance）
- `forkliftId`: 正在充电的叉车
- `chargingStartTime`: 充电开始时间
- `estimatedEndTime`: 预计完成时间

### 任务 (Task)
- `code`: 任务编号（唯一）
- `shiftId`: 所属班次
- `forkliftId`: 分配的叉车
- `type`: 类型（loading/unloading/transfer/inventory）
- `priority`: 优先级（low/normal/high/urgent）
- `status`: 状态（pending/assigned/in_progress/completed/cancelled）
- `estimatedDuration`: 预计时长（分钟）

### 历史记录 (History Log)
- `entityType`: 实体类型（forklift/charging_station/shift/task）
- `entityId`: 实体ID
- `action`: 操作类型（create/update/delete/assign/start等）
- `oldValue`: 变更前值（脱敏）
- `newValue`: 变更后值（脱敏）
- `operatorName`: 操作人
- `createdAt`: 操作时间

## 🔐 敏感字段处理

系统自动对以下字段进行全链路脱敏：
- `operatorPhone`（操作员电话）：138****8001
- `operatorIdCard`（操作员身份证）：110101****1234
- `maintainerContact`（维护联系人）：同电话脱敏规则

脱敏覆盖范围：
✅ API响应数据  
✅ 导出CSV文件  
✅ 系统日志文件  
✅ 历史变更记录  

## 📝 日志说明

日志文件位于 `logs/app.log`，包含：
- 系统启动/关闭信息
- 所有API请求记录
- 业务操作日志
- 错误和警告信息
- 数据库操作记录

## 🤝 常见问题

### Q: 重启服务后数据会丢失吗？
A: 不会，所有数据持久化存储在SQLite数据库中，重启服务可完全恢复。

### Q: 如何添加新的叉车？
A: 通过API: `POST /api/forklifts` 或直接操作数据库。

### Q: 如何修改充电速率？
A: 编辑 `config/default.js` 中的 `chargingRatePerMinute` 配置项。

### Q: 脱敏后的数据能恢复吗？
A: 不能，脱敏是单向不可逆的。原始数据仅存储在数据库中，如需查看原始数据需直接查询数据库。

## 📄 许可证

MIT License