# 校车调度员乱账治理系统

解决家长申诉、GPS轨迹和司机打卡对不上的核心痛点，实现快速自动对账和责任判定。

## ✨ 核心功能

- **数据导入**: 支持批量导入司机、车辆、学生、打卡记录、GPS轨迹、家长申诉
- **自动对账**: 智能匹配申诉、GPS、打卡数据，自动计算时间差
- **规则引擎**: 内置迟到判定、GPS与打卡时间比对等规则
- **人工复核**: 支持对账结果人工审核，记录审核意见
- **数据导出**: CSV格式导出，敏感字段自动脱敏
- **敏感脱敏**: API返回、导出文件、日志全链路脱敏
- **本地持久化**: SQLite数据库，重启数据不丢失
- **操作日志**: 完整记录所有操作历史

## 📁 项目结构

```
├── src/
│   ├── app.js                    # 主程序入口
│   ├── config/
│   │   ├── database.js           # 数据库配置
│   │   └── logger.js             # 日志配置
│   ├── dao/                      # 数据访问层
│   │   ├── baseDAO.js            # 基础数据DAO
│   │   ├── reconciliationDAO.js  # 对账相关DAO
│   │   └── recordDAO.js          # 记录相关DAO
│   ├── services/                 # 业务逻辑层
│   │   ├── importService.js      # 数据导入服务
│   │   ├── reconciliationService.js # 对账服务
│   │   └── exportService.js      # 数据导出服务
│   ├── utils/
│   │   └── maskSensitive.js      # 敏感字段脱敏工具
│   ├── routes/
│   │   └── api.js                # API路由
│   └── scripts/                  # 命令行脚本
│       ├── importData.js         # 数据导入脚本
│       ├── exportData.js         # 数据导出脚本
│       └── testFlow.js           # 完整流程测试
├── sample_data/                  # 样例数据
│   ├── drivers.csv
│   ├── buses.csv
│   ├── students.csv
│   ├── checkins.csv
│   ├── gps_tracks.csv
│   └── complaints.csv
├── data/                         # 数据库文件 (运行时生成)
├── exports/                      # 导出文件 (运行时生成)
├── logs/                         # 日志文件 (运行时生成)
└── package.json
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后会显示:
```
╔══════════════════════════════════════════════════════════════╗
║           校车调度员乱账治理系统已启动                          ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:3000                              ║
║  健康检查: http://localhost:3000/api/health                   ║
║  数据统计: http://localhost:3000/api/stats                    ║
╚══════════════════════════════════════════════════════════════╝
```

### 3. 导入样例数据

新开一个终端，运行:

```bash
npm run import
```

会依次导入所有样例数据（司机、车辆、学生、打卡、GPS、申诉）。

### 4. 运行完整流程测试

```bash
npm run test
```

测试脚本会自动完成:
- 查看系统统计
- 自动对账所有申诉
- 查看对账记录列表
- 查看对账详情
- 人工复核对账记录
- 导出对账结果CSV
- 查看最终统计

## 📋 详细操作指南

### 数据导入

#### 方式1: 使用命令行脚本

```bash
# 导入所有样例数据
node src/scripts/importData.js
```

#### 方式2: 使用API接口

```bash
# 导入司机数据
curl -X POST -F "file=@sample_data/drivers.csv" \
  http://localhost:3000/api/import/driver?operator=admin

# 导入车辆数据
curl -X POST -F "file=@sample_data/buses.csv" \
  http://localhost:3000/api/import/bus?operator=admin

# 导入学生数据
curl -X POST -F "file=@sample_data/students.csv" \
  http://localhost:3000/api/import/student?operator=admin

# 导入打卡数据
curl -X POST -F "file=@sample_data/checkins.csv" \
  http://localhost:3000/api/import/checkin?operator=admin

# 导入GPS数据
curl -X POST -F "file=@sample_data/gps_tracks.csv" \
  http://localhost:3000/api/import/gps?operator=admin

