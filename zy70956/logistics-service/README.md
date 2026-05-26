# 后勤服务中心 - 宿舍维修评分记录管理系统

一套完整的后端服务，用于管理宿舍维修报修记录、维修工信息、评分记录，支持可追踪的全链路操作审计。

## 技术栈

- **运行时**: Node.js 16+
- **框架**: Express 4.x
- **数据库**: MongoDB (Mongoose ODM)
- **数据解析**: csv-parse, csv-writer

## 快速开始

### 1. 安装依赖

```bash
cd logistics-service
npm install
```

### 2. 启动 MongoDB

```bash
# 使用 Docker（推荐）
docker run -d -p 27017:27017 --name mongodb mongo:5

# 或使用本地 MongoDB
mongod --dbpath /data/db
```

### 3. 启动服务

```bash
npm start
# 服务运行在 http://localhost:3000
```

### 4. 健康检查

```bash
curl http://localhost:3000/api/health
```

## 数据模型

### RepairRequest（报修记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| requestId | String | 报修单号，唯一 |
| batchId | String | 所属批次号 |
| building | String | 宿舍楼栋 |
| room | String | 房间号 |
| repairType | String | 报修类型（水电/土木/暖通/电子/综合） |
| description | String | 报修内容 |
| reporter | String | 报修人 |
| reportedAt | Date | 报修时间 |
| assignedWorkerId | String | 指派维修工号 |
| status | String | 状态（待处理/已派单/处理中/已完成/已退回/已关闭） |
| isDuplicate | Boolean | 是否重复报修 |
| duplicateOf | String | 重复参照单号 |
| duplicateReason | String | 重复原因 |

### Worker（维修工）

| 字段 | 类型 | 说明 |
|------|------|------|
| workerId | String | 工号，唯一 |
| name | String | 姓名 |
| trade | String | 工种（水电/土木/暖通/电子/综合） |
| phone | String | 联系电话 |
| team | String | 班组 |
| status | String | 状态（在岗/休假/停岗） |

### Rating（评分记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| ratingId | String | 评分单号，唯一 |
| requestId | String | 关联报修单号 |
| workerId | String | 被评维修工号 |
| score | Number | 评分（1-5） |
| comment | String | 评价内容 |
| ratedBy | String | 评分人 |
| ratedAt | Date | 评分时间 |
| isMalicious | Boolean | 是否恶意评分 |
| maliciousReason | String | 恶意原因 |
| maliciousHandledBy | String | 处理人 |
| maliciousHandledAt | Date | 处理时间 |
| hasAppeal | Boolean | 是否有申诉 |
| appealStatus | String | 申诉状态（无/待审核/通过/驳回） |

### Appeal（申诉记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| appealId | String | 申诉单号，唯一 |
| ratingId | String | 关联评分单号 |
| appellant | String | 申诉人 |
| appellantRole | String | 申诉人角色 |
| appealReason | String | 申诉理由 |
| appealStatus | String | 状态（待审核/通过/驳回） |
| reviewReason | String | 审核意见 |
| reviewedBy | String | 审核人 |
| reviewedAt | Date | 审核时间 |

### ProcessLog（处理日志）

**每条操作都会记录以下信息，确保可追踪：**

| 字段 | 类型 | 说明 |
|------|------|------|
| logId | String | 日志ID |
| targetType | String | 操作对象类型（RepairRequest/Rating/Batch/Appeal） |
| targetId | String | 操作对象ID |
| action | String | 操作类型（导入/派单/完成/退回/标记重复/超时罚分/申诉等） |
| reason | String | 操作原因 |
| operator | String | 操作人 |
| operatedAt | Date | 操作时间 |
| oldStatus | String | 变更前状态 |
| newStatus | String | 变更后状态 |
| metadata | Mixed | 附加元数据 |

## API 接口

所有写操作需通过 `x-operator` 请求头提供操作人标识。

### 批次管理

#### 新增批次
```
POST /api/batch/create
Content-Type: application/json
x-operator: admin

{
  "batchType": "报修记录",
  "fileName": "repair_requests.csv",
  "content": "报修单号,宿舍楼栋,房间号,报修类型,报修内容,报修人,联系电话,报修时间\nBX202605001,1号楼,101,水电,水龙头漏水严重,张三,13800000001,2026-05-20 09:30:00",
  "importedBy": "admin"
}
```

#### 确认批次入库
```
POST /api/batch/confirm
x-operator: admin

{
  "batchId": "uuid-here"
}
```

