# 🏠 民宿运营后端系统

一个完整的民宿运营管理后端系统，解决保洁照片、客诉、返工和结算扣款全流程管理。

## ✨ 功能特性

- 📊 **保洁记录管理** - 保洁记录导入、查询、复核
- ⚠️ **异常自动识别** - 质量分过低、缺少照片自动标记
- 📋 **客诉管理** - 客诉登记、处理、扣款
- 🔄 **返工管理** - 返工记录、复核扣款
- 💰 **月度结算** - 自动计算保洁员月度结算
- 📁 **CSV导入导出** - 支持批量数据导入和报告导出
- 📝 **操作日志** - 所有操作都有记录可追溯
- 💾 **本地持久化** - SQLite数据库，数据不丢失

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据（可选）

```bash
npm run import-sample
```

### 4. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

## 📖 核心操作流程

### 📥 **导入保洁记录**

```bash
# 使用样例文件
curl -X POST -F "file=@samples/cleaning_records_with_issues.csv" \
     -F "imported_by=管理员" http://localhost:3000/api/import/cleaning

# 返回结果会区分正常和异常记录
```

**正常记录**: 数据完整且质量达标 → 自动设为 `approved` 状态
**异常记录**: 
- 数据缺失（房间号/保洁员/日期为空 → 导入失败
- 质量分<80 或 缺少照片 → 标记为 `pending` 待审核

### ✅ **复核保洁记录**

```bash
# 审核通过
curl -X POST -H "Content-Type: application/json" \
     -d '{"reviewer_name":"主管","status":"approved","issue_description":""}' \
     http://localhost:3000/api/cleaning/1/review

# 审核拒绝
curl -X POST -H "Content-Type: application/json" \
     -d '{"reviewer_name":"主管","status":"rejected","issue_description":"需重新清洁"}' \
     http://localhost:3000/api/cleaning/2/review
```

### 📋 **查询保洁记录**

```bash
# 查询所有
curl http://localhost:3000/api/cleaning

# 按负责人筛选
curl "http://localhost:3000/api/cleaning?cleaner_name=张三

# 按状态筛选
curl "http://localhost:3000/api/cleaning?status=pending"

# 按日期范围筛选
curl "http://localhost:3000/api/cleaning?start_date=2024-01-15&end_date=2024-01-20"

# 查看有问题的记录
curl "http://localhost:3000/api/cleaning?has_issue=1"

# 查看统计数据
curl http://localhost:3000/api/cleaning/stats
```

### 📤 **导出报告**

```bash
# 导出保洁记录CSV
curl -O http://localhost:3000/api/export/cleaning

# 按条件导出
curl -O "http://localhost:3000/api/export/cleaning?cleaner_name=张三&start_date=2024-01-01"

# 导出月度综合报告
curl "http://localhost:3000/api/export/monthly-report?month=2024-01"
```

### ⚠️ **客诉管理

```bash
# 登记客诉
curl -X POST -H "Content-Type: application/json" \
     -d '{
       "room_number":"101",
       "complaint_type":"卫生问题",
       "description":"卫生间有异味",
       "reporter_name":"客人",
       "handler_name":"张三"
     }" \
     http://localhost:3000/api/complaints

# 处理客诉
curl -X POST -H "Content-Type: application/json" \
     -d '{
       "handler_name":"客房主管",
       "status":"resolved",
       "handling_result":"已清洁",
       "deduction_amount":50
     }" \
     http://localhost:3000/api/complaints/1/handle
```

### 🔄 **返工管理**

```bash
# 登记返工
curl -X POST -H "Content-Type: application/json" \
     -d '{
       "room_number":"101",
       "original_cleaner":"张三",
       "reworker_name":"张三",
       "reason":"卫生间有污渍",
       "deduction_amount":20
     }" \
     http://localhost:3000/api/reworks

# 复核返工
curl -X POST -H "Content-Type: application/json" \
     -d '{
       "reviewer_name":"主管",
       "status":"completed",
       "deduction_amount":20
     }" \
     http://localhost:3000/api/reworks/1/review
```

### 💰 **月度结算**

```bash
# 生成结算数据
curl -X POST -H "Content-Type: application/json" \
     -d '{
       "settlement_month":"2024-01",
       "cleaner_name":"张三"
     }" \
     http://localhost:3000/api/settlements/generate

# 创建结算单
curl -X POST -H "Content-Type: application/json" \
     -d '{
       "settlement_month":"2024-01",
       "cleaner_name":"张三",
       "total_cleanings":5,
       "total_reworks":1,
       "total_complaints":0,
       "total_deduction":50,
       "final_amount":200
     }" \
     http://localhost:3000/api/settlements

# 批准结算
curl -X POST -H "Content-Type: application/json" \
     -d '{"reviewed_by":"财务主管"}' \
     http://localhost:3000/api/settlements/1/approve
```

