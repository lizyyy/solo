# 危化品领用追溯站

为高校实验室安全员设计的本地 REST API 服务，解决纸表管理带来的审批漏签、库存扣错、过期试剂领用、月底追责无据等问题。

## 功能特性

### 核心功能
- **试剂建档**：建立危险化学品基础档案，支持 CAS 号、危险等级、单位等信息
- **批次入库**：按批次入库管理，记录生产日期、有效期、库存数量
- **领用申请**：创建领用申请，选择试剂批次、填写数量和用途
- **审批/驳回**：安全员/管理员审批申请，高危险等级试剂强制审批
- **实际领出**：审批通过后执行领用，扣减库存
- **归还/报废**：剩余试剂归还或报废处理
- **库存预警**：低库存、近过期、已过期自动预警
- **审计日志**：所有关键操作完整记录，支持追溯

### 数据校验
- **角色权限**：三级角色（admin/safety_officer/user）权限控制
- **库存校验**：库存充足性、正数数量、归还数量校验
- **有效期校验**：过期判断、即将过期预警
- **危险等级**：四级危险等级（低/中/高/极高），高等级强制审批
- **重复提交**：内存缓存频率限制，防止重复提交

### 报告功能
- **CSV 导入**：批量导入试剂批次
- **CSV 导出**：审计日志、领用申请、批次、试剂的 CSV 格式
- **Markdown 导出**：审计日志的 Markdown 格式报告

## 项目架构

```
危化品领用追溯站/
├── package.json           # 项目配置
├── jest.config.js         # 测试配置
├── .env.example           # 环境变量示例
├── data/                  # 数据目录
│   └── .gitkeep
├── src/
│   ├── index.js           # 应用入口
│   ├── config.js          # 配置文件
│   ├── models/            # 数据模型
│   │   ├── index.js
│   │   ├── Chemical.js    # 试剂模型
│   │   ├── Batch.js       # 批次模型
│   │   ├── Request.js     # 领用申请模型
│   │   └── AuditLog.js    # 审计日志模型
│   ├── storage/           # 存储层
│   │   ├── index.js
│   │   ├── database.js    # 数据库连接管理
│   │   └── repositories/  # 数据访问层
│   │       ├── index.js
│   │       ├── ChemicalRepository.js
│   │       ├── BatchRepository.js
│   │       ├── RequestRepository.js
│   │       └── AuditLogRepository.js
│   ├── validation/        # 校验规则层
│   │   ├── index.js
│   │   ├── PermissionValidator.js   # 权限校验
│   │   ├── StockValidator.js        # 库存校验
│   │   ├── ExpiryValidator.js       # 有效期校验
│   │   ├── DangerLevelValidator.js  # 危险等级校验
│   │   └── DuplicateSubmitValidator.js  # 重复提交校验
│   ├── state-machine/     # 状态机层
│   │   ├── index.js
│   │   └── RequestStateMachine.js   # 申请状态机
│   ├── services/          # 服务层
│   │   ├── index.js
│   │   ├── ChemicalService.js
│   │   ├── BatchService.js
│   │   ├── RequestService.js
│   │   ├── AuditService.js
│   │   └── AlertService.js
│   ├── routes/            # 路由层
│   │   ├── index.js       # 主路由
│   │   ├── chemicals.js
│   │   ├── batches.js
│   │   ├── requests.js
│   │   ├── audit.js
│   │   ├── alerts.js
│   │   └── reports.js
│   └── reports/           # 报告层
│       ├── index.js
│       ├── CsvImporter.js
│       ├── CsvExporter.js
│       └── MarkdownExporter.js
└── tests/                 # 测试目录
    ├── models.test.js
    ├── validation.test.js
    └── state-machine.test.js
```

## 角色权限

| 角色 | 说明 | 权限 |
|------|------|------|
| admin | 管理员 | 全部权限 |
| safety_officer | 安全员 | 管理试剂/批次、审批申请、查看审计日志 |
| user | 普通用户 | 查看试剂/批次、创建/查看/修改/撤销自己的申请 |