#### 作废批次
```
POST /api/batch/void
x-operator: admin

{
  "batchId": "uuid-here"
}
```

#### 查询批次列表
```
GET /api/batch?batchType=报修记录&importStatus=待确认&page=1&limit=20
```

#### 查询批次详情
```
GET /api/batch/:batchId
```

### 报修记录管理

#### 派单
```
POST /api/repair/assign
x-operator: admin

{
  "requestId": "BX202605001",
  "workerId": "W001",
  "reason": "根据工种匹配派单"
}
```

#### 标记处理中
```
POST /api/repair/process
x-operator: admin

{
  "requestId": "BX202605001",
  "reason": "维修工到场开始处理"
}
```

#### 标记完成
```
POST /api/repair/complete
x-operator: admin

{
  "requestId": "BX202605001",
  "reason": "维修完成，用户确认"
}
```

#### 退回修改
```
POST /api/repair/return
x-operator: admin

{
  "requestId": "BX202605001",
  "reason": "需要补充报修材料"
}
```

#### 关闭记录
```
POST /api/repair/close
x-operator: admin

{
  "requestId": "BX202605001",
  "closedReason": "用户自行解决"
}
```

#### 查询报修详情
```
GET /api/repair/:requestId
```

#### 查询报修操作日志
```
GET /api/repair/:requestId/logs
```

#### 查询报修列表
```
GET /api/repair?status=已完成&building=1号楼&workerId=W001&page=1&limit=20
```

### 维修工管理

#### 查询维修工列表
```
GET /api/worker?trade=水电&status=在岗
```

#### 查询维修工详情
```
GET /api/worker/:workerId
```

#### 更新维修工信息
```
PUT /api/worker
x-operator: admin

{
  "workerId": "W001",
  "phone": "13999999999"
}
```

### 评分管理

#### 创建评分
```
POST /api/rating/create
x-operator: admin

{
  "ratingId": "PF202605001",
  "requestId": "BX202605001",
  "workerId": "W001",
  "score": 5,
  "comment": "修得很满意",
  "ratedBy": "张三",
  "ratedAt": "2026-05-21T10:00:00Z"
}
```

#### 标记恶意评分
```
POST /api/rating/mark-malicious
x-operator: admin

{
  "ratingId": "PF202605009",
  "maliciousReason": "短时间内连续给同一维修工低分"
}
```

#### 取消恶意标记
```
POST /api/rating/unmark-malicious
x-operator: admin

{
  "ratingId": "PF202605009",
  "reason": "经核实评分真实有效"
}
```

#### 检查恶意评分模式
```
POST /api/rating/check-malicious

{
  "ratedBy": "张三",
  "startTime": "2026-05-21T00:00:00Z",
  "endTime": "2026-05-22T00:00:00Z"
}
```

#### 查询评分详情
```
GET /api/rating/:ratingId
```

#### 按报修单查询评分
```
GET /api/rating/by-request/:requestId
```

#### 按维修工查询评分
```
GET /api/rating/by-worker/:workerId?excludeMalicious=true
```

### 申诉管理

#### 提交申诉
```
POST /api/appeal/submit
x-operator: admin

{
  "ratingId": "PF202605007",
  "appellant": "陈师傅",
  "appellantRole": "维修工",
  "appealReason": "用户对维修范围理解有误"
}
```

#### 审核申诉
```
POST /api/appeal/review
x-operator: admin

{
  "appealId": "uuid-here",
  "decision": "通过",
  "reviewReason": "经核实，评分确实不客观"
}
```

#### 查询申诉列表
```
GET /api/appeal?appealStatus=待审核&page=1&limit=20
```

#### 查询申诉详情
```
GET /api/appeal/:appealId
```

### 历史查询与导出

#### 按楼栋查询维修记录
```
GET /api/query/building/:building?status=已完成&startDate=2026-05-01&endDate=2026-05-31
```

#### 导出楼栋维修记录
```
GET /api/query/building/:building/export
x-operator: admin
# 返回 CSV 文件下载
```

#### 按维修工查询
```
GET /api/query/worker/:workerId
```

#### 导出维修工记录
```
GET /api/query/worker/:workerId/export
x-operator: admin
```

#### 按申诉状态查询
```
GET /api/query/appeal/:appealStatus
```

#### 导出申诉记录
```
GET /api/query/appeal/:appealStatus/export
x-operator: admin
```

#### 查询所有楼栋列表
```
GET /api/query/buildings
```

