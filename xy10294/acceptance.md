# 产线班组技能矩阵 API 验收步骤

## 前置条件
1. 已安装 Node.js 16+
2. 已在项目目录执行 `npm install`

---

## 第零步：准备数据库和测试数据

### 0.1 清理旧数据（可选）
如果之前运行过，先删除旧数据库：
```bash
rm -f production_line.db
```

### 0.2 插入测试数据
```bash
node init-data.js
```
预期输出：显示各数据量的统计信息，以及关键数据说明。

---

## 第一步：启动服务

### 1.1 启动 API 服务
```bash
node index.js
```
预期输出：
```
产线班组技能矩阵 API 已启动: http://localhost:3002
健康检查: http://localhost:3002/api/health
```

**保持该终端窗口打开**，以下步骤需要新开一个终端窗口执行。

---

## 第二步：健康检查和基础数据查询

### 2.1 健康检查
```bash
curl -s http://localhost:3002/api/health
```
预期：返回 `{"success":true,"status":"ok",...}`

### 2.2 查询员工列表（员工技能入口）
```bash
curl -s http://localhost:3002/api/employees
```
预期：返回 6 名员工（EMP001-EMP006）

### 2.3 查询技能列表
```bash
curl -s http://localhost:3002/api/skills
```
预期：返回 6 项技能（焊接、组装、检测等）

### 2.4 查询岗位列表（岗位要求关键校验）
```bash
curl -s http://localhost:3002/api/positions
```
预期：返回 7 个岗位

### 2.5 查询岗位的技能要求
```bash
curl -s "http://localhost:3002/api/position-requirements?position_id=POS001"
```
预期：主焊接岗（POS001）要求 焊接L3（必须）+ 机器人L2（非必须）

### 2.6 查询员工的技能认证
```bash
curl -s "http://localhost:3002/api/employee-skills?employee_id=EMP001"
```
预期：张三（EMP001）有 3 项技能：焊接L4、组装L3、机器人L2

---

## 第三步：正常场景 - 完整的换班申请流程

### 3.1 创建换班申请（李四替班到主焊接岗）
李四（EMP002）有焊接L3技能，技能匹配。
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-20260510-LISI-001",
    "requester_id": "EMP002",
    "original_position_id": "POS002",
    "target_position_id": "POS001",
    "original_employee_id": "EMP001",
    "replacement_employee_id": "EMP002",
    "shift_date": "2026-05-15",
    "shift_type": "DAY",
    "reason": "张三家中有事，请求临时换班"
  }'
```
预期结果验证：
- `status: "DRAFT"`
- `validation_summary.passed: true` 或检查各校验项：
  - SKILL_MATCH: passed=true（李四焊接L3 >= 要求L3；机器人技能非必须）
  - FATIGUE_CHECK: passed=true（李四未疲劳）
  - ABSENCE_CHECK: passed=true（李四未缺勤）

### 3.2 提交申请（推进到待审批）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests/<替换为上一步返回的request_id>/submit \
  -H "Content-Type: application/json" \
  -d '{"actor_id": "EMP002", "comment": "已确认信息无误"}'
```
预期：`status: "PENDING_APPROVAL"`

### 3.3 审批通过
```bash
curl -s -X POST http://localhost:3002/api/shift-requests/<替换为上一步的request_id>/approve \
  -H "Content-Type: application/json" \
  -d '{"actor_id": "MANAGER001", "comment": "同意换班"}'
```
预期：`status: "APPROVED"`

### 3.4 查询申请详情（含校验记录和流转日志）
```bash
curl -s http://localhost:3002/api/shift-requests/<替换为上一步的request_id>
```
预期：
- `validations` 包含技能匹配、疲劳检查、缺勤检查的记录
- `transitions` 包含 CREATE -> SUBMIT -> APPROVE 的流转记录

---

## 第四步：异常场景验证

### 4.1 异常1：技能等级不足（重复数据/数据错误场景）
尝试让吴八（EMP006，焊接L1）顶替主焊接岗（要求L3）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-20260510-WUBA-001",
    "requester_id": "EMP006",
    "target_position_id": "POS001",
    "replacement_employee_id": "EMP006",
    "shift_date": "2026-05-15",
    "shift_type": "DAY",
    "reason": "我想试试主焊接岗"
  }'
