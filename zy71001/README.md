# 航司机组调休补偿 API

基于 Go + Gin + SQLite 的轻量级后端服务，解决排班组处理机长和乘务调休申请的痛点。

## 功能特性

- ✅ **材料登记**：基地、机组成员、调休申请管理
- ✅ **幂等提交**：重复申请自动返回原处理结论
- ✅ **状态流转**：pending → approved → completed 状态机
- ✅ **操作追溯**：完整的处理日志链，支持单条追溯
- ✅ **补偿摘要**：状态完成时自动生成补偿记录
- ✅ **CSV 导出**：与查询结果一致的汇总下载
- ✅ **持久化存储**：SQLite 数据库，重启服务数据不丢失

## 快速开始

### 1. 编译运行

```bash
# 编译
go build -o crew-api .

# 启动服务
./crew-api
```

服务启动在 `http://localhost:8080`

### 2. 目录结构

```
.
├── main.go          # 完整服务实现（单文件）
├── go.mod           # 依赖管理
├── go.sum
├── crew-api         # 编译后的可执行文件
├── data/
│   └── crew.db      # SQLite 数据库（自动创建）
└── README.md
```

## API 接口

### 基础信息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/bases` | 获取基地列表 |
| GET | `/api/v1/crew` | 获取所有机组人员 |
| GET | `/api/v1/crew/:base_id` | 按基地获取人员 |

### 申请管理

#### 提交调休申请（幂等）

```bash
POST /api/v1/applications
Headers: Idempotency-Key: <可选，自定义幂等键>
Body:
{
  "crew_id": "xxx",
  "base_id": "xxx",
  "comp_type": "delay_compensation",
  "amount": 800,
  "reason": "航班延误超过4小时"
}
```

**响应示例（首次提交）：**
```json
{
  "data": { ...申请详情... },
  "idempotent": false,
  "message": "Application submitted successfully"
}
```

**响应示例（重复提交）：**
```json
{
  "data": { ...原有申请详情... },
  "idempotent": true,
  "message": "Request already processed"
}
```

#### 获取申请列表

```bash
GET /api/v1/applications?status=pending&crew_id=xxx&base_id=xxx
```

#### 获取申请详情

```bash
GET /api/v1/applications/:id
```

#### 状态流转

```bash
PUT /api/v1/applications/:id/status
Body:
{
  "status": "approved",
  "operator": "调度员A",
  "remark": "情况属实，同意补偿"
}
```

**支持的状态：**
- `pending` - 待审核
- `approved` - 已批准
- `rejected` - 已拒绝
- `processing` - 处理中
- `completed` - 已完成（自动生成补偿记录）

#### 申请追溯

```bash
GET /api/v1/applications/:id/trace
```

返回完整的状态变更日志，包括：操作人、操作时间、前后状态、备注

### 导出功能

```bash
GET /api/v1/applications/export/csv?status=completed
```

导出 CSV 文件，包含：申请ID、人员姓名、基地、补偿类型、金额、状态、原因、创建时间

### 补偿记录

```bash
GET /api/v1/compensations?crew_id=xxx
```

## 数据模型

### bases（基地表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| name | TEXT | 基地名称 |
| description | TEXT | 描述 |
| created_at | DATETIME | 创建时间 |

### crew（机组人员表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| name | TEXT | 姓名 |
| base_id | TEXT | 所属基地ID |
| role | TEXT | 角色（机长/乘务） |
| created_at | DATETIME | 创建时间 |

### apps（申请表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| idempotency_key | TEXT | 幂等键（唯一索引） |
| crew_id | TEXT | 人员ID |
| base_id | TEXT | 基地ID |
| comp_type | TEXT | 补偿类型 |
| amount | REAL | 金额 |
| status | TEXT | 状态 |
| reason | TEXT | 原因 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### comp（补偿表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| application_id | TEXT | 申请ID |
| crew_id | TEXT | 人员ID |
| amount | REAL | 金额 |
| paid_at | DATETIME | 发放时间 |
| created_at | DATETIME | 创建时间 |

### logs（操作日志表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| application_id | TEXT | 申请ID |
| action | TEXT | 操作类型 |
| from_status | TEXT | 原状态 |
| to_status | TEXT | 新状态 |
| operator | TEXT | 操作人 |
| remark | TEXT | 备注 |
| created_at | DATETIME | 操作时间 |

## 核心逻辑说明

### 幂等性实现

通过 HTTP Header `Idempotency-Key` 实现：
1. 客户端传入自定义幂等键
2. 服务端检查数据库中是否存在该键
3. 存在则直接返回原有申请（`idempotent: true`）
4. 不存在则创建新申请（`idempotent: false`）
5. 未传入时自动生成 UUID

### 状态机流转

```
pending → approved  → completed → 自动生成补偿记录
        ↘ rejected
        ↘ processing → approved → completed
```

状态变更时自动记录操作日志，支持完整追溯。

### 数据一致性

- 所有写入操作使用数据库事务
- CSV 导出直接查询数据库，与列表查询结果一致
- SQLite ACID 特性保证数据持久化

## 测试示例

```bash
# 1. 获取基地列表
curl http://localhost:8080/api/v1/bases

# 2. 获取机组人员
curl http://localhost:8080/api/v1/crew

# 3. 提交申请（带幂等键）
curl -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: TEST-001" \
  -d '{"crew_id":"xxx","base_id":"xxx","comp_type":"delay","amount":500,"reason":"测试"}'

# 4. 审核申请
curl -X PUT http://localhost:8080/api/v1/applications/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","operator":"张三","remark":"同意"}'

# 5. 导出CSV
curl -OJ http://localhost:8080/api/v1/applications/export/csv
```

## License

MIT
