# 试用期转正管理 API 系统

一个完整的试用期转正后端闭环系统，基于 Node.js + Express + PostgreSQL + BullMQ 构建。

## 功能特性

### 核心业务流程
- **试用期计划管理**: 创建、启动、查询试用期计划
- **绩效评价收集**: 提交、审批绩效评价
- **导师意见收集**: 导师提交评价和建议
- **转正审批流程**: 规则检查、审批通过/拒绝
- **延期审批流程**: 申请、批准/拒绝延期
- **薪资调整生效**: 审批通过后自动调度薪资生效任务
- **完整审计追踪**: 所有关键操作都有历史记录

### 业务规则（可复查）
所有规则定义在 `src/constants/index.js` 中，不隐藏在临时变量中：

| 规则名称 | 值 | 说明 |
|---------|-----|------|
| MIN_PERFORMANCE_SCORE | 3.0 | 绩效评价最低分数要求 |
| MIN_MENTOR_FEEDBACK_SCORE | 3.0 | 导师意见最低分数要求 |
| MAX_EXTENSION_COUNT | 1 | 最大延期次数 |
| MAX_EXTENSION_MONTHS | 3 | 最大延期月数 |

### 状态流转（可复查）
```
pending → in_progress → awaiting_evaluation → evaluation_completed 
        → awaiting_approval → approved → confirmed
              ↓
        extension_requested → extension_approved → in_progress
              ↓
        extension_rejected → awaiting_approval
              ↓
        rejected → terminated
```

终态: `confirmed`, `terminated`（无法再变更状态）

## 技术栈

- **运行时**: Node.js
- **Web 框架**: Express.js
- **ORM**: Sequelize
- **数据库**: PostgreSQL
- **任务队列**: BullMQ (基于 Redis)
- **日期处理**: dayjs
- **数据验证**: zod
- **唯一ID**: uuid

## 快速开始

### 环境要求

- Node.js >= 16
- PostgreSQL >= 12
- Redis >= 6

### 安装步骤

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库和 Redis 连接：
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=probation_db
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. **创建数据库**
```sql
CREATE DATABASE probation_db;
```

4. **启动服务器**
```bash
npm run dev
```

服务器启动后：
- 健康检查: http://localhost:3000/health
- API 文档: http://localhost:3000/api-docs

### 运行测试

```bash
npm test
```

测试脚本会自动创建测试数据，验证核心流程：
- 正常转正流程（绩效和导师评分达标）
- 人工复核场景（绩效不达标）
- 延期申请和审批流程
- 延期次数限制
- HR 报表输出
- 审计追踪

## API 端点

### 员工管理
```
POST /api/employees          - 创建员工
GET  /api/employees          - 获取员工列表
GET  /api/employees/:id      - 获取员工详情
```

### 试用期管理
```
POST /api/probation                      - 创建试用期计划
POST /api/probation/:id/start            - 启动试用期
GET  /api/probation                      - 获取试用期列表
GET  /api/probation/:id                  - 获取试用期详情
POST /api/probation/evaluations          - 提交绩效评价
POST /api/probation/evaluations/:id/approve  - 批准绩效评价
POST /api/probation/mentor-feedbacks     - 提交导师意见
POST /api/probation/:id/submit-approval  - 提交转正审批（触发规则检查）
POST /api/probation/:id/approve          - 批准转正（可选薪资调整）
POST /api/probation/:id/reject           - 拒绝转正
POST /api/probation/extensions           - 申请延期
POST /api/probation/extensions/:id/approve   - 批准延期
POST /api/probation/extensions/:id/reject    - 拒绝延期
POST /api/probation/:id/terminate        - 终止试用期
GET  /api/probation/:id/history          - 获取试用期历史
GET  /api/probation/employee/:id/history - 获取员工试用期历史
```

### HR 报表
```
GET /api/reports/dashboard                    - 仪表盘概览
GET /api/reports/pending-reviews              - 待处理评审（含需要人工复核的）
GET /api/reports/salary-adjustments           - 薪资调整报告
GET /api/reports/confirmation-history         - 转正历史报告
GET /api/reports/audit/employee/:id           - 员工审计追踪
GET /api/reports/audit/probation/:id          - 试用期审计追踪
GET /api/reports/rules                        - 查看系统业务规则
```

## 成功场景 vs 人工复核场景

### 处理成功的情况

**1. 正常转正**
- 绩效评价已批准且分数 >= 3.0
- 导师意见已提交且分数 >= 3.0
- 导师建议为 'confirm'
- 没有超过延期次数限制

