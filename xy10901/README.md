# 诊所检验样本交接 API

本地后端 API 服务，用于诊所检验样本的全流程交接管理，提供条码管理、采样记录、运输批次、接收窗口、拒收原因、补录审批和交接报告导出功能。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init-data
```

> ✅ `init-data` 脚本会自动创建所有数据库表并插入样例数据，无需先启动服务。

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

## 📋 核心业务规则

| 规则 | 说明 |
|------|------|
| **条码唯一性** | 条码必须唯一，重复条码创建将被拒绝 |
| **接收时限** | 支持配置接收窗口，非工作时间接收将被拒绝 |
| **拒收状态** | 样本可被拒收，需选择预设拒收原因 |
| **补录审批** | 交接记录修改需申请并审批通过后生效 |
| **异常日志** | 所有异常路径保存原始输入和处理结论 |

## 📦 数据模型

| 模型 | 说明 |
|------|------|
| `sample_barcodes` | 样本条码管理 |
| `sampling_records` | 采样记录 |
| `transport_batches` | 运输批次 |
| `batch_samples` | 批次样本关联 |
| `receiving_windows` | 接收窗口配置 |
| `rejection_reasons` | 拒收原因字典 |
| `transfer_records` | 交接记录 |
| `amendment_requests` | 补录审批申请 |
| `exception_logs` | 异常日志 |

## 🔌 API 接口文档

### 📌 创建类接口

#### 1. 创建样本条码

```bash
curl -X POST http://localhost:3000/api/barcodes \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "CLINIC-C-001",
    "sample_type": "血液",
    "patient_info": "孙八,男,45岁",
    "created_by": "周护士"
  }'
```

#### 2. 创建采样记录

```bash
curl -X POST http://localhost:3000/api/sampling \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "CLINIC-A-001",
    "sampling_time": "2024-01-15T09:30:00.000Z",
    "sampler": "李护士",
    "clinic_name": "城东社区诊所",
    "patient_name": "张三",
    "patient_id": "P001",
    "sample_type": "血液"
  }'
```

#### 3. 创建运输批次

```bash
curl -X POST http://localhost:3000/api/transport \
  -H "Content-Type: application/json" \
  -d '{
    "transporter": "陈司机",
    "departure_time": "2024-01-15T10:00:00.000Z",
    "origin_clinic": "城东社区诊所",
    "destination_lab": "中心检验室",
    "sample_barcodes": ["CLINIC-A-001", "CLINIC-A-002", "CLINIC-A-003"]
  }'
```

#### 4. 接收样本

```bash
curl -X POST http://localhost:3000/api/receive \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "CLINIC-A-001",
    "batch_code": "BATCH-2024-001",
    "receiver": "王检验员",
    "received_time": "2024-01-15T03:00:00.000Z",
    "receiving_lab": "中心检验室"
  }'
```

> **注意**：`received_time` 使用UTC时间。接收窗口校验按北京时间进行，例如 UTC 03:00 = 北京时间 11:00，在工作日 08:00-17:00 窗口内。

#### 5. 拒收样本

```bash
curl -X POST http://localhost:3000/api/reject \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "CLINIC-A-002",
    "rejection_reason_code": "BROKEN",
    "rejection_note": "样本管有轻微裂痕",
    "operator": "李检验员"
  }'
```

### 🔍 查询类接口

#### 1. 查询样本条码

```bash
# 全部
curl http://localhost:3000/api/barcodes

# 按状态过滤
curl "http://localhost:3000/api/barcodes?status=active"
```

#### 2. 查询采样记录

```bash
# 全部
curl http://localhost:3000/api/sampling

# 按条码查询
curl "http://localhost:3000/api/sampling?barcode=CLINIC-A-001"
```

#### 3. 查询运输批次

```bash
# 全部
curl http://localhost:3000/api/transport

