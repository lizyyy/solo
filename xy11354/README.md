# 园区安保系统 - 访客预约、临时车牌、黑名单核验一体化平台

## 项目简介

本系统针对一线园区安保主管的实际需求，解决了访客预约、临时车牌、黑名单核验三个系统数据分散、门岗容易放错人的问题。系统实现了数据统一导入、智能核验、人工复核、脱敏导出的全流程管理。

## 核心特性

- **统一数据导入**: 支持CSV格式批量导入访客、临时车牌、黑名单数据
- **智能核验**: 自动核验身份信息，实时拦截黑名单人员/车辆
- **人工复核**: 支持单人/批量复核，自动拦截黑名单记录
- **敏感数据脱敏**: API返回、导出文件、日志记录全程脱敏处理
- **本地持久化**: SQLite数据库，重启服务数据不丢失
- **操作留痕**: 完整的操作日志和核验历史记录

## 技术栈

- Node.js + Express
- SQLite (better-sqlite3)
- CSV解析/导出 (csv-parser, json2csv)
- 数据校验 (Joi)
- 日志管理 (winston)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 功能验证测试

```bash
npm test
```

该命令会执行完整的功能测试，包括：
- 数据库初始化
- 示例数据导入
- 敏感字段脱敏验证
- 复核功能测试
- 黑名单拦截测试
- 数据导出测试
- 数据持久化验证

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

## 核心操作流程

### 一、数据导入

#### 1. 导入访客预约数据

```bash
curl -X POST http://localhost:3000/api/import/visitor \
  -F "file=@data/sample_visitors_normal.csv"
```

**CSV文件格式**:
```csv
visitorName,phone,idCard,company,visitReason,visitDate,visitTimeStart,visitTimeEnd,visitedPerson,licensePlate
张三,13800138001,110101199001011234,科技有限公司,商务洽谈,2024-01-15,09:00,12:00,李经理,京A12345
```

#### 2. 导入临时车牌数据

```bash
curl -X POST http://localhost:3000/api/import/temporary-plate \
  -F "file=@data/sample_plates_normal.csv"
```

**CSV文件格式**:
```csv
plateNumber,vehicleType,ownerName,ownerPhone,validStartDate,validEndDate,issueReason
临A10001,轿车,陈车主,13900139001,2024-01-15,2024-01-20,施工车辆
```

#### 3. 导入黑名单数据

```bash
curl -X POST http://localhost:3000/api/import/blacklist \
  -F "file=@data/sample_blacklist.csv"
```

**CSV文件格式**:
```csv
type,name,phone,idCard,licensePlate,reason,level
person,危险人员A,13999999999,110101199000000001,,多次强行闯卡,high
```

#### 4. 查看导入批次

```bash
# 查看所有批次
curl http://localhost:3000/api/import/batches

# 查看特定批次详情
curl http://localhost:3000/api/import/batch/1
```

### 二、数据复核

#### 1. 查看待复核列表

```bash
# 查看所有待复核
curl http://localhost:3000/api/review/pending

# 只查看待复核访客
curl "http://localhost:3000/api/review/pending?type=visitor"

# 只查看待复核车牌
curl "http://localhost:3000/api/review/pending?type=temporary_plate"
```

#### 2. 单条复核

```bash
# 复核访客（自动拦截黑名单）
curl -X POST http://localhost:3000/api/review/visitor/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","remark":"信息核实无误"}'

# 复核临时车牌
curl -X POST http://localhost:3000/api/review/temporary-plate/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","remark":"手续齐全"}'
```

**复核状态说明**:
- `approved`: 通过（如遇黑名单会自动拒绝）
- `rejected`: 拒绝

#### 3. 批量复核

```bash
curl -X POST http://localhost:3000/api/review/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "type": "visitor",
    "ids": [1, 2, 3],
    "status": "approved",
    "remark": "批量审核通过"
  }'
```

**自动拦截机制**: 复核时系统会自动检查黑名单，黑名单人员/车辆会被自动拒绝并记录原因。

#### 4. 查看已复核列表

```bash
# 查看已通过访客
curl "http://localhost:3000/api/review/list/visitor?reviewStatus=approved"

# 查看已拒绝访客
curl "http://localhost:3000/api/review/list/visitor?reviewStatus=rejected"
```

#### 5. 添加到黑名单

```bash
curl -X POST http://localhost:3000/api/review/add-blacklist \
  -H "Content-Type: application/json" \
  -d '{
    "type": "visitor",
    "targetId": 1,
    "reason": "发现可疑行为",
    "level": "normal"
  }'
```

### 三、门岗核验

#### 1. 核验访客（手机号）

```bash
curl -X POST http://localhost:3000/api/verify/visitor \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800138001",
    "gateNumber": "东门1号岗",
    "checkDate": "2024-01-15"
  }'
```

**返回说明**:
```json
{
  "success": true,
  "data": {
    "isAllowed": true,        // 是否放行
    "isInBlacklist": false,   // 是否在黑名单
    "verifyResult": "核验通过，访客: 张*",  // 核验结果
    "visitors": [...]         // 匹配的访客记录（已脱敏）
  }
}
```

#### 2. 核验车辆（车牌）

```bash
curl -X POST http://localhost:3000/api/verify/license-plate \
  -H "Content-Type: application/json" \
  -d '{
    "plateNumber": "京A12345",
    "gateNumber": "北门车场入口",
    "checkDate": "2024-01-15"
  }'
```

#### 3. 核验黑名单（身份证）

