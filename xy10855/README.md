# 报表生成任务 API (Report Generator Task API)

> 解决复杂报表同步生成超时问题的异步任务处理系统

## 技术架构

- **后端**: Node.js + Express + SQLite
- **前端**: React 18 + Axios
- **核心特性**: 异步队列、状态机、进度追踪、失败重试、授权下载

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 初始化数据库

```bash
npm run init:db
```

### 3. 启动服务

```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：单独启动后端
npm run dev:backend

# 方式三：单独启动前端
cd frontend && npm start
```

- 后端服务: http://localhost:3001
- 前端服务: http://localhost:3000

## 核心数据模型

### 1. report_templates (报表模板)
- 存储预定义的报表配置
- 包含模板参数、输出格式等配置

### 2. report_tasks (生成任务)
- 任务唯一标识、关联模板
- **参数快照** (parameters_snapshot): 创建时的参数快照，防止后续模板变更影响
- 状态流转: `pending` → `running` → `completed` / `failed`
- 进度追踪 (0-100%)
- 重试计数 (max_retries 默认 3 次)

### 3. progress_events (进度事件)
- 任务执行的完整时间线记录
- 事件类型: created, start, progress, completed, failed, retry, timeout
- 支持审计和问题溯源

### 4. failure_reasons (失败原因)
- 记录每次失败的详细信息
- 包含错误消息、堆栈、错误码
- 用于重试策略和问题分析

### 5. download_authorizations (下载授权)
- JWT Token 授权机制
- 有效期控制 (默认 24 小时)
- 下载次数限制 (默认 5 次)
- 防止未授权访问报告文件

## 核心规则实现

### ✅ 1. 参数快照 (Parameter Snapshot)

**位置**: `backend/services/TaskService.js:5-15`

**规则**:
- 任务创建时立即对参数进行 JSON 序列化存储
- 即使后续模板配置变更，已创建任务不受影响
- 保证报告生成的可重现性

**验证方式**:
1. 创建任务 A，使用参数 X
2. 修改模板配置
3. 查看任务详情，parameters_snapshot 仍为原始参数

---

### ✅ 2. 异步生成 (Async Generation)

**位置**: `backend/services/TaskQueue.js`

**规则**:
- 任务提交后立即返回，不阻塞请求
- 任务进入队列等待执行
- 并发控制: 最大同时执行 2 个任务
- 状态自动更新

**解决问题**: 避免复杂报表 HTTP 请求超时

---

### ✅ 3. 进度轮询 (Progress Polling)

**位置**: 
- 后端: `backend/routes/tasks.js:47-69` (列表) + `97-120` (详情)
- 前端: 列表每 3 秒自动刷新，详情每 2 秒刷新

**规则**:
- 前端定时轮询任务状态
- 每个进度变更都记录事件日志
- 支持实时百分比展示

---

### ✅ 4. 失败重跑 (Failure Retry)

**位置**: `backend/services/TaskService.js:169-215`

**规则**:
- 只有 `failed` 状态的任务可以重试
- 重试次数受 `max_retries` 限制 (默认 3 次)
- 重试后状态重置为 `pending`，重新进入队列
- 每次重试记录独立的失败日志

**API**: `POST /api/tasks/:taskId/retry`

---

### ✅ 5. 授权下载 (Authorized Download)

**位置**: `backend/services/AuthService.js` + `backend/routes/download.js`

**规则**:
- 只有 `completed` 状态的任务可以生成下载链接
- 使用 JWT Token 进行授权验证
- Token 包含: taskId, authId, 时间戳
- 双重校验: Token 有效性 + 数据库授权记录
- 可配置过期时间和下载次数限制

**安全保障**:
- Token 过期自动失效
- 超过下载次数限制后无法继续下载
- 可手动撤销授权

---

## 防重复与脏数据处理

### 🔒 1. 防重复请求 (Anti-duplicate)