### 📝 **查看操作日志**

```bash
# 查看所有日志
curl http://localhost:3000/api/logs

# 按模块筛选
curl "http://localhost:3000/api/logs?module=cleaning_records"
```

## 📁 样例数据说明

| 文件位置: `samples/` 目录

| 数据类型:

```
samples/
  ├── cleaning_records_normal.csv       # 正常记录样例
  └── cleaning_records_with_issues.csv # 含异常的样例
```

正常记录样例包含:
- 房间号、保洁员、日期完整
- 质量分达标
- 有照片链接

异常记录样例包含:
- 质量分过低(<80)
- 缺少照片
- 数据缺失
- 分数超出范围

## 🏗️ 项目结构

```
homestay-operation/
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── controllers/
│   │   ├── CleaningController.js   # 保洁记录控制器
│   │   ├── ComplaintController.js  # 客诉控制器
│   │   ├── ReworkController.js   # 返工控制器
│   │   ├── SettlementController.js # 结算控制器
│   │   ├── ImportController.js   # 导入控制器
│   │   └── ExportController.js   # 导出控制器
│   ├── models/
│   │   ├── CleaningRecord.js      # 保洁记录模型
│   │   ├── Complaint.js         # 客诉模型
│   │   ├── Rework.js            # 返工模型
│   │   ├── Settlement.js         # 结算模型
│   │   ├── Room.js             # 房间模型
│   │   ├── OperationLog.js      # 操作日志模型
│   │   └── ImportBatch.js      # 导入批次模型
│   ├── services/
│   │   ├── ImportService.js      # 导入服务
│   │   └── ExportService.js      # 导出服务
│   ├── routes/
│   │   └── index.js            # 路由定义
│   ├── scripts/
│   │   ├── initDB.js           # 数据库初始化脚本
│   │   └── importSampleData.js # 样例数据导入
│   └── server.js               # 服务器入口
├── samples/                       # 样例数据文件
├── data/                          # SQLite数据库文件目录
├── exports/                       # 导出文件目录
└── package.json
```

## 🔧 API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/cleaning | 导入保洁记录CSV |
| GET | /api/import/batches | 查看导入批次 |
| GET | /api/cleaning | 查询保洁记录 |
| POST | /api/cleaning | 创建保洁记录 |
| GET | /api/cleaning/stats | 保洁记录统计 |
| GET | /api/cleaning/:id | 获取单个记录 |
| PUT | /api/cleaning/:id | 更新保洁记录 |
| POST | /api/cleaning/:id/review | 复核保洁记录 |
| GET | /api/complaints | 查询客诉记录 |
| POST | /api/complaints | 创建客诉记录 |
| POST | /api/complaints/:id/handle | 处理客诉 |
| GET | /api/reworks | 查询返工记录 |
| POST | /api/reworks | 创建返工记录 |
| POST | /api/reworks/:id/review | 复核返工 |
| GET | /api/settlements | 查询结算记录 |
| POST | /api/settlements/generate | 生成结算数据 |
| POST | /api/settlements/:id/approve | 批准结算 |
| GET | /api/export/cleaning | 导出保洁记录 |
| GET | /api/export/complaints | 导出客诉记录 |
| GET | /api/export/reworks | 导出返工记录 |
| GET | /api/export/monthly-report | 生成月度报告 |
| GET | /api/logs | 查看操作日志 |

## 📊 异常处理逻辑

**保洁记录状态:
- ✅ approved: 正常记录，自动通过
- ⏳ pending: 待审核（质量分低/无照片/标记有问题）
- ❌ rejected: 审核拒绝

**客诉状态:
- ⏳ pending: 待处理
- 🔄 processing: 处理中
- ✅ resolved: 已解决

**返工状态:
- ⏳ pending: 待处理
- ✅ completed: 已完成

## 💾 数据持久化

所有数据存储在 `data/homestay.db` (SQLite)，包含表结构:

| 表名 | 说明 |
|------|------|
| rooms | 房间信息 |
| cleaning_records | 保洁记录 |
| complaints | 客诉记录 |
| reworks | 返工记录 |
| settlements | 结算记录 |
| operation_logs | 操作日志 |
| import_batches | 导入批次 |

重启服务或重新运行后，所有数据都会保留。

## 📋 操作日志记录

所有重要操作都会记录到 operation_logs 表，包含:
- 操作类型 (create/update/delete/review/import/export
- 操作模块
- 记录ID
- 操作人
- 操作时间
- 变更前后值 (JSON)
- IP地址

## 🎯 核心业务场景测试

```bash
# 完整流程测试
1. npm run init-db
2. npm run import-sample
3. npm start
4. curl http://localhost:3000/api/cleaning
5. curl "http://localhost:3000/api/cleaning?status=pending
6. curl -X POST ... 复核记录
7. curl http://localhost:3000/api/export/cleaning
```

## 📝 License

MIT