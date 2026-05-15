# 门店巡检整改 API - 使用说明

## 一、快速启动

### 1. 安装依赖

```bash
cd /Users/lzy/pro/solo/workspaces/zy70080
pip3 install -r requirements.txt
```

### 2. 启动服务

```bash
python3 -m uvicorn app.main:app --reload --port 8000
```

服务启动后，访问以下地址：
- API 文档（交互界面）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

**首次启动会自动：**
- 创建 SQLite 数据库文件 `inspection.db`
- 初始化 5 个示例门店
- 初始化 5 个巡检项
- 初始化 4 条扣分规则

---

## 二、核心概念

| 概念 | 说明 | 关键数据 |
|------|------|----------|
| **门店** | 被巡检的对象 | 名称、编码、所属区域 |
| **巡检项** | 检查的标准条目 | 名称、类别、基础分 |
| **巡检** | 一次巡检活动 | 门店、巡检员、状态 |
| **巡检记录** | 某巡检项的检查结果 | 是否通过、初始扣分 |
| **整改任务** | 针对不合格项的整改 | 责任人、截止时间、状态流转 |
| **照片证据** | 问题/整改/复查的照片 | 类型、上传人、时间 |
| **事件日志** | 整改过程的所有操作 | 状态变化、操作人、说明 |

---

## 三、整改任务状态机

```
           ┌─────────────────────────────────────────────────┐
           │                                                 ▼
  [assigned] ──► [rectifying] ──► [submitted] ──► [rechecking] ──► [passed]
       │              │              │              │              │
       │              │              │              │              │
       ▼              ▼              │              └──► [rejected]
  [cancelled]    [overdue] ──────────┘                    │
        ▲              ▲                                  │
        │              │                                  │
        └──────────────┴──────────────────────────────────┘
                         创建新整改任务（重试）
```

| 状态 | 含义 | 可执行操作 |
|------|------|------------|
| `assigned` | 已分派 | 开始整改 / 撤销 |
| `rectifying` | 整改中 | 提交整改 / 撤销（会触发逾期检测） |
| `submitted` | 已提交 | 开始复查 |
| `rechecking` | 复查中 | 复查通过 / 复查不通过 |
| `passed` | 已通过 | 无（终态） |
| `rejected` | 不通过 | 创建重试任务 |
| `overdue` | 已逾期 | 重新整改 / 撤销 |
| `cancelled` | 已撤销 | 无（终态） |

---

## 四、标准操作流程

### 流程一：正常巡检 + 整改 + 复查

```
步骤1：创建巡检
POST /api/inspections
{
  "store_id": 1,
  "inspector": "张巡检员"
}
返回: {"id": 1, "status": "pending", ...}

接下来该做什么？
→ 查 GET /api/inspections 确认巡检创建成功
→ 下一步：添加巡检记录
```

```
步骤2：添加巡检记录（不合格项）
POST /api/inspections/1/records
{
  "item_id": 1,
  "is_pass": false,
  "deduction_reason": "地面有明显污渍"
}
返回: {"id": 1, "is_pass": false, "score": 0.0, "deduction": 10.0, ...}

巡检状态自动变为 in_progress

接下来该做什么？
→ 查 GET /api/inspections/1/records 看记录列表
→ 继续添加其他巡检项，或完成巡检
```

```
步骤3：完成巡检
POST /api/inspections/1/complete
返回: {"message": "巡检已完成", "inspection_id": 1}

接下来该做什么？
→ 查 GET /api/inspections 确认状态变为 completed
→ 下一步：为不合格项分派整改任务
```

```
步骤4：分派整改任务
POST /api/inspections/rectifications
{
  "record_id": 1,
  "assignee": "李店长",
  "deadline": "2026-05-12T18:00:00"
}
返回: {"id": 1, "status": "assigned", "retry_count": 0, ...}

接下来该做什么？
→ 查 GET /api/inspections/rectifications?assignee=李店长
→ 或查 GET /api/inspections/rectifications/1
→ 下一步：责任人开始整改
```

```
步骤5：责任人开始整改
POST /api/inspections/rectifications/1/start?actor=李店长
返回: {"message": "开始整改", "status": "rectifying"}

接下来该做什么？
→ 查 GET /api/inspections/rectifications/1 确认状态
→ 下一步：提交整改结果
```

```
步骤6：提交整改
POST /api/inspections/rectifications/1/submit
{
  "rectification_description": "已清扫地面，并安排了定期保洁"
}
返回: {"message": "整改已提交", "status": "submitted"}

接下来该做什么？
→ 查 GET /api/inspections/rectifications/1 确认状态
→ 下一步：巡检员进行复查
```

