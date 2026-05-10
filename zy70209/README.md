# 母乳库冻存批次追踪 API

医院母乳库管理系统的核心 API，专门解决捐赠、检测、冻存和发放全流程中的**批次混淆风险**问题。

## 项目特色

- **闭环追踪**: 从捐赠登记 → 检测结果 → 冻存批次 → 发放核验 → 召回追溯，完整业务链路
- **状态机约束**: 严格的状态转换规则，防止非法操作
- **幂等性保证**: 重复请求不会写乱状态
- **批次追溯**: 一键追溯任意批次的完整生命周期，包括影响的受者
- **风险评估**: 自动检测批次风险等级
- **关键逻辑可验证**: 所有判断逻辑在测试、接口响应和命令输出中明确体现

## 技术栈

- **Node.js** + **Express.js**: API 服务框架
- **better-sqlite3**: 轻量级嵌入式数据库
- **Jest** + **Supertest**: 自动化测试
- **UUID**: 全局唯一标识

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务启动后访问：
- 服务地址: http://localhost:3000
- 健康检查: http://localhost:3000/health
- API 说明: http://localhost:3000/

### 4. 运行测试

```bash
npm test
```

### 5. 运行主流程演示

**先启动服务**，然后在另一个终端运行：

```bash
npm run demo
```

### 6. 运行异常操作演示

**先启动服务**，然后在另一个终端运行：

```bash
npm run demo-errors
```

## 业务闭环

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  捐赠登记   │────▶│  检测结果   │────▶│  冻存批次   │
│  pending    │     │  自动评估   │     │  frozen     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        ▼                      ▼                      ▼
                ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
                │  发放登记   │        │  库存报表   │        │  召回追溯   │
                │  核验确认   │        │  风险评估   │        │  受者追踪   │
                └─────────────┘        └─────────────┘        └─────────────┘
```

## 核心数据模型

### 捐赠 (Donations)

| 字段 | 说明 |
|------|------|
| id | 唯一标识 |
| donor_id | 捐赠人 ID |
| donation_date | 捐赠日期 |
| quantity_ml | 捐赠量 (ml) |
| status | 状态 |
| notes | 备注 |

**状态流转**:
```
pending_test → test_passed → frozen → distributed → recalled
         ↘          ↘           ↘
          test_failed  withdrawn  recalled
```

### 检测结果 (Test Results)

- **关键检测类型** (必须全部阴性才能冻存):
  - `hiv` - 艾滋病毒
  - `htlv` - 人类嗜T淋巴细胞病毒
  - `hbsag` - 乙肝表面抗原
  - `syphilis` - 梅毒
  - `bacterial_culture` - 细菌培养
  - `cytomegalovirus` - 巨细胞病毒 (可选)

- **检测结果**: `negative` (阴性) | `positive` (阳性) | `inconclusive` (不确定)

### 冻存批次 (Frozen Batches)

| 字段 | 说明 |
|------|------|
| batch_code | 批次号 (BM-日期-捐赠人-序号) |
| volume_ml | 总容量 |
| container_type | 容器类型 |
| container_count | 容器数量 |
| freezer_location | 冰箱位置 |
| status | 状态 |

**批次状态**:
- `frozen` - 在库
- `partial_distributed` - 部分发放
- `fully_distributed` - 全部发放
- `recalled` - 已召回
- `expired` - 已过期
- `discarded` - 已废弃

### 发放记录 (Distribution Records)

| 字段 | 说明 |
|------|------|
| recipient_id | 受者 ID |
| containers_used | 使用容器数 |
| verification_status | 核验状态 |

**核验状态**: `pending` | `verified` | `failed`

## API 接口

### 捐赠管理

```bash
# 登记捐赠
POST /api/donations
Body: { donorId, donationDate, quantityMl, notes? }

# 查询捐赠列表
GET /api/donations?donorId=&status=

# 查询捐赠详情
GET /api/donations/:id
GET /api/donations/:id/details

# 更新状态
PATCH /api/donations/:id/status
Body: { status, reason? }

# 撤回捐赠
POST /api/donations/:id/withdraw
Body: { reason }
```

### 检测管理

```bash
# 录入检测结果
POST /api/tests
Body: { donationId, testType, result, testDate, testedBy?, notes? }

# 查询检测结果
GET /api/tests/:id
GET /api/tests/donation/:donationId

# 更新检测结果
PATCH /api/tests/:id
Body: { result?, testDate?, testedBy?, notes?, status? }

# 取消检测
POST /api/tests/:id/cancel
Body: { reason }

# 获取检测类型枚举
GET /api/tests/types
```

### 冻存批次

```bash
# 创建批次
POST /api/batches
Body: { donationId, containerType, containerCount, freezerLocation, freezerLevel? }

# 查询批次列表
GET /api/batches?status=&freezerLocation=&batchCode=

# 查询批次详情
GET /api/batches/:id
GET /api/batches/:id/details

# 按批次号查询
GET /api/batches/code/:batchCode

# 批次追溯 (核心功能)
GET /api/batches/:id/traceability

# 更新批次状态
PATCH /api/batches/:id/status
Body: { status, reason? }

# 获取状态枚举
GET /api/batches/statuses

# 库存概览
GET /api/batches/inventory
```

### 发放与召回

```bash
# 发放登记
POST /api/distribution/distribute
Body: { batchId, recipientId, containersUsed, verifiedBy?, notes? }