## 状态流转

```
┌────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐
│ 草稿   │───▶│ 待审批  │───▶│ 已批准   │───▶│ 已领出   │
│ (draft)│    │(pending)│    │(approved)│    │(executed)│
└────────┘    └─────────┘    └──────────┘    └────┬─────┘
                 │                                    │
                 ▼                                    ▼
            ┌─────────┐                         ┌──────────┐
            │ 已驳回  │                         │ 已归还   │
            │(rejected)│                         │(returned) │
            └─────────┘                         ├──────────┤
                                                  │ 已报废   │
                                                  │(discarded)│
                                                  └──────────┘
```

## 危险等级

| 等级 | 名称 | 审批要求 | 示例 |
|------|------|----------|------|
| low | 低危险 | 无需审批 | 乙醇、氯化钠 |
| medium | 中危险 | 无需审批 | 盐酸、硫酸稀溶液 |
| high | 高危险 | **强制审批** | 浓硫酸、浓硝酸 |
| extreme | 极高危险 | **强制审批** | 氰化物、爆炸物 |

## 安装与配置

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装步骤

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量（可选）：
```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件
PORT=3000
DB_PATH=./data/database.sqlite
LOW_STOCK_THRESHOLD=10
EXPIRY_WARNING_DAYS=30
```

3. 创建数据目录：
```bash
mkdir -p data
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务启动后访问：`http://localhost:3000`

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## API 文档

### 健康检查

