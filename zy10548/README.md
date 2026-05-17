# 数据同步暂停API

当下游系统维护时，需要暂停数据同步，但暂停窗口、积压量、恢复结果没有统一入口。本项目围绕"数据同步暂停API"交付可运行服务、样例和自检。

## 核心功能

- **暂停状态管理**: 支持创建、激活、结束、取消暂停窗口
- **积压数据统计**: 实时统计暂停时、恢复时的积压量
- **恢复操作幂等**: 通过idempotencyKey确保恢复操作不重复执行
- **失败记录留存**: 保存原始输入、处理依据、最终结论，支持人工修正
- **报告生成导出**: 支持JSON和CSV格式导出

## 数据模型

1. **SyncTask (同步任务)**: 同步任务的元数据和状态
2. **PauseWindow (暂停窗口)**: 暂停的时间窗口，记录原因、起止时间、积压量
3. **BacklogStats (积压统计)**: 待处理、处理中、失败的数量统计
4. **RecoveryAction (恢复动作)**: 恢复操作的执行记录
5. **FailureDetail (失败明细)**: 单次失败的完整信息，可追溯
6. **SyncReport (同步报告)**: 暂停-恢复全过程的汇总报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行API服务

```bash
npm run dev
```

服务启动在: http://localhost:3000

### 运行完整示例

```bash
npx ts-node src/example.ts
```

### 运行自检工具

```bash
npm run self-check
```

## API 端点

### 健康检查
```
GET /health
```

### 同步任务
```
POST /api/tasks              - 创建同步任务
GET  /api/tasks              - 查询任务列表
GET  /api/tasks/:id          - 查询单个任务
```

### 暂停窗口
```
POST /api/pause-windows          - 创建暂停窗口
GET  /api/pause-windows/:id      - 查询暂停窗口
POST /api/pause-windows/:id/activate - 激活暂停窗口
POST /api/pause-windows/:id/end  - 结束暂停窗口
POST /api/pause-windows/:id/cancel - 取消暂停窗口
```

### 恢复操作
```
POST /api/recovery               - 启动恢复操作
GET  /api/recovery/:id           - 查询恢复操作
```

### 失败管理
```
POST /api/failures               - 记录失败
GET  /api/failures/:id           - 查询失败明细
POST /api/failures/:id/correct   - 人工修正失败
```

### 积压更新
```
POST /api/tasks/:id/backlog     - 更新积压统计
```

### 报告管理
```
POST /api/reports                 - 生成同步报告
GET  /api/reports/:id             - 查询报告
POST /api/reports/:id/export/json - 导出JSON报告
POST /api/reports/:id/export/csv  - 导出CSV报告
```

## 核心规则实现

### 1. 暂停状态流转
```
ACTIVE → PAUSED (创建暂停窗口)
PAUSED → RESUMING (结束暂停窗口)
RESUMING → ACTIVE (恢复完成且无失败)
```

### 2. 积压统计
- `backlogAtPause`: 创建暂停窗口时的积压量
- `backlogAtResume`: 结束暂停窗口时的积压量
- 恢复期间实时更新待处理、处理中、失败数量

### 3. 恢复幂等性
通过 `idempotencyKey` 保证相同请求只执行一次：
```typescript
const recoveryAction = await syncService.startRecovery({
  syncTaskId: "...",
  pauseWindowId: "...",
  idempotencyKey: "unique_key_here",  // 幂等键
  createdBy: "..."
});
```

### 4. 失败记录留存
每个失败记录包含完整的审计信息：
- `originalInput`: 原始输入数据
- `processingBasis`: 处理依据/上下文
- `finalConclusion`: 最终结论
- `resolved/resolvedBy/resolvedAt`: 解决状态和信息

### 5. 报告导出
支持两种格式：
- JSON: 完整的结构化数据
- CSV: 便于数据分析的表格格式

## 项目结构

```
├── src/
│   ├── models.ts        # 数据模型定义
│   ├── store.ts         # 持久化存储层
│   ├── service.ts       # 业务逻辑层
│   ├── index.ts         # API服务入口
│   ├── example.ts       # 完整使用示例
│   └── self-check.ts    # 自检工具
├── data/                 # 持久化数据存储
├── exports/              # 导出报告
├── package.json
├── tsconfig.json
└── README.md
```

## 数据持久化

所有数据存储在本地JSON文件中：
- `data/syncTasks.json` - 同步任务
- `data/pauseWindows.json` - 暂停窗口
- `data/recoveryActions.json` - 恢复操作
- `data/failureDetails.json` - 失败明细
- `data/syncReports.json` - 同步报告

重启服务后数据不会丢失。

## 使用示例

### 1. 创建任务并暂停

```typescript
import { syncService } from './service';

// 创建任务
const task = await syncService.createSyncTask({
  name: '用户数据同步',
  sourceSystem: 'CRM',
  targetSystem: 'Analytics',
  createdBy: 'admin'
});

// 更新积压
await syncService.updateBacklogStats(task.id, 500, 0, 0);

// 创建暂停窗口
const pauseWindow = await syncService.createPauseWindow({
  syncTaskId: task.id,
  name: '下游系统维护',
  reason: '系统版本升级',
  createdBy: 'operator'
});
```

### 2. 恢复并处理失败

```typescript
// 结束暂停
const { window, task: resumedTask } = 
  await syncService.endPauseWindow(pauseWindow.id);

// 启动恢复
const recovery = await syncService.startRecovery({
  syncTaskId: task.id,
  pauseWindowId: pauseWindow.id,
  idempotencyKey: `recovery_${Date.now()}`,
  createdBy: 'recovery_bot'
});

// 查看失败
const failures = await syncService.listFailureDetails(task.id);

// 人工修正
await syncService.applyManualCorrection({
  failureId: failures[0].id,
  correctedInput: { ... },
  resolutionNote: '数据格式修正',
  correctedBy: 'engineer',
  retry: true
});
```

### 3. 生成报告

```typescript
const report = await syncService.generateReport(
  task.id,
  'FULL_REPORT',
  'report_gen',
  pauseWindow.id
);

// 导出
const jsonPath = await syncService.exportReportToJson(report.id);
const csvPath = await syncService.exportReportToCsv(report.id);
```
