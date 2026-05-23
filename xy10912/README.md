# 连锁门店价签 API

一个完整的本地后端 API 服务，用于管理连锁门店的商品价签、促销活动、差异报告等核心业务流程。

## 功能特性

### 核心数据模型
- **门店管理**: 门店基本信息维护，支持多门店
- **商品条码**: 商品基础信息和基准价格
- **价签版本**: 价格版本管理，支持多类型价格（正常/促销/特价）
- **促销窗口**: 促销活动时间窗口和门店范围
- **确认记录**: 门店对价签变更的确认记录
- **差异报告**: 巡检发现的价格差异报告
- **异常日志**: 系统异常和处理记录
- **人工修正**: 人工价格调整记录

### 核心业务规则
- ✅ **价签版本管理**: 支持多版本、多状态流转（待处理→待复核→激活）
- ✅ **门店确认机制**: 门店确认价签变更，确保执行到位
- ✅ **促销到期检查**: 自动检测过期促销并更新状态
- ✅ **差异复核流程**: 差异报告多级审核（待复核→已复核/已驳回/已补偿）
- ✅ **异常追踪记录**: 异常路径保存原始输入和处理结论
- ✅ **人工修正追踪**: 人工价格调整完整记录

### API 状态返回
- `pending` - 待处理
- `pending_review` - 待复核
- `active` - 生效中
- `reviewed` - 已复核
- `confirmed` - 已确认
- `rejected` - 已驳回
- `compensated` - 已补偿
- `expired` - 已过期

## 技术栈

- **运行环境**: Node.js 16+
- **Web 框架**: Express.js
- **数据库**: SQLite（本地持久化）
- **数据验证**: Joi
- **日期处理**: Moment.js
- **数据导出**: JSON2CSV

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化示例数据（可选）
```bash
npm run init-data
```

### 3. 启动服务
```bash
npm start
```

开发模式（自动重启）:
```bash
npm run dev
```

服务启动后访问: http://localhost:3000/api

## 项目结构

```
.
├── src/
│   ├── server.js              # 服务入口
│   ├── database/
│   │   ├── init.js            # 数据库初始化
│   │   └── dao.js             # 数据访问对象
│   ├── middleware/
│   │   └── exceptionHandler.js # 异常处理中间件
│   ├── utils/
│   │   ├── validation.js      # 数据验证规则
│   │   └── response.js        # 响应格式化
│   └── routes/
│       ├── stores.js          # 门店管理路由
│       ├── products.js        # 商品管理路由
│       ├── priceVersions.js   # 价签版本路由
│       ├── promotions.js      # 促销窗口路由
│       ├── confirmations.js   # 确认记录路由
│       ├── discrepancies.js   # 差异报告路由
│       ├── exceptions.js      # 异常日志路由
│       ├── corrections.js     # 人工修正路由
│       └── exports.js         # 数据导出路由
├── scripts/
│   ├── initSampleData.js      # 示例数据脚本
│   ├── apiExamples.md         # API调用示例
│   └── testApi.js             # API测试脚本
├── data/                      # 数据库文件目录（自动创建）
├── package.json
└── README.md
```

