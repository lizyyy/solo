# 疫苗运输监控系统

疾控站周末借调车辆送疫苗的全流程监控系统，解决保温箱温度日志、交接签名和路线延误对不上的问题。

## 功能特性

- **数据导入**：支持导入箱体温度 CSV、车辆轨迹 JSON 和交接单
- **状态机管理**：维护箱体/批次/站点/责任人的完整状态流转
- **智能规则引擎**：自动判定
  - 温度断链（超温/低温累计）
  - 路线延误影响批次
  - 交接签名缺失
  - 链路中断

- **REST API**：提供完整的接口
  - 查询风险事件
  - 补录复核记录
  - 生成审计事件
  - 导出 Markdown/CSV/JSON 报告

## 项目结构

```
xy4286/
├── api/                    # REST API 层
│   ├── controllers.js      # 控制器
│   └── routes.js           # 路由定义
├── models/                 # 数据模型
│   ├── box.js              # 保温箱模型
│   ├── batch.js            # 疫苗批次模型
│   ├── station.js          # 站点模型
│   ├── responsiblePerson.js # 责任人模型
│   ├── temperatureLog.js   # 温度日志模型
│   ├── vehicleTrajectory.js # 车辆轨迹模型
│   ├── handoverForm.js     # 交接单模型
│   ├── riskEvent.js        # 风险事件模型
│   ├── auditEvent.js       # 审计事件模型
│   ├── review.js           # 复核记录模型
│   └── stateMachine.js     # 状态机核心
├── repositories/           # 数据访问层
│   ├── baseRepository.js   # 基础仓库类
│   └── index.js            # 各实体仓库
├── storage/                # 存储层
│   ├── fileStore.js        # 文件存储实现
│   └── index.js            # 存储导出
├── rules/                  # 规则引擎
│   ├── engine.js           # 规则引擎核心
│   └── index.js            # 规则导出
├── import_export/          # 导入导出模块
│   ├── importer.js         # 导入功能
│   ├── exporter.js         # 导出功能
│   └── index.js            # 导入导出导出
├── sample_data/            # 示例数据
│   ├── seed.js             # 数据初始化脚本
│   ├── temperature_log_normal.csv    # 正常温度日志示例
│   ├── temperature_log_with_violation.csv  # 含异常的温度日志
│   └── vehicle_trajectory.json       # 车辆轨迹示例
├── tests/                  # 测试用例
│   └── unit/
│       ├── models.test.js  # 模型测试
│       └── rules.test.js   # 规则引擎测试
├── data/                   # 数据存储目录（运行时生成）
├── uploads/                # 上传文件目录（运行时生成）
├── config.js               # 配置文件
├── index.js                # 入口文件
├── package.json            # 依赖配置
└── README.md               # 本文档
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式（带热重载）
npm run dev

# 生产模式
npm start
```

服务启动后访问 http://localhost:3000

### 初始化示例数据

```bash
node sample_data/seed.js
```

## 核心概念

### 状态机

系统使用状态机管理各实体的生命周期：

#### 箱体状态
- `idle` - 闲置
- `in_transit` - 运输中
- `at_station` - 在站点
- `completed` - 已完成
- `maintenance` - 维护中

#### 批次状态
- `pending` - 待处理
- `in_transit` - 运输中
- `delivered` - 已送达
- `compromised` - 已受影响
- `rejected` - 已拒收

#### 交接单状态
- `pending` - 待处理
- `in_progress` - 处理中
- `completed` - 已完成
- `cancelled` - 已取消

### 风险类型

- `temperature_violation` - 温度异常（超温/低温）
- `delay` - 运输延误
- `signature_missing` - 签名缺失
- `chain_break` - 链路中断

### 严重程度

- `low` - 低
- `medium` - 中
- `high` - 高
- `critical` - 严重

## API 文档

### 健康检查

```bash
GET /health
```

### API 根路径

```bash
GET /api
```

### 数据导入

#### 导入温度 CSV

```bash
POST /api/import/temperature
Content-Type: multipart/form-data

Body:
- file: CSV 文件（必须包含 timestamp, temperature 列）
- boxId: 箱体 ID
```

CSV 格式示例：
```csv
timestamp,temperature,unit,source
2026-05-03T08:00:00,5,C,device
2026-05-03T08:05:00,5.2,C,device
```

#### 导入车辆轨迹 JSON

```bash
POST /api/import/trajectory
Content-Type: multipart/form-data

Body:
- file: JSON 文件
- batchId: 批次 ID（可选）
- boxId: 箱体 ID（可选）
```

JSON 格式示例：
```json
{
  "vehiclePlate": "京A-12345",
  "startTime": "2026-05-03T08:00:00",
  "endTime": "2026-05-03T09:30:00",
  "points": [
    {
      "latitude": 39.9042,
      "longitude": 116.4074,
      "timestamp": "2026-05-03T08:00:00"
    }
  ]
}
```

