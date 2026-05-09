# DistChaos - 分布式系统混沌工程平台

一个专注于底层后端问题复现的混沌工程平台，用于模拟和可视化分布式系统中的各种异常场景。

## 功能特性

### 🎯 核心场景模拟

1. **库存扣减但订单失败**
   - 完整的订单流程：库存预留 → 订单创建 → 支付处理
   - 自动触发补偿机制
   - 补偿失败重试可视化

2. **连接池耗尽** (connection_pool)
   - 模拟数据库连接泄漏
   - 连接数超过上限时的等待队列
   - 实时连接状态监控

3. **消息积压** (message_backlog)
   - 消息队列堆积模拟
   - 处理延迟配置
   - 消息丢失场景复现

4. **Goroutine 泄漏** (goroutine_leak)
   - 可控的 goroutine 泄漏数量
   - 实时 goroutine 计数监控
   - 自动清理机制

5. **数据库锁等待** (db_lock_wait)
   - 模拟行锁/表锁竞争
   - 锁等待超时场景
   - 死链检测可视化

6. **缓存脏数据** (cache_dirty_data)
   - 缓存与数据库不一致
   - 缓存穿透/击穿模拟
   - 数据一致性验证

7. **配置漂移** (config_drift)
   - 运行时配置变更
   - 配置回滚机制
   - 配置版本追踪

### 📊 可观测性功能

- **事件时间线**: 实时追踪所有操作的时间序列
- **链路追踪**: 基于 Trace ID 的完整调用链可视化
- **状态回放**: 重放任意时刻的系统状态
- **异常恢复**: 补偿机制的完整生命周期监控
- **SSE 实时推送**: 服务器事件实时推送到前端

## 项目结构

```
distchaos/
├── backend/
│   ├── cmd/
│   │   └── chaos/
│   │       └── main.go           # 主程序入口
│   ├── internal/
│   │   ├── domain/
│   │   │   └── models.go         # 领域模型
│   │   ├── service/
│   │   │   └── order_service.go  # 订单服务（含补偿逻辑）
│   │   ├── chaos/
│   │   │   └── manager.go        # 混沌实验管理器
│   │   ├── event/
│   │   │   └── event.go          # 事件系统
│   │   └── repository/
│   │       └── memory_repo.go    # 内存仓库
│   ├── pkg/
│   │   └── config/
│   │       └── config.go         # 配置管理
│   └── go.mod
├── frontend/
│   └── index.html                # 前端可视化界面
└── README.md
```

## 快速开始

### 1. 启动后端服务

```bash
cd distchaos/backend

# 下载依赖
go mod tidy

# 运行服务
go run cmd/chaos/main.go
```

服务将在 `http://localhost:8080` 启动。

### 2. 打开前端界面

在浏览器中直接打开 `distchaos/frontend/index.html` 文件。

或者使用 Python 启动一个简单的 HTTP 服务器：

```bash
cd distchaos/frontend
python3 -m http.server 3000
```

然后访问 `http://localhost:3000`

## API 接口

### 订单操作

```bash
# 创建订单
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "product_id": 1, "quantity": 1}'

# 查询订单链路
curl http://localhost:8080/api/v1/events/{trace_id}

# 回放事件
curl -X POST http://localhost:8080/api/v1/events/{trace_id}/replay
```

### 混沌实验

```bash
# 注入混沌实验
curl -X POST http://localhost:8080/api/v1/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{
    "type": "connection_pool",
    "duration": "30s",
    "params": {"leak_count": 10}
  }'

# 停止实验
curl -X POST http://localhost:8080/api/v1/chaos/stop/{type}

# 查询状态
curl http://localhost:8080/api/v1/chaos/status
```

### 支持的混沌实验类型

| 类型 | 描述 | 参数示例 |
|------|------|----------|
| `connection_pool` | 连接池耗尽 | `{"leak_count": 10, "max_conns": 5}` |
| `message_backlog` | 消息积压 | `{"backlog_size": 1000, "process_delay": 100}` |
| `goroutine_leak` | Goroutine泄漏 | `{"leak_count": 100}` |
| `db_lock_wait` | 数据库锁等待 | `{"lock_count": 5, "lock_duration": 30}` |
| `cache_dirty_data` | 缓存脏数据 | `{"dirty_count": 50}` |
| `config_drift` | 配置漂移 | `{"drift_count": 20}` |

## 典型使用场景

### 场景1: 复现"库存扣减但订单失败"

1. 在前端点击"📦 创建正常订单"确认正常流程
2. 观察时间线中的事件流：
   - `inventory_reserved` (成功)
   - `order_created` (成功)
   - `payment_succeeded` (成功)
3. 点击"❌ 库存不足 (模拟失败)"
4. 观察补偿流程：
   - `inventory_reserved` (成功)
   - `order_failed` (失败)
   - `compensation_start` (开始补偿)
   - `compensation_retry` (重试)
   - `compensation_success/failed` (结果)

### 场景2: 模拟连接池耗尽

1. 在前端点击"🔌 连接池耗尽"
2. 观察指标面板中的连接池状态
3. 查看时间线中的 `connection_exhausted` 事件
4. 30秒后自动恢复，或手动点击"🛑 停止所有实验"

### 场景3: Goroutine 泄漏分析

1. 点击"🧵 Goroutine泄漏"
2. 观察 Goroutine 数量从正常变为异常
3. 查看时间线中的 `goroutine_leak` 事件序列
4. 停止实验后观察自动清理过程

## 事件类型说明

### 业务事件
- `inventory_reserved` - 库存预留
- `inventory_released` - 库存释放
- `order_created` - 订单创建
- `order_failed` - 订单失败
- `payment_succeeded` - 支付成功
- `payment_failed` - 支付失败

### 补偿事件
- `compensation_start` - 补偿开始
- `compensation_retry` - 补偿重试
- `compensation_success` - 补偿成功
- `compensation_failed` - 补偿失败

### 混沌事件
- `chaos_inject` - 混沌注入
- `chaos_recover` - 混沌恢复
- `connection_exhausted` - 连接耗尽
- `message_backlog` - 消息积压
- `goroutine_leak` - Goroutine泄漏
- `db_lock_wait` - 数据库锁等待
- `cache_dirty` - 缓存脏数据
- `config_drift` - 配置漂移

## 技术栈

### 后端
- **Go 1.21** - 编程语言
- **Gin** - Web 框架
- **UUID** - 唯一标识生成
- **CORS** - 跨域支持

### 前端
- **原生 HTML/CSS/JavaScript** - 零依赖
- **Server-Sent Events (SSE)** - 实时推送
- **响应式设计** - 移动端适配

## 扩展开发

### 添加新的混沌场景

1. 在 `internal/chaos/manager.go` 中添加新类型：
```go
const (
    ChaosTypeMyScenario ChaosType = "my_scenario"
)
```

2. 实现模拟方法：
```go
func (m *ChaosManager) simulateMyScenario(ctx context.Context, state *ScenarioState) {
    // 实现逻辑
}
```

3. 在 `executeScenario` 中添加 case 分支

### 添加新的事件类型

在 `internal/event/event.go` 中添加：
```go
const (
    EventTypeMyEvent EventType = "my_event"
)
```

## License

MIT
