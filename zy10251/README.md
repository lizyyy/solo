# 园区访客车牌授权 API

一个完整的园区访客车牌授权管理系统，支持预约、审批、车牌授权、签到、离场、撤销和超时查询等功能。

## 功能特性

- ✅ **访客预约** - 创建访客预约，支持幂等性保证
- ✅ **冲突检测** - 同一车牌在重叠时间段不能重复预约
- ✅ **审批流程** - 管理员审批预约，通过后自动创建车牌授权
- ✅ **签到离场** - 门岗签到验证，离场时授权自动失效
- ✅ **会议取消** - 取消会议后车牌授权自动撤销
- ✅ **超时查询** - 查询所有超时未失效的授权
- ✅ **审计日志** - 记录每次授权变更的来源和操作人
- ✅ **本地持久化** - 使用 SQLite 存储数据

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化种子数据

```bash
npm run seed
```

### 3. 运行完整流程演示

```bash
npm run demo
```

### 4. 启动 API 服务

```bash
npm run dev          # 开发模式 (热重载)
npm run build        # 编译 TypeScript
npm start            # 生产模式
```

服务启动后访问: `http://localhost:3000`

## API 接口

### 预约管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/appointments | 创建访客预约 |
| GET | /api/appointments | 查询所有预约 |
| GET | /api/appointments/pending | 查询待审批预约 |
| GET | /api/appointments/:id | 查询单个预约 |
| POST | /api/appointments/:id/approve | 审批通过预约 |
| POST | /api/appointments/:id/reject | 拒绝预约 |
| POST | /api/appointments/:id/checkin | 访客签到 |
| POST | /api/appointments/:id/checkout | 访客离场 |
| POST | /api/appointments/:id/cancel | 取消会议 |
| GET | /api/appointments/:id/logs | 查询预约变更日志 |

### 授权管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/authorizations | 查询所有授权 |
| GET | /api/authorizations/overdue | 查询超时授权 |
| GET | /api/authorizations/:id | 查询单个授权 |
| POST | /api/authorizations/:id/revoke | 撤销授权 |
| GET | /api/authorizations/:id/logs | 查询授权变更日志 |

## 接口示例

### 创建预约

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2024-001",
    "visitorName": "张三",
    "visitorPhone": "13800138001",
    "visitorCompany": "华为技术有限公司",
    "hostName": "李四",
    "hostDepartment": "研发部",
    "licensePlate": "京A12345",
    "meetingSubject": "项目合作洽谈",
    "startTime": "2024-05-20T09:00:00.000Z",
    "endTime": "2024-05-20T12:00:00.000Z"
  }'
```

### 审批预约

```bash
curl -X POST http://localhost:3000/api/appointments/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "ADMIN-001",
    "operatorName": "系统管理员",
    "remark": "审批通过"
  }'
```

### 访客签到

```bash
curl -X POST http://localhost:3000/api/appointments/{id}/checkin \
  -H "Content-Type: application/json" \
  -d '{
    "gateId": "GATE-NORTH",
    "gateName": "北门岗"
  }'
```

### 查询超时授权

```bash
curl http://localhost:3000/api/authorizations/overdue
```

## 项目结构

```
.
├── src/
│   ├── index.ts      # 服务入口
│   ├── types.ts      # 类型定义
│   ├── database.ts   # 数据库层
│   ├── service.ts    # 业务逻辑层
│   ├── routes.ts     # 路由层
│   ├── seed.ts       # 种子数据
│   └── demo.ts       # 流程演示
├── package.json
├── tsconfig.json
└── README.md
```

## 数据模型

### Appointment (预约)
- `id`: 预约唯一标识
- `requestId`: 请求ID（用于幂等性）
- `visitorName/visitorPhone/visitorCompany`: 访客信息
- `hostName/hostDepartment`: 接待人信息
- `licensePlate`: 车牌号
- `meetingSubject`: 会议主题
- `startTime/endTime`: 预约时间
- `status`: 状态 (pending/approved/rejected/cancelled/checked_in/checked_out/expired)

### Authorization (授权)
- `id`: 授权唯一标识
- `appointmentId`: 关联预约ID
- `licensePlate`: 车牌号
- `validFrom/validTo`: 有效时间
- `status`: 状态 (inactive/active/revoked/expired)

### ChangeLog (变更日志)
- `entityType`: 实体类型 (appointment/authorization)
- `entityId`: 实体ID
- `field`: 变更字段
- `oldValue/newValue`: 新旧值
- `source`: 变更来源
- `operatorId/operatorName`: 操作人
- `remark`: 备注

## 核心业务场景

### 1. 完整进出流程
创建预约 → 审批预约（创建授权） → 门岗签到 → 门岗离场 → 授权自动失效

### 2. 会议取消场景
创建预约 → 审批预约 → 会议取消 → 授权自动撤销

### 3. 异常处理
- 同一车牌不能在重叠时间段重复预约
- 重复提交相同 requestId 的请求不会创建重复记录
- 只有已批准的预约才能签到
- 只有已签到的预约才能离场
- 离场后授权自动失效
