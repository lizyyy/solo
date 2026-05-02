# 封锁点施工冲突审校站

地铁检修调度室专用夜间窗口封锁计划管理系统，用于合并线路区间、施工队申请、接触网停电范围、行车调度命令和抢修插单，自动检查冲突并支持人工复核。

## 功能特性

### 核心功能
- **夜间窗口合并**：支持跨线路、跨区间的施工计划整合
- **冲突自动检测**：
  - 时间重叠检测（完全重叠、部分重叠）
  - 区间连通性检查
  - 资源占用冲突（施工队、接触网分区）
  - 停送电前后置条件验证
  - 首班车安全缓冲时间检查
  - 紧急插单优先级处理
- **计划状态管理**：草稿 → 提交 → 审批 → 执行 → 完成/撤销
- **数据导入导出**：CSV/JSON 申请导入，Markdown/CSV/JSON 排班审计包导出
- **版本管理**：所有计划变更自动保存版本
- **审计日志**：完整操作追溯记录

### 技术特性
- 基于 Node.js + Express 的 REST API 服务
- SQLite 本地数据库，无需额外配置
- 完整的拓扑关系管理（线路、车站、区间）
- 完善的资源管理（施工队、接触网分区、调度命令）

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装步骤

```bash
# 1. 安装依赖
npm install

# 2. 初始化示例数据（可选）
npm run init-data

# 3. 启动服务
npm start
```

服务启动后，访问 `http://localhost:3000` 即可使用。

## API 端点总览

| 模块 | 端点 | 说明 |
|------|------|------|
| 健康检查 | GET /health | 服务健康状态 |
| 线路管理 | GET/POST/PUT/DELETE /api/lines | 线路 CRUD |
| 车站管理 | GET/POST/PUT/DELETE /api/stations | 车站 CRUD |
| 区间管理 | GET/POST/PUT/DELETE /api/sections | 区间 CRUD |
| 拓扑查询 | GET /api/topology/lines/:id | 获取线路拓扑 |
| 计划管理 | GET/POST/PUT/DELETE /api/plans | 封锁计划 CRUD |
| 计划状态 | POST /api/plans/:id/submit | 提交计划 |
| | POST /api/plans/:id/approve | 审批计划 |
| | POST /api/plans/:id/execute | 开始执行 |
| | POST /api/plans/:id/complete | 完成执行 |
| | POST /api/plans/:id/cancel | 撤销计划 |
| | POST /api/plans/:id/emergency | 标记为紧急 |
| 冲突检查 | GET/POST /api/conflicts | 冲突检测 |
| 资源管理 | GET/POST/PUT/DELETE /api/teams | 施工队管理 |
| | GET/POST/PUT/DELETE /api/catenary-zones | 接触网分区 |
| | GET/POST/PUT/DELETE /api/dispatch-commands | 调度命令 |
| 数据导入 | POST /api/import/json | JSON 导入 |
| | POST /api/import/csv | CSV 导入 |
| 数据导出 | GET /api/export/markdown | Markdown 导出 |
| | GET /api/export/csv | CSV 导出 |
| | GET /api/export/json | JSON 导出 |
| 版本管理 | GET /api/versions | 版本列表 |
| 审计日志 | GET /api/audit | 审计日志 |

## CURL 验证流程

以下是完整的 curl 命令验证流程，按顺序执行即可体验完整功能。

### 1. 健康检查

```bash
# 检查服务是否正常运行
curl -X GET http://localhost:3000/health
```

**预期响应：**
```json
{"success":true,"data":{"status":"ok","uptime":"...","timestamp":"..."}}
```

---

### 2. 线路拓扑管理

#### 2.1 查看所有线路

```bash
curl -X GET http://localhost:3000/api/lines
```

#### 2.2 创建新线路

```bash
curl -X POST http://localhost:3000/api/lines \
  -H "Content-Type: application/json" \
  -d '{
    "id": "LINE-TEST-001",
    "name": "测试线路",
    "color": "#FF0000",
    "description": "用于测试的演示线路"
  }'
```

#### 2.3 查看特定线路

```bash
curl -X GET http://localhost:3000/api/lines/LINE-TEST-001
```

---

### 3. 车站管理

#### 3.1 创建车站