# 查看批次内样本
curl http://localhost:3000/api/transport/{batchId}/samples
```

#### 4. 查询交接记录

```bash
# 全部
curl http://localhost:3000/api/transfers

# 按状态过滤
curl "http://localhost:3000/api/transfers?status=received"

# 查看已补录记录
curl "http://localhost:3000/api/transfers?is_amended=true"
```

#### 5. 查询拒收原因

```bash
curl http://localhost:3000/api/rejection-reasons
```

#### 6. 查询接收窗口

```bash
curl http://localhost:3000/api/receiving-windows
```

#### 7. 查询异常日志

```bash
# 全部异常
curl http://localhost:3000/api/exceptions

# 未处理异常
curl "http://localhost:3000/api/exceptions?resolved=false"
```

### ✏️ 补录审批接口

#### 1. 申请补录

```bash
curl -X POST http://localhost:3000/api/amendment \
  -H "Content-Type: application/json" \
  -d '{
    "transfer_record_id": "{交接记录ID}",
    "requester": "李护士",
    "requested_changes": {
      "receiver": "王检验员",
      "received_time": "2024-01-15T11:30:00.000Z"
    },
    "reason": "接收时间录入错误"
  }'
```

#### 2. 审批补录申请

```bash
curl -X POST http://localhost:3000/api/amendment/approve \
  -H "Content-Type: application/json" \
  -d '{
    "amendment_id": "{补录申请ID}",
    "approver": "张主任",
    "approval_notes": "情况属实，同意修改",
    "approved": true
  }'
```

#### 3. 查询补录申请

```bash
curl http://localhost:3000/api/amendments
```

### 📊 报告接口

#### 1. 查询交接报告

```bash
# 全部
curl http://localhost:3000/api/report

# 按时间范围
curl "http://localhost:3000/api/report?start_date=2024-01-01&end_date=2024-01-31"

# 按诊所
curl "http://localhost:3000/api/report?clinic_name=城东社区诊所"

# 按状态
curl "http://localhost:3000/api/report?status=received"
```

#### 2. 导出 CSV 报告

```bash
curl -o transfer_report.csv http://localhost:3000/api/report/export
```

## ❌ 坏数据路径测试

运行测试脚本验证异常处理：

```bash
npm run test-bad-data
```

测试内容包括：
- ✅ 重复条码创建（唯一性校验）
- ✅ 无效条码格式验证
- ✅ 采样记录使用不存在的条码
- ✅ 缺少必填字段的请求
- ✅ 运输批次空样本列表
- ✅ 非接收窗口时间的样本接收
- ✅ 无效拒收原因代码
- ✅ 补录申请不存在的交接记录
- ✅ 审批不存在的补录申请

所有异常都会：
1. 返回明确的错误信息
2. 保存原始输入到 `exception_logs` 表
3. 记录处理结论

## 🛠️ 开发模式

使用 nodemon 自动重启：

```bash
npm run dev
```

## 📁 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── middleware/
│   │   └── validation.js        # 验证中间件
│   ├── services/
│   │   ├── sampleService.js     # 核心业务逻辑
│   │   └── queryService.js      # 查询服务
│   ├── routes/
│   │   └── sampleRoutes.js      # API 路由
│   └── server.js                # 服务入口
├── scripts/
│   ├── initData.js              # 初始化样例数据
│   └── testBadData.js           # 坏数据路径测试
├── data/                        # SQLite 数据库文件
├── package.json
└── README.md
```

## 📝 预置样例数据

| 类型 | 数量 | 内容 |
|------|------|------|
| 拒收原因 | 5 | 标本破损、标本超时、信息缺失、类型错误、标本污染 |
| 接收窗口 | 2 | 工作日 08:00-17:00，周末 09:00-12:00 |
| 样本条码 | 5 | CLINIC-A-001 ~ CLINIC-B-002 |
| 采样记录 | 5 | 对应条码的采样信息 |
| 运输批次 | 1 | 包含城东诊所3个样本 |
