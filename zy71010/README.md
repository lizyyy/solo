# 兽医疫苗冷链 API

基于 Go + SQLite 的轻量级兽医疫苗冷链管理后端服务，实现疫苗批号管理、冰箱温度监控、开瓶记录、调拨留痕、废弃确认和冷链报告导出。

## 核心特性

- 🧊 **冷链窗口校验**：实时监控冰箱温度，自动检测温度断点
- 🧪 **开瓶状态机**：跟踪开瓶时间，超时自动标记过期
- 🚚 **调拨留痕**：同批号跨冰箱调拨完整记录
- 🗑️ **废弃确认**：废弃原因记录与双签确认
- 📊 **报告导出**：冷链合规报告 CSV 导出
- 🔗 **证据链更新**：重复补材料只更新证据链，不重复计算业务结果

## 业务动作覆盖

| 动作 | 说明 |
|------|------|
| 提交材料 | 提交各类证据材料到证据链 |
| 自动判断 | 基于规则自动评估冷链合规性 |
| 人工处理 | 人工审核特殊情况 |
| 退回补充 | 退回要求补充材料 |
| 重新计算 | 基于新证据重新评估 |
| 结果核对 | 查看业务结果与完整证据链 |

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
go mod download
```

### 2. 启动服务

```bash
# 直接运行
go run main.go

# 或编译后运行
go build -o cold_chain_api
./cold_chain_api
```

服务默认运行在 `http://localhost:8080`

### 3. 生成测试数据

```bash
# 运行造数脚本
go run scripts/seed.go
```

造数脚本会生成：
- 3 个疫苗冰箱（A、B、C）
- 3 种疫苗（犬四联、猫三联、狂犬病）
- 24 小时温度记录（包含随机温度断点）
- 2 条开瓶记录（其中一条超时）
- 1 条调拨记录
- 1 条待确认废弃记录
- 3 条接种记录

### 4. 轻量自检

```bash
# 健康检查
curl http://localhost:8080/api/v1/health

# 数据一致性检查
curl http://localhost:8080/api/v1/consistency
```

## API 接口速查

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/consistency` | 数据一致性检查 |

### 核心业务流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/submissions` | 提交材料 |
| GET | `/api/v1/evaluations` | 自动判断 |
| POST | `/api/v1/manual-process` | 人工处理 |
| POST | `/api/v1/return-correction` | 退回补充 |
| POST | `/api/v1/recalculate` | 重新计算 |
| GET | `/api/v1/verify` | 结果核对 |

### 功能接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/cold-chain/validate` | 冷链窗口校验 |
| GET | `/api/v1/open-vial/:id/status` | 开瓶状态查询 |
| GET | `/api/v1/transfers/:batch/trail` | 调拨留痕查询 |
| POST | `/api/v1/discards/confirm` | 废弃确认 |
| POST | `/api/v1/reports/generate` | 生成冷链报告 |
| GET | `/api/v1/reports/:id/export` | 导出报告 CSV |

## Curl 示例

### 1. 提交材料（自动评估）

```bash
curl -X POST http://localhost:8080/api/v1/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "business_key": "CV2024001_FRIDGE_A",
    "business_type": "temperature_compliance",
    "evidence_type": "temperature",
    "evidence_data": {
      "refrigerator_id": "冰箱ID从造数输出中获取",
      "start_time": "2024-01-01T00:00:00Z",
      "end_time": "2024-01-02T00:00:00Z"
    },
    "submitted_by": "张医生",
    "auto_evaluate": true
  }'
```

### 2. 冷链窗口校验

```bash
curl -X POST http://localhost:8080/api/v1/cold-chain/validate \
  -H "Content-Type: application/json" \
  -d '{
    "refrigerator_id": "替换为实际冰箱ID",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-01-02T00:00:00Z"
  }'
```

### 3. 查询开瓶状态（状态机）

```bash
# 替换为实际开瓶记录ID
curl http://localhost:8080/api/v1/open-vial/替换为开瓶ID/status
```

**响应说明**：
- `expired`: 是否超时（超过 6 小时）
- `time_open`: 已开瓶时长
- `status`: 状态（opened/expired/closed）

### 4. 查询调拨留痕

```bash
curl http://localhost:8080/api/v1/transfers/CV2024001/trail
```

**响应说明**：
- `transfers`: 完整调拨历史
- `current_fridge`: 当前所在冰箱
- `total_transfers`: 调拨次数

### 5. 废弃确认

```bash
# 先创建废弃记录
curl -X POST http://localhost:8080/api/v1/discards \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "CV2024001",
    "doses_count": 5,
    "reason": "开瓶超时",
    "discarded_by": "李医生"
  }'

# 然后确认废弃
curl -X POST http://localhost:8080/api/v1/discards/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "discard_id": "替换为废弃记录ID",
    "confirmed_by": "王主任"
  }'
```

### 6. 生成并导出报告