#### 导入交接单

```bash
POST /api/import/handover
Content-Type: application/json

Body:
{
  "formNumber": "HO-2026-05-001",
  "batchId": "batch-id",
  "boxId": "box-id",
  "fromStationId": "station-id",
  "toStationId": "station-id",
  "senderPersonId": "person-id",
  "receiverPersonId": "person-id",
  "handoffTime": "2026-05-03T08:00:00",
  "temperatureAtHandover": 5.2,
  "vehiclePlate": "京A-12345",
  "senderSignature": "sig-id",
  "receiverSignature": "sig-id"
}
```

### 风险事件

#### 查询风险列表

```bash
GET /api/risks?status=open&type=temperature_violation&batchId=xxx
```

查询参数：
- `status`: 状态筛选（open/in_review/resolved/dismissed）
- `type`: 类型筛选
- `batchId`: 批次 ID
- `severity`: 严重程度

#### 获取风险详情

```bash
GET /api/risks/:id
```

#### 获取风险汇总

```bash
GET /api/risks/summary?batchId=xxx
```

#### 解决风险

```bash
PUT /api/risks/:id/resolve
Content-Type: application/json

Body:
{
  "notes": "解决说明",
  "status": "resolved"  // 或 "dismissed"
}
```

### 复核记录

#### 创建复核记录

```bash
POST /api/reviews
Content-Type: application/json

Body:
{
  "riskEventId": "risk-id",
  "batchId": "batch-id",
  "boxId": "box-id",
  "type": "temperature_correction",
  "submittedBy": "person-id",
  "submittedByName": "张三",
  "title": "温度异常复核",
  "description": "温度异常原因说明...",
  "evidence": ["证据1", "证据2"],
  "correctionData": {
    "correctedTemperature": 5.0
  }
}
```

复核类型：
- `temperature_correction` - 温度修正
- `signature_supplement` - 签名补录
- `delay_explanation` - 延误说明
- `chain_break_resolution` - 链路中断解决
- `other` - 其他

#### 查询复核列表

```bash
GET /api/reviews?status=pending&riskEventId=xxx
```

#### 获取复核详情

```bash
GET /api/reviews/:id
```

#### 批准复核

```bash
PUT /api/reviews/:id/approve
Content-Type: application/json

Body:
{
  "notes": "批准说明",
  "reviewerId": "reviewer-id",
  "reviewerName": "李四"
}
```

#### 驳回复核

```bash
PUT /api/reviews/:id/reject
Content-Type: application/json

Body:
{
  "notes": "驳回原因",
  "reviewerId": "reviewer-id",
  "reviewerName": "李四"
}
```

### 审计事件

#### 查询审计事件

```bash
GET /api/audit-events?entityType=batch&action=create&limit=100
```

### 报告导出

#### 导出 JSON

```bash
GET /api/export/json?batchId=xxx
```

#### 导出 CSV

```bash
GET /api/export/csv?batchId=xxx
```

#### 导出 Markdown

```bash
GET /api/export/markdown?batchId=xxx
```

### 实体管理

#### 批次

```bash
# 列表
GET /api/batches?state=in_transit&hasRisk=true

# 详情
GET /api/batches/:id

# 创建
POST /api/batches
Content-Type: application/json

# 更新
PUT /api/batches/:id
Content-Type: application/json

# 运行规则检查
POST /api/batches/run-rules
Content-Type: application/json
{
  "batchId": "xxx"  // 可选，不传则检查所有批次
}
```

#### 箱体

```bash
# 列表
GET /api/boxes?state=in_transit

# 详情
GET /api/boxes/:id

# 创建
POST /api/boxes
Content-Type: application/json

# 更新
PUT /api/boxes/:id
Content-Type: application/json
```

#### 站点

```bash
# 列表
GET /api/stations

# 详情
GET /api/stations/:id

# 创建
POST /api/stations
Content-Type: application/json

# 更新
PUT /api/stations/:id
Content-Type: application/json
```

#### 责任人

```bash
# 列表
GET /api/persons

# 详情
GET /api/persons/:id

# 创建
POST /api/persons
Content-Type: application/json

# 更新
PUT /api/persons/:id
Content-Type: application/json
```

#### 交接单

```bash
# 列表
GET /api/handover-forms?batchId=xxx

# 详情
GET /api/handover-forms/:id

# 发送方签名
POST /api/handover-forms/:id/sign-sender
Content-Type: application/json
{
  "signatureId": "sig-id",
  "personId": "person-id"
}

# 接收方签名
POST /api/handover-forms/:id/sign-receiver
Content-Type: application/json
{
  "signatureId": "sig-id",
  "personId": "person-id"
}
```

## 配置说明

配置文件 `config.js` 中的关键参数：

### 温度规则

