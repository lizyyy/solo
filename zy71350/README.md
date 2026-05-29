# 画廊寄售结算表服务

画廊月底给艺术家结算寄售作品时的结算工具。重点解决**展期、折扣、佣金比例**反复核对的问题，确保每条数据可追溯，异常情况分级处理。

## 核心特性

### ✅ 数据可追溯
- **原始数据留存**: 所有导入的原始数据完整保存在 `raw_data` 字段
- **处理日志留痕**: 每一步校验、计算、授权、结算都有详细日志
- **原始 vs 处理**: 每条日志标记 `is_original`(原始) 或 `is_processed`(处理结果)
- **处理顺序**: 按 `processing_order` 明确处理先后

### ⚠️ 异常分级
| 级别 | 颜色 | 说明 |
|------|------|------|
| 🔴 严重 | critical | 折扣超阈值未授权、佣金比例不符、负价格、艺术家未登记 |
| 🟡 警告 | warning | 展期跨月、申报折扣与实际不符、佣金比例未填 |
| 🔵 提示 | info | 展期超长、常规处理日志 |

### 🔄 状态流转
```
已导入 → 校验中 → 待审核 → 已授权 → 已结算
                        ↓
                      已驳回
```

### 🔑 核心功能
1. **数据导入**: 支持 JSON / CSV 格式，支持中英文字段名
2. **规则校验**: 展期跨月、折扣授权、佣金比例、价格有效性
3. **佣金试算**: 按艺术家等级自动匹配佣金率，支持授权覆盖
4. **授权留痕**: 折扣超10%、佣金比例不符需特别授权，记录授权人、原因、时间
5. **结算导出**: 导出CSV格式结算表，含完整处理信息
6. **历史追溯**: 每条记录可查看完整处理轨迹

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```
预置5位艺术家基础数据：
- A001 张艺涵 (ESTABLISHED, 35%)
- A002 李明远 (EMERGING, 25%)
- A003 王思齐 (MASTER, 40%)
- A004 陈雨萱 (DEFAULT, 30%)
- A005 刘子墨 (EMERGING, 25%)

### 3. 处理样例数据
```bash
npm run test-sample
```
样例数据包含10条记录，覆盖：
- ✅ **正常数据**: 无任何问题
- 🟡 **展期跨月**: 临界-跨月1天
- 🟡 **折扣临界**: 刚好10%（等于阈值）
- 🔴 **折扣未授权**: 15%（超过10%阈值）
- 🔴 **佣金比例错**: 申报25%，系统应为40%
- 🔴🔴 **多重问题**: 展期跨月 + 折扣未授权 + 佣金比例错
- 🔴 **脏数据**: 负价格
- 🔴 **脏数据**: 艺术家未登记
- 🟡 **脏数据**: 交易日期格式（2026/04/08）
- 🔵 **临界**: 展期超长8个月

### 4. 启动服务
```bash
npm start
```
访问: http://localhost:3000

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/config` | 配置信息（佣金率、阈值等） |
| GET | `/api/artists` | 艺术家列表 |
| POST | `/api/import/json` | JSON格式导入 |
| POST | `/api/import/csv` | CSV文件上传 |
| GET | `/api/batches` | 批次列表 |
| GET | `/api/batches/:id` | 批次详情 |
| GET | `/api/batches/:id/issues` | 批次问题列表 |
| POST | `/api/batches/:id/validate` | 执行校验 |
| POST | `/api/batches/:id/trial` | 佣金试算 |
| POST | `/api/batches/:id/settle` | 完成结算 |
| POST | `/api/batches/:id/export` | 导出结算表 |
| GET | `/api/items/:id` | 单条记录 |
| GET | `/api/items/:id/trace` | 数据追溯 |
| POST | `/api/items/:id/authorize` | 单条授权 |
| POST | `/api/batches/:id/authorize-batch` | 批量授权 |
| GET | `/api/exports` | 导出历史 |
| GET | `/api/exports/:id/download` | 下载导出文件 |

