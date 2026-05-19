# 民宿运营台账系统

一个完整的民宿运营管理后端服务，整合了房态管理、保洁记录、客诉处理、返工跟踪和结算扣款功能。

## 功能特性

### 📊 数据导入与校验
- **房态CSV导入**: 支持批量导入每日房态数据
- **保洁记录JSON导入**: 支持批量导入保洁工作记录
- **智能数据校验**: 坏数据不吞掉，保留原始位置、错误原因和修改建议
- **导入批次管理**: 完整记录每次导入的批次信息

### 🔄 工作流状态管理
- **保洁状态流转**: pending → in_progress → completed → needs_rework → closed
- **客诉状态流转**: open → processing → resolved / escalated
- **返工状态流转**: pending → assigned → completed → verified
- **自动关联扣款**: 客诉和返工自动关联扣款规则

### 🔒 敏感字段脱敏
- **API响应脱敏**: 客人姓名、手机号等敏感字段自动脱敏
- **导出文件脱敏**: Excel导出文件中敏感信息自动处理
- **日志脱敏**: 系统日志中的手机号自动脱敏

### 📈 报告与结算
- **结算报告生成**: 按时间段统计保洁、返工、客诉和扣款
- **按保洁员统计**: 每人工作量、返工率、客诉率和扣款总额
- **Excel导出**: 支持导出结算报表为Excel文件
- **扣款规则管理**: 可配置不同类型的扣款金额

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **语言**: TypeScript
- **数据库**: SQLite (文件数据库，无需额外服务)
- **数据校验**: Joi
- **日志**: Winston
- **Excel导出**: SheetJS (xlsx)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件（可选，使用默认值即可）：

```env
PORT=3000
DB_PATH=./data/homestay.db
UPLOAD_PATH=./uploads
LOG_LEVEL=info
```

### 3. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

## 使用指南

### 📥 数据导入

#### 导入房态CSV

正常数据导入：
```bash
curl -X POST -F "file=@samples/room-states.csv" http://localhost:3000/import/room-state
```

测试错误数据校验：
```bash
curl -X POST -F "file=@samples/room-states-with-errors.csv" http://localhost:3000/import/room-state
```

**CSV字段说明**:
| 字段 | 格式 | 说明 |
|------|------|------|
| roomNumber | 字母+数字或纯数字 | 房间号，如101、A101 |
| date | YYYY-MM-DD | 日期 |
| status | occupied/vacant/reserved/maintenance | 房态 |
| guestName | 字符串 | 客人姓名（可选） |
| guestPhone | 11位手机号 | 客人电话（可选） |
| checkInDate | YYYY-MM-DD | 入住日期（可选） |
| checkOutDate | YYYY-MM-DD | 离店日期（可选） |
| source | 字符串 | 订单来源（可选） |

#### 导入保洁记录JSON

正常数据导入：
```bash
curl -X POST -F "file=@samples/cleaning-records.json" http://localhost:3000/import/cleaning
```

测试错误数据校验：
```bash
curl -X POST -F "file=@samples/cleaning-records-with-errors.json" http://localhost:3000/import/cleaning
```

**JSON字段说明**:
| 字段 | 格式 | 说明 |
|------|------|------|
| roomNumber | 字母+数字或纯数字 | 房间号 |
| cleanerName | 字符串 | 保洁员姓名 |
| cleanerPhone | 11位手机号 | 保洁员电话（可选） |
| scheduledDate | YYYY-MM-DD | 计划保洁日期 |
| startTime | HH:MM | 开始时间（可选） |
| endTime | HH:MM | 结束时间（可选） |
| status | pending/in_progress/completed/needs_rework/closed | 状态 |
| qualityScore | 0-100 | 质量评分（可选） |
| remarks | 字符串 | 备注（可选） |

### 🔍 查询导入记录

查看所有导入批次：
```bash
curl http://localhost:3000/import/batches
```

查看某个批次详情：
```bash
curl http://localhost:3000/import/batch/{BATCH_ID}
```

只查看错误记录：
```bash
curl "http://localhost:3000/import/batch/{BATCH_ID}?isValid=false"
```

### 🏠 房态与保洁查询

查询房态：
```bash
curl http://localhost:3000/room-states
curl "http://localhost:3000/room-states?date=2024-01-15"
```

查询保洁记录：
```bash
curl http://localhost:3000/cleanings
curl "http://localhost:3000/cleanings?startDate=2024-01-01&endDate=2024-01-31"
```

### 🔄 工作流操作

更新保洁状态：
```bash
curl -X PATCH http://localhost:3000/cleanings/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "needs_rework", "remarks": "卫生间清洁不达标"}'
```

