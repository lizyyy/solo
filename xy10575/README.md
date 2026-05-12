# 生产设备点检 API

围绕生产设备点检按班次、项目、异常、停机和维修闭环管理展开的完整后端服务。

## 项目概述

本项目实现了车间设备点检的全流程闭环管理，涵盖：
- 设备档案管理
- 点检模板配置
- 班次点检执行
- 异常登记与追踪
- 停机记录
- 维修派工与执行
- 复检与闭环

## 核心业务规则

| 规则 | 说明 | 校验点 |
|------|------|--------|
| 同一班次重复点检被拒绝 | 同一设备在同一天的同一班次只能创建一次点检记录 | 创建点检时检查 equipmentId + shiftDate + shift 组合 |
| 关键项异常触发状态变化 | 发现关键项异常时，设备状态变为 ABNORMAL，点检状态变为 EXCEPTION | 点检项目时自动判断 ItemType.KEY |
| 维修未完成不能关闭点检 | 存在未解决异常（status != RESOLVED）时不能关闭点检 | complete() 和 close() 方法校验 |
| 复检失败可重新派工 | 复检失败后异常状态变为 RECHECK_FAILED，可再次派工维修 | recheck() 失败后允许再次 assignMaintenance() |
| 重复请求保持幂等 | 使用 idempotentKey 避免重复创建 | 所有 create 接口支持幂等键 |
| 人工修正记录差异 | 手动修改会记录字段、旧值、新值、原因和操作者 | manualCorrection() 写入历史记录 |

## 技术栈

- **Node.js** - 运行环境
- **TypeScript** - 类型安全
- **Express** - Web 框架
- **SQLite** - 嵌入式数据库（内存模式便于演示）
- **Jest** - 单元测试
- **json2csv** - CSV 报告导出

## 项目结构

```
src/
├── models/              # 数据模型和枚举定义
│   └── index.ts         # 所有接口和枚举
├── database/            # 数据库连接和建表
│   └── index.ts
├── repositories/        # 数据访问层
│   ├── equipmentRepository.ts
│   ├── templateRepository.ts
│   ├── inspectionRepository.ts
│   ├── exceptionRepository.ts
│   └── historyRepository.ts
├── services/            # 业务逻辑层（核心规则实现）
│   ├── equipmentService.ts
│   ├── templateService.ts
│   ├── inspectionService.ts
│   ├── exceptionService.ts
│   └── reportService.ts
├── controllers/         # HTTP 控制器
│   ├── equipmentController.ts
│   ├── templateController.ts
│   ├── inspectionController.ts
│   ├── exceptionController.ts
│   └── reportController.ts
├── routes/              # API 路由
│   └── index.ts
├── demo/                # 演示脚本
│   ├── index.ts         # 正常流程演示
│   └── failDemo.ts      # 失败路径演示
├── app.ts               # Express 应用配置
└── server.ts            # 服务启动入口
```

## 状态机设计

### 点检状态流转
```
DRAFT → IN_PROGRESS → EXCEPTION → COMPLETED → CLOSED
              ↓                          ↑
              └───────────(无异常)────────┘
```

### 异常状态流转
```
DETECTED → DOWNTIME_SCHEDULED → MAINTENANCE_ASSIGNED → MAINTENANCE_COMPLETED → RESOLVED
                                    ↑                                 ↓
                                    └───────── RECHECK_FAILED ────────┘
```

### 设备状态
- **RUNNING** - 正常运行
- **ABNORMAL** - 发现异常（关键项）
- **STOPPED** - 已停机
- **MAINTENANCE** - 维修中

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 本地启动

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动，使用内存 SQLite 数据库。

### 3. 运行演示脚本

#### 正常流程演示
```bash
npm run demo
```

演示内容：
1. **场景一：正常点检** - 创建设备 → 创建模板 → 创建点检 → 点检项目（全部正常）→ 完成 → 关闭
2. **场景二：关键异常闭环** - 发现关键项异常 → 登记异常 → 停机 → 派工 → 维修 → 复检 → 解决
3. **场景三：复检失败重新派工** - 复检失败 → 再次派工 → 再次维修 → 复检通过
4. **场景四：幂等性演示** - 重复提交相同请求只创建一次
5. **数据看板展示** - 设备状态、异常时间线、停机时长、班组报告

#### 失败路径演示
```bash
npm run demo-fail
```

演示 5 条失败路径：
1. **异常未解决就关闭** - 验证 UNRESOLVED_EXCEPTIONS 规则
2. **点检未完成就关闭** - 验证 INCOMPLETE_INSPECTION 规则
3. **维修未开始就完成** - 验证 INVALID_STATUS 规则
4. **维修未完成就复检** - 验证 INVALID_EXCEPTION_STATUS 规则
5. **同一班次重复点检** - 验证 DUPLICATE_SHIFT_INSPECTION 规则

