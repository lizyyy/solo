# 连锁门店中台门店价目表生效 API

## 项目概述

提供价目表的创建、修改、审核、撤回、列表查询、详情查看和导出功能，解决门店价格冲突问题，支持完整状态流转和历史追溯。

## 核心特性

- **状态流转**: 草稿 → 待生效 → 已生效 → 已回滚
- **冲突检测**: 门店已有生效价目时自动拦截，提示需补充材料
- **历史追溯**: 完整记录所有操作历史，支持审计
- **导出功能**: 业务语言字段，与列表查询结果对应

## 技术栈

- Node.js + Express
- TypeScript
- SQLite
- csv-writer

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行验收测试

```bash
npm test
```

### 启动服务

```bash
npm run dev
```

服务地址: http://localhost:3000

## API 接口

### 基础信息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |

### 价目表管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/price-lists | 创建价目表 |
| PUT | /api/price-lists/:id | 修改价目表 |
| POST | /api/price-lists/:id/submit | 提交审核 |
| POST | /api/price-lists/:id/approve | 审核通过 |
| POST | /api/price-lists/:id/rollback | 撤回 |
| GET | /api/price-lists | 列表查询 |
| GET | /api/price-lists/:id | 详情查询 |
| GET | /api/price-lists/export | 导出列表 |
| GET | /api/price-lists/:id/export | 导出行细 |

### 门店管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stores | 获取门店列表 |

## 核心数据模型

### 价目表状态

| 状态值 | 说明 |
|--------|------|
| draft | 草稿 |
| pending_effective | 待生效 |
| effective | 已生效 |
| rolled_back | 已回滚 |

### 数据结构

- **stores**: 门店信息表
- **price_lists**: 价目表主表
- **price_list_stores**: 价目表-门店关联表
- **price_list_items**: 价目表明细表
- **price_list_history**: 操作历史表
- **import_bad_rows**: 导入坏行记录表

## 验收场景

### 1. 完整流转

创建 → 修改 → 提交审核 → 审核通过 → 撤回

### 2. 冲突记录

为已有生效价目的门店创建新价目表时，系统会：
- 拦截冲突门店
- 说明冲突原因
- 提示需补充的材料（门店价格调整审批单、终止合作协议、价格差异说明）
- 给出下一步建议

### 3. 导入坏行

记录导入过程中的错误数据，包括：
- 行号
- 原始数据
- 错误原因

## 目录结构

```
├── src/
│   ├── controllers/      # 控制器
│   ├── services/         # 业务逻辑
│   ├── database.ts       # 数据库初始化
│   ├── types.ts          # 类型定义
│   ├── routes.ts         # 路由配置
│   └── server.ts         # 服务入口
├── scripts/              # 测试脚本
├── data/                 # 数据文件
│   └── exports/          # 导出文件
├── package.json
└── tsconfig.json
```
