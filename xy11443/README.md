# 生鲜分拣损耗验收回放链路服务

## 项目概述

解决坏果扣款和二次分拣损耗重复计算时无人能说清依据的问题，从供应商送货单、称重记录、退筐照片开始建账，支持异常照片追加，所有操作可追溯回放。

## 核心功能

- **造数**: 创建批次、录入送货单、称重记录、照片、损耗记录
- **启动服务**: RESTful API服务
- **发请求**: 标准化HTTP接口
- **对账**: 自动计算损耗、扣款金额
- **导出**: 冻结后导出JSON/CSV
- **回放异常**: 时间线追踪、版本对比

## 边界情况覆盖

| 场景 | 处理方式 |
|------|---------|
| 重复提交 | 支持 ignore/overwrite/append 三种策略 |
| 撤回后再提交 | 正常流程 |
| 部分失败 | 成功/失败分别返回，不吞异常 |
| 人工改判 | 保留版本历史，记录改判人/时间/原因 |
| 导出前冻结 | 冻结后禁止修改，保证数据一致 |

## 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── models/
│   │   ├── index.js             # 模型关联
│   │   ├── Batch.js             # 批次
│   │   ├── DeliveryNote.js      # 送货单
│   │   ├── WeighingRecord.js    # 称重记录
│   │   ├── Photo.js             # 照片
│   │   ├── LossRecord.js        # 损耗记录
│   │   ├── AuditLog.js          # 审计日志
│   │   ├── Reconciliation.js    # 对账记录
│   │   └── ExportRecord.js      # 导出记录
│   ├── services/
│   │   ├── index.js
│   │   ├── auditService.js      # 审计服务
│   │   ├── batchService.js      # 批次服务
│   │   ├── dataService.js       # 数据录入服务
│   │   ├── reconcileService.js  # 对账服务
│   │   ├── exportService.js     # 导出服务
│   │   └── replayService.js     # 回放服务
│   ├── routes/
│   │   ├── batches.js           # 批次相关API
│   │   ├── loss.js              # 损耗相关API
│   │   ├── exports.js           # 导出相关API
│   │   └── audit.js             # 审计相关API
│   └── server.js                # 服务入口
├── scripts/
│   ├── seed.js                  # 造数脚本
│   ├── reconcile.js             # 对账脚本
│   ├── export.js                # 导出脚本
│   ├── replay.js                # 回放脚本
│   └── acceptance-test.js       # 验收测试
├── data/                        # SQLite数据目录
├── exports/                     # 导出文件目录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行验收测试（推荐先跑）

```bash
npm run test
```

覆盖20个测试用例：
- 正常链路测试
- 边界情况测试
- 历史追溯验证

### 3. 造测试数据

```bash
npm run seed
```

### 4. 启动服务

```bash
npm start
```

服务地址: http://localhost:3000

### 5. 对账

```bash
npm run reconcile
```

### 6. 导出

```bash
npm run export
```

### 7. 回放异常

```bash
npm run replay
```

## API接口

### 请求头要求
所有写操作需要在Header中携带: `operator: 操作人名称`

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/batches | 批次列表 |
| POST | /api/batches | 创建批次 |
| GET | /api/batches/:id | 批次详情 |
| POST | /api/batches/:id/submit | 提交批次 |
| POST | /api/batches/:id/withdraw | 撤回批次 |
| POST | /api/batches/:id/freeze | 冻结批次 |
| POST | /api/batches/:id/unfreeze | 解冻批次 |
| GET | /api/batches/:id/history | 操作历史 |
| POST | /api/batches/:id/reconcile | 对账 |
| POST | /api/batches/:id/export | 导出 |
| GET | /api/batches/:id/replay | 回放时间线 |

### 数据录入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/:id/data | 批量添加数据 |
| POST | /api/batches/:id/delivery-notes | 添加送货单 |
| POST | /api/batches/:id/weighing-records | 添加称重记录 |
| POST | /api/batches/:id/photos | 添加照片 |
| POST | /api/batches/:id/loss-records | 添加损耗记录 |

### 损耗管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/loss | 异常损耗列表 |
| GET | /api/loss/:id | 损耗详情 |
| POST | /api/loss/:id/confirm | 确认损耗 |
| POST | /api/loss/:id/adjust | 人工改判 |
| GET | /api/loss/:id/versions | 版本对比 |

### 审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/audit/operator/:name | 操作人历史 |
| GET | /api/audit/entity/:type/:id | 实体变更历史 |

## 数据库表说明

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| batches | 批次 | batchNo, status, isFrozen, submitCount |
| delivery_notes | 送货单 | noteNo, quantity, status, version |
| weighing_records | 称重记录 | recordNo, weighType, weight |
| photos | 照片 | photoType, isAnomaly, anomalyRemark |
| loss_records | 损耗记录 | lossType, lossWeight, isManualAdjusted, previousId |
| audit_logs | 审计日志 | action, beforeData, afterData, diffData, operator |
| reconciliations | 对账记录 | totalLossWeight, totalDeduction |
| export_records | 导出记录 | exportNo, filePath, exportData |

## 验收流程

### 第一轮：正常链路

1. npm run seed (造数)
2. npm start (启动服务)
3. 调用API发请求
4. npm run reconcile (对账)
5. npm run export (导出)
6. npm run replay (回放)

### 第二轮：边界情况

1. 重复提交测试（三种策略）
2. 撤回后再提交
3. 批量添加部分失败
4. 人工改判损耗
5. 冻结后尝试修改

### 第三轮：历史验证

1. 重启服务
2. 查询历史数据
3. 验证审计记录完整
4. 查看损耗版本历史

## 采购经理关注

- **命令脚本**: scripts/ 目录下的所有 .js 文件
- **HTTP读写**: src/routes/ 目录下的路由定义
- **本地持久化**: 
  - 数据库: data/database.sqlite
  - 导出文件: exports/ 目录
  - 所有操作留痕: audit_logs 表
