# 影院排片补贴核算 API 系统

院线运营排片补贴核算解决方案，支持跨日场次、补贴上限、退票扣减等复杂规则。

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 📂 文件解析 | 支持场次CSV、票房JSON、规则JSON自动识别解析 |
| 🧮 核算引擎 | 跨日场次补贴倍增、日/总补贴上限、退票扣减比例 |
| 📊 智能分类 | 自动分为正常项、待确认项、失败项三类 |
| 💡 建议处理 | 失败项自动给出建议处理方式 |
| 🔒 去重机制 | 同一批材料再次提交不重复生效 |
| 🔍 全程追踪 | 通过 traceId 从单条明细追踪到最终报告 |

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /Users/lzy/pro/solo/workspaces/zy70873
npm install
```

### 2. 本地复跑测试

```bash
npm test
```

测试数据位于 `test/` 目录，包含：
- `showtimes.csv` - 场次数据
- `box_office.json` - 票房数据
- `contract_rules.json` - 合同规则

### 3. 启动 API 服务

```bash
npm start
# 或开发模式 (自动重启)
npm run dev
```

服务启动后访问: http://localhost:3000

## 📡 API 接口

### 提交核算

```http
POST /api/calculate
Content-Type: multipart/form-data

files: showtimes.csv
files: box_office.json
files: contract_rules.json
```

**响应示例:**
```json
{
  "success": true,
  "batchId": "BATCH_1705300000_abc123",
  "resultId": "uuid",
  "summary": {
    "total": 7,
    "normal": 4,
    "pending": 2,
    "failed": 1,
    "totalSubsidy": 2350,
    "totalBoxOffice": 35000,
    "totalRefundDeduction": 375
  },
  "result": {
    "normalItems": [...],
    "pendingItems": [...],
    "failedItems": [...]
  }
}
```

### 其他接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/batches` | 获取所有批次列表 |
| GET | `/api/batches/:batchId` | 获取批次摘要信息 |
| GET | `/api/batches/:batchId/result` | 获取批次完整核算结果 |
| GET | `/api/batches/:batchId/result/:status` | 按状态筛选结果 (normal/pending/failed) |
| GET | `/api/trace/:batchId/:traceId` | 通过 traceId 追踪单条记录 |

### 使用 curl 测试

```bash
# 提交核算
curl -X POST http://localhost:3000/api/calculate \
  -F "files=@test/showtimes.csv" \
  -F "files=@test/box_office.json" \
  -F "files=@test/contract_rules.json"

# 获取所有批次
curl http://localhost:3000/api/batches

# 追踪单条记录 (替换实际的 batchId 和 traceId)
curl http://localhost:3000/api/trace/TEST_BATCH/xxxx-xxxx-xxxx
```

## 📋 数据格式说明

### 场次 CSV 字段

| 字段 | 说明 | 示例 |
|------|------|------|
| cinema_id | 影院ID | C001 |
| cinema_name | 影院名称 | 万达影城(国贸店) |
| film_id | 影片ID | F001 |
| film_name | 影片名称 | 流浪地球3 |
| screen_id | 影厅ID | S001 |
| show_date | 放映日期 | 2024-01-15 |
| start_time | 开场时间 | 19:30 |
| end_time | 结束时间 | 21:45 |
| total_seats | 总座位数 | 150 |
| sold_seats | 已售座位数 | 120 |
| ticket_price | 票价 | 50 |
| service_fee | 服务费 | 3 |
| refunded_count | 退票数量 | 5 |

### 合同规则 JSON 字段

| 字段 | 说明 | 示例 |
|------|------|------|
| rule_name | 规则名称 | 流浪地球3场次补贴 |
| film_id | 适用影片ID (可选) | F001 |
| cinema_id | 适用影院ID (可选) | C001 |
| start_date | 生效开始日期 | 2024-01-10 |
| end_date | 生效结束日期 | 2024-01-20 |
| subsidy_type | 补贴类型 | per_show / per_ticket / box_office_percentage |
| subsidy_amount | 补贴金额 (元) | 200 |
| subsidy_rate | 补贴比例 (0-1) | 0.1 |
| daily_subsidy_cap | 每日补贴上限 (元) | 1000 |
| total_subsidy_cap | 总补贴上限 (元) | 5000 |
| min_box_office_commitment | 最低票房承诺 (元) | 5000 |
| refund_deduction_rate | 退票扣减比例 | 0.3 |
| cross_day_subsidy_multiplier | 跨日场次补贴乘数 | 1.5 |
| min_ticket_price | 最低票价限制 | 30 |
| priority | 规则优先级 | 1 |

## 🔍 结果分类说明

### 📗 正常项
- 数据验证通过
- 匹配到有效规则
- 无异常警告

### 📙 待确认项
- 数据格式正确但存在问题，如：
  - 未找到匹配的合同规则
  - 最低票房承诺未达标
  - 票价超出限制范围
  - 补贴达到上限被截断

### 📕 失败项
- 数据验证失败，如：
  - 必填字段缺失
  - 已售座位数为负数
  - 退票数超过已售数
  - 票价 <= 0

## 📁 项目结构

```
.
├── src/
│   ├── models/
│   │   ├── Showtime.js           # 场次模型
│   │   ├── BoxOffice.js          # 票房模型
│   │   ├── ContractRule.js       # 合同规则模型
│   │   └── CalculationResult.js  # 核算结果模型
│   ├── services/
│   │   ├── FileParserService.js  # 文件解析服务
│   │   ├── SubsidyCalculatorService.js  # 核算引擎
│   │   └── BatchService.js       # 批次管理服务
│   ├── controllers/
│   │   └── CalculationController.js  # API控制器
│   ├── server.js                  # Express服务器
│   └── config.js                  # 配置文件
├── test/
│   ├── showtimes.csv              # 测试场次数据
│   ├── box_office.json            # 测试票房数据
│   ├── contract_rules.json        # 测试合同规则
│   └── run-test.js                # 本地测试脚本
├── data/
│   ├── uploads/                   # 上传文件临时目录
│   ├── batches.json               # 批次历史记录
│   └── result_*.json              # 核算结果文件
├── package.json
└── README.md
```

## 🎯 核心规则演示

测试数据中包含以下典型场景：

1. **跨日场次**: 22:00-00:15 的场次将自动识别并应用 1.5 倍补贴乘数
2. **退票扣减**: 退票数量将按规则比例从补贴中扣减
3. **补贴上限**: 当日补贴达到上限后将自动截断后续补贴
4. **数据异常**: 已售座位数为负数的记录将被标记为失败

## 💡 常见问题

**Q: 如何重新测试？**
> 删除 `data/batches.json` 文件后重新运行测试脚本即可。

**Q: 支持哪些补贴类型？**
> - `per_show`: 按场次固定金额补贴
> - `per_ticket`: 按人次补贴
> - `box_office_percentage`: 按票房比例补贴

**Q: 如何追踪单条记录？**
> 每个记录都有唯一的 `traceId`, 通过 `/api/trace/:batchId/:traceId` 可获取完整信息，包含原始数据、计算明细、错误原因等。
