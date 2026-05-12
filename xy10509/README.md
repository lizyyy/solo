# 医院转诊床位协调 API

## 项目概述

医联体转诊床位协调系统，解决传统电话确认床位的问题。实现患者转诊时的科室床位匹配、病情等级优先级、预约时间管理和取消释放规则。

## 本地启动

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务启动后访问: http://localhost:3000

### 健康检查
```bash
curl http://localhost:3000/health
```

## 造数说明

首次启动会自动初始化数据库并加载样例数据。

### 预置数据
- **医院**: 中心医院、社区医院
- **科室**: 
  - 心内科 (5张床，活跃)
  - 神经内科 (4张床，活跃)
  - ICU (2张床，活跃)
  - 急诊科 (已暂停接收，用于失败场景)
- **患者**: 张三、李四、王五、赵六、孙七（5位示例患者）

### 手动重新造数
```bash
rm -rf ./data && npm start
```

## 主要演示路径

### 运行完整演示
```bash
npm run demo
```

演示包含以下场景：

#### 场景1：普通预约流程
1. 查看床位状态 → 确认可用
2. 创建转诊申请（张三 - 稳定性心绞痛）
3. 预约床位 → 自动分配
4. 确认预约 → 状态变更
5. 查看历史记录 → 完整流转追踪

#### 场景2：重症插队（优先级）
1. 占满心内科床位
2. 普通患者申请 → 进入候补（位置1）
3. 重症患者申请 → 进入候补（位置1，普通患者后移）
4. 验证队列：重症分数100 > 普通40

#### 场景3：取消释放 + 候补递补
1. 取消一个已预约申请
2. 床位释放
3. 系统自动处理候补队列
4. 重症患者优先递补到床位

#### 场景4：幂等性验证
1. 首次调用创建申请
2. 相同幂等键重复调用
3. 返回同一记录，不重复创建

#### 场景5：人工修正
1. 管理员修改申请状态
2. 记录前后差异（diff）
3. 记录操作者信息

#### 场景6：超时释放
- 默认配置：30分钟未确认自动取消
- 调用 `POST /api/v1/system/check-timeouts` 触发检查

## 失败路径演示

### 运行失败演示
```bash
npm run demo-fail
```

包含以下失败场景：

1. **向已暂停科室申请** → 抛出异常，记录 exception
2. **同一患者重复申请** → 拦截，返回已有申请
3. **无效病情等级** → 校验失败
4. **状态流转错误** → 取消后不能再确认
5. **超时未确认** → 自动取消，床位释放
6. **科室不存在** → 校验失败

## API 接口说明

### 基础路由: `/api/v1`

#### 患者管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/patients` | 注册患者 |
| GET | `/patients` | 获取患者列表 |
| GET | `/patients/:id` | 获取患者详情 |

#### 转诊申请
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/requests` | 创建申请（支持幂等键） |
| GET | `/requests` | 查询申请列表（可按状态筛选） |
| GET | `/requests/:id` | 获取申请详情（含历史和异常） |
| POST | `/requests/:id/schedule` | 预约床位 |
| POST | `/requests/:id/confirm` | 确认预约 |
| POST | `/requests/:id/cancel` | 取消申请 |
| PUT | `/requests/:id/manual` | 人工修正（记录差异） |

#### 床位和队列
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/beds/status` | 全局床位状态 |
| GET | `/departments/:departmentId/queue` | 查看科室候补队列 |

#### 报告导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reports/dashboard` | 仪表板摘要 |
| GET | `/reports/bed-occupancy` | 床位占用报告 |
| GET | `/reports/waiting-queue` | 候补队列报告 |
| GET | `/reports/full` | 完整综合报告 |

#### 异常和历史
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/exceptions` | 查询异常记录 |
| POST | `/exceptions/:id/resolve` | 标记异常已解决 |
| GET | `/history` | 查询状态变更历史 |

#### 系统操作
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/system/check-timeouts` | 检查并处理超时申请 |

### 请求头

| Header | 说明 |
|--------|------|
| `x-idempotency-key` | 幂等键，防止重复请求 |
| `x-operator` | 操作者标识，用于审计 |

### 病情等级 (severityLevel)

| 等级 | 分数 | 说明 |
|------|------|------|
| `critical` | 100 | 危急，最高优先级 |
| `urgent` | 70 | 紧急 |
| `normal` | 40 | 普通 |
| `low` | 10 | 低优先级 |

### 申请状态流转

```
pending (待处理)
    ↓
waiting (候补) ←──────┐
    ↓                 │
scheduled (已预约)     │ 无床位时
    ↓                 │
confirmed (已确认)     │
    ↓                 │
in_progress (转诊中)  │
    ↓                 │
completed (已完成)    │
                      │
cancelled (已取消) ←───┼── 主动取消
timed_out (超时) ←────┘── 超时未确认
rejected (已拒绝)
exception (异常)
```

## 业务规则实现

### 1. 重症优先
- 按 `urgency_score` 排序（critical=100, normal=40）
- 同分数按申请时间排序
- 候补队列实时重排

### 2. 同一患者重复申请
- 创建时检查是否有未完成申请
- 状态：pending/waiting/scheduled/confirmed 视为未完成
- 拦截并返回已有申请