```bash
# 创建起点站
curl -X POST http://localhost:3000/api/stations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ST-TEST-001",
    "line_id": "LINE-TEST-001",
    "name": "测试起点站",
    "sequence": 0,
    "is_terminal": true,
    "description": "测试线路起点站"
  }'

# 创建中间站
curl -X POST http://localhost:3000/api/stations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ST-TEST-002",
    "line_id": "LINE-TEST-001",
    "name": "测试中间站",
    "sequence": 1,
    "is_terminal": false
  }'

# 创建终点站
curl -X POST http://localhost:3000/api/stations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ST-TEST-003",
    "line_id": "LINE-TEST-001",
    "name": "测试终点站",
    "sequence": 2,
    "is_terminal": true,
    "description": "测试线路终点站"
  }'
```

#### 3.2 查看所有车站

```bash
curl -X GET "http://localhost:3000/api/stations?line_id=LINE-TEST-001"
```

---

### 4. 区间管理

#### 4.1 创建区间

```bash
# 区间1: 起点站-中间站
curl -X POST http://localhost:3000/api/sections \
  -H "Content-Type: application/json" \
  -d '{
    "id": "SEC-TEST-001",
    "line_id": "LINE-TEST-001",
    "name": "测试起点站-中间站区间",
    "start_station_id": "ST-TEST-001",
    "end_station_id": "ST-TEST-002",
    "length_km": 2.5,
    "track_count": 2,
    "speed_limit": 80
  }'

# 区间2: 中间站-终点站
curl -X POST http://localhost:3000/api/sections \
  -H "Content-Type: application/json" \
  -d '{
    "id": "SEC-TEST-002",
    "line_id": "LINE-TEST-001",
    "name": "测试中间站-终点站区间",
    "start_station_id": "ST-TEST-002",
    "end_station_id": "ST-TEST-003",
    "length_km": 1.8,
    "track_count": 2,
    "speed_limit": 70
  }'
```

#### 4.2 获取线路拓扑

```bash
curl -X GET http://localhost:3000/api/topology/lines/LINE-TEST-001
```

---

### 5. 资源管理

#### 5.1 创建施工队

```bash
curl -X POST http://localhost:3000/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TEAM-TEST-001",
    "name": "轨道维修测试队",
    "leader_name": "张测试",
    "leader_phone": "13800000000",
    "team_size": 10,
    "specialization": "轨道检修、更换钢轨",
    "status": "active"
  }'
```

#### 5.2 创建接触网分区

```bash
curl -X POST http://localhost:3000/api/catenary-zones \
  -H "Content-Type: application/json" \
  -d '{
    "id": "CAT-TEST-001",
    "line_id": "LINE-TEST-001",
    "name": "测试供电分区",
    "start_section_id": "SEC-TEST-001",
    "end_section_id": "SEC-TEST-002",
    "power_supply": "测试变电所",
    "voltage": "1500V",
    "status": "active"
  }'
```

#### 5.3 创建调度命令

```bash
curl -X POST http://localhost:3000/api/dispatch-commands \
  -H "Content-Type: application/json" \
  -d '{
    "id": "CMD-TEST-001",
    "code": "BLK-TEST-001",
    "name": "区间封锁测试命令",
    "command_type": "blockade",
    "description": "测试用区间封锁命令",
    "valid_from": "2024-05-20 00:00:00",
    "valid_until": "2024-12-31 23:59:59",
    "status": "active"
  }'
```

---

### 6. 封锁计划管理

#### 6.1 创建计划（草稿）

```bash
# 获取今天和明天的日期
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -v +1d +%Y-%m-%d 2>/dev/null || date -d tomorrow +%Y-%m-%d)

# 创建计划
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d "{
    \"plan_number\": \"BLK-TEST-$(date +%Y%m%d)-001\",
    \"line_id\": \"LINE-TEST-001\",
    \"work_type\": \"轨道检修\",
    \"work_content\": \"测试计划：更换磨耗超标钢轨，涉及3处病害点\",
    \"construction_team_id\": \"TEAM-TEST-001\",
    \"priority\": 1,
    \"is_emergency\": false,
    \"start_time\": \"${TODAY} 23:00:00\",
    \"end_time\": \"${TOMORROW} 04:00:00\",
    \"first_train_time\": \"${TOMORROW} 05:30:00\",
    \"power_off_required\": false,
    \"catenary_zone_ids\": [],
    \"section_ids\": [\"SEC-TEST-001\", \"SEC-TEST-002\"],
    \"station_ids\": [\"ST-TEST-001\", \"ST-TEST-002\", \"ST-TEST-003\"],
    \"dispatch_command_id\": \"CMD-TEST-001\",
    \"applicant_id\": \"TEST-USER-001\",
    \"applicant_name\": \"测试申请人\",
    \"notes\": \"这是一个测试计划\"
  }"
```

#### 6.2 查看所有计划

```bash
curl -X GET http://localhost:3000/api/plans
```

#### 6.3 提交计划（草稿 → 已提交）