```bash
curl -X POST http://localhost:3000/api/verify/id-card \
  -H "Content-Type: application/json" \
  -d '{
    "idCard": "110101199001011234",
    "gateNumber": "正门岗"
  }'
```

#### 4. 查看核验历史

```bash
# 全部记录
curl http://localhost:3000/api/verify/history

# 黑名单拦截记录
curl "http://localhost:3000/api/verify/history?isInBlacklist=true"

# 按日期范围查询
curl "http://localhost:3000/api/verify/history?startDate=2024-01-01&endDate=2024-01-31"
```

#### 5. 核验统计

```bash
curl http://localhost:3000/api/verify/statistics
```

### 四、数据导出

#### 1. 导出访客数据

```bash
# 导出全部访客（自动脱敏）
curl http://localhost:3000/api/export/visitors

# 按日期导出
curl "http://localhost:3000/api/export/visitors?visitDate=2024-01-15"

# 只导出已通过复核的
curl "http://localhost:3000/api/export/visitors?reviewStatus=approved"
```

#### 2. 导出临时车牌数据

```bash
curl http://localhost:3000/api/export/temporary-plates
```

#### 3. 导出黑名单数据

```bash
curl http://localhost:3000/api/export/blacklist
```

#### 4. 导出核验记录

```bash
# 导出所有核验记录
curl http://localhost:3000/api/export/verify-records

# 只导出拦截记录
curl "http://localhost:3000/api/export/verify-records?isAllowed=false"
```

#### 5. 查看导出文件列表

```bash
curl http://localhost:3000/api/export/files
```

#### 6. 下载导出文件

```bash
# 替换为实际的文件名
curl -O "http://localhost:3000/api/export/download/visitors_2024-01-15_xxx.csv"
```

## 敏感数据脱敏说明

系统在以下环节自动进行敏感字段脱敏：

### 1. API返回
- 手机号: `138****8001`
- 身份证号: `110101********1234`
- 姓名: `张*`
- 车牌号: `京A***45`

### 2. 导出文件
导出的CSV文件默认进行脱敏处理，保护个人隐私。

### 3. 日志记录
系统日志中的敏感字段会自动脱敏，防止信息泄露。

### 4. 管理员权限
管理员角色可查看完整信息（需在代码中配置用户角色）。

## 数据持久化验证

系统使用SQLite数据库，所有数据会持久化到 `data/security.db` 文件。

**验证方法**:
1. 运行 `npm test` 导入测试数据
2. 查看数据库记录数
3. 重启服务后再次运行 `npm test`
4. 确认数据不会丢失（记录数持续增加而非重置）

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── config/
│   │   ├── database.js        # 数据库配置
│   │   └── logger.js          # 日志配置
│   ├── models/
│   │   ├── init.js            # 数据库初始化
│   │   ├── Visitor.js         # 访客模型
│   │   ├── TemporaryPlate.js  # 临时车牌模型
│   │   ├── Blacklist.js       # 黑名单模型
│   │   ├── ImportBatch.js     # 导入批次模型
│   │   └── VerifyRecord.js    # 核验记录模型
│   ├── services/
│   │   ├── ImportService.js   # 导入服务
│   │   ├── VerifyService.js   # 核验服务
│   │   ├── ReviewService.js   # 复核服务
│   │   └── ExportService.js   # 导出服务
│   ├── routes/
│   │   ├── import.js          # 导入路由
│   │   ├── verify.js          # 核验路由
│   │   ├── review.js          # 复核路由
│   │   └── export.js          # 导出路由
│   └── utils/
│       └── mask.js            # 脱敏工具
├── data/
│   ├── sample_visitors_normal.csv   # 正常访客示例
│   ├── sample_visitors_error.csv    # 异常访客示例
│   ├── sample_plates_normal.csv     # 临时车牌示例
│   ├── sample_blacklist.csv         # 黑名单示例
│   ├── exports/                     # 导出文件目录
│   └── security.db                  # SQLite数据库文件
├── logs/                            # 日志目录
├── uploads/                         # 上传临时目录
├── tests/
│   └── verify.js                    # 功能测试脚本
├── package.json
└── README.md
```

## 数据库表结构

### 核心表
1. **visitors**: 访客预约记录
2. **temporary_plates**: 临时车牌记录
3. **blacklist**: 黑名单记录
4. **import_batches**: 导入批次记录
5. **verify_records**: 核验历史记录
6. **operation_logs**: 操作日志（预留）

## 测试用例

### 正常场景
1. 导入正常访客数据 → 全部导入成功
2. 复核正常访客 → 通过
3. 核验已通过的访客 → 放行
4. 核验正常车牌 → 放行
5. 导出数据 → 文件正常生成

### 异常场景
1. 导入缺失必填字段的数据 → 验证失败
2. 复核黑名单人员 → 自动拒绝
3. 核验黑名单手机号 → 拦截
4. 核验黑名单车牌 → 拦截
5. 非管理员查看数据 → 自动脱敏

## 常见问题

### Q: 重启服务后数据会丢失吗？
A: 不会。系统使用SQLite数据库，所有数据持久化存储在 `data/security.db` 文件中。

### Q: 如何清理测试数据？
A: 删除 `data/security.db` 文件，重启服务会自动重建数据库。

### Q: 导出的CSV文件在哪里？
A: 默认导出到 `data/exports/` 目录。

### Q: 如何查看系统日志？
A: 日志文件保存在 `logs/` 目录下，包含 `error.log` 和 `combined.log`。

## 许可证

MIT