### 4. 运行单元测试

```bash
npm test
```

测试覆盖所有 8 大业务规则。

## API 接口

### 设备管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/equipment` | 创建设备 |
| GET | `/api/equipment` | 查询设备列表 |
| GET | `/api/equipment/:id` | 查询单个设备 |
| PUT | `/api/equipment/:id` | 更新设备 |
| GET | `/api/equipment/:id/history` | 设备操作历史 |

请求头：
```
X-Operator-ID: user-001
X-Operator-Name: 张三
```

### 点检模板

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates` | 创建模板（含项目） |
| GET | `/api/templates` | 查询模板列表 |
| GET | `/api/templates/:id` | 查询模板详情 |
| GET | `/api/templates/:id/items` | 查询模板项目 |

### 班次点检

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inspections` | 创建点检 |
| GET | `/api/inspections` | 查询点检列表 |
| GET | `/api/inspections/:id` | 查询点检详情 |
| POST | `/api/inspections/:id/check` | 点检一个项目 |
| GET | `/api/inspections/:id/results` | 查询点检结果 |
| POST | `/api/inspections/:id/complete` | 完成点检 |
| POST | `/api/inspections/:id/close` | 关闭点检 |
| GET | `/api/inspections/:id/history` | 点检操作历史 |

### 异常管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/exceptions` | 登记异常 |
| GET | `/api/exceptions` | 查询异常列表 |
| GET | `/api/exceptions/:id` | 查询异常详情 |
| GET | `/api/exceptions/:id/history` | 异常操作历史 |
| POST | `/api/exceptions/:id/correction` | 人工修正（记录历史） |

### 停机记录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/downtime` | 安排停机 |
| GET | `/api/downtime` | 查询停机记录 |
| POST | `/api/downtime/:id/end` | 结束停机 |

### 维修派工

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/maintenance` | 派工维修 |
| GET | `/api/maintenance` | 查询维修任务 |
| POST | `/api/maintenance/:id/start` | 开始维修 |
| POST | `/api/maintenance/:id/complete` | 完成维修 |
| GET | `/api/maintenance/:id` | 查询维修详情 |

### 复检

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/exceptions/:id/recheck` | 执行复检 |
| GET | `/api/exceptions/:id/rechecks` | 查询复检历史 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/dashboard` | 数据看板（设备状态、异常统计） |
| GET | `/api/reports/timeline` | 异常时间线 |
| GET | `/api/reports/downtime` | 停机时长统计 |
| GET | `/api/reports/team-report?shift=白班` | 班组点检报告 |
| GET | `/api/reports/export/csv` | 导出 CSV 报告 |

## 主要演示路径

### 路径一：正常点检流程（无异常）

```
1. POST /api/equipment         → 创建设备 EQ-001
2. POST /api/templates         → 创建日常点检模板（含2个项目）
3. POST /api/inspections       → 创建白班点检（状态: IN_PROGRESS）
4. POST /api/inspections/:id/check × 2 → 两个项目均正常
5. POST /api/inspections/:id/complete → 完成点检（状态: COMPLETED）
6. POST /api/inspections/:id/close    → 关闭点检（状态: CLOSED）
```

**结果验证**：
- 设备状态：RUNNING
- 点检状态：CLOSED
- 无异常记录

### 路径二：关键异常闭环流程

```
1. POST /api/equipment         → 创建设备 EQ-002
2. POST /api/templates         → 创建模板（含1个关键项）
3. POST /api/inspections       → 创建点检
4. POST /api/inspections/:id/check → 关键项异常（设备: ABNORMAL, 点检: EXCEPTION）
5. POST /api/exceptions        → 登记异常（状态: DETECTED）
6. POST /api/downtime          → 安排停机（设备: STOPPED, 异常: DOWNTIME_SCHEDULED）
7. POST /api/maintenance       → 派工维修（设备: MAINTENANCE, 异常: MAINTENANCE_ASSIGNED）
8. POST /api/maintenance/:id/start   → 开始维修
9. POST /api/maintenance/:id/complete → 完成维修（异常: MAINTENANCE_COMPLETED）
10. POST /api/exceptions/:id/recheck → 复检通过（异常: RESOLVED, 设备: RUNNING）
11. POST /api/downtime/:id/end      → 结束停机
```

**结果验证**：
- 设备状态：RUNNING（从 RUNNING → ABNORMAL → STOPPED → MAINTENANCE → RUNNING）
- 异常状态：RESOLVED（完整闭环）
- 停机记录：有开始和结束时间、持续时长
- 历史记录：每个状态变化都有记录

### 路径三：复检失败重新派工

```
1-9. 同路径二，完成维修
10. POST /api/exceptions/:id/recheck → 复检失败（异常: RECHECK_FAILED）
11. POST /api/maintenance            → 再次派工
12. POST /api/maintenance/:id/start  → 开始维修
13. POST /api/maintenance/:id/complete → 完成维修
14. POST /api/exceptions/:id/recheck → 复检通过
```

**结果验证**：
- 存在 2 条维修记录
- 存在 2 条复检记录（1 失败 + 1 通过）
- 异常最终状态：RESOLVED

## 失败路径演示

### 失败路径：异常未解决就关闭

```bash
npm run demo-fail
```

演示场景：
1. 创建设备和模板
2. 创建点检
3. 点检一个项目（异常）
4. **尝试直接关闭点检** → **失败**（UNRESOLVED_EXCEPTIONS）
5. 验证：点检状态仍为 EXCEPTION

**预期输出**：
```
✗ 尝试在异常未解决时关闭点检
   错误码: UNRESOLVED_EXCEPTIONS
   错误信息: 存在未解决的异常，无法关闭点检