## 数据导入格式

### CSV 字段（支持中英文）
```csv
作品编号,艺术家编码,艺术家,展期开始,展期结束,交易日期,标价,成交价,折扣,佣金比例
artwork_no,artist_code,artist_name,exhibition_start_date,exhibition_end_date,transaction_date,listed_price,transaction_price,discount_rate,commission_rate
```

### JSON 格式
```json
[
  {
    "artwork_no": "ART-2026-001",
    "artist_code": "A001",
    "artist_name": "张艺涵",
    "exhibition_start_date": "2026-04-01",
    "exhibition_end_date": "2026-04-15",
    "transaction_date": "2026-04-10",
    "listed_price": 15000,
    "transaction_price": 15000,
    "discount_rate": 0,
    "commission_rate": 0.35
  }
]
```

## 规则说明

### 佣金比例规则
| 艺术家等级 | 佣金比例 |
|------------|----------|
| MASTER (大师) | 40% |
| ESTABLISHED (成熟) | 35% |
| EMERGING (新锐) | 25% |
| DEFAULT (默认) | 30% |

### 折扣授权规则
- 折扣 ≤ 10%: 无需授权
- 折扣 > 10%: 需特别授权，记录授权人、原因

### 展期规则
- 跨月: 警告级别，标注提醒
- 超过7个月: 提示级别，建议确认

## 项目结构

```
.
├── server.js                 # 服务入口
├── config.js                 # 配置文件
├── package.json
├── dao/                      # 数据访问层
│   ├── database.js
│   ├── batchDao.js
│   ├── itemDao.js
│   ├── artistDao.js
│   ├── authDao.js
│   ├── logDao.js
│   └── exportDao.js
├── services/                 # 业务逻辑层
│   ├── validationEngine.js   # 规则引擎
│   ├── settlementService.js  # 结算服务
│   └── importService.js      # 导入服务
├── routes/
│   └── api.js                # API路由
├── scripts/
│   ├── init-db.js            # 数据库初始化
│   └── process-sample.js     # 样例数据测试
├── samples/
│   ├── sample_data.json      # 样例数据(JSON)
│   └── sample_data.csv       # 样例数据(CSV)
├── public/
│   └── index.html            # 前端页面
├── data/                     # 数据库文件
├── uploads/                  # 上传文件
└── exports/                  # 导出文件
```

## 数据库表结构

### `artists` - 艺术家主数据
### `consignment_batches` - 结算批次
### `consignment_items` - 寄售作品明细
- `raw_data`: 原始导入数据(JSON)
- `processing_order`: 处理顺序
- `has_issues`: 是否有问题
- `highest_severity`: 最高问题级别

### `processing_logs` - 处理日志
- `is_original`: 1=原始数据记录
- `is_processed`: 1=处理结果记录
- `rule_code`: 触发的规则编码
- `raw_value` / `expected_value`: 原值/期望值

### `authorization_records` - 授权记录
### `settlement_exports` - 导出记录

## 使用流程

1. **导入数据**: 上传CSV或JSON，选择结算月份
2. **校验数据**: 系统自动检测展期、折扣、佣金等问题
3. **处理异常**: 对严重问题进行授权或修正
4. **佣金试算**: 预览佣金和艺术家应得金额
5. **完成结算**: 确认后状态变为"已结算"
6. **导出报表**: 导出CSV格式结算表

## 追溯示例

访问 `/api/items/:id/trace` 可查看：
```json
{
  "item": { "...": "当前状态" },
  "original_data": { "...": "原始导入数据" },
  "artist": { "...": "艺术家信息" },
  "authorizations": [{ "...": "授权记录" }],
  "processing_trace": [
    {
      "step": "import",
      "action": "record_original",
      "is_original": 1,
      "message": "原始展期: 2026-04-01 ~ 2026-04-15"
    },
    {
      "step": "validation",
      "action": "calculate_duration",
      "is_processed": 1,
      "message": "展期计算: 15天"
    }
  ]
}
```
