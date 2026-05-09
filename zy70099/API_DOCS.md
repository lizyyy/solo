# 换电柜电池流转 API 系统

## 一、系统概述

本系统负责换电柜中电池在**充电(CHARGING)**、**可借出(AVAILABLE)**、**借出(LENT)**、**维修(MAINTENANCE)**、**报废(SCRAPPED)** 五种状态间的流转控制。

### 核心实体
- **电池(Battery)**：唯一编号 batteryCode，循环次数追踪
- **柜格(CabinetSlot)**：柜格状态与电池绑定关系
- **事务(Transaction)**：借出/归还操作的完整记录
- **异常记录(ExceptionRecord)**：边界数据的持久化存储
- **待处理任务(PendingTask)**：需人工复核的任务队列

---

## 二、状态流转图

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   CHARGING ──────► AVAILABLE ──────► LENT ──────► AVAILABLE     │
│      │               │              │              │            │
│      │               │              │              │            │
│      ▼               ▼              ▼              │            │
│   MAINTENANCE ◄──────┴──────────────┘              │            │
│      │                                             │            │
│      └─────────────────► SCRAPPED ◄────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**合法转换表：**

| 当前状态 | 可转换到 |
|---------|---------|
| CHARGING | AVAILABLE, MAINTENANCE, SCRAPPED |
| AVAILABLE | LENT, MAINTENANCE, SCRAPPED |
| LENT | AVAILABLE, MAINTENANCE |
| MAINTENANCE | AVAILABLE, SCRAPPED |
| SCRAPPED | (无) |

---

## 三、处理成功场景 (200/201)

### 3.1 借出成功条件

电池状态为 `AVAILABLE` **且** 柜格状态为 `OCCUPIED` **且** 柜格内电池匹配。

```json
POST /api/transactions/lend
{
  "batteryCode": "BAT-001",
  "userId": "user-123",
  "cabinetId": "CAB-001",
  "slotNumber": 1
}
```

**后置状态：**
- 电池：`LENT`
- 柜格：`EMPTY`
- 事务：`SUCCESS`

### 3.2 归还成功条件

电池状态为 `LENT` **且** 目标柜格为空。

```json
POST /api/transactions/return
{
  "batteryCode": "BAT-001",
  "userId": "user-123",
  "cabinetId": "CAB-001",
  "slotNumber": 1
}
```

**后置状态：**
- 电池：`AVAILABLE`，循环次数 +1
- 柜格：`OCCUPIED`
- 事务：`SUCCESS`

### 3.3 维修/报废成功条件

见状态流转图，状态机校验通过即成功。

---

## 四、进入人工复核场景 (HTTP 422)

以下情况**不会静默失败**，会同时创建：
1. **异常记录**：可通过 `GET /api/exceptions` 查询
2. **待处理任务**：可通过 `GET /api/pending-tasks` 查询
3. 事务状态标记为 `PENDING_REVIEW`

### 4.1 借出操作的人工复核场景

| 场景 | 异常类型 | 处理建议 |
|------|---------|---------|
| 电池不存在 | BATTERY_NOT_FOUND | 检查电池是否漏录入 |
| 柜格不存在 | SLOT_NOT_FOUND | 检查柜格配置 |
| 电池已报废 | INVALID_TRANSITION | 确认电池是否真的报废 |
| 电池在维修中 | INVALID_TRANSITION | 检查维修是否已完成 |
| 电池已借出(状态串位) | INVALID_TRANSITION | **需要现场核对电池位置** |
| 柜格不是 OCCUPIED | SLOT_MISMATCH | **需要现场检查柜格实际状态** |
| 柜格电池不匹配 | SLOT_MISMATCH | **需要现场核对电池编号** |

### 4.2 归还操作的人工复核场景

| 场景 | 异常类型 | 处理建议 |
|------|---------|---------|
| 电池不存在 | BATTERY_NOT_FOUND | 检查电池是否漏录入 |
| 柜格不存在 | SLOT_NOT_FOUND | 检查柜格配置 |
| 电池已报废 | STATE_MISMATCH | **需要确认电池实际位置** |
| 电池不在借出状态 | STATE_MISMATCH | **需要现场核对电池状态** |
| 柜格在维修中 | SLOT_MISMATCH | 选择其他柜格或结束维修 |
| 柜格已有电池 | SLOT_MISMATCH | **需要现场清理柜格** |

### 4.3 维修/报废操作的人工复核场景

| 场景 | 异常类型 | 处理建议 |
|------|---------|---------|
| 电池处于借出状态时尝试报废 | INVALID_TRANSITION | **必须先确认电池去向** |
| 完成维修时电池不在维修状态 | MAINTENANCE_VIOLATION | 检查电池当前状态 |

### 4.4 循环次数边界

| 阈值 | 行为 |
|------|------|
| < 90% 最大循环次数 | 正常处理 |
| >= 90% 最大循环次数 | 创建检查任务，正常借出/归还 |
| >= 100% 最大循环次数 | 创建检查任务，正常借出/归还 |

> **设计决策**：循环次数超限不阻止借出/归还，但会创建待处理任务，由运维决定是否继续使用。

---

## 五、API 列表

### 基础操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /api/batteries | 创建电池 |
| POST | /api/cabinet-slots | 创建柜格 |
| POST | /api/batteries/place | 将电池放入柜格 |

### 事务操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/transactions/lend | 借出电池 |
| POST | /api/transactions/return | 归还电池 |

### 生命周期管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batteries/maintenance | 标记维修 |
| POST | /api/batteries/:code/complete-maintenance | 完成维修 |
| POST | /api/batteries/scrap | 报废电池 |

### 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/exceptions | 查询未解决的异常记录 |
| GET | /api/pending-tasks | 查询待处理任务队列 |

---

## 六、统一响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    "id": "tx-xxx",
    "status": "SUCCESS",
    "completedAt": "2026-05-10T10:00:00.000Z"
  }
}
```

### 失败但无需人工复核 (HTTP 400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "电池编号不能为空"
  }
}
```

### 失败且需要人工复核 (HTTP 422)

```json
{
  "success": false,
  "error": {
    "code": "PENDING_REVIEW",
    "message": "电池已在其他柜格中",
    "exceptionId": "exc-xxx",
    "pendingTaskId": "task-xxx"
  }
}
```

> 收到 `PENDING_REVIEW` 后，应通过 exceptionId 或 pendingTaskId 关联到待处理任务。

---

## 七、测试覆盖

核心判断逻辑位于 `src/services/batteryStateMachine.ts`，已通过 Jest 测试：

```bash
npm test
```

**测试覆盖内容：**
- ✅ 5 种状态间的所有合法/非法转换
- ✅ 借出/归还/维修/报废的前置条件校验
- ✅ 柜格状态和电池匹配校验
- ✅ 循环次数阈值判断
- ✅ 所有需要人工复核的场景识别

---

## 八、启动说明

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 启动服务
npm run dev
# 或
npm run build && npm start
```

服务默认端口：`3000`
健康检查：`GET http://localhost:3000/health`

---

## 九、数据持久化

使用 SQLite 存储，数据库文件位置：
- 开发：`./data/battery-cabinet.db`
- 可通过环境变量 `DB_PATH` 自定义

**重启后数据不会丢失**，历史事务、异常记录、待处理任务均可查询。
