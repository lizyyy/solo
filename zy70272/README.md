# 滑翔伞飞行窗口 API

一个小而完整的业务工具，用于滑翔伞基地根据**天气窗口**、**教练排班**、**学员等级**和**装备状态**判断飞行可行性。

---

## 一、快速开始

### 1. 安装依赖

```bash
cd /Users/lzy/pro/solo/workspaces/zy70272
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 查看接口文档

访问 `http://localhost:3000/api` 查看所有接口。

---

## 二、业务流程概览

```
创建申请 → 天气窗口检查 → 教练排班检查 → 装备检查
     ↓
提交审批 → 审批通过 → 飞行完成 → 安全报表
     ↓
(任一环节失败 → 待复核 needs_review → 人工修正 → 继续)
```

### 核心差异点

1. **天气窗口**：风向必须是 NE/E/SE（东北/东/东南），不同学员等级风速上限不同
2. **教练学员匹配**：教练等级必须 ≥ 学员等级，新手学员(<3次飞行)必须高级教练
3. **装备安全**：必须三件套齐全（主伞+备份伞+头盔），检查状态和检定期限

---

## 三、内置数据（造数完成）

### 天气窗口

| ID | 日期 | 时段 | 风向 | 风速 | 最低等级 | 是否可飞 |
|----|------|------|------|------|----------|----------|
| w1 | 今日 | morning | E(东风) | 15m/s | intermediate | ✅ |
| w2 | 今日 | afternoon | SE(东南) | 25m/s | advanced | ❌ 风速过高 |
| w3 | 明日 | morning | NE(东北) | 10m/s | beginner | ✅ |

### 教练

| ID | 姓名 | 等级 | 今日上午 | 今日下午 | 明日上午 |
|----|------|------|----------|----------|----------|
| c1 | 张明 | advanced | ✅ 可用 | ❌ 休息 | ✅ 可用 |
| c2 | 李华 | intermediate | ✅ 可用 | ✅ 可用 | ❌ 培训 |
| c3 | 王强 | beginner | ❌ 设备维护 | ✅ 可用 | ✅ 可用 |

### 学员

| ID | 姓名 | 等级 | 飞行次数 | 上次飞行 |
|----|------|------|----------|----------|
| s1 | 赵小白 | beginner | 5次 | 7天前 |
| s2 | 钱中间 | intermediate | 30次 | 2天前 |
| s3 | 孙高手 | advanced | 100次 | 1天前 |

### 装备

| ID | 名称 | 类型 | 状态 | 检定期限 | 适合等级 |
|----|------|------|------|----------|----------|
| e1 | Alpha-1 | 主伞 | available | 23天后 | 全部 |
| e2 | Beta-2 | 主伞 | available | 27天后 | 中高级 |
| e3 | Gamma-3 | 主伞 | maintenance | 今天到期 | 初中级 |
| e4 | S-1 | 备份伞 | available | 335天后 | 全部 |
| e5 | H-1 | 头盔 | available | 351天后 | 全部 |

---

## 四、使用指南

### 第一步：查看可用资源

```bash
# 查看天气窗口（按学员等级过滤）
curl "http://localhost:3000/api/weather/windows?level=intermediate"

# 查看某时段可用教练
curl "http://localhost:3000/api/coaches/available?date=2026-05-11&timeSlot=morning&level=intermediate"

# 查看所有装备
curl http://localhost:3000/api/equipment
```

### 第二步：走一个完整的顺利流程

**推荐：先运行脚本查看命令**

```bash
node test-success.js
```

以下是手动执行步骤：

