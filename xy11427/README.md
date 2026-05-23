# 园区访客通行重试补偿队列 API

## 项目概述

本系统解决园区访客通行异常单的后台可信度问题，通过统一事实视图、重试补偿队列、脏记录分类等机制，确保访客预约表、闸机记录、临时车牌截图、客服备注、人工意见等数据能够对得上。

## 核心特性

### 🎯 统一事实视图
- **幂等性保证**：重复请求只能更新同一条事实，不会悄悄多算
- **跨源关联**：预约+闸机+车牌截图自动关联到同一事实记录
- **操作历史**：所有修改都有完整的审计追踪

### 📋 重试补偿队列
- **外部回执提交** → **排队** → **限次重试** → **人工接管** → **补偿入账** → **关闭**
- **指数退避重试**：1分钟→5分钟→15分钟→30分钟→60分钟
- **默认5次重试**：超过次数自动转入死信队列

### 🔍 脏记录分类
- **缺字段**：缺少必填字段的记录
- **跨日**：跨日期不一致的记录
- **改名**：姓名/字段变更不一致
- **冲突**：金额/数量/字段值冲突
- **车牌不匹配**：预约车牌与识别车牌不一致

### 👮 安保主管视图
- **可重试分类**统计
- **死信处理**追踪
- **恢复后续跑**监控
- **不是一堆看不出来源的汇总数**

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init
```

### 3. 导入样例数据
```bash
npm run seed
```

### 4. 触发坏数据（可选）
```bash
npm run bad-data
```

### 5. 启动服务
```bash
npm start
```

服务启动后访问：http://localhost:3000

### 6. 生成报告
```bash
npm run report
```

### 7. 运行测试
```bash
npm test
```

## 本地完整演示流程

```bash
# 1. 初始化
npm run init

# 2. 导入正常样例
npm run seed

# 3. 生成各种坏数据（缺字段、跨日、改名、冲突、车牌不匹配）
npm run bad-data

# 4. 启动API服务
npm start

# 5. 人工修正脏记录（通过API）
#    POST /api/dirty/{dirtyRecordId}/handle

# 6. 生成安保主管报告
npm run report
```

## API 接口

### 数据接收
```
POST /api/receive/appointment   - 提交访客预约
POST /api/receive/gate-record   - 提交闸机记录
POST /api/receive/screenshot    - 提交车牌截图
```

### 事实查询
```
GET  /api/facts                 - 事实记录列表（支持分页、筛选）
GET  /api/facts/:factId         - 事实记录详情（含完整关联）
GET  /api/facts/appointment/:no - 通过预约号查询事实
```

### 补偿队列
```
GET  /api/queue/stats           - 队列统计
GET  /api/queue/next            - 获取待处理批次
POST /api/queue/:id/retry       - 执行重试
POST /api/queue/:id/complete    - 标记完成
POST /api/queue/:id/fail        - 标记失败
POST /api/queue/:id/manual      - 转人工处理
```

### 脏记录管理
```
GET  /api/dirty                 - 脏记录列表
GET  /api/dirty/stats           - 脏记录分类统计
POST /api/dirty/:id/handle      - 处理脏记录 (fix/ignore/handle)
```

### 死信队列
```
GET  /api/deadletter            - 死信列表
POST /api/deadletter/:id/recover - 从死信恢复
```

### 人工备注
```
POST /api/notes/fact/:factId    - 添加备注
GET  /api/notes/fact/:factId    - 查询备注
```

### 导出报告
```
GET  /api/export/facts          - 导出事实CSV
GET  /api/export/dirty-records  - 导出脏记录CSV
GET  /api/export/security-report - 生成安保主管报告
```

## 数据模型

### 核心表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| visitor_appointments | 访客预约表 | appointment_no, visitor_name, visit_date |
| gate_records | 闸机记录表 | record_no, pass_time, license_plate |
| license_plate_screenshots | 车牌截图表 | screenshot_no, capture_time, confidence |
| fact_records | 事实记录表（统一视图） | fact_id, consistency_score, data_sources |
| compensation_queue | 补偿队列 | queue_id, retry_count, next_retry_at |
| dirty_records | 脏记录表 | dirty_type, severity, original_data |
| operation_history | 操作历史 | operation_type, old_value, new_value |
| manual_notes | 人工备注 | note_type, content, author |
| dead_letter_queue | 死信队列 | original_queue_id, final_error |

## 脏数据类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| missing_field | 缺少必填字段 | high |
| cross_date | 跨日期不一致 | high |
| name_change | 姓名不一致 | medium |
| conflict | 字段值冲突 | high |
| plate_mismatch | 车牌识别不匹配 | medium |

## 队列状态流转

```
pending → retrying → [成功] → completed
                      → [失败] → (重试N次) → manual → dead_letter
                                         → (人工处理) → recovered
```

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── services/
│   │   ├── compensationQueue.js  # 补偿队列服务
│   │   ├── dataReceiver.js      # 数据接收服务
│   │   ├── factService.js       # 事实服务
│   │   ├── operationHistory.js  # 操作历史服务
│   │   └── exportService.js     # 导出报告服务
│   ├── utils/
│   │   ├── idempotency.js       # 幂等性工具
│   │   └── dirtyRecordClassifier.js  # 脏记录分类
│   └── routes/
│       ├── receive.js
│       ├── facts.js
│       ├── queue.js
│       ├── dirty.js
│       ├── deadletter.js
│       ├── notes.js
│       └── export.js
├── scripts/
│   ├── init-db.js           # 数据库初始化
│   ├── seed-data.js         # 样例数据导入
│   ├── generate-bad-data.js # 坏数据生成
│   ├── generate-report.js   # 报告生成
│   ├── run-tests.js         # 功能测试
│   └── api-test.js          # API测试
├── data/                     # SQLite数据库目录
├── exports/                  # CSV导出目录
├── reports/                  # 报告生成目录
└── package.json
```

## 技术栈

- **运行时**: Node.js
- **Web框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **其他**: uuid, moment, json2csv

## 关键设计决策

1. **事实表驱动**：所有数据最终汇聚到事实表，确保导出、详情、历史查询讲同一套事实
2. **幂等性哈希**：基于关键字段生成fact_id，重复请求自动更新同一条记录
3. **原始数据保留**：脏记录不删除，保留original_data字段和处理意见
4. **可追溯性**：所有操作都有历史记录，谁改了什么一目了然
5. **安保友好**：报告突出可重试分类、死信处理、恢复后续跑，不是单纯的汇总数
