# 数据库连接池保护 API

基于 Go + Gin 实现的数据库连接池保护系统，提供规则管理、连接统计、慢查询识别、熔断保护和审计追踪能力。

## 项目结构

```
.
├── main.go                    # 程序入口
├── go.mod                     # 依赖管理
├── internal/
│   ├── model/                # 数据模型定义
│   ├── store/                # 存储层（内存 + 持久化）
│   ├── service/              # 业务逻辑层
│   └── handler/              # HTTP 接口层
├── test_api.sh               # API 测试脚本
└── README.md                 # 本文档
```

## 核心能力

### 1. 规则管理 (Rule)
- 创建/查询/更新/删除保护规则
- 支持版本号管理，每次更新自增
- 重复提交防重（RequestID 机制）
- 规则状态：active / paused / triggered / restored / revoked

### 2. 连接统计 (Connection Stats)
- 上报活跃连接数、空闲连接数
- 上报等待队列长度和平均等待时间
- 用于阈值判断和保护触发

### 3. 慢查询记录 (Slow Query)
- 自动关联对应 API 路径的规则
- 记录 SQL 语句、执行时长、TraceID
- 用于慢接口识别和问题排查

### 4. 保护触发 (Protection Trigger)
- 阈值检测：活跃连接数、等待时间
- 保护动作：熔断 / 拒绝新连接 / 降级
- 记录触发原因和上下文数据

### 5. 恢复确认 (Restore Confirm)
- 人工介入确认恢复
- 记录恢复原因和检查数据
- 操作人审计

### 6. 历史审计 (History)
- 所有变更操作完整记录
- 支持按资源 ID 查询
- 包含操作前后快照

### 7. 报表导出 (Export)
- CSV 格式导出
- 包含保护事件、恢复记录、慢查询

## 快速开始

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run main.go
```

服务默认监听 `:8080`

### 3. 运行测试脚本

```bash
chmod +x test_api.sh
./test_api.sh
```

## API 文档

### 公共请求头

| 头名称 | 说明 | 示例 |
|--------|------|------|
| X-Operator | 操作人标识 | admin |
| Content-Type | 请求格式 | application/json |

---

### 规则管理 API

#### 创建规则
```
POST /api/v1/rules
```

请求体：
```json
{
  "name": "订单查询连接池保护",
  "api_path": "/api/order/query",
  "pool_name": "order-db-pool",
  "description": "保护订单查询接口",
  "thresholds": {
    "max_active_conn": 50,
    "max_wait_time_ms": 3000,
    "slow_query_time_ms": 500,
    "error_rate_threshold": 0.1
  },
  "action": "circuit_break",
  "action_params": {
    "fallback_response": "系统繁忙"
  },
  "request_id": "req-123456"
}
```

#### 查询规则列表
```
GET /api/v1/rules
```

#### 查询单个规则
```
GET /api/v1/rules/:id
```

#### 更新规则状态
```
PUT /api/v1/rules/:id/status
```

请求体：
```json
{
  "status": "paused"
}
```

#### 删除规则
```
DELETE /api/v1/rules/:id
```

---

### 统计上报 API

#### 上报连接统计
```
POST /api/v1/stats/connection
```

请求体：
```json
{
  "rule_id": "xxx",
  "api_path": "/api/order/query",
  "pool_name": "order-db-pool",
  "active_conn": 30,
  "idle_conn": 20,
  "wait_count": 5,
  "wait_time_avg_ms": 150
}
```

#### 上报慢查询
```
POST /api/v1/stats/slow-query
```

请求体：
```json
{
  "api_path": "/api/order/query",
  "sql": "SELECT * FROM orders WHERE ...",
  "duration_ms": 650,
  "trace_id": "trace-abc123"
}
```

#### 获取概览统计
```
GET /api/v1/stats/overview
```

返回：
- 规则总数、活跃规则数、触发保护规则数
- 今日保护次数、今日恢复次数
- Top 慢接口列表
- 连接池状态列表

---

### 保护操作 API

#### 触发保护
```
POST /api/v1/protection/trigger
```

请求体：
```json
{
  "rule_id": "xxx"
}
```

#### 确认恢复
```
POST /api/v1/protection/restore
```

请求体：
```json
{
  "rule_id": "xxx",
  "event_id": "event-xxx",
  "reason": "问题已修复",
  "check_data": {
    "active_conn": 25,
    "confirmed_by": "dba"
  }
}
```

---

### 审计与导出

#### 查询历史记录
```
GET /api/v1/history?resource_id=xxx&limit=100
```

#### 导出 CSV 报告
```
GET /api/v1/export
```

## 测试指南

### 场景 1：造数据
使用测试脚本的前 6 步：
1. 创建规则
2. 上报正常连接统计
3. 上报多条慢查询记录
4. 验证数据已保存

### 场景 2：触发异常保护
1. 上报异常连接统计（活跃连接 > 阈值）
2. 调用触发保护接口
3. 验证规则状态变为 `triggered`
4. 查看保护事件记录

### 场景 3：人工恢复流程
1. 调用确认恢复接口
2. 验证规则状态变为 `restored`
3. 查看恢复记录
4. 查看历史审计，验证有完整变更轨迹

### 场景 4：重复提交防重
1. 使用相同 RequestID 创建规则两次
2. 验证第二次返回已存在的规则，不重复创建

## 数据持久化

- 服务启动时自动加载 `data.json`
- 服务优雅关闭时自动保存所有数据
- 包含：规则、连接统计、慢查询、保护事件、恢复记录、历史审计、RequestID 集合

## 状态流转图

```
active → triggered → restored → active
  ↓         ↓           ↓
paused    paused      paused
  ↓
revoked (终端状态，不可恢复)
```

## 技术栈

- **Web 框架**: Gin
- **ID 生成**: UUID v4
- **存储**: 内存 + JSON 持久化
- **并发安全**: sync.RWMutex

## 扩展建议

1. 接入真实数据库（MySQL/PostgreSQL）替代内存存储
2. 增加规则匹配引擎，支持正则匹配 API 路径
3. 实现自动保护触发（定时检测阈值）
4. 接入告警系统（钉钉/企业微信）
5. 增加 Prometheus metrics 暴露
6. 实现 RBAC 权限控制