```
GET /api/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### API 文档

```
GET /api/docs
```

返回所有可用 API 端点列表。

---

### 试剂管理

#### 获取试剂列表

```
GET /api/chemicals
```

查询参数：
- `search`: 搜索关键词（名称、CAS号）
- `danger_level`: 危险等级过滤
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20）

请求头：
```
Authorization: Bearer admin
```

#### 创建试剂

```
POST /api/chemicals
```

请求头：
```
Authorization: Bearer safety_officer
Content-Type: application/json
```

请求体：
```json
{
  "name": "浓硫酸",
  "cas_number": "7664-93-9",
  "danger_level": "high",
  "unit": "mL",
  "description": "98% 硫酸溶液",
  "storage_conditions": "阴凉干燥处"
}
```

#### 获取单个试剂

```
GET /api/chemicals/:id
```

#### 更新试剂

```
PUT /api/chemicals/:id
```

#### 删除试剂

```
DELETE /api/chemicals/:id
```

#### 获取危险等级列表

```
GET /api/chemicals/danger-levels
```

---

### 批次管理

#### 获取批次列表

```
GET /api/batches
```

查询参数：
- `chemical_id`: 试剂 ID 过滤
- `status`: 状态过滤（active/inactive）
- `page`: 页码
- `limit`: 每页数量

#### 创建批次

```
POST /api/batches
```

请求体：
```json
{
  "chemical_id": "chem-xxx",
  "batch_number": "BATCH-2024-001",
  "production_date": "2024-01-15T00:00:00Z",
  "expiry_date": "2026-01-15T23:59:59Z",
  "initial_quantity": 500,
  "supplier": "某化学试剂公司"
}
```

#### 获取单个批次

```
GET /api/batches/:id
```

#### 更新批次

```
PUT /api/batches/:id
```

#### 删除批次

```
DELETE /api/batches/:id
```

#### 获取过期预警

```
GET /api/batches/alerts/expiry
```

#### 获取低库存预警

```
GET /api/batches/alerts/low-stock
```

---

### 领用申请

#### 获取申请列表

```
GET /api/requests
```

查询参数：
- `status`: 状态过滤
- `requester_id`: 申请人过滤
- `page`: 页码
- `limit`: 每页数量

#### 创建申请

```
POST /api/requests
```

请求体：
```json
{
  "chemical_id": "chem-xxx",
  "batch_id": "batch-xxx",
  "quantity": 50,
  "purpose": "有机合成实验",
  "notes": "用于实验A"
}
```

#### 获取单个申请

```
GET /api/requests/:id
```

#### 更新申请（仅草稿状态）

```
PUT /api/requests/:id
```

#### 提交申请

```
POST /api/requests/:id/submit
```

将状态从 `draft` 改为 `pending`

#### 批准申请

```
POST /api/requests/:id/approve
```

请求头：
```
Authorization: Bearer safety_officer
```

将状态从 `pending` 改为 `approved`

#### 驳回申请

```
POST /api/requests/:id/reject
```

请求头：
```
Authorization: Bearer safety_officer
```

请求体：
```json
{
  "reason": "库存不足，无法满足申请"
}
```

将状态从 `pending` 改为 `rejected`

#### 执行领用

```
POST /api/requests/:id/execute
```

将状态从 `approved` 改为 `executed`，扣减批次库存

#### 归还试剂

```
POST /api/requests/:id/return
```

请求体：
```json
{
  "return_quantity": 20,
  "notes": "剩余试剂归还"
}
```

将状态从 `executed` 改为 `returned`，恢复部分库存

#### 报废试剂

```
POST /api/requests/:id/discard
```

请求体：
```json
{
  "reason": "试剂已污染，无法使用"
}
```

将状态从 `executed` 改为 `discarded`

---

### 审计日志

#### 获取审计日志

```
GET /api/audit
```

查询参数：
- `action`: 操作类型过滤
- `entity_type`: 实体类型过滤
- `entity_id`: 实体 ID 过滤
- `user_id`: 用户 ID 过滤
- `start_date`: 开始日期
- `end_date`: 结束日期
- `page`: 页码
- `limit`: 每页数量

#### 获取审计统计

```
GET /api/audit/stats
```

---

### 预警管理

#### 获取所有预警

```
GET /api/alerts
```

#### 获取库存预警

```
GET /api/alerts/stock
```

#### 获取过期预警

```
GET /api/alerts/expiry
```

#### 确认预警

```
POST /api/alerts/:type/:id/acknowledge
```

路径参数：
- `type`: 预警类型（stock/expiry）
- `id`: 批次 ID

---

### 报告功能

#### 获取导入模板

```
GET /api/reports/import-template
```

返回 CSV 格式的批次导入模板

#### 批量导入批次

```
POST /api/reports/import-batches
```

请求头：
```
Content-Type: text/csv
```

请求体（CSV 格式）：
```
chemical_id,batch_number,production_date,expiry_date,initial_quantity,supplier
chem-xxx,BATCH-2024-001,2024-01-15,2026-01-15,500,供应商A
chem-xxx,BATCH-2024-002,2024-02-01,2026-02-01,300,供应商B
```

#### 导出审计日志（CSV）

```
GET /api/reports/export/audit/csv
```

查询参数：
- `start_date`: 开始日期
- `end_date`: 结束日期
- `user_id`: 用户过滤

#### 导出审计报告（Markdown）

```
GET /api/reports/export/audit/markdown
```

#### 导出领用申请（CSV）

```
GET /api/reports/export/requests/csv
```

#### 导出批次（CSV）

```
GET /api/reports/export/batches/csv
```

#### 导出试剂（CSV）

```
GET /api/reports/export/chemicals/csv
```

---

## 本地验证流程

### 步骤 1：启动服务

```bash
npm install
npm run dev
```

### 步骤 2：测试健康检查

```bash
curl http://localhost:3000/api/health
```

### 步骤 3：创建试剂（安全员角色）

```bash
curl -X POST http://localhost:3000/api/chemicals \
  -H "Authorization: Bearer safety_officer" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "浓硫酸",
    "cas_number": "7664-93-9",
    "danger_level": "high",
    "unit": "mL",
    "description": "98% 硫酸溶液",
    "storage_conditions": "阴凉干燥处"
  }'