```javascript
rules: {
  temperature: {
    min: 2,           // 最低温度 (°C)
    max: 8,           // 最高温度 (°C)
    maxOverTempDuration: 30,   // 最大允许超温时长 (分钟)
    maxUnderTempDuration: 30   // 最大允许低温时长 (分钟)
  },
  time: {
    maxDelayMinutes: 15  // 最大允许延误 (分钟)
  }
}
```

### 存储配置

```javascript
storage: {
  baseDir: './data',  // 数据存储目录
  collections: {
    boxes: 'boxes.json',
    batches: 'batches.json',
    // ...
  }
}
```

## 验证流程

### 步骤 1：安装并启动

```bash
npm install
npm start
```

验证服务是否正常：

```bash
curl http://localhost:3000/health
```

期望响应：
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

### 步骤 2：初始化示例数据

```bash
node sample_data/seed.js
```

### 步骤 3：创建测试数据

创建一个疫苗批次：

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "TEST-2026-001",
    "vaccineName": "测试疫苗",
    "quantity": 100,
    "manufacturer": "测试厂商",
    "expiryDate": "2027-12-31",
    "scheduledDepartureTime": "2026-05-03T08:00:00",
    "scheduledArrivalTime": "2026-05-03T09:00:00",
    "actualDepartureTime": "2026-05-03T08:00:00",
    "actualArrivalTime": "2026-05-03T09:30:00"
  }'
```

### 步骤 4：导入温度日志（含异常）

```bash
curl -X POST http://localhost:3000/api/import/temperature \
  -F "file=@sample_data/temperature_log_with_violation.csv" \
  -F "boxId=test-box-id"
```

### 步骤 5：创建交接单（签名缺失）

```bash
curl -X POST http://localhost:3000/api/import/handover \
  -H "Content-Type: application/json" \
  -d '{
    "formNumber": "TEST-HO-001",
    "batchId": "从步骤3获取的batchId",
    "senderSignature": "sig-sender-001"
  }'
```

### 步骤 6：运行规则检查

```bash
curl -X POST http://localhost:3000/api/batches/run-rules
```

### 步骤 7：查询风险事件

```bash
curl http://localhost:3000/api/risks?status=open
```

期望看到：
- 温度异常风险（如果导入了含异常的温度日志）
- 延误风险（实际到达时间比计划晚 30 分钟）
- 签名缺失风险（交接单缺少接收方签名）

### 步骤 8：查看风险汇总

```bash
curl http://localhost:3000/api/risks/summary
```

### 步骤 9：导出报告

```bash
# Markdown 格式
curl http://localhost:3000/api/export/markdown

# JSON 格式
curl http://localhost:3000/api/export/json
```

### 步骤 10：补录复核

创建复核记录：

```bash
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "riskEventId": "从步骤7获取的风险ID",
    "type": "delay_explanation",
    "submittedByName": "张三",
    "title": "延误原因说明",
    "description": "周末借调车辆不熟悉路线，导致延误20分钟"
  }'
```

批准复核：

```bash
curl -X PUT http://localhost:3000/api/reviews/复核ID/approve \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "情况属实，批准",
    "reviewerName": "李四"
  }'
```

### 步骤 11：解决风险

```bash
curl -X PUT http://localhost:3000/api/risks/风险ID/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "已完成复核，情况属实",
    "status": "resolved"
  }'
```

### 步骤 12：查看审计日志

```bash
curl http://localhost:3000/api/audit-events
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- tests/unit/models.test.js
```

## 数据存储

所有数据存储在 `./data` 目录下的 JSON 文件中：

- `boxes.json` - 保温箱数据
- `batches.json` - 疫苗批次数据
- `stations.json` - 站点数据
- `responsible_persons.json` - 责任人数据
- `temperature_logs.json` - 温度日志
- `vehicle_trajectories.json` - 车辆轨迹
- `handover_forms.json` - 交接单
- `risk_events.json` - 风险事件
- `audit_events.json` - 审计事件
- `reviews.json` - 复核记录

## 典型使用场景

### 场景 1：周末送疫苗后的风险排查

1. 导入保温箱温度日志 CSV
2. 导入车辆轨迹 JSON
3. 创建交接单（补录签名）
4. 运行规则检查
5. 查看风险事件
6. 导出报告供追责使用

### 场景 2：日常监控

1. 实时导入温度日志
2. 系统自动检测异常
3. 风险事件实时告警
4. 责任人及时处理
5. 生成审计记录

### 场景 3：事后审计

1. 按批次查询所有相关数据
2. 查看温度历史、轨迹、交接记录
3. 检查风险事件和处理记录
4. 导出完整的审计报告

## 注意事项

1. 本系统为本地运行的纯后端服务，数据存储在本地 JSON 文件
2. 生产环境建议替换为数据库（MySQL/PostgreSQL/MongoDB）
3. 温度规则和延误阈值可在 `config.js` 中调整
4. 所有操作均有审计记录，可追溯

## 许可证

MIT License