```
步骤7：开始复查
POST /api/inspections/rectifications/1/start-recheck?rechecker=王复查员
返回: {"message": "开始复查", "status": "rechecking", "rechecker": "王复查员"}

接下来该做什么？
→ 查 GET /api/inspections/rectifications/1/events 看事件日志
→ 下一步：完成复查
```

```
步骤8：复查通过
POST /api/inspections/rectifications/1/complete-recheck
{
  "recheck_result": "通过",
  "recheck_remark": "地面已清洁，符合标准"
}
返回: {
  "message": "复查完成",
  "status": "passed",
  "final_score": 8.0,
  "final_deduction": 2.0
}

恭喜！整改完成。

接下来该做什么？
→ 查 GET /api/inspections/rectifications/1/trace 看完整追踪
→ 查 GET /api/reports/export/trace/1 导出追踪明细
→ 或查 GET /api/reports/regions 看区域统计
```

### 流程二：复查不通过 → 重试

```
承接流程一步骤7之后：

步骤8：复查不通过
POST /api/inspections/rectifications/1/complete-recheck
{
  "recheck_result": "不通过",
  "recheck_remark": "仍有死角未清扫，需要重新整改"
}
返回: {"message": "复查完成", "status": "rejected"}

接下来该做什么？
→ 查 GET /api/inspections/rectifications/1/events 看事件
→ 查 GET /api/inspections/rectifications/1/trace 看状态变化
→ 下一步：创建重试整改任务
```

```
步骤9：创建重试整改
POST /api/inspections/rectifications/1/retry?new_deadline=2026-05-14T18:00:00
返回: {
  "id": 2,
  "status": "assigned",
  "retry_count": 1,
  "parent_id": 1,
  ...
}

注意：
- 创建了新的整改任务 #2
- retry_count = 1（第一次重试）
- parent_id 指向原任务 #1

接下来该做什么？
→ 查 GET /api/inspections/rectifications/2/trace 看重试链
→ 后续流程同流程一（开始整改 → 提交 → 复查）
```

### 流程三：撤销整改任务

```
适用场景：问题误判、门店已关闭等

POST /api/inspections/rectifications/1/cancel?reason=该问题不属于本门店责任范围&actor=管理员
返回: {"message": "整改已撤销", "status": "cancelled"}

可撤销的状态：
- assigned（已分派）
- rectifying（整改中）
- overdue（已逾期）

不可撤销：
- passed（已通过）
- cancelled（已撤销）

接下来该做什么？
→ 查 GET /api/inspections/rectifications/1/events 看撤销事件
→ 或重新分派新的整改任务
```

### 流程四：逾期处理

```
系统自动检测：
- 当 deadline < 当前时间 时
- 访问 GET /api/inspections/rectifications/{id} 会自动触发逾期检测
- 状态从 rectifying 变为 overdue
- 记录一条事件日志

或手动检查：
GET /api/inspections/rectifications/1

返回中 status = "overdue"

逾期后的操作：
1. 创建重试任务（重新分派，有重试惩罚）
2. 撤销整改

逾期对扣分的影响：
- 扣分 = 基础扣分 × 逾期倍数 + 重试次数 × 重试惩罚
- 默认规则：逾期倍数 1.5~2.0，重试惩罚 1.0~3.0

接下来该做什么？
→ 查 GET /api/master/deduction-rules 看扣分规则
→ 查 GET /api/inspections/rectifications/1/events 看逾期事件
```

---

## 五、异常场景说明

### 场景一：并发操作冲突

```
A用户：开始整改 #1 → status: rectifying
B用户：同时尝试开始整改 #1 → 返回 409 冲突

错误响应：
{
  "detail": "状态冲突：当前状态为 rectifying，期望状态为 assigned"
}

问题排查：
→ 查 GET /api/inspections/rectifications/1/events 看谁先操作
→ 查 retry_chain 看是否已有重试任务
```

### 场景二：同一记录同时存在多个整改任务

```
尝试分派第二个整改任务：
POST /api/inspections/rectifications
{
  "record_id": 1,  # 已有进行中的整改任务
  "assignee": "另一个人",
  "deadline": "..."
}

返回 409：
{
  "detail": "该记录已有进行中的整改任务 #1"
}

问题排查：
→ 查 GET /api/inspections/rectifications?status=assigned,rectifying,submitted
→ 确认是否是误操作，先撤销已有任务再新建
```

### 场景三：状态机非法跳转

```
当前状态：submitted（已提交等待复查）
尝试操作：提交整改（应为 rectifying 才能提交）

POST /api/inspections/rectifications/1/submit
返回 409：
{
  "detail": "状态冲突：当前状态为 submitted，期望状态为 rectifying"
}

问题排查：
→ 查 GET /api/inspections/rectifications/1/trace 看当前状态
→ 对照状态机图表确认正确的操作顺序
```