```

记录返回的 `id`，记为 `CHEM_ID`

### 步骤 4：创建批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Authorization: Bearer safety_officer" \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "'"${CHEM_ID}"'",
    "batch_number": "BATCH-2024-TEST-001",
    "production_date": "2024-01-15T00:00:00Z",
    "expiry_date": "2026-01-15T23:59:59Z",
    "initial_quantity": 500,
    "supplier": "某化学试剂公司"
  }'
```

记录返回的 `id`，记为 `BATCH_ID`

### 步骤 5：创建领用申请（普通用户）

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Authorization: Bearer user" \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "'"${CHEM_ID}"'",
    "batch_id": "'"${BATCH_ID}"'",
    "quantity": 50,
    "purpose": "有机合成实验",
    "notes": "用于实验A"
  }'
```

记录返回的 `id`，记为 `REQUEST_ID`

### 步骤 6：提交申请

```bash
curl -X POST http://localhost:3000/api/requests/${REQUEST_ID}/submit \
  -H "Authorization: Bearer user"
```

检查状态是否变为 `pending`

### 步骤 7：安全员审批

```bash
curl -X POST http://localhost:3000/api/requests/${REQUEST_ID}/approve \
  -H "Authorization: Bearer safety_officer"
```

检查状态是否变为 `approved`

### 步骤 8：执行领用

```bash
curl -X POST http://localhost:3000/api/requests/${REQUEST_ID}/execute \
  -H "Authorization: Bearer user"
```

检查：
- 状态是否变为 `executed`
- 批次库存是否从 500 变为 450

### 步骤 9：归还部分试剂

```bash
curl -X POST http://localhost:3000/api/requests/${REQUEST_ID}/return \
  -H "Authorization: Bearer user" \
  -H "Content-Type: application/json" \
  -d '{
    "return_quantity": 20,
    "notes": "剩余试剂归还"
  }'
```

检查：
- 状态是否变为 `returned`
- 批次库存是否从 450 变为 470

### 步骤 10：查看审计日志

```bash
curl http://localhost:3000/api/audit \
  -H "Authorization: Bearer admin"
```

应能看到完整的操作链路

### 步骤 11：导出审计报告

```bash
# CSV 格式
curl "http://localhost:3000/api/reports/export/audit/csv" \
  -H "Authorization: Bearer admin"

# Markdown 格式
curl "http://localhost:3000/api/reports/export/audit/markdown" \
  -H "Authorization: Bearer admin"
```

### 步骤 12：测试过期校验（可选）

创建一个已过期的批次：

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Authorization: Bearer safety_officer" \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "'"${CHEM_ID}"'",
    "batch_number": "BATCH-EXPIRED-TEST",
    "production_date": "2020-01-15T00:00:00Z",
    "expiry_date": "2021-01-15T23:59:59Z",
    "initial_quantity": 100,
    "supplier": "测试"
  }'
```

尝试申请该批次：

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Authorization: Bearer user" \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "'"${CHEM_ID}"'",
    "batch_id": "<EXPIRED_BATCH_ID>",
    "quantity": 10,
    "purpose": "测试过期校验"
  }'
```

应返回过期相关的错误

### 步骤 13：运行自动化测试

```bash
npm test
```

## 错误处理

API 返回统一的错误格式：

```json
{
  "error": "错误类型",
  "message": "错误描述",
  "details": {
    "field": "具体字段"
  }
}
```

常见错误类型：
- `ValidationError`: 数据校验失败
- `PermissionError`: 权限不足
- `StockError`: 库存相关错误
- `ExpiryError`: 有效期相关错误
- `DangerLevelError`: 危险等级相关错误
- `DuplicateSubmitError`: 重复提交
- `StateMachineError`: 状态流转错误
- `NotFoundError`: 资源不存在

## 配置说明

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| PORT | 服务端口 | 3000 |
| DB_PATH | SQLite 数据库路径 | ./data/database.sqlite |
| LOW_STOCK_THRESHOLD | 低库存预警阈值 | 10 |
| EXPIRY_WARNING_DAYS | 过期预警提前天数 | 30 |

## 许可证

MIT License
