# 幂等支付指令 API

一个解决重复调用和状态不明问题的支付指令处理系统，使用Go语言实现。

## 功能特性

### 核心数据对象
- **付款指令 (Payment Instruction)**: 支付请求的核心载体
- **收款账户 (Receiver Account)**: 收款人银行账户信息
- **幂等键 (Idempotent Key)**: 确保请求幂等性的唯一标识
- **渠道回执 (Channel Receipt)**: 支付渠道返回的回执信息
- **状态查询 (Status Query)**: 支持按支付单号或幂等键查询
- **撤销申请 (Cancel Application)**: 支付撤销请求管理

### 核心规则
1. **指令登记**: 支持完整的支付指令创建和登记流程
2. **幂等响应**: 重复提交自动识别，返回首次结果不重复处理
3. **渠道轮询**: 后台自动轮询支付渠道状态，解决状态不明问题
4. **状态补偿**: 通过轮询机制自动补偿缺失的状态更新
5. **撤销限制**: 已成功支付不可撤销，避免资金风险

### 时间线追踪
- 每个关键动作都留下完整的时间线记录
- 支持按支付单号、事件类型、时间范围查询历史
- 操作人、IP地址等审计信息完整记录

### 问题排查汇总
- 自动识别超时支付和异常状态
- 完整的问题支付汇总报告
- 支持导出排查报告

## API接口

### 基础信息
- 服务地址: `http://localhost:8080`
- API前缀: `/api/v1`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/payments` | 创建支付指令 |
| GET | `/api/v1/payments` | 查询支付指令 |
| POST | `/api/v1/payments/cancel` | 撤销支付指令 |
| POST | `/api/v1/payments/callback` | 渠道回调通知 |
| POST | `/api/v1/payments/history` | 查询历史记录 |
| POST | `/api/v1/payments/problem-summary` | 获取问题支付汇总 |
| POST | `/api/v1/payments/export-summary` | 导出问题汇总报告 |
| GET | `/health` | 健康检查 |

## 快速开始

### 环境要求
- Go 1.21+
- SQLite3

### 安装依赖
```bash
cd idempotent-payment-api
go mod download
```

### 启动服务
```bash
go run cmd/main.go
```

服务将在 `http://localhost:8080` 启动

### 使用示例

#### 1. 创建支付指令
```bash
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "unique_key_001",
    "merchant_id": "merchant_001",
    "amount": 10000,
    "currency": "CNY",
    "channel": "ALIPAY",
    "receiver": {
      "bank_name": "工商银行",
      "account_no": "6222021234567890",
      "account_name": "张三"
    },
    "remark": "订单支付",
    "operator": "admin",
    "ip_address": "192.168.1.1"
  }'
```

#### 2. 重复提交测试（幂等验证）
```bash
# 使用相同的 idempotent_key 再次提交
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "unique_key_001",
    "merchant_id": "merchant_001",
    "amount": 10000,
    "currency": "CNY",
    "channel": "ALIPAY",
    "receiver": {
      "bank_name": "工商银行",
      "account_no": "6222021234567890",
      "account_name": "张三"
    }
  }'
```

#### 3. 查询支付指令
```bash
# 按支付单号查询
curl "http://localhost:8080/api/v1/payments?payment_no=PAY20240101120000abc123"

# 按幂等键查询
curl "http://localhost:8080/api/v1/payments?idempotent_key=unique_key_001"
```

#### 4. 撤销支付指令
```bash
curl -X POST http://localhost:8080/api/v1/payments/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "payment_no": "PAY20240101120000abc123",
    "reason": "用户取消订单",
    "operator": "admin",
    "ip_address": "192.168.1.1"
  }'
```

#### 5. 查询历史记录
```bash
curl -X POST http://localhost:8080/api/v1/payments/history \
  -H "Content-Type: application/json" \
  -d '{
    "payment_no": "PAY20240101120000abc123",
    "event_type": "CREATE_PAYMENT",
    "start_time": "2024-01-01 00:00:00",
    "end_time": "2024-12-31 23:59:59"
  }'
```

#### 6. 获取问题支付汇总
```bash
curl -X POST http://localhost:8080/api/v1/payments/problem-summary \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 项目结构

```
idempotent-payment-api/
├── cmd/
│   └── main.go              # 主程序入口
├── internal/
│   ├── model/               # 数据模型
│   │   ├── model.go         # 核心数据结构
│   │   └── dto.go           # 请求/响应DTO
│   ├── repository/          # 数据访问层
│   │   ├── database.go      # 数据库初始化
│   │   └── repository.go    # 仓库实现
│   ├── service/             # 业务逻辑层
│   │   ├── payment_service.go  # 支付服务
│   │   └── channel_service.go  # 渠道服务（模拟）
│   └── handler/             # API接口层
│       └── handler.go       # HTTP处理器
├── pkg/
│   └── utils/               # 工具函数
├── data/                    # 数据文件目录
├── go.mod                   # Go模块定义
└── README.md                # 项目文档
```

## 支付状态说明

| 状态 | 说明 |
|------|------|
| PENDING | 待处理，刚创建 |
| PROCESSING | 处理中，已提交渠道 |
| SUCCESS | 支付成功 |
| FAILED | 支付失败 |
| CANCELLING | 撤销中 |
| CANCELLED | 已撤销 |
| UNKNOWN | 状态未知 |

## 事件类型说明

| 事件类型 | 说明 |
|----------|------|
| CREATE_PAYMENT | 创建支付指令 |
| DUPLICATE_REQUEST | 重复请求拦截 |
| PROCESS_PAYMENT | 开始处理支付 |
| CHANNEL_SUBMIT | 提交支付渠道 |
| CHANNEL_CALLBACK | 收到渠道回调 |
| STATUS_POLL | 轮询更新状态 |
| CANCEL_REQUEST | 申请撤销 |
| CHANNEL_CANCEL | 渠道撤销 |

## 核心设计

### 幂等性实现
1. 每次请求必须携带唯一的 `idempotent_key`
2. 创建支付前先检查幂等键是否存在
3. 已存在则直接返回已有支付结果
4. 使用数据库事务保证原子性

### 状态补偿机制
1. 后台定时轮询处于 `PROCESSING` 状态的支付
2. 查询渠道最新状态
3. 自动更新本地状态并记录时间线
4. 超过阈值标记为问题支付

### 时间线追踪
- 所有关键操作都生成时间线事件
- 包含操作类型、状态、内容、操作人、IP
- 支持完整的审计追踪和问题排查

## 注意事项

1. 幂等键有效期：系统默认保留30天
2. 轮询间隔：默认10秒轮询一次状态
3. 超时阈值：处理超过1小时标记为问题支付
4. 撤销限制：已成功的支付不允许撤销

## 许可证

MIT License