```bash
# 生成报告
curl -X POST http://localhost:8080/api/v1/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-01-02T00:00:00Z",
    "generated_by": "系统管理员"
  }'

# 导出 CSV（替换为报告ID）
curl -OJ http://localhost:8080/api/v1/reports/替换为报告ID/export
```

### 7. 结果核对（证据链+业务结果）

```bash
curl "http://localhost:8080/api/v1/verify?business_key=CV2024001_FRIDGE_A&business_type=temperature_compliance"
```

**响应说明**：
- `business_result`: 业务计算结果（唯一，不会重复计算）
- `evidence_chain`: 完整证据链（版本递增）
- `evidence_count`: 证据提交次数

## 失败路径演示

### 场景1：开瓶超时使用（不合规）

```bash
# 1. 创建一个超时的开瓶记录（7小时前）
curl -X POST http://localhost:8080/api/v1/open-records \
  -H "Content-Type: application/json" \
  -d '{
    "inventory_id": "库存ID",
    "batch_number": "CV2024001",
    "opened_at": "2024-01-01T00:00:00Z",
    "opened_by": "测试医生",
    "doses_used": 1,
    "status": "opened"
  }'

# 2. 查询状态 - 应显示 expired: true
curl http://localhost:8080/api/v1/open-vial/返回的开瓶ID/status

# 3. 提交评估 - 结果应为 non_compliant
curl -X POST http://localhost:8080/api/v1/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "business_key": "EXPIRED_VIAL_TEST",
    "business_type": "open_vial_check",
    "evidence_type": "open_vial",
    "evidence_data": {"open_record_id": "返回的开瓶ID"},
    "submitted_by": "测试员",
    "auto_evaluate": true
  }'
```

### 场景2：温度断点（不合规）

造数脚本已故意生成一些温度异常点，运行冷链校验会检测到：

```bash
curl -X POST http://localhost:8080/api/v1/cold-chain/validate \
  -H "Content-Type: application/json" \
  -d '{
    "refrigerator_id": "替换为冰箱A的ID",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-01-02T00:00:00Z"
  }'
```

### 场景3：重复提交材料（证据链更新）

```bash
# 第一次提交
curl -X POST http://localhost:8080/api/v1/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "business_key": "DUPLICATE_TEST",
    "business_type": "temperature",
    "evidence_type": "temperature",
    "evidence_data": {"note": "第一次提交"},
    "submitted_by": "测试员",
    "auto_evaluate": false
  }'

# 第二次提交（同一 business_key）- 证据版本变为 2，业务结果不重复
curl -X POST http://localhost:8080/api/v1/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "business_key": "DUPLICATE_TEST",
    "business_type": "temperature",
    "evidence_type": "temperature_complete",
    "evidence_data": {"note": "补充材料"},
    "submitted_by": "测试员",
    "auto_evaluate": true
  }'

# 查看证据链 - 会看到两个版本
curl "http://localhost:8080/api/v1/verify?business_key=DUPLICATE_TEST&business_type=temperature"
```

## 配置说明

可在 [config/config.go](file:///Users/lzy/pro/solo/workspaces/zy71010/config/config.go) 中调整：

```go
ColdChainMinTemp:  2.0,   // 最低冷链温度
ColdChainMaxTemp:  8.0,   // 最高冷链温度
MaxOpenHours:      6,     // 开瓶后最大使用时长（小时）
```

## 项目结构

```
.
├── main.go                 # 程序入口
├── go.mod
├── config/
│   └── config.go          # 配置管理
├── database/
│   ├── db.go              # 数据库连接
│   └── schema.go          # 数据库 Schema
├── models/
│   └── models.go          # 数据模型
├── repository/
│   └── repository.go      # 数据访问层
├── service/
│   ├── cold_chain.go      # 业务逻辑
│   └── report.go          # 报告生成
├── handler/
│   └── handler.go         # API 处理器
├── scripts/
│   └── seed.go            # 造数脚本
└── README.md
```

## 数据库表结构

- `refrigerators` - 冰箱信息
- `vaccines` - 疫苗信息
- `vaccine_inventory` - 疫苗库存
- `temperature_records` - 温度记录
- `open_records` - 开瓶记录
- `transfer_records` - 调拨记录
- `discard_records` - 废弃记录
- `vaccination_records` - 接种记录
- `evidence_chains` - 证据链（版本控制）
- `business_results` - 业务结果（唯一键约束防重复）
- `cold_chain_reports` - 冷链报告

## 关键设计说明

### 证据链防重复机制

- 使用 `business_key + business_type` 作为业务唯一标识
- 证据链表 `evidence_chains` 按版本号递增存储
- 业务结果表 `business_results` 使用唯一键约束确保同一业务只计算一次
- 重复提交只增加证据版本，不重复创建业务结果

### 开瓶状态机

- `opened`: 正常使用中
- `expired`: 超时未使用完（自动检测）
- `closed`: 正常用完关闭

### 冷链校验规则

- 温度范围：2°C ~ 8°C
- 超出范围记录为温度断点
- 无温度记录视为不合规