**系统行为**:
- 状态自动流转: `evaluation_completed` → `awaiting_approval` → `approved` → `confirmed`
- 薪资调整（如有）自动调度到生效日期执行
- 所有操作记录到转正历史

**输出**:
- 试用期状态变为 `confirmed`
- 员工薪资更新
- HR 报表显示转正成功

**2. 延期审批通过**
- 延期次数 < 1
- 延期月数 <= 3
- 有明确的延期原因和改进计划

**系统行为**:
- 状态流转: `in_progress` → `extension_requested` → `extension_approved` → `in_progress`
- `currentEndDate` 自动延长
- `extensionCount` 自动加 1

**3. 薪资调整生效**
- 薪资调整状态为 `approved`
- 生效日期已到达
- 员工状态为 active
- 后台任务执行成功

### 需要人工复核的情况

| 场景 | 触发条件 | 推荐操作 |
|------|---------|---------|
| 绩效不达标 | 绩效分数 < 3.0 | 根据导师建议：延期或终止 |
| 导师评分低 | 导师分数 < 3.0 | 参考导师建议决定 |
| 导师建议延期 | recommendation = 'extend' | 考虑延期申请 |
| 导师建议终止 | recommendation = 'terminate' | 考虑终止试用期 |
| 缺少评价 | 缺少绩效或导师评价 | 催促相关人员提交 |
| 延期超限制 | 次数>=1 或 月数>3 | 特殊审批或终止 |

**如何检测**:
- `GET /api/reports/pending-reviews` - `needsManualReview` 列表
- `POST /api/probation/:id/submit-approval` - 返回 `shouldReview=true`
- 规则检查结果会记录到 `probation_histories` 表

## 后台任务处理

### 薪资生效任务 (salary-effect)

**触发时机**: 薪资调整审批通过后自动调度

**重试策略**:
- 最大尝试: 5 次
- 退避策略: 指数退避 (60s, 120s, 240s, 480s, 960s)
- 幂等性: 已生效的薪资调整会被跳过

**任务失败表现**:
- 任务保留在队列中（不会自动删除）
- 错误信息记录到 `probation_histories` 表
- action = `SALARY_EFFECT_FAILED`
- metadata 包含 jobId、错误信息、尝试次数、失败时间

**如何检测失败**:
- `GET /api/reports/salary-adjustments` - 状态为 `approved` 但 `effectiveAt` 为 null
- `GET /api/reports/audit/probation/:id` - 查找 `SALARY_EFFECT_FAILED` 记录

**再次执行**:
- BullMQ 自动重试最多 5 次
- 5 次失败后需要人工介入
- 可通过 BullMQ Dashboard 或 API 重新入队

## 项目结构

```
src/
├── config/
│   ├── database.js      # 数据库配置
│   └── queue.js         # BullMQ 队列配置
├── constants/
│   └── index.js         # 业务规则和状态常量（可复查）
├── models/
│   ├── index.js         # 模型关系定义
│   ├── employee.js
│   ├── probationPlan.js
│   ├── performanceEvaluation.js
│   ├── mentorFeedback.js
│   ├── salaryAdjustment.js
│   ├── probationHistory.js
│   └── extensionRequest.js
├── services/
│   ├── probationRuleEngine.js   # 核心规则引擎
│   ├── probationService.js      # 业务逻辑
│   ├── probationHistoryService.js # 历史记录服务
│   └── reportService.js         # HR 报表服务
├── workers/
│   └── salaryEffectWorker.js    # 薪资生效后台任务
├── routes/
│   ├── employees.js
│   ├── probation.js
│   └── reports.js
├── api-docs.json        # API 文档（JSON格式）
└── app.js               # 应用入口

tests/
└── test-all.js          # 综合测试脚本
```

## 核心设计原则

1. **规则可复查**: 所有业务规则明确定义在 `constants/index.js`，可通过 `GET /api/reports/rules` 查看

2. **状态不隐藏**: 状态转换严格遵循状态机，定义在规则引擎中，不依赖临时变量

3. **完整审计**: 所有关键操作都记录到 `probation_histories` 表，包含操作人、时间、前后状态、详细元数据

4. **任务可追踪**: 后台任务有完整的进度、失败、重试记录，可通过报表和审计追踪查看

5. **幂等性**: 薪资生效任务具有幂等性，重复执行不会产生副作用

## 认证说明

当前版本简化了认证，操作人信息通过请求头传递：
- `createdBy`, `startedBy`, `submittedBy`, `approvedBy`, `rejectedBy`, `terminatedBy`, `mentorId`

生产环境建议替换为 JWT 或 Session 认证。

## License

MIT
