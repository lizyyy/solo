# 🏥 住院床位管理与追踪系统

为住院处护士长设计的后端服务系统，用于床位管理、患者流转追踪、保洁工单管理等。

## ✨ 核心功能

### 📥 数据导入
- **床位表CSV导入** - 批量导入床位信息
- **患者流转JSON导入** - 导入患者转科记录
- **保洁工单导入** - 批量创建清洁任务

### 📋 记录处理
- **新增批次** - 支持批量导入和处理
- **标记处理** - 处理患者转科申请
- **批准/驳回** - 审核记录状态
- **退回修改** - 要求补充材料

### ⚠️ 特殊情况检测
- **转科锁床** - 自动锁定目标床位
- **清洁超时** - 检测保洁工单是否超时
- **重复占床** - 防止床位被重复占用

### 📊 历史查询与导出
- 按**病区床位**查询历史记录
- 按**保洁接单**查询工单状态
- 按**患者转归**查询流转记录
- 导出数量与查询结果一致

### 🔍 审计追踪
- 单条明细完整追踪链路
- 操作历史全程可追溯
- 处理原因清晰记录

## 🚀 快速开始

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
开发模式（自动重启）：
```bash
npm run dev
```

服务将运行在 `http://localhost:3000`

## 📁 项目结构

```
.
├── src/
│   ├── models/          # 数据模型
│   │   ├── BedModel.js
│   │   ├── PatientModel.js
│   │   ├── PatientTransferModel.js
│   │   ├── CleaningOrderModel.js
│   │   ├── BatchModel.js
│   │   ├── TrackingRecordModel.js
│   │   └── OperationLogModel.js
│   ├── services/        # 业务服务
│   │   ├── ImportService.js
│   │   ├── BusinessService.js
│   │   └── ExportService.js
│   ├── routes/          # API路由
│   │   ├── import.js
│   │   ├── records.js
│   │   └── export.js
│   ├── utils/           # 工具类
│   │   └── db.js
│   ├── scripts/         # 脚本
│   │   └── initDB.js
│   └── server.js        # 主服务器
├── examples/            # 示例数据
├── data/                # SQLite数据库
├── uploads/             # 上传文件目录
└── test/                # 测试脚本
```

## 🔌 API接口

### 导入接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/beds` | 导入床位CSV |
| POST | `/api/import/patient-transfers` | 导入患者流转JSON |
| POST | `/api/import/cleaning-orders` | 导入保洁工单 |

### 记录处理接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/records/process-transfer` | 处理患者转科 |
| POST | `/api/records/:id/approve` | 批准记录 |
| POST | `/api/records/:id/reject` | 驳回记录 |
| POST | `/api/records/:id/send-back` | 退回修改 |
| GET | `/api/records/:id` | 查询记录详情 |
| GET | `/api/records/:id/audit-trail` | 审计追踪（纯文本） |
| GET | `/api/records/` | 查询记录列表（支持筛选） |
| GET | `/api/records/check-timeout` | 检查超时工单 |

### 导出接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/records` | 导出追踪记录（CSV/JSON） |
| GET | `/api/export/beds` | 导出床位状态 |
| GET | `/api/export/cleaning-orders` | 导出保洁工单 |
| GET | `/api/export/patient-outcome` | 导出患者转归 |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/` | API文档首页 |

## 📝 使用示例

### 1. 导入床位CSV
```bash
curl -X POST -F "file=@examples/beds_sample.csv" -F "handler=张护士长" http://localhost:3000/api/import/beds
```

### 2. 导入患者流转
```bash
curl -X POST -F "file=@examples/patient_transfers_sample.json" -F "handler=张护士长" http://localhost:3000/api/import/patient-transfers
```

### 3. 处理患者转科
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "transfer_id": "TF001",
  "handler": "李护士长",
  "remarks": "患者情况稳定"
}' http://localhost:3000/api/records/process-transfer
```

### 4. 批准记录
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "handler": "王主任",
  "reason": "材料齐全，符合转科条件"
}' http://localhost:3000/api/records/REC-xxx/approve
```

### 5. 退回修改
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "handler": "王主任",
  "reason": "缺少检查报告，请补充后重新提交"
}' http://localhost:3000/api/records/REC-xxx/send-back
```

### 6. 导出记录
```bash
curl -o records.csv http://localhost:3000/api/export/records?ward=内科一病区
```

### 7. 查看审计追踪
```bash
curl http://localhost:3000/api/records/REC-xxx/audit-trail
```

### 8. 检查清洁超时工单
```bash
curl http://localhost:3000/api/records/check-timeout
```

## 💡 重要说明

### 记录编号使用
系统支持两种方式标识追踪记录：
- **对外记录编号**（推荐使用）：格式为 `REC-YYYYMMDDHHmmss-NNN`（如 `REC-20260520062132-194`）
- **数据库ID**：数字格式（如 `11`）

所有接口（查询详情、批准、驳回、退回修改、审计追踪）均支持这两种格式。

## 🔧 数据模型

### 追踪记录状态
- `pending` - 待处理
- `processing` - 处理中
- `pending_review` - 待审核（有异常情况）
- `approved` - 已批准
- `rejected` - 已驳回
- `send_back` - 退回修改

### 记录类型
- `bed_import` - 床位导入
- `patient_transfer` - 患者转科
- `cleaning_timeout` - 保洁超时

## 🧪 运行测试
```bash
node test/test_flow.js
```

## 💡 技术栈
- **框架**: Express.js
- **数据库**: SQLite3
- **数据处理**: csv-parser, json2csv
- **日期处理**: Moment.js
- **跨域支持**: CORS

## 📋 注意事项

1. 数据库文件位于 `data/hospital.db`，重启服务后数据不会丢失
2. 上传的文件存储在 `uploads/` 目录
3. 所有操作都会记录操作人和原因，全程可追溯
4. 保洁工单超时检测需要定期调用检查接口

---

**为住院处护士长提供透明、可追溯的床位管理服务 ✅**