## API 接口概览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| **健康检查** | GET | `/api/health` | 服务健康状态 |
| **门店管理** | GET | `/api/stores` | 获取所有门店 |
| | GET | `/api/stores/:code` | 获取单个门店 |
| | POST | `/api/stores` | 创建门店 |
| | PUT | `/api/stores/:code` | 更新门店 |
| **商品管理** | GET | `/api/products` | 获取所有商品 |
| | GET | `/api/products/:barcode` | 获取单个商品 |
| | POST | `/api/products` | 创建商品 |
| **价签版本** | GET | `/api/price-versions` | 获取所有价签版本 |
| | GET | `/api/price-versions/active` | 获取活跃版本 |
| | POST | `/api/price-versions` | 创建价签版本 |
| | PATCH | `/api/price-versions/:code/activate` | 激活价签 |
| | PATCH | `/api/price-versions/:code/status` | 状态推进 |
| **促销窗口** | GET | `/api/promotions` | 获取所有促销 |
| | GET | `/api/promotions/check-expired` | 检查过期促销 |
| | POST | `/api/promotions` | 创建促销窗口 |
| | PATCH | `/api/promotions/:code/start` | 开始促销 |
| | PATCH | `/api/promotions/:code/end` | 结束促销 |
| **确认记录** | GET | `/api/confirmations` | 获取所有确认记录 |
| | POST | `/api/confirmations` | 创建确认记录 |
| **差异报告** | GET | `/api/discrepancies` | 获取所有差异报告 |
| | GET | `/api/discrepancies/pending-review` | 获取待复核差异 |
| | POST | `/api/discrepancies` | 创建差异报告 |
| | PATCH | `/api/discrepancies/:code/review` | 复核差异报告 |
| | PATCH | `/api/discrepancies/:code/status` | 状态更新 |
| **异常日志** | GET | `/api/exceptions` | 获取所有异常日志 |
| | GET | `/api/exceptions/pending` | 获取待处理异常 |
| | PATCH | `/api/exceptions/:code/handle` | 处理异常 |
| **人工修正** | GET | `/api/corrections` | 获取所有修正记录 |
| | POST | `/api/corrections` | 创建修正记录 |
| **数据导出** | GET | `/api/exports/stores` | 导出门店CSV |
| | GET | `/api/exports/products` | 导出商品CSV |
| | GET | `/api/exports/price-versions` | 导出价格版本CSV |
| | GET | `/api/exports/discrepancies` | 导出差异CSV |
| | GET | `/api/exports/report/summary` | 获取汇总报告 |

## 业务流程示例

### 1. 正常价签更新流程
```
创建价签版本 → 状态: pending
  → 提交复核 → 状态: pending_review
    → 审核通过 → 状态: active
      → 门店确认 → 生成确认记录
```

### 2. 差异处理流程
```
发现差异 → 创建差异报告 → 状态: pending_review
  → 复核处理:
    ├─ 通过 → 状态: reviewed
    ├─ 驳回 → 状态: rejected
    └─ 补偿 → 状态: compensated + 人工修正记录
```

### 3. 促销管理流程
```
创建促销窗口 → 状态: scheduled
  → 开始促销 → 状态: active
    → 自动/手动结束 → 状态: ended/expired
```

## 数据持久化

服务使用 SQLite 进行本地数据存储，数据库文件位于 `./data/pricetag.db`
- ✅ 服务重启数据不丢失
- ✅ 支持事务操作
- ✅ 无需额外数据库服务

## 异常处理

所有 API 异常会被自动捕获并记录到 `exception_logs` 表，包含：
- 异常编码（唯一）
- API 端点
- 原始输入（请求参数）
- 错误信息
- 处理结论
- 处理状态

## 响应格式

### 成功响应
```json
{
  "success": true,
  "status": "success",
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2024-05-15 10:30:00"
}
```

### 状态流转响应（待复核）
```json
{
  "success": true,
  "status": "pending_review",
  "message": "已提交复核",
  "data": { ... },
  "timestamp": "2024-05-15 10:30:00"
}
```

### 错误响应
```json
{
  "success": false,
  "status": "validation_error",
  "message": "参数验证失败",
  "timestamp": "2024-05-15 10:30:00"
}
```

## 详细 API 示例

查看 [scripts/apiExamples.md](scripts/apiExamples.md) 获取完整的 curl 命令示例。

## 测试

运行 API 测试:
```bash
npm test
```

## 注意事项

1. **端口配置**: 默认端口 3000，可通过环境变量 `PORT` 修改
2. **数据库路径**: 默认 `./data/pricetag.db`，首次启动自动创建
3. **时间格式**: 所有时间字段使用 `YYYY-MM-DD HH:mm:ss` 格式
4. **金额精度**: 价格字段保留两位小数

## License

MIT