# 查询发放记录
GET /api/distribution/distributions/:id
GET /api/distribution/distributions/batch/:batchId
GET /api/distribution/distributions/recipient/:recipientId

# 核验发放
POST /api/distribution/distributions/:id/verify
Body: { verifiedBy, notes? }

# 核验失败
POST /api/distribution/distributions/:id/fail
Body: { reason, notes? }

# 发起召回
POST /api/distribution/recalls
Body: { batchId, reason, recalledQuantity?, recalledContainers?, notes? }

# 查询召回记录
GET /api/distribution/recalls/:id
GET /api/distribution/recalls/batch/:batchId

# 更新召回状态
PATCH /api/distribution/recalls/:id/status
Body: { status, recalledQuantity?, recalledContainers?, notes? }

# 捐赠发放汇总
GET /api/distribution/donation-summary/:donationId
```

### 报表

```bash
# 库存总览报表
GET /api/reports/inventory

# 批次详细报告 (含风险评估)
GET /api/reports/batch/:batchId

# 捐赠追溯报告
GET /api/reports/donation-trace/:donationId

# 受者历史报告
GET /api/reports/recipient-history/:recipientId
```

## 幂等性使用

在请求头中添加 `x-request-id` 即可获得幂等性保证：

```bash
curl -X POST http://localhost:3000/api/donations \
  -H "Content-Type: application/json" \
  -H "x-request-id: req-20260510-001" \
  -d '{
    "donorId": "DONOR001",
    "donationDate": "2026-05-10",
    "quantityMl": 200
  }'
```

相同的 `x-request-id` + 相同接口的重复请求，只会执行一次，后续返回首次结果。

## 关键判断逻辑验证

### 1. 检测合格才能冻存

**接口响应中体现**:
```json
{
  "success": false,
  "error": "该捐赠未通过所有必要检测，无法冻存",
  "code": "CREATE_FAILED"
}
```

**测试验证**: 运行 `npm test` 查看 "冻存批次测试" 用例

**命令输出**: 运行 `npm run demo-errors` 查看 "三、冻存批次异常"

### 2. 同一检测类型不能重复录入

**接口响应中体现**:
```json
{
  "success": true,
  "data": {
    "id": "首次创建的ID",
    "result": "negative"
  },
  "message": "该捐赠的 hiv 检测已存在，返回已有记录"
}
```

**测试验证**: "检测流程测试" → "同一捐赠的同一检测类型不能重复录入"

### 3. 发放不能超库存

**接口响应中体现**:
```json
{
  "error": "发放数量超出可用库存。可用: 1, 申请: 10",
  "code": "DISTRIBUTE_FAILED"
}
```

**命令输出**: "四、发放核验异常" → "发放超过库存的数量"

### 4. 幂等性保证

**命令输出**: "六、幂等性演示" 会显示：
```
第一次请求 ID: xxx
第二次请求 ID: xxx  ← 相同
该捐赠人实际记录数: 1  ← 只创建了一条
验证: ✓ 正确 (幂等性生效)
```

### 5. 状态转换约束

**接口响应中体现**:
```json
{
  "error": "无法从 frozen 转换到 test_passed",
  "code": "STATUS_UPDATE_FAILED"
}
```

**测试验证**: 测试中大量验证状态转换的非法路径

## 样例数据说明

本项目通过以下方式提供可运行的数据示例：

### 方式 1: 运行主流程演示
```bash
npm start
# 另开终端
npm run demo
```
这会创建完整的演示数据，包括：
- 1 条捐赠记录
- 5 条检测记录（全部阴性）
- 2 个冻存批次
- 2 条发放记录
- 1 条召回记录

### 方式 2: 运行异常演示
```bash
npm run demo-errors
```
这会演示各种异常场景的系统响应。

### 方式 3: 通过 API 自行创建
参考 `demo/main-flow.js` 中的请求示例。

## 项目结构

```
.
├── server.js              # 服务入口
├── package.json
├── db/
│   ├── connection.js      # 数据库连接
│   └── init.js            # 初始化脚本
├── middleware/
│   └── idempotent.js      # 幂等性中间件
├── services/              # 业务逻辑层
│   ├── donationService.js
│   ├── testService.js
│   ├── batchService.js
│   ├── distributionService.js
│   └── reportService.js
├── routes/                # API 路由
│   ├── donations.js
│   ├── tests.js
│   ├── batches.js
│   ├── distribution.js
│   └── reports.js
├── tests/                 # 自动化测试
│   └── business-logic.test.js
└── demo/                  # 演示脚本
    ├── main-flow.js       # 主流程演示
    └── error-cases.js     # 异常操作演示
```

## 风险控制亮点

### 批次混淆风险防范

1. **唯一批次号**: `BM-YYYYMMDD-DONOR-XXX` 格式，一眼可辨
2. **关联绑定**: 批次与捐赠、检测、发放、召回强关联
3. **追溯接口**: `/api/batches/:id/traceability` 一键追溯完整链路
4. **受者追踪**: 召回时自动列出所有影响的受者

### 数据一致性

1. **状态机**: 严格的状态转换规则
2. **自动评估**: 检测结果自动更新捐赠状态
3. **级联更新**: 发放/召回自动更新批次和捐赠状态
4. **幂等性**: 重复请求安全

## License

MIT
