# 后台任务处理策略

## 概述

本服务的核心流程（接种记录、补录审核、报表生成）都是同步操作，不依赖后台任务。但在以下场景可以考虑引入后台任务：

1. **批量接种通知**：定时检查即将到期的接种计划并发送通知
2. **过期批次清理**：自动标记和清理已过期的疫苗批次
3. **报表定期生成**：定期自动生成检疫报表
4. **数据同步**：与外部系统（如检疫部门）的数据同步

## 后台任务失败处理机制

### 1. 任务状态管理

每个后台任务应维护以下状态：
- `pending`：待执行
- `running`：执行中
- `completed`：已完成
- `failed`：失败
- `retrying`：重试中

### 2. 重试机制

```typescript
interface BackgroundTask {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "retrying";
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
}
```

#### 重试策略：
- **指数退避**：失败后等待时间逐渐增加（1min → 5min → 15min → 30min → 1hr）
- **最大重试次数**：默认 5 次
- **手动触发**：超过最大重试次数后，任务标记为失败，需要管理员手动触发

### 3. 失败后的状态表现

#### 3.1 批量通知任务失败
- **任务状态**：`failed`
- **用户可见**：通知列表显示"发送失败"状态
- **重试效果**：再次执行时，只发送给未成功通知的收件人
- **数据一致性**：不影响核心数据，通知记录不会重复创建

#### 3.2 过期批次清理任务失败
- **任务状态**：`failed`
- **用户可见**：在"批次管理"页面显示警告提示
- **重试效果**：重新扫描所有过期批次
- **数据一致性**：批次状态仍为有效，人工检查后可手动标记过期

#### 3.3 定期报表生成任务失败
- **任务状态**：`failed`
- **用户可见**：报表列表显示"生成失败"
- **重试效果**：重新生成整个报表
- **数据一致性**：不会产生不完整的报表记录（使用事务）

#### 3.4 数据同步任务失败
- **任务状态**：`failed`
- **用户可见**：同步状态显示"同步失败"
- **重试效果**：从上次成功的位置继续同步（断点续传）
- **数据一致性**：使用幂等操作，重复同步不会产生重复数据

### 4. 失败查询和恢复

#### 4.1 查看当前卡点
```typescript
// 查询所有失败的任务
const failedTasks = await taskRepository.find({
  where: { status: "failed" },
  order: { lastRunAt: "DESC" },
});

// 查看任务执行历史
const taskHistory = await taskLogRepository.find({
  where: { taskId: task.id },
  order: { createdAt: "DESC" },
});
```

#### 4.2 恢复失败任务
```typescript
async function retryTask(taskId: string): Promise<void> {
  const task = await taskRepository.findOne({ where: { id: taskId } });
  if (!task) throw new Error("任务不存在");
  if (task.retryCount >= task.maxRetries) {
    // 需要手动重置重试次数
    task.retryCount = 0;
    task.status = "pending";
  } else {
    task.status = "retrying";
  }
  await taskRepository.save(task);
  // 触发任务执行
  await executeTask(task);
}
```

### 5. 建议实现方案

如果需要实现后台任务，推荐使用：

- **Bull**（Redis 队列）：适合分布式部署
- **node-schedule**：适合简单的定时任务
- **agenda**：MongoDB 支持的任务调度

#### 关键设计原则：
1. **幂等性**：所有任务操作必须是幂等的
2. **事务性**：涉及数据变更的操作使用事务
3. **可追踪**：完整记录任务执行历史和错误信息
4. **可恢复**：提供手动恢复和重试机制
5. **告警**：任务失败时发送告警通知

## 当前实现状态

本服务的核心业务逻辑（接种流程、审核、追溯、报表）都是同步执行的，不依赖后台任务。所有关键判断都在代码中直接实现，通过测试覆盖。

如需添加后台任务，建议按照上述策略实现，并确保：
- 任务失败不会影响核心数据一致性
- 任务状态和历史记录可查询
- 提供手动恢复机制
