# 水泵远程启停审计 API 系统

专门针对水泵远程启停场景的指令-回执-报警一致性管控系统，解决「指令发了、设备回执乱了、报警查不清」的问题。

## 核心设计思路

### 问题定位
工业远程控制中经常出现：
- 下发了启动指令，设备实际没动
- 设备状态变化，找不到对应的控制指令
- 报警触发时，不知道是联锁阻止还是设备故障

### 解决方案
1. **指令与回执绑定**：每条回执自动关联最近的控制指令，状态不一致立刻报警
2. **联锁规则可复查**：规则定义在数据库，执行过程全记录，事后能看到哪条规则起了作用
3. **操作全链路审计**：指令下发、规则判断、回执接收、报警产生，每个环节都有痕迹

## 项目结构

```
pump-audit-api/
├── src/
│   ├── config/
│   │   └── index.js          # 配置
│   ├── database/
│   │   ├── connection.js     # 数据库连接
│   │   └── init.js           # 表结构和初始化数据
│   ├── services/
│   │   ├── auditService.js   # 审计日志
│   │   ├── alarmService.js   # 报警管理
│   │   ├── commandService.js # 控制指令
│   │   ├── receiptService.js # 设备回执+状态校验
│   │   ├── interlockService.js # 联锁规则引擎
│   │   └── eventService.js   # 事件查询+一致性报告
│   ├── routes/
│   │   ├── devices.js
│   │   ├── commands.js
│   │   ├── receipts.js
│   │   ├── rules.js
│   │   ├── alarms.js
│   │   ├── audit.js
│   │   └── events.js
│   └── server.js
├── data/                     # SQLite 数据库文件目录
└── package.json
```

## 数据模型

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| pump_devices | 水泵设备 | current_status 实时状态 |
| control_commands | 控制指令 | status (issued/confirmed/mismatch/rejected) |
| device_receipts | 设备回执 | command_id 关联指令 |
| interlock_rules | 联锁规则 | condition_device, forbidden_action |
| rule_execution_logs | 规则执行日志 | condition_met, decision, reason |
| alarms | 报警记录 | alarm_type, level, resolved |
| audit_logs | 操作审计 | event_type, detail 完整描述 |

## 快速开始

### 安装
```bash
npm install
```

### 启动
```bash
npm start
```

服务运行在 `http://localhost:3000`

### 初始化
首次启动会自动创建数据库并初始化：
- 3 台水泵设备（PUMP-001/002/003）
- 3 条默认联锁规则

## API 接口

### 设备管理
- `GET /api/devices` - 获取所有设备
- `GET /api/devices/:id` - 获取单台设备
- `GET /api/devices/:id/status` - 设备实时状态

### 控制指令
- `POST /api/commands` - 下发启停指令（自动经过联锁检查）
  ```json
  {
    "deviceId": "PUMP-001",
    "action": "start",
    "operator": "张三",
    "reason": "设备巡检"
  }
  ```
- `GET /api/commands` - 查询指令列表
- `GET /api/commands/:id` - 查询单条指令

### 设备回执
- `POST /api/receipts` - 设备上报状态（自动与指令校验）
  ```json
  {
    "deviceId": "PUMP-001",
    "reportedStatus": "running",
    "source": "PLC",
    "relatedCommandId": "xxx"
  }
  ```
- `GET /api/receipts/command/:commandId` - 按指令查回执
- `GET /api/receipts/device/:deviceId` - 按设备查回执

### 联锁规则
- `GET /api/rules` - 查看所有规则
- `GET /api/rules/:id` - 查看单条规则
- `GET /api/rules/logs/command/:commandId` - 某指令的规则执行日志
- `GET /api/rules/logs/device/:deviceId` - 某设备的规则执行日志

### 报警管理
- `GET /api/alarms?resolved=false` - 未解除报警
- `GET /api/alarms?alarmType=status_mismatch` - 状态不一致报警
- `POST /api/alarms/:id/resolve` - 解除报警

### 审计日志
- `GET /api/audit` - 审计日志查询
- `GET /api/audit/command/:commandId` - 某指令的完整审计链

### 事件查询（核心功能）
- `GET /api/events/trace/command/:commandId` - 指令全链路追溯
- `GET /api/events/timeline/device/:deviceId` - 设备事件时间线
- `GET /api/events/consistency/:commandId` - 一致性检查报告
- `GET /api/events/search?keyword=异常` - 关键词搜索

## 业务流程

### 正常启停流程
1. 调用 `/api/commands` 下发指令
2. 系统自动遍历 `interlock_rules`，每条规则判断记入 `rule_execution_logs`
3. 指令下发成功，状态为 `issued`，审计记录 `command_issued`
4. 设备上报回执到 `/api/receipts`
5. 系统自动比对：回执状态是否与指令期望一致
6. 一致则指令状态更新为 `confirmed`，否则 `mismatch` 并触发 `status_mismatch` 报警
7. 整个过程产生多条审计日志，可通过 `/api/events/trace` 一次性查看

### 联锁阻止流程
1. 下发指令时，规则引擎发现某条规则条件满足
2. 指令状态为 `rejected`
3. 触发 `interlock_violation` 报警
4. 审计记录 `rule_check_blocked`，规则执行日志记录 `decision=block`

### 状态不一致场景
- 下发了 `start` 指令，但设备回执 `stopped`
- 系统自动识别不一致，指令状态标记 `mismatch`
- 产生 critical 级别的 `status_mismatch` 报警
- 通过一致性报告可看到：期望 running，实际 stopped