创建客诉：
```bash
curl -X POST http://localhost:3000/complaints \
  -H "Content-Type: application/json" \
  -d '{
    "cleaningId": 1,
    "category": "cleanliness",
    "description": "卫生间有异味，地面有头发",
    "guestName": "张三",
    "guestPhone": "13800138001"
  }'
```

创建返工记录：
```bash
curl -X POST http://localhost:3000/reworks \
  -H "Content-Type: application/json" \
  -d '{
    "cleaningId": 1,
    "reworkReason": "卫生间清洁不达标",
    "reworkerName": "张阿姨",
    "reworkDate": "2024-01-16"
  }'
```

完成返工验证：
```bash
curl -X PATCH http://localhost:3000/reworks/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "verified", "verificationRemarks": "返工合格，已验证"}'
```

### 📊 报告与结算

生成结算报告：
```bash
curl "http://localhost:3000/report/settlement?startDate=2024-01-01&endDate=2024-01-31"
```

导出Excel结算报表：
```bash
curl -O -J "http://localhost:3000/report/settlement/export?startDate=2024-01-01&endDate=2024-01-31"
```

查看扣款规则：
```bash
curl http://localhost:3000/deduction-rules
```

## API 接口总览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /import/room-state | 导入房态CSV |
| POST | /import/cleaning | 导入保洁JSON |
| GET | /import/batches | 获取所有导入批次 |
| GET | /import/batch/:batchId | 获取批次详情 |
| GET | /room-states | 查询房态 |
| GET | /cleanings | 查询保洁记录 |
| PATCH | /cleanings/:id/status | 更新保洁状态 |
| POST | /complaints | 创建客诉 |
| GET | /complaints | 查询客诉 |
| PATCH | /complaints/:id/status | 更新客诉状态 |
| POST | /reworks | 创建返工记录 |
| GET | /reworks | 查询返工记录 |
| PATCH | /reworks/:id/status | 更新返工状态 |
| GET | /report/settlement | 生成结算报告 |
| GET | /report/settlement/export | 导出Excel结算报表 |
| GET | /deduction-rules | 获取扣款规则 |

## 数据校验规则

### 房态校验
- ✅ 房间号必须是数字或字母+数字格式（如101、A101）
- ✅ 日期必须是YYYY-MM-DD格式
- ✅ 状态必须是 occupied/vacant/reserved/maintenance 之一
- ✅ 手机号必须是11位有效手机号
- ✅ 入住日期不能晚于离店日期

### 保洁记录校验
- ✅ 房间号格式验证
- ✅ 保洁员姓名不能为空
- ✅ 计划日期格式验证
- ✅ 开始/结束时间必须是HH:MM格式
- ✅ 开始时间不能晚于结束时间
- ✅ 质量评分必须在0-100之间
- ✅ 状态必须是预设枚举值之一

## 状态流转图

### 保洁状态
```
pending → in_progress → completed → needs_rework → in_progress → completed → closed
                 ↓                         ↓
              closed                     closed
```

### 客诉状态
```
open → processing → resolved
        ↓
    escalated → resolved
```

### 返工状态
```
pending → assigned → completed → verified
```

## 项目结构

```
.
├── src/
│   ├── index.ts              # 主入口文件
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── database/
│   │   ├── index.ts          # 数据库连接
│   │   └── schema.ts         # 数据库Schema
│   ├── validation/
│   │   └── schemas.ts        # Joi校验规则
│   ├── import/
│   │   └── engine.ts         # 导入引擎
│   ├── workflow/
│   │   └── state.ts          # 状态管理
│   ├── security/
│   │   └── masking.ts        # 脱敏处理
│   └── report/
│       └── generator.ts      # 报告生成
├── samples/
│   ├── room-states.csv              # 正常房态样例
│   ├── room-states-with-errors.csv  # 含错误的房态样例
│   ├── cleaning-records.json        # 正常保洁样例
│   └── cleaning-records-with-errors.json # 含错误的保洁样例
├── data/                    # 数据库文件目录
├── logs/                    # 日志文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 常见问题

### Q: 导入的数据有错误怎么办？
A: 系统不会丢弃错误数据，每条记录都会保留：
- 原始数据（rawData）
- 错误原因列表（errors）
- 修改建议列表（suggestions）
- 是否有效标记（isValid）
- 所在行号（rowNumber）

### Q: 敏感信息会泄露吗？
A: 不会。系统在三层都做了脱敏：
1. API响应返回时自动脱敏姓名和手机号
2. Excel导出文件中的姓名自动脱敏
3. 日志文件中的手机号自动脱敏

### Q: 扣款是自动计算的吗？
A: 是的。当客诉解决或返工验证完成时，系统会根据预设的扣款规则自动计算扣款金额，并记录到结算报告中。

### Q: 数据库需要单独安装吗？
A: 不需要。使用SQLite文件数据库，系统会自动创建和初始化。

## License

MIT