```bash
# 先获取计划ID
PLAN_ID=$(curl -s http://localhost:3000/api/plans?status=draft | grep -o '"id":"[0-9]*"' | head -1 | cut -d'"' -f4)

echo "Plan ID: $PLAN_ID"

# 提交计划
curl -X POST "http://localhost:3000/api/plans/$PLAN_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer_id": "TEST-REVIEWER-001",
    "reviewer_name": "测试审批人"
  }'
```

#### 6.4 自动冲突检查

```bash
# 检查计划冲突
curl -X POST http://localhost:3000/api/conflicts/check \
  -H "Content-Type: application/json" \
  -d "{
    \"plan_id\": \"$PLAN_ID\"
  }"
```

#### 6.5 审批计划（已提交 → 已审批）

```bash
curl -X POST "http://localhost:3000/api/plans/$PLAN_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer_id": "TEST-APPROVER-001",
    "reviewer_name": "测试审批人",
    "approved": true,
    "comments": "同意，注意施工安全"
  }'
```

#### 6.6 开始执行（已审批 → 执行中）

```bash
curl -X POST "http://localhost:3000/api/plans/$PLAN_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor_id": "TEST-EXECUTOR-001",
    "executor_name": "测试执行人"
  }'
```

#### 6.7 完成执行（执行中 → 已完成）

```bash
TOMORROW=$(date -v +1d +%Y-%m-%d 2>/dev/null || date -d tomorrow +%Y-%m-%d)

curl -X POST "http://localhost:3000/api/plans/$PLAN_ID/complete" \
  -H "Content-Type: application/json" \
  -d "{
    \"executor_id\": \"TEST-EXECUTOR-001\",
    \"actual_end_time\": \"${TOMORROW} 03:30:00\",
    \"completion_notes\": \"施工完成，质量符合要求\"
  }"
```

---

### 7. 冲突检测演示

#### 7.1 创建冲突计划

```bash
# 先创建第一个计划（已完成的步骤）
# 现在创建一个会与第一个计划冲突的新计划

TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -v +1d +%Y-%m-%d 2>/dev/null || date -d tomorrow +%Y-%m-%d)

# 创建冲突计划（时间重叠，区间重叠）
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d "{
    \"plan_number\": \"BLK-TEST-$(date +%Y%m%d)-002\",
    \"line_id\": \"LINE-TEST-001\",
    \"work_type\": \"接触网维护\",
    \"work_content\": \"冲突测试计划：同一时间段同一区间\",
    \"construction_team_id\": \"TEAM-TEST-001\",
    \"priority\": 2,
    \"is_emergency\": false,
    \"start_time\": \"${TODAY} 23:30:00\",
    \"end_time\": \"${TOMORROW} 03:00:00\",
    \"first_train_time\": \"${TOMORROW} 05:30:00\",
    \"power_off_required\": true,
    \"catenary_zone_ids\": [\"CAT-TEST-001\"],
    \"section_ids\": [\"SEC-TEST-001\"],
    \"station_ids\": [\"ST-TEST-001\", \"ST-TEST-002\"],
    \"applicant_id\": \"TEST-USER-002\",
    \"applicant_name\": \"冲突测试申请人\"
  }"
```

#### 7.2 检查冲突

```bash
# 获取新计划ID
NEW_PLAN_ID=$(curl -s "http://localhost:3000/api/plans?status=draft" | grep -o '"id":"[0-9]*"' | tail -1 | cut -d'"' -f4)

# 检查该计划的冲突
curl -X POST http://localhost:3000/api/conflicts/check \
  -H "Content-Type: application/json" \
  -d "{
    \"plan_id\": \"$NEW_PLAN_ID\"
  }"
```

**预期冲突检测结果：**
```json
{
  "success": true,
  "data": {
    "has_conflict": true,
    "conflicts": [
      {
        "type": "time_section_overlap",
        "severity": "high",
        "message": "与计划 BLK-TEST-... 存在时间和区间重叠",
        "details": {
          "timeOverlap": { ... },
          "sectionOverlap": { ... }
        }
      }
    ]
  }
}
```

---

### 8. 紧急插单演示

#### 8.1 创建紧急计划