## 默认联锁规则

| 规则 | 描述 | 类型 |
|------|------|------|
| PUMP-001 运行时，禁止启动 PUMP-002 | 双泵互斥，防止管网压力异常 | mutual_exclusion |
| PUMP-002 运行时，禁止启动 PUMP-001 | 双泵互斥反向 | mutual_exclusion |
| PUMP-001 停止时，禁止启动 PUMP-003 | 备用泵依赖主泵 | dependency |

## 关键可复查点

### 规则不是藏在代码里
- 规则定义：`interlock_rules` 表
- 规则执行：`rule_execution_logs` 表
- 每个指令都能看到：哪些规则被评估、条件是否满足、决定是 allow 还是 block、具体原因是什么

### 一致性检查可自动化
- `/api/events/consistency/:commandId` 返回：
  - `isConsistent`: 布尔值
  - `confirmations`: 哪些环节通过
  - `issues`: 哪些环节有问题（规则阻止、无回执、状态不匹配、未解除报警）

### 全链路可追溯
- 一条指令 ID，能关联出：
  - 指令本身
  - 所有设备回执
  - 每条审计日志（按时间顺序）
  - 每条规则评估
  - 相关报警

## 报警类型

| 类型 | 级别 | 触发条件 |
|------|------|----------|
| interlock_violation | warning | 联锁规则阻止了指令 |
| status_mismatch | critical | 回执状态与指令期望不一致 |
| receipt_timeout | warning | 指令下发后超时未收到回执 |

## 设计特点

1. **无隐藏逻辑**：关键判断（规则匹配、状态比对）都有数据库记录，不是一次性的 if 判断
2. **事件可串联**：指令、回执、报警、审计通过 command_id 关联
3. **规则可扩展**：新增联锁规则只需往数据库插数据，无需改代码
4. **一致性可自动判断**：不用人工看，调用 consistency 接口直接拿到结论

## 自然语言验收点

### 一、主流程：正常启停能闭环
1. 下发一条启动指令后，设备上报「运行」状态回执，这条指令的最终状态应该是「已确认」
2. 再下发一条停止指令后，设备上报「停止」状态回执，指令同样能走到「已确认」
3. 任意一条成功的指令，用它的 ID 去查全链路追溯，应该能同时看到：指令本身、设备回执、审计日志、规则评估
4. 正常流程走完后，设备实时状态页面上显示的状态应该和最后一次回执一致

### 二、异常场景：联锁规则真能拦住
1. 先让一号泵处于运行状态（下发 start 指令并回执 running）
2. 这时尝试下发启动二号泵的指令
3. 应该能看到指令直接被拒绝，返回信息里明确写着「因为一号泵在运行，所以禁止启动二号泵」
4. 查报警列表时，应该能看到一条「联锁规则违规尝试」的警告
5. 关键的是：翻这条被拒绝指令的规则执行日志，能看到具体哪条规则起了作用、条件是否满足、决策是阻止还是放行、以及用自然语言写的判断原因——不是藏在代码里的一个布尔值

### 三、数据一致性：指令和回执对不上时要立刻暴露
1. 下发一条启动指令，但故意让设备回执「停止」状态
2. 这条指令的状态应该变成「不一致」，而不是默默地「已确认」
3. 报警列表中应该立刻出现一条「严重」级别的报警，内容写清楚：指令下发了什么动作、期望什么状态、实际回执了什么状态
4. 用一致性检查接口查这条指令，返回的 isConsistent 应该是 false，issues 数组里明确列出「回执状态不一致」
5. 如果把设备状态手动纠正为运行，再用同一条指令 ID 查，之前的不一致记录仍然保留——不会因为后续状态变化而抹掉历史痕迹

### 四、规则可复查：事后能看清每条判断
1. 随便下发一条指令，不管成功还是失败
2. 用这条指令 ID 去查规则执行日志
3. 应该能看到系统当时评估了多少条规则
4. 每条规则都能看到：规则名称、规则类型、当时的条件设备状态是多少、条件是否满足、最终决定是 allow 还是 block
5. 最重要的一点：每条决策都有一句人类可读的 reason，比如「互锁条件未满足：PUMP-002 当前状态为 stopped，规则放行」，事后回看时不需要翻代码也能理解当时为什么放行或阻止

### 五、全链路审计：操作痕迹不丢
1. 任意执行一个操作（下发指令、收到回执、解除报警）
2. 等几秒钟后查审计日志列表，应该能看到一条对应类型的记录
3. 审计记录里应该有：什么人（operator）、对哪个设备、做了什么动作、详细描述
4. 用一条指令的 ID 查该指令的审计链，应该能按时间顺序看到完整过程：规则检查通过/阻止 → 指令下发/拒绝 → （如果有回执）回执接收 → 指令确认/不一致 → （如果有报警）报警产生
5. 报警解除操作也应该在审计日志里有一条「alarm_resolved」记录，能看到是谁解除的

### 六、扩展能力：规则真的是数据驱动
1. 查当前生效的联锁规则列表，应该能看到 3 条默认规则
2. 如果在数据库里新增一条规则（比如「一号泵停止时禁止启动三号泵」的反向规则），不需要重启服务
3. 新规则在下一次指令下发时应该自动生效
4. 这说明规则不是硬编码在 if 语句里，而是真正从数据库读取的可复查配置