```

## 数据看板说明

通过 `/api/reports/dashboard` 可查看：

```json
{
  "equipmentStats": {
    "total": 10,
    "byStatus": {
      "RUNNING": 7,
      "ABNORMAL": 1,
      "STOPPED": 1,
      "MAINTENANCE": 1
    }
  },
  "exceptionStats": {
    "total": 5,
    "byStatus": {
      "DETECTED": 1,
      "MAINTENANCE_ASSIGNED": 1,
      "RESOLVED": 3
    },
    "byLevel": {
      "CRITICAL": 1,
      "HIGH": 2,
      "MEDIUM": 2
    }
  },
  "inspectionStats": {
    "today": { "total": 5, "completed": 4, "exception": 1 }
  }
}
```

## 异常时间线

通过 `/api/reports/timeline` 可查看异常处理全过程：

```json
{
  "exceptionId": "exc-xxx",
  "timeline": [
    { "time": "2025-07-01 08:00", "action": "DETECTED", "status": "DETECTED", "operator": "张三" },
    { "time": "2025-07-01 08:05", "action": "DOWNTIME_SCHEDULED", "status": "DOWNTIME_SCHEDULED", "operator": "李四" },
    { "time": "2025-07-01 08:10", "action": "MAINTENANCE_ASSIGNED", "status": "MAINTENANCE_ASSIGNED", "operator": "王五" },
    { "time": "2025-07-01 09:00", "action": "MAINTENANCE_COMPLETED", "status": "MAINTENANCE_COMPLETED", "operator": "赵六" },
    { "time": "2025-07-01 09:30", "action": "RESOLVED", "status": "RESOLVED", "operator": "张三" }
  ]
}
```

## 如何判断业务闭环

不看源码，通过以下结果判断：

| 判断指标 | 检查方式 | 闭环标准 |
|----------|----------|----------|
| 设备状态 | GET /api/equipment/:id | 最终为 RUNNING |
| 异常状态 | GET /api/exceptions/:id | 最终为 RESOLVED |
| 点检状态 | GET /api/inspections/:id | 最终为 CLOSED |
| 停机记录 | GET /api/downtime?equipmentId=xxx | 有 COMPLETED 记录，durationMinutes > 0 |
| 维修记录 | GET /api/maintenance?exceptionId=xxx | 有 COMPLETED 记录 |
| 复检记录 | GET /api/exceptions/:id/rechecks | 最后一条为 PASSED |
| 历史记录 | GET /api/exceptions/:id/history | 包含完整状态流转链 |

## 幂等性使用说明

为防止网络重试导致重复操作，所有创建接口支持 `idempotentKey`：

```json
POST /api/inspections
{
  "equipmentId": "eq-001",
  "templateId": "tpl-001",
  "shift": "白班",
  "shiftDate": "2025-07-01",
  "idempotentKey": "inspection-eq001-20250701-day-shift"
}
```

**特点**：相同 `idempotentKey` 多次调用返回同一记录，不会重复创建。

## 人工修正记录

当需要手动修正数据时（如管理层特批）：

```json
POST /api/exceptions/:id/correction
{
  "field": "status",
  "oldValue": "EXCEPTION",
  "newValue": "RESOLVED",
  "reason": "管理层特批，紧急放行"
}
```

**记录内容**：操作人、操作时间、字段、旧值、新值、原因。

## 常见问题

**Q: 为什么关键项异常后设备状态自动变了？**
A: 这是业务规则，关键项异常意味着设备存在严重问题，必须停机处理。系统自动将设备标记为 ABNORMAL。

**Q: 如何查看谁做了什么操作？**
A: 每个实体都有 `/history` 接口，记录所有状态变化和操作人。

**Q: 数据库会持久化吗？**
A: 默认使用内存数据库，服务重启后数据清空。可修改 `src/database/index.ts` 使用文件数据库。