```bash
# ========== 步骤1: 创建飞行申请 ==========
# 学员: 钱中间(s2, intermediate)
# 日期: 今日 时段: 上午
RESPONSE=$(curl -s -X POST http://localhost:3000/api/flights \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "s2",
    "date": "2026-05-11",
    "timeSlot": "morning",
    "notes": "复飞训练"
  }')

echo $RESPONSE | python3 -m json.tool

# 从响应中提取 data.id，替换下方的 ${REQUEST_ID}

# ========== 步骤2: 天气窗口检查 ==========
# 使用 w1 (今日上午，东风15m/s，要求intermediate)
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/weather \
  -H "Content-Type: application/json" \
  -d '{ "weatherId": "w1" }' | python3 -m json.tool

# 预期: success=true, status=weather_check

# ========== 步骤3: 教练排班检查 ==========
# 选择 张明(c1, advanced)
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/coach \
  -H "Content-Type: application/json" \
  -d '{ "coachId": "c1" }' | python3 -m json.tool

# 预期: success=true, status=schedule_check

# ========== 步骤4: 装备检查 ==========
# 三件套: Alpha-1(e1) + 备份伞S-1(e4) + 头盔H-1(e5)
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/equipment \
  -H "Content-Type: application/json" \
  -d '{ "equipmentIds": ["e1", "e4", "e5"] }' | python3 -m json.tool

# 预期: success=true, status=equipment_check

# ========== 步骤5: 提交审批 ==========
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/submit \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

# 预期: status=pending_approval

# ========== 步骤6: 审批通过 ==========
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "安全主管-李总",
    "notes": "条件良好，同意放飞"
  }' | python3 -m json.tool

# 预期: status=approved

# ========== 步骤7: 完成飞行 + 安全报告 ==========
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "flightDuration": 45,
    "altitude": 800,
    "weatherConditions": {
      "windSpeed": 14,
      "windDirection": "E",
      "temperature": 23
    },
    "incidents": [],
    "notes": "飞行平稳，学员表现良好",
    "safetyRating": "normal"
  }' | python3 -m json.tool

# 预期: status=completed，生成安全报告

# ========== 步骤8: 导出安全报表 ==========
curl "http://localhost:3000/api/reports/safety?startDate=2026-05-11" | python3 -m json.tool
```

### 第三步：测试拦截/待复核场景

**运行脚本查看所有拦截场景：**

```bash
node test-failure.js
```

#### 场景1: 缺字段（直接拦截）

```bash
curl -X POST http://localhost:3000/api/flights \
  -H "Content-Type: application/json" \
  -d '{ "studentId": "s1" }' | python3 -m json.tool

# 预期: success=false, missingFields=["date","timeSlot"]
```

#### 场景2: 重复提交（直接拦截）

```bash
# 先提交一次
curl -X POST http://localhost:3000/api/flights \
  -H "Content-Type: application/json" \
  -d '{"studentId":"s2","date":"2026-05-11","timeSlot":"morning"}'

# 再提交一次相同的
curl -X POST http://localhost:3000/api/flights \
  -H "Content-Type: application/json" \
  -d '{"studentId":"s2","date":"2026-05-11","timeSlot":"morning"}' | python3 -m json.tool

# 预期: success=false, error="重复提交..."
```

#### 场景3: 天气不匹配（进入待复核）

```bash
# 赵小白(s1, beginner) 申请 w1 (要求intermediate)
# 步骤1: 创建申请
RESPONSE=$(curl -s -X POST http://localhost:3000/api/flights \
  -H "Content-Type: application/json" \
  -d '{"studentId":"s1","date":"2026-05-11","timeSlot":"morning"}')

REQUEST_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 步骤2: 天气检查
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/weather \
  -H "Content-Type: application/json" \
  -d '{"weatherId":"w1"}' | python3 -m json.tool

# 预期: success=false, status=needs_review
# 原因: 赵小白是beginner，w1要求intermediate
```

#### 场景4: 装备维护中（进入待复核 → 人工修正）

```bash
# 假设申请已通过天气和教练检查
# 尝试选择 e3 (状态maintenance)

# 装备检查
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/equipment \
  -H "Content-Type: application/json" \
  -d '{"equipmentIds":["e3","e4","e5"]}' | python3 -m json.tool

# 预期: success=false, status=needs_review
# 原因: e3是maintenance状态

# ========== 人工修正 ==========
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "安全员-老王",
    "decision": "approve",
    "corrections": {
      "equipmentIds": ["e1", "e4", "e5"]
    }
  }' | python3 -m json.tool

# 预期: status=pending_approval，可继续审批流程
```

