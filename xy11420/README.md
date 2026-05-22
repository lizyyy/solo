# 二手车整备异常回执状态机服务

## 项目概述

本服务用于管理二手车整备过程中的异常回执处理，支持同一辆车多次返厂后的追溯和复盘。所有数据持久化存储，重启服务后可查询历史记录。

## 核心功能

### 📦 状态机流转
- **批次创建**: 创建新的整备批次
- **附件补传**: 上传检测单、维修报价、照片清单、扫码明细
- **提交审核**: 录入员提交审核
- **复核改判**: 复核员审批通过或驳回
- **冻结结算**: 主管冻结异常批次，保存冻结前后状态
- **撤回归档**: 撤销或归档已完成批次

### 🔍 脏记录处理
自动识别以下类型的异常数据：
- 缺字段 (missing_field)
- 跨日 (cross_day)
- 改名 (name_mismatch)
- 金额冲突 (amount_conflict)
- 数量冲突 (quantity_conflict)
- 重复提交 (duplicate)

### 🔐 权限控制
| 角色 | 权限说明 |
|------|----------|
| 录入员 (entry) | 创建、编辑、提交批次，上传附件 |
| 复核员 (reviewer) | 查看、复核、编辑批次，处理脏记录 |
| 主管 (manager) | 拥有所有权限，冻结/解冻批次 |
| 只读 (readonly) | 查看批次和历史，导出汇总 |

### 📊 重点展示
- 冻结前后状态对比
- 人工操作理由
- CSV导出汇总
- 完整的状态流转历史

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 启动服务
```bash
npm start
```

服务启动后访问: http://localhost:3000/api

### 4. 运行验收测试
```bash
npm test
```

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 录入员 | entry_user | entry123 |
| 复核员 | reviewer_user | reviewer123 |
| 主管 | manager_user | manager123 |
| 只读 | readonly_user | readonly123 |

## API 接口

### 认证
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 批次管理
- `GET /api/batches` - 获取批次列表
- `POST /api/batches` - 创建批次
- `GET /api/batches/:id` - 获取批次详情
- `GET /api/batches/:id/history` - 获取状态历史
- `GET /api/batches/:id/transitions` - 获取可用状态转换

### 状态流转
- `POST /api/batches/:id/submit` - 提交审核
- `POST /api/batches/:id/review/start` - 开始复核
- `POST /api/batches/:id/review/approve` - 复核通过
- `POST /api/batches/:id/review/reject` - 复核驳回
- `POST /api/batches/:id/freeze` - 冻结批次
- `POST /api/batches/:id/unfreeze` - 解冻批次
- `POST /api/batches/:id/archive` - 归档批次
- `POST /api/batches/:id/cancel` - 撤销批次
- `POST /api/batches/:id/settle` - 结算批次

### 附件管理
- `POST /api/batches/:id/inspections` - 添加检测单
- `POST /api/batches/:id/quotes` - 添加维修报价
- `POST /api/batches/:id/photos` - 添加照片
- `POST /api/batches/:id/scans` - 添加扫码明细
- `POST /api/batches/:id/return` - 添加返厂记录

### 脏记录管理
- `GET /api/dirty-records` - 获取脏记录列表
- `GET /api/dirty-records/:id` - 获取脏记录详情
- `POST /api/dirty-records/:id/resolve` - 处理脏记录

### 导出功能
- `GET /api/export/batch/:id` - 导出单个批次CSV
- `GET /api/export/batches` - 导出批次汇总CSV
- `GET /api/export/batch/:id/summary` - 获取批次汇总数据

## 项目结构

```
├── src/
│   ├── server.js           # 服务入口
│   ├── db/
│   │   ├── index.js        # 数据库连接
│   │   └── schema.js       # 数据库Schema
│   ├── models/
│   │   ├── batch.js        # 批次模型
│   │   ├── attachment.js   # 附件模型
│   │   └── dirtyRecord.js  # 脏记录模型
│   ├── services/
│   │   ├── statusMachine.js # 状态机服务
│   │   └── export.js       # 导出服务
│   ├── middleware/
│   │   └── auth.js         # 认证和权限中间件
│   └── routes/
│       ├── auth.js         # 认证路由
│       ├── batches.js      # 批次路由
│       ├── dirtyRecords.js # 脏记录路由
│       └── export.js       # 导出路由
├── test/
│   └── run-tests.js        # 验收测试脚本
├── scripts/
│   └── init-db.js          # 数据库初始化脚本
├── data/                   # 数据库文件目录
├── exports/                # 导出文件目录
└── package.json
```

## 验收测试流程

### 第一阶段: 正常链路
1. 健康检查
2. 用户登录
3. 创建批次
4. 添加检测单、维修报价、照片
5. 提交审核 → 开始复核 → 复核通过
6. 查看批次详情和状态历史

### 第二阶段: 重复提交和坏数据
1. 重复提交检测单（生成脏记录）
2. 提交缺失字段数据（生成脏记录）
3. 查看脏记录列表
4. 处理脏记录
5. 金额冲突测试（生成脏记录）

### 第三阶段: 冻结和解冻
1. 冻结批次（保存冻结前状态和原因）
2. 验证录入员无法操作冻结批次
3. 解冻批次（恢复到冻结前状态）
4. 添加返厂记录

### 第四阶段: 权限控制
1. 验证只读用户无法创建批次
2. 验证只读用户可以查看批次

### 第五阶段: 导出功能
1. 获取批次汇总数据
2. 导出单个批次CSV
3. 导出批次汇总CSV

### 第六阶段: 重启验证
1. 重启服务后查询历史批次
2. 验证数据持久化完整

## 状态流转图

```
draft ──► submitted ──► reviewing ──► approved ──► settled ──► archived
  │          │             │            │
  ▼          ▼             ▼            ▼
cancelled  frozen       rejected      frozen
```

冻结状态 (frozen) 可转换到任意状态，仅主管可操作。

## 数据库表

- **users**: 用户表（权限控制）
- **batches**: 批次主表
- **inspection_orders**: 检测单
- **repair_quotes**: 维修报价
- **photo_lists**: 照片清单
- **scan_details**: 扫码明细
- **status_history**: 状态变更历史
- **dirty_records**: 脏记录
- **operation_logs**: 操作日志
- **return_records**: 返厂记录