```bash
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -v +1d +%Y-%m-%d 2>/dev/null || date -d tomorrow +%Y-%m-%d)

curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d "{
    \"plan_number\": \"BLK-EMERG-$(date +%Y%m%d)-001\",
    \"line_id\": \"LINE-TEST-001\",
    \"work_type\": \"紧急抢修\",
    \"work_content\": \"道岔故障紧急抢修，影响早高峰运营\",
    \"construction_team_id\": \"TEAM-TEST-001\",
    \"priority\": 10,
    \"is_emergency\": true,
    \"start_time\": \"${TODAY} 23:00:00\",
    \"end_time\": \"${TOMORROW} 05:00:00\",
    \"first_train_time\": \"${TOMORROW} 05:30:00\",
    \"power_off_required\": false,
    \"section_ids\": [\"SEC-TEST-002\"],
    \"applicant_id\": \"TEST-USER-003\",
    \"applicant_name\": \"紧急抢修申请人\",
    \"notes\": \"运营期间发现故障，已登记运统-46\"
  }"
```

#### 8.2 检查紧急计划优先级

```bash
# 获取紧急计划ID
EMERG_PLAN_ID=$(curl -s "http://localhost:3000/api/plans?is_emergency=true" | grep -o '"id":"[0-9]*"' | head -1 | cut -d'"' -f4)

# 查看紧急计划详情
curl -X GET "http://localhost:3000/api/plans/$EMERG_PLAN_ID"
```

---

### 9. 撤销计划演示

```bash
# 先提交冲突计划，然后撤销
curl -X POST "http://localhost:3000/api/plans/$NEW_PLAN_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer_id": "TEST-REVIEWER-001",
    "reviewer_name": "测试审批人"
  }'

# 撤销计划（发现冲突后撤销）
curl -X POST "http://localhost:3000/api/plans/$NEW_PLAN_ID/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelled_by": "TEST-CANCEL-001",
    "cancelled_by_name": "测试撤销人",
    "cancel_reason": "检测到与已有计划冲突，撤销后重新安排"
  }'
```

---

### 10. 数据导入导出

#### 10.1 JSON 导入

```bash
# 创建导入数据文件
cat > /tmp/test-import.json << 'EOF'
{
  "data_source": "系统导入",
  "plans": [
    {
      "plan_number": "BLK-IMPORT-001",
      "line_name": "测试线路",
      "work_type": "导入测试",
      "work_content": "通过JSON导入的测试计划",
      "team_name": "轨道维修测试队",
      "priority": 2,
      "is_emergency": false,
      "start_time": "2024-05-20 23:00:00",
      "end_time": "2024-05-21 04:00:00",
      "first_train_time": "2024-05-21 05:30:00",
      "section_names": ["测试起点站-中间站区间"],
      "station_names": ["测试起点站", "中间站"],
      "power_off_required": false,
      "applicant_name": "导入测试人"
    }
  ]
}
EOF

# 执行导入
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @/tmp/test-import.json
```

#### 10.2 CSV 导入

```bash
# 创建 CSV 导入文件
cat > /tmp/test-import.csv << 'EOF'
plan_number,line_name,work_type,work_content,team_name,priority,start_time,end_time,first_train_time,section_names,applicant_name
BLK-CSV-IMPORT-001,测试线路,轨道检修,CSV导入测试计划,轨道维修测试队,1,2024-05-20 23:00:00,2024-05-21 04:00:00,2024-05-21 05:30:00,测试起点站-中间站区间,CSV导入人
EOF

# 执行导入
curl -X POST http://localhost:3000/api/import/csv \
  -F "file=@/tmp/test-import.csv"
```

#### 10.3 导出 Markdown 审计包

```bash
# 导出所有已审批计划
curl -X GET "http://localhost:3000/api/export/markdown?status=approved" -o /tmp/audit-report.md

# 查看导出内容
cat /tmp/audit-report.md
```

#### 10.4 导出 CSV

```bash
# 导出为 CSV
curl -X GET "http://localhost:3000/api/export/csv" -o /tmp/plans.csv
```

#### 10.5 导出 JSON

```bash
# 导出为 JSON
curl -X GET "http://localhost:3000/api/export/json"
```

---

### 11. 版本管理和审计日志

#### 11.1 查看计划版本历史

```bash
curl -X GET "http://localhost:3000/api/versions?entity_type=PLAN&entity_id=$PLAN_ID"
```

#### 11.2 查看审计日志

```bash
# 所有审计日志
curl -X GET http://localhost:3000/api/audit

# 特定计划的审计日志
curl -X GET "http://localhost:3000/api/audit/plans/$PLAN_ID"

# 按操作类型筛选
curl -X GET "http://localhost:3000/api/audit?operation_type=PLAN_CREATE"
```

---

## 项目结构

