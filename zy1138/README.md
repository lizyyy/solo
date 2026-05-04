# 队列分析工具 (queue-analyzer)

一个用于分析和模拟 worker queue 系统的 Go 工具，帮助你复盘队列问题、分析性能瓶颈、模拟调参方案。

## 功能特性

- **数据导入**: 支持导入 jobs.jsonl、workers.csv、queue-events.jsonl、config.yaml
- **深度分析**: 分析等待时间、吞吐率、p95/p99、积压峰值、worker 空转率、重试风暴、优先级反转、死信风险
- **模拟调参**: 模拟不同配置（worker 数、batch size、poll interval、retry backoff、超时时间、优先级配额）
- **对比分析**: 比较多个模拟方案的性能，找出最优配置
- **报告输出**: 支持 Markdown、JSON、CSV 格式的报告输出

## 安装

```bash
go build -o queue-analyzer .
```

## 数据格式

### jobs.jsonl (任务数据)

每行一个 JSON 对象，包含任务信息：

```json
{"id": "job-001", "type": "email_send", "priority": 2, "status": "completed", "enqueue_time": "2025-06-01T10:00:00Z", "start_time": "2025-06-01T10:00:02Z", "end_time": "2025-06-01T10:00:05Z", "execution_time_ms": 3000, "wait_time_ms": 2000, "retry_count": 0, "max_retries": 3, "timeout_ms": 30000, "queue_name": "default"}
```

字段说明：
- `id`: 任务唯一标识
- `type`: 任务类型
- `priority`: 优先级（数字越大优先级越高）
- `status`: 状态 (pending/running/succeeded/completed/failed/retrying/dead_letter)
- `enqueue_time`: 入队时间 (RFC3339)
- `start_time`: 开始执行时间
- `end_time`: 结束时间
- `execution_time_ms`: 执行耗时 (毫秒)
- `wait_time_ms`: 等待耗时 (毫秒)
- `retry_count`: 已重试次数
- `max_retries`: 最大重试次数
- `timeout_ms`: 超时时间 (毫秒)
- `fail_reason`: 失败原因 (失败时)
- `queue_name`: 队列名称

### queue-events.jsonl (队列事件)

用于更细粒度的事件分析：

```json
{"id": "evt-001", "job_id": "job-001", "event_type": "enqueue", "timestamp": "2025-06-01T10:00:00Z", "job_type": "email_send", "priority": 2}
```

事件类型：
- `enqueue`: 入队
- `start`: 开始执行
- `complete`: 完成
- `fail`: 失败
- `retry`: 重试
- `timeout`: 超时
- `dead_letter`: 进入死信队列

### workers.csv (Worker 配置)

```csv
worker_id,queue_name,concurrency,batch_size,poll_interval_ms
worker-001,default,1,1,1000
worker-002,default,1,1,1000
worker-003,priority,1,1,500
```

### config.yaml (队列配置)

```yaml
queues:
  - name: "default"
    worker_concurrency: 10
    batch_size: 1
    poll_interval: "1s"
    default_timeout: "30s"
    max_retries: 3

worker_pools:
  - name: "default-pool"
    worker_count: 10
    queue_names: ["default"]
    concurrency_per_worker: 1

retry_policy:
  strategy: "exponential"
  initial_delay: "1s"
  max_delay: "5m"
  multiplier: 2.0
  jitter: 0.1
```

重试策略：
- `fixed`: 固定间隔
- `exponential`: 指数退避
- `linear`: 线性增长

## 使用方式

### 1. 分析历史数据

```bash
# 基本分析
./queue-analyzer analyze --jobs examples/jobs.jsonl

# 完整分析（包含所有数据文件）
./queue-analyzer analyze \
  --jobs examples/jobs.jsonl \
  --workers examples/workers.csv \
  --events examples/queue-events.jsonl \
  --config examples/config.yaml

# 导出 JSON 格式报告
./queue-analyzer analyze \
  --jobs examples/jobs.jsonl \
  --format json \
  --output report.json

# 导出 CSV 格式报告
./queue-analyzer analyze \
  --jobs examples/jobs.jsonl \
  --format csv \
  --output report.csv
```

### 2. 模拟队列运行