---

## 六、数据导出

### 1. 区域汇总报表

```
GET /api/reports/regions
返回各区域统计：
{
  "region": "华南区",
  "total_stores": 2,
  "total_inspections": 5,
  "total_issues": 8,
  "total_rectifications": 8,
  "passed_rectifications": 6,
  "overdue_rectifications": 1,
  "total_deduction": 15.0,
  "avg_score": 7.5
}

筛选条件：
- ?region=华南区 ：指定区域
- ?start_date=...&end_date=... ：时间范围

业务复核用途：
- 各区域整改完成率对比
- 逾期情况分析
- 扣分趋势
```

### 2. 整改任务批量导出

```
GET /api/reports/export/rectifications
下载 Excel 文件

内容：
- Sheet1：整改任务明细（18列，带格式）
- Sheet2：数据汇总（状态分布、扣分合计）

筛选条件：
- ?region=华南区
- ?status=passed
- ?start_date=...&end_date=...

业务复核用途：
- 月度/季度复盘
- 导出给财务或管理层
- 异常数据排查
```

### 3. 单任务追踪导出

```
GET /api/reports/export/trace/1
下载单任务的完整追踪 Excel

内容：
- 整改基本信息（编号、状态、得分、扣分）
- 事件日志（时间线）
- 照片证据列表

业务复核用途：
- 争议处理（查谁做了什么）
- 责任追溯（重试链看历史）
- 审计存档
```

---

## 七、照片证据处理

### 照片类型

| 类型 | 时机 | 关联 |
|------|------|------|
| `issue` | 巡检发现问题时 | 巡检记录（record_id） |
| `rectification` | 提交整改时 | 整改任务（rectification_id） |
| `recheck` | 复查时 | 整改任务（rectification_id） |

### 照片与数据同步机制

```
问题：照片上传了，但整改状态没更新？

排查步骤：
1. 查 GET /api/inspections/rectifications/{id}/trace
2. 看 events 中是否有 submit 事件
3. 看 photos 列表是否包含该照片
4. 确认 photo_type 是否正确（应为 rectification）

设计说明：
- 照片与整改状态分开管理
- 提交整改时可同时附带照片
- 也可以单独上传照片（通过 PhotoEvidence 表）
- 追踪接口会返回照片和事件的完整时间线
```

---

## 八、扣分规则

### 默认规则

| 规则 | 类别 | 等级 | 基础扣分 | 逾期倍数 | 重试惩罚 |
|------|------|------|----------|----------|----------|
| 通用一级 | 全部 | 1 | 2.0 | 1.5x | 1.0 |
| 通用二级 | 全部 | 2 | 5.0 | 2.0x | 2.0 |
| 通用三级 | 全部 | 3 | 10.0 | 2.0x | 3.0 |
| 安全一级 | 安全 | 1 | 5.0 | 2.0x | 2.0 |

### 扣分计算公式

```
最终扣分 = 基础扣分 × 逾期倍数 + 重试次数 × 重试惩罚

示例：
- 正常完成：2.0 × 1 + 0 × 1.0 = 2.0 分
- 逾期完成：2.0 × 1.5 + 0 × 1.0 = 3.0 分
- 重试1次：2.0 × 1 + 1 × 1.0 = 3.0 分
- 逾期+重试：2.0 × 1.5 + 1 × 1.0 = 4.0 分
```

### 如何确认扣分规则？

```
查扣分规则：
GET /api/master/deduction-rules

查任务最终扣分：
GET /api/inspections/rectifications/1
→ final_deduction 字段

查扣分计算明细：
GET /api/inspections/rectifications/1/trace
→ 看 retry_count（重试次数）
→ 看 events 中是否有 overdue 事件
→ 结合扣分规则复核
```

---

## 九、追踪与审计

### 完整追踪

```
GET /api/inspections/rectifications/{id}/trace

返回包含：
{
  "rectification": { 基本信息 },
  "retry_chain": [  // 重试链路，从最初到当前
    { "id": 1, "status": "rejected", ... },
    { "id": 2, "status": "passed", ... }
  ],
  "events": [  // 所有状态变化
    { "time": "...", "type": "assign", "from": null, "to": "assigned", ... },
    { "time": "...", "type": "start", "from": "assigned", "to": "rectifying", ... },
    ...
  ],
  "photos": [  // 所有相关照片
    { "id": 1, "type": "issue", ... },
    { "id": 2, "type": "rectification", ... },
  ]
}
```

### 事件类型