```
blockade-conflict-checker/
├── src/
│   ├── app.js                    # Express 应用入口
│   ├── config.js                 # 配置文件
│   ├── storage/
│   │   ├── database.js           # SQLite 数据库连接和初始化
│   │   └── init.sql              # 数据库表结构定义
│   ├── models/
│   │   ├── plan.js               # 计划数据模型
│   │   ├── line.js               # 线路数据模型
│   │   ├── section.js            # 区间数据模型
│   │   ├── station.js            # 车站数据模型
│   │   ├── team.js               # 施工队数据模型
│   │   ├── catenary.js           # 接触网数据模型
│   │   └── version.js            # 版本数据模型
│   ├── services/
│   │   ├── topology-service.js   # 拓扑服务（线路、车站、区间）
│   │   ├── conflict-checker.js   # 冲突检查器
│   │   ├── plan-state-machine.js # 计划状态机
│   │   ├── resource-service.js   # 资源管理服务
│   │   ├── import-service.js     # 数据导入服务
│   │   ├── export-service.js     # 数据导出服务
│   │   └── audit-service.js      # 审计日志服务
│   ├── utils/
│   │   ├── time-rules.js         # 时间规则引擎
│   │   └── validators.js         # 数据验证工具
│   └── routes/
│       ├── plans.js              # 计划 API 路由
│       ├── topology.js           # 拓扑 API 路由
│       ├── conflicts.js          # 冲突检查 API 路由
│       ├── resources.js          # 资源管理 API 路由
│       ├── import.js             # 数据导入 API 路由
│       ├── export.js             # 数据导出 API 路由
│       ├── versions.js           # 版本管理 API 路由
│       └── audit.js              # 审计日志 API 路由
├── data/                         # 数据目录（运行时生成）
│   └── blockade.db               # SQLite 数据库文件
├── scripts/
│   └── init-sample-data.js       # 示例数据初始化脚本
├── test/
│   └── basic-test.js             # 基础测试脚本
├── package.json                  # 项目配置
└── README.md                     # 本文档
```

## 状态机说明

计划状态流转如下：

```
┌─────────────┐
│   draft     │  草稿状态（可编辑）
└──────┬──────┘
       │ submit()
       ▼
┌─────────────┐
│  submitted  │  已提交（等待审批）
└──────┬──────┘
       │ approve()
       │ reject()
       ▼
┌─────────────┐    cancel()
│  approved   │──────────────┐
│             │              ▼
└──────┬──────┘    ┌─────────────┐
       │            │  cancelled  │
       │ execute()  └─────────────┘
       ▼
┌─────────────┐
│  executing  │  执行中
└──────┬──────┘
       │ complete()
       ▼
┌─────────────┐
│  completed  │  已完成
└─────────────┘
```

**状态定义：**
| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| draft | 草稿，初始状态 | submit, update, delete |
| submitted | 已提交，等待审批 | approve, reject, cancel |
| approved | 已审批，等待执行 | execute, cancel |
| executing | 执行中 | complete, cancel |
| completed | 已完成 | - |
| cancelled | 已撤销 | - |
| rejected | 已驳回 | update, delete |

## 冲突检查规则

### 时间规则
- **重叠检测**：两个时间段存在交集即视为冲突（边界接触不冲突）
- **安全缓冲**：结束时间与首班车时间间隔必须 >= 30 分钟
- **夜间窗口**：作业时间必须在 22:00 - 次日 06:00 之间，且不能跨越多夜

### 拓扑规则
- **区间重叠**：同一时间重叠区间的施工视为冲突
- **区间连通**：计划区间必须在拓扑上连通
- **相邻区间**：相邻区间的时间重叠需特别检查

### 资源规则
- **施工队冲突**：同一施工队不能同时参与多个计划
- **接触网冲突**：同一接触网分区不能同时进行多个需要停电的作业
- **优先级处理**：高优先级（数值大）计划可抢占低优先级计划的资源

## 运行测试

```bash
# 运行基础测试
npm test

# 或手动运行
node test/basic-test.js
```

## 常见问题

### Q: 如何重置数据库？
A: 删除 `data/blockade.db` 文件，重新启动服务会自动创建新数据库。

### Q: 如何添加新线路？
A: 使用线路管理 API，先创建线路，再创建车站，最后创建区间。

### Q: 冲突检测返回有冲突，但我认为没有问题怎么办？
A: 可以查看详细的冲突信息，确认后进行人工复核。紧急插单可以通过提高优先级来解决冲突。

### Q: 支持多线路并行施工吗？
A: 支持。不同线路之间不会产生区间冲突，但需要注意施工队、接触网等资源冲突。

## 安全说明

- 本系统为本地服务，默认不包含身份认证
- 生产环境使用建议添加身份认证和访问控制
- 数据库文件包含敏感信息，请注意保护

## 许可证

MIT License
