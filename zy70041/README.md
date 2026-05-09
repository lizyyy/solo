# 设备点检缺陷工单系统

一个后端闭环系统，解决工厂点检发现缺陷后，维修、复验和停机影响经常断链的问题。

## 功能特性

- **点检项管理**：创建设备的检查项目
- **缺陷工单**：记录点检发现的缺陷，带严重等级（CRITICAL/HIGH/MEDIUM/LOW）
- **维修派单**：将工单分配给维修人员，生成派单记录
- **停机窗口**：记录设备停机时间，自动汇总到工单
- **复验回执**：维修完成后进行复验，通过则确认，不通过则重新打开
- **影响统计**：后台任务定期统计工单数量、等级分布、停机时长、平均解决时间
- **并发保护**：使用版本号乐观锁，防止重复提交把状态写乱
- **状态机控制**：非法流转会被拦住并给出能看懂的原因

## 状态流转图

```
PENDING(待处理)
    ↓派单
ASSIGNED(已派单)
    ↓开始维修
IN_PROGRESS(维修中)
    ↓完成维修
COMPLETED(待复验)
   ↙复验通过      ↘复验失败
REINSPECTED      REOPENED(重新派单)
    ↓关闭              ↓
CLOSED            ←────┘
```

## 快速开始

### 1. 安装依赖

```bash
pip install flask flask-sqlalchemy
```

### 2. 启动应用

```bash
python run.py
```

服务会在 `http://localhost:5001` 启动，首次启动会自动初始化数据库和 5 个默认点检项。

### 3. 生成测试数据

```bash
python seed_data.py
```

这会清空数据库，重新创建 3 个点检项、3 个工单，并模拟完整的业务流程。

---

## API 主流程调用示例

假设已运行 `seed_data.py` 生成了测试数据。

### 步骤 1：查看所有工单

```bash
curl http://localhost:5001/api/tickets
```

可以看到工单 #1 是 CLOSED（已走完主流程），工单 #2 是 REOPENED（复验失败），工单 #3 是 PENDING。

### 步骤 2：从头走一遍完整流程

```bash
# 2.1 创建点检项
curl -X POST http://localhost:5001/api/inspection-items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "气压检查",
    "equipment": "空压机E-05",
    "description": "检查空压机输出气压是否在 0.6-0.8MPa"
  }'

# 2.2 创建缺陷工单（返回的 version=1）
curl -X POST http://localhost:5001/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_item_id": 4,
    "severity": "HIGH",
    "description": "空压机气压只有 0.4MPa，无法满足生产需求",
    "created_by": "点检员-赵六"
  }'

# 2.3 派单（需要 version=1）
curl -X POST http://localhost:5001/api/tickets/4/assign \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "assignee": "维修组C",
    "instructions": "检查气路是否泄漏，必要时更换密封圈"
  }'
# 返回的 version 变为 2

# 2.4 开始维修（需要 version=2）
curl -X POST http://localhost:5001/api/tickets/4/start-work \
  -H "Content-Type: application/json" \
  -d '{"version": 2}'
# version 变为 3

# 2.5 记录停机窗口
curl -X POST http://localhost:5001/api/tickets/4/downtime \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2026-05-09T08:00:00",
    "end_time": "2026-05-09T09:30:00",
    "reason": "需要停机拆卸气路检查"
  }'

# 2.6 完成维修（需要 version=3）
curl -X POST http://localhost:5001/api/tickets/4/complete-work \
  -H "Content-Type: application/json" \
  -d '{
    "version": 3,
    "notes": "发现主管道密封圈老化，已更换，气压恢复 0.7MPa"
  }'
# version 变为 4

# 2.7 复验通过（需要 version=4）
curl -X POST http://localhost:5001/api/tickets/4/reinspect \
  -H "Content-Type: application/json" \
  -d '{
    "version": 4,
    "inspector": "质量检查员-王五",
    "result": true,
    "comments": "气压稳定，运行正常"
  }'
# version 变为 5

# 2.8 关闭工单（需要 version=5）
curl -X POST http://localhost:5001/api/tickets/4/close \
  -H "Content-Type: application/json" \
  -d '{"version": 5}'
```

### 步骤 3：查看影响统计

```bash
curl http://localhost:5001/api/statistics
```

---

## 触发异常示例

### 1. 重复提交（版本号冲突）

用旧的 version 提交：

```bash
# 假设工单 #4 当前 version 是 6，故意用 version=5
curl -X POST http://localhost:5001/api/tickets/4/close \
  -H "Content-Type: application/json" \
  -d '{"version": 5}'
```

**返回错误：**
```json
{
  "error": "工单版本冲突：当前版本 6，您的版本 5，请刷新后重试"
}
```

**说明：** 这是乐观锁保护。每次状态变更会使 version +1。如果两个人同时基于同一个 version 提交，只有第一个能成功，第二个会被拒绝，防止后提交的把先提交的覆盖。

### 2. 非法状态流转

从 PENDING 直接跳到 COMPLETED：

```bash
curl -X POST http://localhost:5001/api/tickets/3/complete-work \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
```