# 导入申诉数据
curl -X POST -F "file=@sample_data/complaints.csv" \
  http://localhost:3000/api/import/complaint?operator=admin
```

### 自动对账

#### 方式1: API自动对账所有待处理申诉

```bash
curl -X POST http://localhost:3000/api/reconciliation/auto?operator=admin
```

#### 方式2: 查看对账列表

```bash
# 获取所有对账记录
curl http://localhost:3000/api/reconciliation

# 按状态筛选
curl "http://localhost:3000/api/reconciliation?status=pending_review"

# 按日期范围筛选
curl "http://localhost:3000/api/reconciliation?startDate=2026-05-01&endDate=2026-05-31"
```

#### 方式3: 查看对账详情

```bash
curl http://localhost:3000/api/reconciliation/{reconciliation_id}
```

### 人工复核

```bash
curl -X POST http://localhost:3000/api/reconciliation/{reconciliation_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "result": "late_confirmed",
    "responsibility": "driver",
    "notes": "经核对GPS和打卡数据，确认为司机迟到",
    "reviewedBy": "zhang_admin"
  }'
```

**状态说明**:
- `pending_review`: 待审核
- `approved`: 已通过
- `rejected`: 已驳回
- `need_more_info`: 需要更多信息

**结果类型**:
- `normal`: 正常，无问题
- `late_confirmed`: 确认迟到
- `data_mismatch`: 数据不一致
- `no_gps_data`: 无GPS数据
- `no_checkin_data`: 无打卡数据

**责任方**:
- `none`: 无责任
- `driver`: 司机责任
- `dispatcher`: 调度责任
- `to_review`: 待审核判定

### 数据导出

#### 方式1: 使用命令行脚本

```bash
# 列出所有导出文件
node src/scripts/exportData.js list

# 导出对账记录
node src/scripts/exportData.js reconciliation

# 导出申诉记录
node src/scripts/exportData.js complaint

# 导出打卡记录 (指定日期范围)
node src/scripts/exportData.js checkin 2026-05-01 2026-05-31

# 导出GPS轨迹 (指定车辆和日期)
node src/scripts/exportData.js gps BUS001 2026-05-18

# 导出所有数据
node src/scripts/exportData.js all
```

#### 方式2: 使用API接口

```bash
# 导出对账记录
curl "http://localhost:3000/api/export/reconciliation?operator=admin"

# 导出申诉记录
curl "http://localhost:3000/api/export/complaint?operator=admin"

# 导出打卡记录
curl "http://localhost:3000/api/export/checkin?startDate=2026-05-01&endDate=2026-05-31&operator=admin"

# 查看导出文件列表
curl http://localhost:3000/api/export/files

# 下载导出文件
curl -O http://localhost:3000/api/export/download/{filename}
```

### 查看数据

```bash
# 查看系统统计
curl http://localhost:3000/api/stats

# 查看申诉列表
curl http://localhost:3000/api/complaint

# 查看打卡列表
curl http://localhost:3000/api/checkin