#### 全链路追踪
```
GET /api/query/trace/:recordType/:recordId
# recordType: RepairRequest | Rating | Appeal | Batch
```

### 异常处理

#### 标记重复报修
```
POST /api/exception/duplicate/mark
x-operator: admin

{
  "requestId": "BX202605006",
  "duplicateOf": "BX202605001",
  "duplicateReason": "同一房间同一报修类型，时间间隔过短"
}
```

#### 取消重复标记
```
POST /api/exception/duplicate/unmark
x-operator: admin

{
  "requestId": "BX202605006",
  "reason": "经核实为独立报修事件"
}
```

#### 扫描重复报修
```
POST /api/exception/duplicate/scan

{
  "building": "1号楼",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31"
}
```

#### 超时罚分
```
POST /api/exception/overtime/penalize
x-operator: admin

{
  "requestId": "BX202605001",
  "penaltyReason": "超出标准处理时长"
}
```

#### 扫描超时记录
```
GET /api/exception/overtime/scan
```

#### 异常汇总
```
GET /api/exception/summary
```

### 报告生成

#### 生成维修明细报告
```
POST /api/report/repair
x-operator: admin

{
  "building": "1号楼",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "status": "已完成"
}
```

#### 生成评分汇总报告
```
POST /api/report/rating
x-operator: admin

{
  "workerId": "W001",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "excludeMalicious": true
}
```

#### 生成综合报告
```
POST /api/report/comprehensive
x-operator: admin

{
  "building": "1号楼",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31"
}
```

#### 查询报告详情
```
GET /api/report/:reportId
```

#### 报告全链路追踪（从单条明细到最终报告）
```
GET /api/report/:reportId/trace
```

#### 导出报告数据
```
GET /api/report/:reportId/export
x-operator: admin
```

#### 查询报告列表
```
GET /api/report?reportType=综合报告&page=1&limit=20
```

## 核心特性说明

### 1. 可追踪记录

**每条操作（新增、修改、退回、关闭、标记异常等）都会在 ProcessLog 中留存以下信息：**

- 操作类型和原因
- 操作人标识
- 精确操作时间
- 状态变更前后值
- 附加元数据（如超时时长、罚分分数等）

**查询操作日志：**
```bash
# 查询单条报修记录的完整操作链
curl http://localhost:3000/api/repair/BX202605001/logs

# 全链路追踪任意记录
curl http://localhost:3000/api/query/trace/RepairRequest/BX202605001
```

### 2. 重复报修处理

系统支持：
- 手动标记重复报修，记录原因、处理人、时间
- 自动扫描潜在重复（同楼栋+同房间+同类型+内容相似度>70%+时间间隔<24h）
- 取消重复标记，恢复正常处理流程

### 3. 超时罚分机制

- 默认超时阈值：**48 小时**（从派单到完成）
- 系统每小时自动扫描超时记录并记录日志
- 手动触发罚分时记录超时时长、阈值、罚分分数

### 4. 恶意评分识别

- 检测频率：同一用户 1 小时内评分超过 5 次
- 检测间隔：两次评分间隔小于 60 秒
- 检测模式：连续 3 条以上 1-2 分低分
- 标记恶意评分时记录原因和处理人
- 支持申诉流程

### 5. 服务重启恢复

- 启动时自动检查：待确认批次、处理中记录状态
- 所有状态数据持久化在 MongoDB，重启后可按任意维度查询历史
- 定时任务在重启后自动恢复运行（每小时扫描一次）

### 6. 导出与查询一致性

- 导出的记录数量与查询结果严格一致
- 导出操作本身也会记录到 ProcessLog 中（包含文件名和记录数）

### 7. 全链路追踪

```
报修单条明细 → 操作日志 → 评分记录 → 申诉记录 → 综合报告
     ↓           ↓           ↓           ↓           ↓
  ProcessLog  ProcessLog  ProcessLog  ProcessLog  ProcessLog
```

通过 `GET /api/report/:reportId/trace` 接口可获取从报告汇总到单条明细的完整追踪数据。

## 示例数据

示例数据文件位于 `samples/` 目录：

- `repair_requests.csv` - 10 条报修记录（含 1 条重复）
- `workers.json` - 7 名维修工信息
- `ratings.csv` - 10 条评分记录（含 2 条恶意评分）

## 配置说明

配置项可通过环境变量覆盖：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| MONGODB_URI | mongodb://localhost:27017/logistics_service | MongoDB 连接串 |