| 事件 | 触发操作 | from_status | to_status |
|------|----------|-------------|-----------|
| `retry_created` | 创建重试任务 | null | assigned |
| `start` | 开始整改 | assigned | rectifying |
| `submit` | 提交整改 | rectifying | submitted |
| `start_recheck` | 开始复查 | submitted | rechecking |
| `pass` | 复查通过 | rechecking | passed |
| `reject` | 复查不通过 | rechecking | rejected |
| `overdue` | 超时自动检测 | 任意活跃态 | overdue |
| `cancel` | 撤销整改 | 非终态 | cancelled |

---

## 十、常见问题排查

### Q1：服务启动失败

```
现象：uvicorn 报错 "ModuleNotFoundError: No module named 'fastapi'"
解决：
1. 确认在正确目录：cd /Users/lzy/pro/solo/workspaces/zy70080
2. 重新安装依赖：pip3 install -r requirements.txt
3. 检查 Python 版本：python3 --version
```

### Q2：数据库文件在哪？

```
位置：/Users/lzy/pro/solo/workspaces/zy70080/inspection.db

重置数据库：
1. 停止服务
2. 删除 inspection.db
3. 重新启动服务（会自动重建并初始化示例数据）
```

### Q3：整改任务状态不对

```
排查：
1. 查 GET /api/inspections/rectifications/{id} 当前状态
2. 查 GET /api/inspections/rectifications/{id}/events 事件时间线
3. 对照状态机图表，确认正确操作

常见错误：
- 提交了整改，但忘了开始复查 → status 还是 submitted
- 复查不通过后，直接操作原任务 → 应该创建重试任务
```

### Q4：扣分和预期不符

```
排查：
1. 查 GET /api/inspections/rectifications/{id}/trace
2. 确认 retry_count（重试次数）
3. 确认是否有 overdue 事件
4. 查 GET /api/master/deduction-rules 看对应规则
5. 手动计算：基础扣分 × 逾期倍数 + 重试次数 × 重试惩罚
```

### Q5：照片和整改不同步

```
排查：
1. 查 GET /api/inspections/rectifications/{id}/trace
2. 看 photos 列表中的 photo_type 和 upload_time
3. 看 events 列表中的状态变化时间
4. 比较时间先后顺序

设计说明：
- 照片可以在任意时间上传
- 但只有 submit 事件发生后，状态才变为 submitted
- 如果先上传照片但没提交整改：照片存在，但状态不对
```

---

## 十一、运行示例脚本

项目包含一个完整的示例脚本，演示所有场景：

```bash
python3 examples/demo_flow.py
```

脚本会演示：
1. 创建巡检
2. 添加不合格记录
3. 分派整改
4. 开始整改 → 提交整改
5. 复查不通过 → 创建重试
6. 重试后复查通过
7. 查看完整追踪
8. 导出报表

---

## 十二、API 清单速查

### 基础数据
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/master/stores` | 新增门店 |
| GET | `/api/master/stores` | 门店列表 |
| POST | `/api/master/items` | 新增巡检项 |
| GET | `/api/master/items` | 巡检项列表 |
| POST | `/api/master/deduction-rules` | 新增扣分规则 |
| GET | `/api/master/deduction-rules` | 扣分规则列表 |

### 巡检
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inspections` | 创建巡检 |
| GET | `/api/inspections` | 巡检列表 |
| POST | `/api/inspections/{id}/records` | 添加巡检记录 |
| GET | `/api/inspections/{id}/records` | 巡检记录列表 |
| POST | `/api/inspections/{id}/complete` | 完成巡检 |

### 整改
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inspections/rectifications` | 分派整改任务 |
| GET | `/api/inspections/rectifications` | 整改任务列表 |
| GET | `/api/inspections/rectifications/{id}` | 任务详情（触发逾期检测） |
| POST | `/api/inspections/rectifications/{id}/start` | 开始整改 |
| POST | `/api/inspections/rectifications/{id}/submit` | 提交整改 |
| POST | `/api/inspections/rectifications/{id}/start-recheck` | 开始复查 |
| POST | `/api/inspections/rectifications/{id}/complete-recheck` | 完成复查 |
| POST | `/api/inspections/rectifications/{id}/retry` | 创建重试任务 |
| POST | `/api/inspections/rectifications/{id}/cancel` | 撤销整改 |
| GET | `/api/inspections/rectifications/{id}/trace` | 完整追踪 |
| GET | `/api/inspections/rectifications/{id}/events` | 事件日志 |

### 报表
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports/regions` | 区域汇总 |
| GET | `/api/reports/region-list` | 区域列表 |
| GET | `/api/reports/export/rectifications` | 批量导出 Excel |
| GET | `/api/reports/export/trace/{id}` | 单任务追踪导出 |