**位置**: `backend/services/TaskService.js:10-28`

**检测逻辑**:
```sql
SELECT id FROM report_tasks 
WHERE template_id = ? 
  AND parameters_snapshot = ? 
  AND status IN ('pending', 'running')
LIMIT 1
```

**规则**:
- 相同模板 + 相同参数 + 未完成状态 = 判定为重复任务
- 重复任务返回已有任务 ID，不创建新任务
- 前端提示"检测到相同参数的任务正在执行，已复用现有任务"

**测试路径**:
1. 点击"新建任务"，使用默认参数创建任务 A
2. 立即再次点击"新建任务"，使用**完全相同**的参数创建任务 B
3. 观察提示: 显示复用消息，列表中只增加 1 个任务

---

### 🔒 2. 脏数据处理 (Dirty Data Handling)

#### 2.1 状态机保护

**位置**: 所有状态变更操作

**状态流转规则**:
```
pending → running → completed
            ↓
          failed → pending (重试)
```

**非法操作拦截**:
- 不能重试 `pending/running/completed` 状态的任务
- 不能启动已完成的任务
- 不能重复完成已完成任务

#### 2.2 超时任务自动清理

**位置**: `backend/services/TaskService.js:333-356`

**规则**:
- 每分钟自动检测超时任务
- 超时条件: `status = 'running'` 且 5 分钟未更新
- 超时任务自动标记为 `failed`
- 记录 timeout 事件和失败原因

**手动触发清理 API**:
```bash
curl -X POST http://localhost:3001/api/cleanup-stuck
```

---

### 🔒 3. 补偿动作 (Compensation Actions)

#### 3.1 任务重试补偿

- 失败任务支持手动重试
- 重试次数计数，超过限制禁止重试
- 每次重试从头开始执行，不从中断点恢复

#### 3.2 数据一致性保证

- 使用数据库事务保证关键操作原子性
- 进度事件和任务状态更新同步
- 失败时自动回滚状态变更

---

## API 接口文档

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks/create` | 创建新任务 |
| GET | `/api/tasks/list` | 获取任务列表（支持筛选） |
| GET | `/api/tasks/:taskId` | 获取任务详情（含时间线） |
| GET | `/api/tasks/:taskId/progress` | 获取任务进度 |
| POST | `/api/tasks/:taskId/retry` | 重试失败任务 |
| POST | `/api/tasks/batch/import` | 批量导入任务 |
| GET | `/api/tasks/templates/list` | 获取模板列表 |
| GET | `/api/tasks/queue/status` | 获取队列状态 |

### 下载授权

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks/:taskId/authorize-download` | 生成下载授权 Token |
| GET | `/api/download/:token` | 使用 Token 下载文件 |

### 系统管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/cleanup-stuck` | 手动清理卡住任务 |

---

## 前端功能说明

### 📋 任务列表页
- 状态筛选: 全部/等待中/运行中/已完成/失败
- 模板筛选: 按模板类型过滤
- 关键词搜索: 任务名称/ID 模糊搜索
- 实时进度条展示
- 操作按钮: 详情/重试/下载

### 📊 任务详情页
- 基本信息展示
- 参数快照预览 (格式化 JSON)
- 事件时间线 (带图标和颜色)
- 失败原因详情 (含错误堆栈)
- 操作区: 重试/下载

### ➕ 创建任务弹窗
- 模板下拉选择
- 任务名称输入
- JSON 参数编辑器（带默认值）

### 📥 批量导入弹窗
- JSON 数组批量输入
- 导入结果实时展示
- 成功/失败分项统计

---

## 测试场景指南

### 场景一: 防重复请求测试

**操作步骤**:
1. 打开首页，点击"新建任务"
2. 保持默认参数，点击"创建任务" → 成功提示
3. **立即再次**点击"新建任务"，保持**完全相同**参数
4. 点击"创建任务" → 提示"检测到相同参数的任务正在执行，已复用现有任务"
5. 查看任务列表 → 只有 1 条新任务记录

