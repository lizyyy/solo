# 冷链中转验收回放链路 API

## 项目概述

解决冷链中转验收的赔付计算问题，支持跨日签收、箱号改名、温度异常等场景的对账和回放，确保数据持久化和操作可追溯。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 造数（生成测试数据）

```bash
npm run seed
```

### 3. 运行完整验收测试

```bash
npm run acceptance
```

### 4. 启动 API 服务

```bash
npm start
```

服务地址: http://localhost:3000

### 5. 查看历史数据

```bash
# 列出所有批次
npm run history -- list

# 查看批次详情
npm run history -- detail 1

# 查看操作历史
npm run history -- history 1
```

## 项目结构

```
├── src/
│   ├── server.js              # 服务入口
│   ├── routes/
│   │   └── batches.js         # API 路由
│   ├── services/
│   │   ├── batchService.js    # 批次提交、对账逻辑
│   │   ├── adjustmentService.js # 人工改判、冻结
│   │   └── exportService.js   # 导出、历史查询
│   └── db/
│       ├── index.js           # 数据库连接
│       ├── schema.js          # 表结构定义
│       └── dao.js             # 数据访问层
├── scripts/
│   ├── seed.js                # 造数工具
│   ├── history.js             # 历史查询工具
│   ├── acceptance.js          # 验收测试脚本
│   └── api-examples.sh        # HTTP 请求示例
└── data/
    ├── db/                    # SQLite 数据库文件
    ├── uploads/               # 照片上传目录
    └── exports/               # 导出文件目录
```

## 核心功能

### 1. 批次提交

支持三种重复提交策略：
- **error** (默认): 批次已存在时报错
- **ignore**: 忽略重复，返回已存在的批次
- **overwrite**: 覆盖原有数据，重新计算
- **append**: 追加新箱号数据

```bash
# 查看完整 HTTP 示例
bash scripts/api-examples.sh
```

### 2. 异常检测与赔付计算

| 异常类型 | 赔付标准 |
|---------|---------|
| 箱号改名 | ¥50/箱 |
| 跨日签收 | ¥100/箱 |
| 温度异常 | ¥200/箱 |
| 数量短缺 | ¥10/件 |

### 3. 边界场景覆盖

- ✅ 重复提交策略
- ✅ 撤回后重新提交
- ✅ 部分失败处理
- ✅ 人工改判补偿
- ✅ 导出前冻结保护
- ✅ 数据持久化（重启可查）

### 4. 操作审计

所有操作都记录历史，包含：
- 操作时间
- 操作人
- 操作类型
- 变更前后数据
- 备注说明

## 数据库表结构

- **batches**: 批次主表
- **boxes**: 箱号明细表
- **temperature_records**: 温度记录表
- **photos**: 照片记录表
- **reconciliation_results**: 对账结果表
- **operation_history**: 操作历史表
- **manual_adjustments**: 人工改判表

## 验收流程

### 第一阶段：正常链路

```bash
npm run acceptance -- normal
```

### 第二阶段：重复提交和坏数据

```bash
npm run acceptance -- duplicate
npm run acceptance -- bad
```

### 第三阶段：重启验证

```bash
npm run acceptance -- restart
```

## API 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/submit | 提交批次 |
| GET | /api/batches | 批次列表 |
| GET | /api/batches/:id | 批次详情 |
| POST | /api/batches/:id/withdraw | 撤回批次 |
| POST | /api/batches/resubmit/:batchNo | 撤回后重提 |
| POST | /api/batches/:id/adjust/compensation | 改判赔付 |
| POST | /api/batches/:id/freeze | 冻结批次 |
| POST | /api/batches/:id/unfreeze | 解冻批次 |
| POST | /api/batches/:id/export | 导出数据 |
| GET | /api/batches/:id/history | 操作历史 |
| GET | /api/batches/:id/replay | 回放原始数据 |
| POST | /api/batches/:id/photo/upload | 上传照片 |
