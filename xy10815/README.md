# 异步任务状态中枢

一个偏技术方向的全栈 Web/API 应用，用于统一管理导出、转码、推送等异步任务的状态。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Vite + Ant Design

## 功能特性

### 页面功能
- 任务列表筛选（按任务类型、状态、业务单号）
- 任务详情时间线（状态变更历史）
- 批量导入任务（CSV格式）
- 导出任务报告（CSV格式）

### 核心规则（后端控制）
- 统一状态机：PENDING → RUNNING → [PAUSED/COMPLETED/FAILED] → 终态
- 事件追加：每次状态变更记录事件日志
- 进度聚合：记录每次进度快照并自动聚合
- 失败重试：失败任务支持重试，记录重试次数
- 进度接口：支持增量更新进度数据

### API 接口
- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 查询任务列表
- `GET /api/tasks/:id` - 查询任务详情
- `PUT /api/tasks/:id/status` - 更新任务状态
- `POST /api/tasks/:id/progress` - 更新任务进度
- `POST /api/tasks/:id/failure` - 记录失败
- `POST /api/tasks/:id/retry` - 重试任务
- `GET /api/tasks/export/csv` - 导出CSV
- `POST /api/tasks/bulk/import` - 批量导入

## 数据模型

### tasks（任务表）
- id: 主键
- task_type: 任务类型（EXPORT/TRANSCODE/PUSH）
- business_no: 业务单号
- current_status: 当前状态
- progress: 进度百分比
- total_count: 总数
- success_count: 成功数
- fail_count: 失败数
- created_at: 创建时间
- updated_at: 更新时间

### status_events（状态事件表）
- id: 主键
- task_id: 任务ID
- status: 状态
- message: 消息
- created_at: 创建时间

### progress_snapshots（进度快照表）
- id: 主键
- task_id: 任务ID
- progress: 进度
- success_count: 成功数
- fail_count: 失败数
- details: 详情
- created_at: 创建时间

### failure_records（失败记录表）
- id: 主键
- task_id: 任务ID
- error_code: 错误码
- error_message: 错误信息
- stack_trace: 堆栈信息
- retry_count: 重试次数
- resolved: 是否已解决
- created_at: 创建时间

## 快速开始

### 方式一：分别启动后端和前端

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 启动后端服务（端口3001）
npm start

# 3. 新开终端，安装前端依赖
cd frontend
npm install

# 4. 启动前端服务（端口3000）
npm run dev
```

### 方式二：使用 concurrently 同时启动（如果已安装）

```bash
# 在项目根目录
npm install -g concurrently
concurrently "cd backend && npm start" "cd frontend && npm run dev"
```

## 访问地址

- 前端页面: http://localhost:3000
- 后端API: http://localhost:3001

## 测试流程

### 页面测试
1. 新建任务（选择类型、输入业务单号）
2. 查看任务列表
3. 进入任务详情
4. 开始执行 → 更新进度 → 记录失败 → 重试 → 完成
5. 导出CSV报告
6. 批量导入（使用导出的CSV作为模板）

### API 测试示例

```bash
# 创建任务
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"task_type":"EXPORT","business_no":"TEST001","total_count":100}'

# 查询任务列表
curl http://localhost:3001/api/tasks

# 更新状态
curl -X PUT http://localhost:3001/api/tasks/1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"RUNNING","message":"开始执行"}'

# 更新进度
curl -X POST http://localhost:3001/api/tasks/1/progress \
  -H "Content-Type: application/json" \
  -d '{"progress":50,"success_count":45,"fail_count":5}'

# 记录失败
curl -X POST http://localhost:3001/api/tasks/1/failure \
  -H "Content-Type: application/json" \
  -d '{"error_code":"E001","error_message":"网络超时","stack_trace":"..."}'

# 重试
curl -X POST http://localhost:3001/api/tasks/1/retry
```

## 验收要点

1. **重复操作稳定性**: 重复创建相同任务（task_type + business_no唯一）、重复更新状态
2. **失败历史追踪**: 查看失败记录、重试次数统计、失败堆栈信息
3. **状态机验证**: 非法状态转换被后端拒绝（如从COMPLETED转回RUNNING）
4. **进度聚合**: 多次更新进度后，总数聚合正确
5. **数据一致性**: 前端显示与后端数据一致