**返回错误：**
```json
{
  "error": "状态流转无效：从 PENDING 不能直接转到 COMPLETED，允许的下一个状态：ASSIGNED"
}
```

**说明：** 状态机严格控制流转路径。必须按 PENDING→ASSIGNED→IN_PROGRESS→COMPLETED 的顺序来，跳步会被拦住。

### 3. 对已关闭的工单操作

```bash
curl -X POST http://localhost:5001/api/tickets/1/start-work \
  -H "Content-Type: application/json" \
  -d '{"version": 6}'
```

**返回错误：**
```json
{
  "error": "状态流转无效：从 CLOSED 不能直接转到 IN_PROGRESS，允许的下一个状态：无（已关闭）"
}
```

---

## 查看结果

### 查看工单详情和历史

```bash
# 工单详情
curl http://localhost:5001/api/tickets/4

# 工单的停机记录
curl http://localhost:5001/api/tickets/4/downtime

# 所有工单列表（按创建时间倒序）
curl http://localhost:5001/api/tickets

# 影响统计
curl http://localhost:5001/api/statistics
```

### 查看数据库文件

数据库是 SQLite 文件 `app.db`，可以用任何 SQLite 工具打开查看所有表的原始数据。

---

## 后台任务说明

系统有一个后台定时任务，**自动生成影响统计**。

### 任务行为

- **执行周期**：每 60 秒一次
- **统计范围**：近 30 天的缺陷工单
- **统计内容**：工单总数、各严重等级数量、总停机时长、平均解决时间

### 任务失败和重试

后台任务有完整的失败处理机制：

1. **首次失败**：
   - 记录失败时间
   - 增加连续失败计数
   - 写入日志

2. **自动重试**：
   - 最多重试 3 次
   - 每次重试间隔 5 秒
   - 第 1 次失败 → 等 5 秒重试（第 1 次重试）
   - 第 2 次失败 → 等 5 秒重试（第 2 次重试）
   - 第 3 次失败 → 等 5 秒重试（第 3 次重试）
   - 第 4 次失败 → 放弃，等待下一个 60 秒周期

3. **不同错误类型的表现：**
   - **数据库错误（SQLAlchemyError）**：会触发上述重试逻辑
   - **其他异常**：记入日志，不重试，直接等下个周期

4. **成功后的表现：**
   - 记录最后成功时间
   - 重置重试计数和连续失败计数
   - 等待下一个 60 秒周期

### 任务状态含义

- `running`：任务线程是否在运行
- `last_success`：上次成功执行的时间
- `last_failure`：上次失败的时间
- `retry_count`：当前周期内已重试次数（0-3）
- `consecutive_failures`：连续失败的周期数

### 举个场景例子

假设数据库连接临时中断 150 秒：

```
0秒  任务启动，正常执行，last_success 更新
60秒 尝试执行 → 数据库错误 → retry_count=1 → 等5秒重试
65秒 重试 → 仍失败 → retry_count=2 → 等5秒
70秒 重试 → 仍失败 → retry_count=3 → 等5秒
75秒 重试 → 仍失败 → 放弃，consecutive_failures=1
120秒 下一个周期开始 → 数据库已恢复 → 执行成功
      last_success 更新，retry_count=0，consecutive_failures=0
```

结果是：丢失了 1 个周期的数据，但在下一个周期自动恢复了，不需要人工干预。

---

## API 汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/inspection-items | 列出所有点检项 |
| POST | /api/inspection-items | 创建点检项 |
| GET | /api/tickets | 列出所有工单 |
| GET | /api/tickets/:id | 获取工单详情 |
| POST | /api/tickets | 创建缺陷工单 |
| POST | /api/tickets/:id/assign | 派单（需要 version） |
| POST | /api/tickets/:id/start-work | 开始维修（需要 version） |
| POST | /api/tickets/:id/complete-work | 完成维修（需要 version） |
| POST | /api/tickets/:id/reinspect | 复验（需要 version，result=true 通过，=false 重开） |
| POST | /api/tickets/:id/close | 关闭工单（需要 version） |
| GET | /api/tickets/:id/downtime | 查看工单的停机记录 |
| POST | /api/tickets/:id/downtime | 记录停机时间 |
| GET | /api/statistics | 查看影响统计 |

---

## 关键规则说明

1. **版本号必须匹配**：所有状态变更操作（assign/start-work/complete-work/reinspect/close）都需要传 `version`，必须等于工单当前的 version，否则报版本冲突。这防止了重复提交和并发写乱。

2. **状态机严格**：只能按允许的路径流转，跳步会被拦住，错误信息会告诉你允许的下一个状态是什么。

3. **复验失败自动重开**：`reinspect` 接口传 `result=false` 时，工单状态从 COMPLETED 变为 REOPENED，`assigned_to` 清空，需要重新派单。

4. **停机时间自动汇总**：每次添加停机记录时，如果传了 `end_time`，`duration_hours` 会自动计算，并累加到工单的 `downtime_hours`。

5. **后台任务自动恢复**：数据库暂时不可用等可恢复错误会自动重试，达到最大重试次数后等待下个周期，不会一直卡死。
