# 口腔连锁采购追踪系统

## 项目概述

本系统专为口腔连锁机构设计，实现库存CSV、召回公告Markdown、门店消耗表的统一接入，生成完整可追溯记录。支持新增批次、标记处理、退回修改和导出明细等核心功能，针对召回批号、近效期、跨门店调拨等场景完整记录原因、处理人和时间。

## 核心功能

### 1. 批次管理
- 新增批次录入
- 批号冻结/解冻（记录原因和处理人）
- 批次状态查询
- 近效期预警

### 2. 审批流程
- 放行/通过审批
- 退回修改（记录退回原因）
- 标记处理中
- 召回处理
- 完整审批历史追踪

### 3. 特殊场景处理
- **召回批号处理**：关联召回公告，记录召回原因和处理措施
- **近效期预警**：自动识别30天内即将过期的批次
- **跨门店调拨**：记录调拨原因、数量、确认人和时间

### 4. 文件导入导出
- 支持CSV格式库存数据导入
- 支持Markdown格式召回公告解析
- 支持批次、库存、审批记录、调拨记录导出为CSV

### 5. 门店确认管理
- 冻结批次门店确认
- 召回批次门店确认
- 替代耗材门店确认
- 待确认事项查询

### 6. 消耗记录管理
- 消耗表CSV批量导入
- 单条消耗登记
- 消耗汇总统计
- 自动扣减库存

### 7. 替代耗材管理
- 设置替代批次
- 替代关系查询
- 历史替换记录追踪

### 8. 审计追踪
- 所有操作记录操作人和IP
- 完整的状态变更历史
- 可向监管机构展示放行/退回/补料依据

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 加载样例数据（包含冻结批号和人工修正记录）
```bash
npm run sample-data
```

### 4. 启动服务
```bash
npm start
# 或开发模式
npm run dev
```

服务启动后访问: http://localhost:3000

## API 接口文档

### 批次管理 (`/api/batches`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | / | 新增批次 |
| GET | / | 查询所有批次（支持status、is_frozen、product_id筛选） |
| GET | /:batch_no | 查询单个批次详情 |
| POST | /:batch_no/freeze | 冻结批次 |
| POST | /:batch_no/unfreeze | 解冻批次 |
| GET | /alerts/expiring | 近效期预警（支持days参数） |
| GET | /:batch_no/history | 查询批次完整历史（审批+审计日志） |

**新增批次示例:**
```json
{
  "batch_no": "BATCH202405001",
  "product_id": 1,
  "supplier_id": 1,
  "production_date": "2024-01-15",
  "expiry_date": "2026-01-15",
  "quantity": 100,
  "created_by": "张三"
}
```

**冻结批次示例:**
```json
{
  "reason": "质量抽检不合格",
  "frozen_by": "质量管理员"
}
```

### 审批管理 (`/api/approvals`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /:batch_no/approve | 放行/审批通过 |
| POST | /:batch_no/reject | 退回修改 |
| POST | /:batch_no/process | 标记处理中 |
| POST | /:batch_no/recall | 召回处理 |
| GET | / | 查询所有审批记录 |
| GET | /batch/:batch_no | 查询指定批次的审批历史 |

**退回修改示例:**
```json
{
  "reason": "质检报告缺少生产厂家盖章",
  "handler": "质量审核员-张静",
  "notes": "请补充完整的质检报告"
}
```

### 调拨管理 (`/api/transfers`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | / | 创建调拨单 |
| POST | /:transfer_no/confirm | 确认调拨 |
| GET | / | 查询所有调拨记录 |

**创建调拨单示例:**
```json
{
  "batch_no": "BATCH202401001",
  "from_store_code": "STORE001",
  "to_store_code": "STORE003",
  "quantity": 50,
  "reason": "广州门店库存不足紧急调拨",
  "created_by": "调度员"
}
```

### 库存管理 (`/api/inventory`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /upload | 上传库存CSV文件（multipart/form-data，file字段） |
| GET | / | 查询库存（支持store_id筛选） |

### 导出功能 (`/api/exports`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /batches | 导出批次列表CSV |
| GET | /approvals/:batch_no | 导出指定批次审批历史CSV |
| GET | /inventory | 导出库存CSV |
| GET | /transfers | 导出调拨记录CSV |

## 样例数据说明

运行 `npm run sample-data` 后将自动加载以下演示场景：

### 1. 批号冻结样例
- **批号**: BATCH202404001-FROZEN
- **产品**: 牙科种植体
- **冻结原因**: 质量抽检不合格，等待供应商复核
- **冻结人**: 质量管理员-王芳
- **存放位置**: 隔离区-QA

### 2. 人工修正审批样例
- **批号**: BATCH202404002-CORRECT
- **产品**: 光固化树脂
- **当前状态**: 已退回等待修正
- **退回原因**: 质检报告缺少生产厂家盖章
- **审批流程**: 提交审核 → 退回修改 → 重新提交

### 3. 近效期预警
- 批号 BATCH202403001 (牙科高速手机) 2025年3月到期
- 批号 BATCH202403002 (一次性口腔器械盒) 2025年9月到期

### 4. 召回批号
- 批号 BATCH202401001 (牙科种植体) 涉及召回
- 召回原因: 产品涂层质量问题

### 5. 跨门店调拨
- 从北京门店调拨100盒一次性器械盒至广州门店

## 数据库结构

核心数据表：
- `stores`: 门店信息
- `suppliers`: 供应商信息
- `products`: 产品信息
- `batches`: 批次信息（含冻结状态）
- `inventory`: 库存明细
- `approvals`: 审批记录
- `transfers`: 调拨记录
- `recalls`: 召回公告
- `audit_logs`: 审计日志

## 项目结构

```
.
├── src/
│   ├── app.js              # 主应用入口
│   ├── config/
│   │   └── database.js     # 数据库配置
│   ├── models/             # 数据模型
│   ├── routes/             # API路由
│   ├── services/           # 业务服务
│   ├── utils/              # 工具函数
│   └── scripts/            # 初始化脚本
├── data/                   # 数据库文件目录
├── package.json
└── README.md
```

## 使用场景示例

### 场景1：处理退回修改的批次
```bash
# 1. 查看退回原因
curl http://localhost:3000/api/approvals/batch/BATCH202404002-CORRECT

# 2. 补充资料后重新提交审批
curl -X POST http://localhost:3000/api/approvals/BATCH202404002-CORRECT/process \
  -H "Content-Type: application/json" \
  -d '{"handler":"采购专员-李明","notes":"已重新提交完整质检报告"}'
```

### 场景2：导出近效期批次明细
```bash
curl "http://localhost:3000/api/exports/batches?status=pending" \
  -o expiring_batches.csv
```

### 场景3：查看完整追踪历史
```bash
curl http://localhost:3000/api/batches/BATCH202404002-CORRECT/history
```

## 技术栈

- **后端框架**: Express.js 4.x
- **数据库**: SQLite3（文件型数据库，重启数据不丢失）
- **文件处理**: csv-parser、json2csv、multer
- **Markdown解析**: marked
- **日期处理**: moment

## 注意事项

1. 所有涉及状态变更的操作都会记录操作人和时间
2. 冻结的批次无法进行审批操作，需先解冻
3. 导出的CSV文件支持Excel直接打开（含BOM头）
4. 数据库文件默认存放在 `data/database.db`

## 许可证

ISC