---

### 场景二: 异步生成 + 进度轮询测试

**操作步骤**:
1. 创建一个新任务
2. 观察任务列表: 状态从"等待中"→"运行中"→"已完成"
3. 点击"详情"查看时间线: 能看到完整的进度事件序列
4. 进度条从 0% → 20% → 40% → 60% → 80% → 95% → 100%

**预期**: 整个过程约 5-6 秒，每个阶段都有明确的状态更新

---

### 场景三: 失败重试机制测试

**操作步骤**:
1. 找到一个失败状态的任务（可通过修改代码强制失败）
2. 点击"重试"按钮
3. 观察: 任务状态从"失败"→"等待中"→"运行中"
4. 查看详情的时间线: 新增 retry 事件记录
5. 重试 3 次后: 重试按钮变为禁用或提示已达上限

---

### 场景四: 脏数据 - 超时任务清理测试

**操作步骤**:
1. 创建一个任务并让它运行
2. 停止后端服务（模拟进程崩溃）
3. 5 分钟后重启服务
4. 调用清理 API: `curl -X POST http://localhost:3001/api/cleanup-stuck`
5. 查看任务状态: 已自动标记为失败
6. 查看失败原因: 包含"任务执行超时"字样

---

### 场景五: 授权下载测试

**操作步骤**:
1. 找到一个已完成的任务
2. 点击"下载"按钮 → 触发授权
3. 观察网络请求: 先调用 authorize-download 接口获取 token
4. 然后使用 token 调用 download 接口
5. 文件下载成功
6. **验证安全**: 直接访问 `/api/download/fake-token` → 返回 400 错误

---

## 项目结构

```
report-generator-api/
├── backend/
│   ├── server.js              # 服务入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── services/
│   │   ├── TaskService.js     # 任务核心逻辑
│   │   ├── TaskQueue.js       # 异步队列管理
│   │   └── AuthService.js     # 下载授权服务
│   ├── routes/
│   │   ├── tasks.js           # 任务管理路由
│   │   └── download.js        # 下载路由
│   └── scripts/
│       └── init-db.js         # 数据库初始化脚本
├── frontend/
│   ├── src/
│   │   ├── App.js             # 主应用组件
│   │   ├── api/
│   │   │   └── index.js       # API 封装
│   │   └── components/
│   │       ├── TaskList.js    # 任务列表
│   │       ├── TaskDetail.js  # 任务详情
│   │       ├── CreateTask.js  # 创建任务
│   │       └── BatchImport.js # 批量导入
│   └── public/
│       └── index.html         # HTML 入口
├── data/                       # SQLite 数据库文件
└── package.json                # 项目配置
```

---

## 常见问题

### Q: 任务一直卡在"运行中"怎么办？
A: 系统会自动检测 5 分钟未更新的任务并标记为失败。也可手动调用 `/api/cleanup-stuck` 接口触发清理。

### Q: 相同参数的任务会重复创建吗？
A: 不会。系统在创建前会检测是否有相同参数的 pending/running 状态任务，如果有则直接复用。

### Q: 下载链接有效期是多久？
A: 默认 24 小时，可在 AuthService.js 中修改。

### Q: 最多可以重试几次？
A: 默认 3 次，可在创建任务时通过 max_retries 参数自定义。

---

## 技术亮点总结

✅ **参数快照** - 保证任务执行可重现  
✅ **异步队列** - 解决超时问题，支持并发控制  
✅ **进度轮询** - 实时反馈，提升用户体验  
✅ **失败重试** - 内置补偿机制  
✅ **授权下载** - JWT + 数据库双重安全校验  
✅ **防重复** - 相同参数自动任务复用  
✅ **脏数据处理** - 状态机保护 + 超时自动清理  
✅ **完整审计** - 所有操作都有事件日志记录