### 3. 超时未确认
- 配置：`confirmTimeoutMinutes: 30`
- 超过30分钟未确认 → 自动取消
- 床位释放 → 候补递补
- 记录异常

### 4. 取消后候补递补
- 取消申请 → 床位状态变为 available
- 触发 `processWaitingQueue()`
- 按优先级从队列取出患者递补
- 更新队列位置

### 5. 科室暂停接收
- 创建/预约时检查 `departments.is_active`
- 暂停的科室拒绝新申请
- 记录 `department_inactive` 异常

### 6. 幂等性
- 使用 `x-idempotency-key` Header
- 相同键返回同一记录
- 防止重复提交

### 7. 人工修正留痕
- 使用 `PUT /requests/:id/manual`
- 记录 `diff_json`（前后差异）
- 记录 `changed_by`（操作者）
- 记录 `reason = '人工修正'`

## 数据模型

### 核心表
- `hospitals` - 医院
- `departments` - 科室（含 is_active 状态）
- `beds` - 床位
- `patients` - 患者
- `transfer_requests` - 转诊申请（核心）
- `appointments` - 预约记录
- `waiting_queue` - 候补队列
- `status_history` - 状态历史
- `exceptions` - 异常记录

### 查询验证业务闭环

无需看源码，通过以下报告判断业务是否闭环：

#### 1. 床位占用报告
GET `/api/v1/reports/bed-occupancy`
```json
{
  "hospital_name": "中心医院",
  "department_name": "心内科",
  "total_beds": 5,
  "available_beds": 2,
  "reserved_beds": 3,
  "occupancy_rate": 60,
  "waiting_count": 1
}
```
验证：可用 + 预留 = 总数，候补队列合理

#### 2. 候补队列报告
GET `/api/v1/reports/waiting-queue`
```json
{
  "queue_position": 1,
  "patient_name": "王五",
  "severity_level": "critical",
  "priority_score": 100
}
```
验证：重症患者排在普通患者前面

#### 3. 异常报告
GET `/api/v1/exceptions?resolved=false`
```json
{
  "exception_type": "confirm_timeout",
  "message": "超过30分钟未确认",
  "resolved_at": null
}
```
验证：失败场景有对应异常记录

#### 4. 状态历史
GET `/api/v1/history`
```json
{
  "old_status": "scheduled",
  "new_status": "confirmed",
  "changed_by": "doctor-001",
  "reason": "确认预约"
}
```
验证：每一步状态变更都有记录，人工操作有差异

#### 5. 申请详情
GET `/api/v1/requests/:id`
返回包含：
- `current_status` - 当前状态
- `history[]` - 完整流转历史
- `appointments[]` - 预约记录
- `exceptions[]` - 异常记录

## 配置说明

文件: `src/config/config.js`
```javascript
{
  port: 3000,
  database: { file: './data/hospital.db' },
  business: {
    confirmTimeoutMinutes: 30,  // 确认超时时间
    cancelAdvanceMinutes: 60     // 取消提前时间
  }
}
```

## 常用 curl 命令

```bash
# 健康检查
curl http://localhost:3000/health

# 仪表板
curl http://localhost:3000/api/v1/reports/dashboard

# 床位状态
curl http://localhost:3000/api/v1/beds/status

# 创建转诊申请（普通）
curl -X POST http://localhost:3000/api/v1/requests \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: req-001" \
  -H "x-operator: doctor-001" \
  -d '{
    "patientId": "pat-001",
    "toHospitalId": "hosp-001",
    "toDepartmentId": "dept-cardio",
    "severityLevel": "normal",
    "diagnosis": "胸痛待查"
  }'

# 查看未解决异常
curl "http://localhost:3000/api/v1/exceptions?resolved=false"

# 完整报告
curl http://localhost:3000/api/v1/reports/full
```

## 验证业务闭环

运行演示后，检查以下指标验证闭环：

✅ **数据一致性**
- 申请数量 = 已完成 + 进行中 + 已取消
- 床位总数 = 可用 + 已用
- 候补队列 = 申请数 - 已预约

✅ **优先级正确**
- 重症患者在队列最前面
- 分数高的先被递补

✅ **失败有痕**
- 每次失败都有 exception 记录
- 异常可查询、可标记解决

✅ **流转可追溯**
- 每个申请有完整 history
- 人工操作有 diff 和操作者

✅ **幂等性有效**
- 相同幂等键重复调用返回同一记录
- 不会重复创建申请

## 项目结构

```
.
├── src/
│   ├── index.js              # 入口文件
│   ├── config/
│   │   └── config.js         # 配置
│   ├── database/
│   │   └── db.js             # 数据库连接和初始化
│   ├── services/
│   │   ├── transferService.js # 核心业务逻辑
│   │   ├── patientService.js  # 患者服务
│   │   ├── bedService.js      # 床位服务
│   │   ├── reportService.js   # 报告导出
│   │   ├── historyService.js  # 历史记录
│   │   └── exceptionService.js # 异常管理
│   ├── routes/
│   │   └── transferRoutes.js  # API 路由
│   ├── utils/
│   │   └── constants.js       # 常量定义
│   └── scripts/
│       ├── seed.js           # 造数脚本
│       ├── demo.js           # 成功路径演示
│       └── demo-fail.js      # 失败路径演示
├── data/
│   └── hospital.db           # SQLite 数据库（自动创建）
├── package.json
└── README.md
```