```bash
# 使用默认配置模拟
./queue-analyzer simulate --jobs examples/jobs.jsonl

# 自定义配置模拟
./queue-analyzer simulate \
  --jobs examples/jobs.jsonl \
  --workers 20 \
  --concurrency 2 \
  --batch-size 5 \
  --poll-interval 500ms \
  --retry-strategy exponential \
  --retry-initial 2s \
  --retry-max 10m \
  --timeout 60s

# 使用配置文件模拟
./queue-analyzer simulate \
  --jobs examples/jobs.jsonl \
  --config examples/simulations.yaml
```

### 3. 对比多个模拟配置

```bash
# 对比多个配置方案
./queue-analyzer compare \
  --jobs examples/jobs.jsonl \
  --config examples/simulations.yaml \
  --format markdown \
  --output comparison.md

# 使用保存的结果文件对比
./queue-analyzer compare \
  --results result1.json,result2.json,result3.json \
  --base current-config
```

## 示例数据说明

examples/ 目录包含多组示例数据：

### 正常场景 (jobs.jsonl)
- 20 个任务
- 包含 email_send、image_process、notification_push、payment_process 等多种类型
- 部分任务失败（SMTP server connection refused）
- 部分任务 pending（模拟积压）

### 异常场景示例

**重试风暴场景**:
- 多个任务短时间内同时失败
- 重试间隔过短
- 导致大量重试事件抢占 worker

**优先级反转场景**:
- 高优先级任务等待低优先级长时间任务完成
- 低优先级任务执行时间过长

**死信队列场景**:
- 任务经过多次重试后仍然失败
- 进入死信队列

## 分析指标说明

### 任务统计
- **成功率**: 成功完成的任务比例
- **执行时间分布**: P50/P95/P99 执行时间
- **等待时间分布**: P50/P95/P99 等待时间
- **重试统计**: 平均重试次数、重试率

### 积压分析
- **峰值积压**: 队列最大深度
- **平均积压**: 平均队列深度
- **积压增长率**: 积压增长速度

### 重试分析
- **重试风暴检测**: 短时间内大量重试事件
- **重试间隔**: 平均重试间隔
- **重试风暴风险**: 是否存在重试风暴

### 优先级分析
- **优先级反转检测**: 高优先级任务被低优先级任务阻塞
- **任务饥饿检测**: 低优先级任务长时间等待
- **优先级分布**: 各优先级任务处理情况

### 死信分析
- **死信率**: 进入死信队列的任务比例
- **失败原因分布**: 主要失败原因
- **重试次数统计**: 死信前的平均重试次数

## 优化建议

工具会根据分析结果自动生成优化建议，例如：

1. **并发优化**: 当峰值积压过高时，建议增加 worker 数量
2. **重试策略优化**: 检测到重试风暴时，建议使用指数退避 + 抖动
3. **优先级优化**: 检测到优先级反转时，建议拆分长时间任务或设置高优先级 worker 池
4. **批处理优化**: 当 worker 利用率不均时，建议调整 batch size 和 poll interval

## 测试

```bash
# 运行所有测试
go test -v ./pkg/...

# 运行特定包测试
go test -v ./pkg/analyzer/...
go test -v ./pkg/simulator/...
go test -v ./pkg/importer/...
```

## 项目结构

```
queue-analyzer/
├── main.go              # 入口文件
├── cmd/                 # CLI 命令
│   ├── root.go          # 根命令
│   ├── analyze.go       # analyze 命令
│   ├── simulate.go      # simulate 命令
│   └── compare.go       # compare 命令
├── pkg/
│   ├── models/          # 数据模型
│   ├── importer/        # 数据导入
│   ├── analyzer/        # 分析引擎
│   ├── simulator/       # 队列模拟器
│   └── reporter/        # 报告生成
├── examples/            # 示例数据
│   ├── jobs.jsonl
│   ├── workers.csv
│   ├── queue-events.jsonl
│   ├── config.yaml
│   └── simulations.yaml
├── go.mod
└── go.sum
```

## 常见问题

### Q: 如何准备真实数据？

从你的队列系统中导出：
1. 任务列表（包含状态、时间、重试次数等）
2. Worker 配置（并发数、batch size 等）
3. 队列事件日志（可选，用于更细粒度的分析）

### Q: 模拟时如何设置任务失败？

在 jobs.jsonl 中设置 `fail_reason` 字段，或者在模拟时使用自定义配置。

### Q: 如何选择最优配置？

使用 `compare` 命令对比多个配置方案，工具会根据综合评分给出最优建议。

## License

MIT