#### 场景5: 非法状态流转（直接拦截）

```bash
# 创建申请后直接跳过天气检查去查教练
RESPONSE=$(curl -s -X POST http://localhost:3000/api/flights \
  -H "Content-Type: application/json" \
  -d '{"studentId":"s2","date":"2026-05-11","timeSlot":"morning"}')

REQUEST_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 跳过天气，直接查教练
curl -X POST http://localhost:3000/api/flights/${REQUEST_ID}/coach \
  -H "Content-Type: application/json" \
  -d '{"coachId":"c1"}' | python3 -m json.tool

# 预期: success=false, error="非法状态流转"
# 原因: 当前status=draft，无法直接到schedule_check
```

---

## 五、接口速查

### 参考数据

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/weather` | GET | 所有天气窗口 |
| `/api/weather/windows?date=&level=` | GET | 按日期和等级过滤可飞窗口 |
| `/api/coaches` | GET | 所有教练 |
| `/api/coaches/available?date=&timeSlot=&level=` | GET | 查询可用教练 |
| `/api/students` | GET | 所有学员 |
| `/api/equipment` | GET | 所有装备 |

### 工作流

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/flights` | POST | 创建申请 |
| `/api/flights/:id/weather` | POST | 天气检查 |
| `/api/flights/:id/coach` | POST | 教练检查 |
| `/api/flights/:id/equipment` | POST | 装备检查 |
| `/api/flights/:id/submit` | POST | 提交审批 |
| `/api/flights/:id/approve` | POST | 审批通过 |
| `/api/flights/:id/reject` | POST | 审批拒绝 |
| `/api/flights/:id/review` | POST | 人工复核 |
| `/api/flights/:id/complete` | POST | 完成飞行+安全报告 |

### 查询与报表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/flights` | GET | 所有申请（?status= 过滤） |
| `/api/flights/:id` | GET | 单个申请详情 |
| `/api/reports/safety?startDate=&endDate=` | GET | 导出安全报表 |

---

## 六、业务规则速查

### 天气窗口规则

- **风向**：必须是 NE / E / SE（东北、东、东南风）
- **风速**：
  - Beginner: ≤ 15 m/s
  - Intermediate: ≤ 20 m/s
  - Advanced: ≤ 25 m/s
- **最低风速**：≥ 5 m/s（风太小无法起飞）
- **能见度**：≥ 5 km
- **学员等级**：必须 ≥ 天气窗口的 minLevel

### 教练排班规则

- 教练必须在该时段 available
- 教练等级必须 ≥ 学员等级
- 学员飞行次数 < 3 次必须由高级教练带教
- 同一时段不能有冲突安排

### 装备安全规则

- **必备三件套**：主伞(canopy) + 备份伞(reserve) + 头盔(helmet)
- 状态必须是 `available`（不能是 maintenance / expired）
- 装备必须适合学员等级
- 风速不能超过装备的 maxWindSpeed
- 检定期限剩余天数必须 > 0

---

## 七、状态机

```
draft → weather_check → schedule_check → equipment_check
  │            │                │                │
  │            ↓                ↓                ↓
  │         needs_review ← needs_review ← needs_review
  │                │
  │                ↓ 人工复核(可修正天气/教练/装备)
  │            pending_approval
  │                │
  │           ┌────┴────┐
  │           ↓         ↓
  │        approved  rejected
  │           │
  │        completed
  │
  └─→ 任何状态都可以 reject/cancel
```

---

## 八、文件结构

```
zy70272/
├── package.json          # 项目配置
├── server.js             # 服务入口
├── models/
│   └── index.js          # 数据模型 + 内置造数
├── services/
│   ├── weather.js        # 天气窗口逻辑
│   ├── scheduling.js     # 教练排班/等级匹配
│   ├── equipment.js      # 装备检查/安全校验
│   └── flight.js         # 飞行申请流程/状态机
├── routes/
│   └── api.js            # REST API 路由
├── test-success.js       # 顺利样例脚本
├── test-failure.js       # 拦截/待复核样例脚本
└── README.md             # 使用说明（本文件）
```

---

**祝你飞行愉快！🪂**