# 查看GPS轨迹
curl http://localhost:3000/api/gps
```

## 📊 样例数据说明

### 正常场景

- **BUS001 (司机: 张明)**: 准时到达，GPS与打卡时间一致
- 申诉STU001: 系统判定为正常

### 异常场景1: 迟到

- **BUS003 (司机: 王强)**: 5月19日打卡时间 08:15，GPS到达 08:00
- 申诉STU005: 系统判定迟到，责任方为司机

### 异常场景2: 数据不匹配

- **BUS002 (司机: 李华)**: 5月19日打卡 07:55，GPS到达 07:40
- 申诉STU004: 系统判定数据不匹配，需人工复核

## 🔒 敏感字段脱敏

系统在以下层面自动处理敏感字段:

### 脱敏字段

- **姓名**: 张*、李*明
- **手机号**: 138****5678
- **身份证号**: 310101********1234
- **邮箱**: j**@example.com

### 脱敏范围

1. **API返回数据**: 所有接口返回的敏感字段自动脱敏
2. **导出文件**: CSV导出文件中的敏感字段自动脱敏
3. **系统日志**: 日志记录中的敏感信息自动脱敏

## 💾 数据持久化

### 数据库位置

```
data/database.db
```

### 数据表

1. **drivers**: 司机信息
2. **buses**: 车辆信息
3. **students**: 学生信息
4. **driver_checkins**: 司机打卡记录
5. **gps_tracks**: GPS轨迹
6. **parent_complaints**: 家长申诉
7. **reconciliation_records**: 对账记录
8. **import_batches**: 导入批次
9. **operation_logs**: 操作日志

重启服务后，所有历史数据均可正常查询。

## 📝 对账规则说明

### 1. 迟到判定规则

- **阈值**: 10分钟
- 司机打卡时间 - 预计到达时间 > 10分钟 → 判定为迟到

### 2. GPS与打卡比对规则

- **距离阈值**: 500米内认为到达学校
- **时间差阈值**: 30分钟
- GPS到达时间与打卡时间相差 > 30分钟 → 判定为数据不匹配

### 3. 责任判定规则

| 情况 | 结果 | 责任方 |
|------|------|--------|
| 时间一致 | normal | none |
| 打卡迟到10分钟以上 | late_confirmed | driver |
| GPS与打卡相差30分钟以上 | data_mismatch | to_review |
| 无GPS数据 | no_gps_data | to_review |
| 无打卡数据 | no_checkin_data | to_review |

## 🔧 API 接口汇总

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/stats | 数据统计 |

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/driver | 导入司机数据 |
| POST | /api/import/bus | 导入车辆数据 |
| POST | /api/import/student | 导入学生数据 |
| POST | /api/import/checkin | 导入打卡数据 |
| POST | /api/import/gps | 导入GPS数据 |
| POST | /api/import/complaint | 导入申诉数据 |

### 对账管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reconciliation/auto | 自动对账所有申诉 |
| GET | /api/reconciliation | 获取对账列表 |
| GET | /api/reconciliation/:id | 获取对账详情 |
| POST | /api/reconciliation/:id/review | 人工复核 |

### 数据查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/complaint | 获取申诉列表 |
| GET | /api/checkin | 获取打卡列表 |
| GET | /api/gps | 获取GPS轨迹 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/reconciliation | 导出对账记录 |
| GET | /api/export/complaint | 导出申诉记录 |
| GET | /api/export/checkin | 导出打卡记录 |
| GET | /api/export/files | 查看导出文件列表 |
| GET | /api/export/download/:filename | 下载导出文件 |

## 📖 常见问题

### Q: 如何验证数据是否持久化？

A: 导入数据后重启服务，调用 `/api/stats` 查看统计数据，如果数据仍然存在说明持久化正常。

### Q: 敏感字段在哪里进行脱敏？

A: 脱敏逻辑在 `src/utils/maskSensitive.js` 中实现，在以下地方调用:
- API返回: `maskForResponse()`
- 导出文件: `maskForExport()`
- 日志记录: `maskForLog()`

### Q: 如何修改对账规则？

A: 修改 `src/services/reconciliationService.js` 中的 `RECONCILIATION_RULES` 对象。

### Q: 导出的CSV文件在哪里？

A: 导出文件保存在 `exports/` 目录下。

### Q: 日志文件在哪里查看？

A: 日志文件保存在 `logs/` 目录下:
- `error.log`: 错误日志
- `combined.log`: 所有日志

## 🤝 技术栈

- **Node.js**: 运行环境
- **Express**: Web框架
- **SQLite3**: 数据库
- **Multer**: 文件上传
- **csv-parser**: CSV解析
- **json2csv**: CSV导出
- **Winston**: 日志记录