```
预期：
- 申请可以创建（DRAFT），但校验失败
- `validation_summary.passed: false`
- SKILL_MATCH 显示 `passed: false`，消息包含「技能等级不足: 焊接操作 要求 L3，员工 L1」

### 4.2 异常2：疲劳状态（EMP001 连续工作6天 + 累计60小时）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-20260510-ZHANGSAN-001",
    "requester_id": "EMP001",
    "target_position_id": "POS003",
    "replacement_employee_id": "EMP001",
    "shift_date": "2026-05-10",
    "shift_type": "NIGHT",
    "reason": "想多加个夜班"
  }'
```
预期：
- FATIGUE_CHECK `passed: false`
- 消息包含「疲劳状态」「连续6天」「累计60小时」

先验证 EMP001 的疲劳状态：
```bash
curl -s "http://localhost:3002/api/fatigue/EMP001?date=2026-05-10"
```
预期：`is_fatigued: 1`，`warnings` 数组有两条警告。

### 4.3 异常3：缺勤状态（EMP006 今天已请假）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-20260510-WUBA-ABSENT-001",
    "requester_id": "EMP006",
    "target_position_id": "POS003",
    "replacement_employee_id": "EMP006",
    "shift_date": "2026-05-10",
    "shift_type": "DAY",
    "reason": "今天上班"
  }'
```
预期：
- ABSENCE_CHECK `passed: false`
- 消息包含「已标记缺勤: 事假」

### 4.4 异常4：缺少必填字段
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "EMP001"
  }'
```
预期：
- HTTP 400
- `error: "BAD_REQUEST"`
- `message` 包含「缺少必填字段: target_position_id, shift_date, shift_type」

### 4.5 异常5：重复数据（幂等性验证 - 重复请求不写乱状态）
用同一个 idempotency_key 发两次请求：

**第一次**：
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "IDEMPOTENT-TEST-001",
    "requester_id": "EMP002",
    "target_position_id": "POS003",
    "replacement_employee_id": "EMP002",
    "shift_date": "2026-05-16",
    "shift_type": "DAY",
    "reason": "测试幂等性"
  }'
```
记录返回的 `request_id`。

**第二次（重复请求）**：
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "IDEMPOTENT-TEST-001",
    "requester_id": "EMP002",
    "target_position_id": "POS003",
    "replacement_employee_id": "EMP002",
    "shift_date": "2026-05-16",
    "shift_type": "DAY",
    "reason": "测试幂等性-第二次"
  }'
```
预期：
- 返回 `from_cache: true`
- `request_id` 和第一次相同
- `reason` 仍然是「测试幂等性」（没有被第二次覆盖）

验证只创建了一条：
```bash
curl -s "http://localhost:3002/api/shift-requests?requester_id=EMP002"
```

---

## 第五步：撤回和修正

### 5.1 创建一个申请并提交
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-WITHDRAW-TEST-001",
    "requester_id": "EMP002",
    "target_position_id": "POS002",
    "replacement_employee_id": "EMP002",
    "shift_date": "2026-05-20",
    "shift_type": "DAY",
    "reason": "测试撤回"
  }'
```
记录 `request_id`。

**提交**：
```bash
curl -s -X POST http://localhost:3002/api/shift-requests/<替换request_id>/submit \
  -H "Content-Type: application/json" \
  -d '{"actor_id": "EMP002"}'
```

### 5.2 撤回申请
```bash
curl -s -X POST http://localhost:3002/api/shift-requests/<替换request_id>/withdraw \
  -H "Content-Type: application/json" \
  -d '{"actor_id": "EMP002", "comment": "临时有事，不换了"}'
```
预期：`status: "WITHDRAWN"`

### 5.3 创建一个有错误的申请（人工改错场景）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-REVISE-TEST-001",
    "requester_id": "EMP002",
    "target_position_id": "POS001",
    "replacement_employee_id": "EMP006",
    "shift_date": "2026-05-21",
    "shift_type": "DAY",
    "reason": "误选了吴八作为替班人"
  }'
```
预期：校验失败（EMP006 技能不足）

记录 `request_id`。

### 5.4 修正申请（改为正确的替班人）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests/<替换request_id>/revise \
  -H "Content-Type: application/json" \
  -d '{
    "actor_id": "EMP002",
    "replacement_employee_id": "EMP002",
    "reason": "应该让李四自己来",
    "comment": "修正替班人员"
  }'
```
预期：
- `status: "DRAFT"`（回到草稿状态可重新提交）
- `replacement_employee_id: "EMP002"`
- `validation_summary.passed: true`（现在校验通过了）

---

## 第六步：查询汇总

### 6.1 查询技能矩阵总览
```bash
curl -s http://localhost:3002/api/summary/matrix
```
预期返回：
- `employees`: 员工技能矩阵（每人的所有技能认证情况）
- `positions`: 岗位要求矩阵（每个岗位需要哪些技能，等级要求）
- `pending_requests_count`: 待处理申请数量
- `pending_requests`: 待处理申请列表
- 统计数据：员工数、技能数、岗位数

### 6.2 按状态查询申请
```bash
curl -s "http://localhost:3002/api/shift-requests?status=DRAFT"
```
```bash
curl -s "http://localhost:3002/api/shift-requests?status=APPROVED"
```
```bash
curl -s "http://localhost:3002/api/shift-requests?status=WITHDRAWN"
```

### 6.3 按日期查询
```bash
curl -s "http://localhost:3002/api/shift-requests?shift_date=2026-05-15"
```

---

## 第七步：新增技能认证（员工技能作为入口）

### 7.1 新增员工技能
给赵六（EMP004）加一个焊接L2技能：
```bash
curl -s -X POST http://localhost:3002/api/employee-skills \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP004",
    "skill_id": "SK001",
    "skill_level": 2,
    "certified_at": "2026-05-01T09:00:00.000Z"
  }'
```
验证：
```bash
curl -s "http://localhost:3002/api/employee-skills?employee_id=EMP004"
```

### 7.2 验证现在赵六可以胜任辅助焊接岗（POS002，要求焊接L2）
```bash
curl -s -X POST http://localhost:3002/api/shift-requests \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "REQ-NEW-SKILL-TEST-001",
    "requester_id": "EMP004",
    "target_position_id": "POS002",
    "replacement_employee_id": "EMP004",
    "shift_date": "2026-05-22",
    "shift_type": "DAY",
    "reason": "新获得了焊接认证"
  }'
```
预期：SKILL_MATCH `passed: true`

---

## 验收检查清单

| 检查项 | 命令位置 | 预期 | 结果 |
|--------|---------|------|------|
| 服务启动 | 步骤1.1 | 监听3000端口 | [ ] |
| 健康检查 | 步骤2.1 | success:true | [ ] |
| 员工技能入口 | 步骤2.2, 2.6 | 能查询员工和技能 | [ ] |
| 岗位要求查询 | 步骤2.4, 2.5 | POS001有焊接L3要求 | [ ] |
| 正常换班流程 | 步骤3.1-3.4 | 能创建->提交->审批 | [ ] |
| 技能等级不足 | 步骤4.1 | 校验失败 | [ ] |
| 疲劳检查 | 步骤4.2 | EMP001被判定疲劳 | [ ] |
| 缺勤检查 | 步骤4.3 | EMP006缺勤被拦截 | [ ] |
| 缺字段报错 | 步骤4.4 | HTTP 400 + 清晰提示 | [ ] |
| 幂等性（防重复） | 步骤4.5 | 同key返回缓存数据 | [ ] |
| 撤回申请 | 步骤5.2 | status=WITHDRAWN | [ ] |
| 修正申请 | 步骤5.4 | 能改替班人并重校验 | [ ] |
| 技能矩阵总览 | 步骤6.1 | 完整的汇总数据 | [ ] |
| 新增技能认证 | 步骤7 | 能加技能并影响校验 | [ ] |

---

## 常见问题

### 端口被占用？
查看占用并杀死：
```bash
lsof -i :3000
kill -9 <PID>
```

### 需要重置数据？
```bash
rm -f production_line.db
node init-data.js
node index.js
```

### 想要用 Postman 测试？
Base URL: `http://localhost:3002`
Headers: `Content-Type: application/json`
