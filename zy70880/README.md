# 冷库园区财务后端服务

## 功能概述

这是一个用于冷库园区电费结算的后端服务，主要功能包括：
- 电表CSV数据导入
- 租户合同JSON数据导入
- 温区管理
- 电费批次管理
- 异常数据检测（异常尖峰、空置期）
- 处理记录追踪（审核通过、退回修改、人工修正）
- 历史记录查询
- CSV导出（导出数量与查询结果一致）

## 项目结构

```
├── src/
│   ├── app.js                    # 主应用入口
│   ├── config/
│   │   └── database.js           # 数据库配置
│   ├── database/
│   │   ├── init.js               # 数据库表初始化脚本
│   │   └── seed.js               # 示例数据初始化脚本
│   ├── routes/
│   │   └── batches.js            # 批次相关API路由
│   └── services/
│       ├── batchService.js       # 批次处理服务
│       ├── importService.js      # 数据导入服务
│       └── queryService.js       # 查询与导出服务
├── examples/
│   ├── zones.json                # 温区示例数据
│   ├── contracts.json            # 合同示例数据
│   └── meter_readings.csv        # 电表读数示例（含异常记录）
├── data/                         # SQLite数据库文件目录
├── uploads/                      # 上传文件目录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 初始化示例数据

```bash
npm run seed
```

示例数据包括：
- 3个温区（低温A区、中温B区、超低温C区）
- 3家租户合同
- 13条电表读数（其中包含1条需要人工修正的异常尖峰记录）

### 4. 启动服务

```bash
npm start
```

服务将运行在 http://localhost:3000

## API接口说明

### 批次管理

- `POST /api/batches` - 创建新批次
- `GET /api/batches` - 查询批次列表
- `GET /api/batches/:id` - 查询单个批次详情

### 数据导入

- `POST /api/batches/:id/import-meter` - 导入电表CSV文件
- `POST /api/batches/import-contracts` - 导入合同JSON文件
- `POST /api/batches/import-zones` - 导入温区数据

### 读数管理

- `GET /api/batches/:id/readings` - 查询批次下的电表读数
- `POST /api/batches/readings/:readingId/process` - 处理单条读数
  - action: approve（审核通过）、return（退回修改）、manual_fix（人工修正）
- `GET /api/batches/readings/:readingId/history` - 查询读数处理历史

### 查询与导出

- `GET /api/batches/zones/:zoneId/contracts` - 按温区查询合同
- `GET /api/batches/meters/:meterId/multiplier` - 查询电表倍率
- `GET /api/batches/:id/export-readings` - 导出读数CSV
- `GET /api/batches/:id/export-allocations` - 导出分摊结果CSV
- `GET /api/batches/allocations` - 查询分摊结果
- `POST /api/batches/:id/calculate-allocations` - 计算分摊

### 健康检查

- `GET /api/health` - 服务健康检查

## 异常处理说明

### 异常尖峰检测
系统自动检测用电量超过10000度的记录，标记为`needs_review`状态，需要人工处理。

### 空置期检测
系统自动检查读数日期是否在合同有效期内，标记为空置期。

### 倍率切换
支持在电表配置中记录倍率变更历史。

## 可追踪记录示例

查询某条读数的处理历史：
```
GET /api/batches/readings/1/history
```

返回结果包含：
- 当前读数详情
- 处理记录（处理动作、原因、处理人、时间、备注）

## 导出一致性保证

所有导出接口返回的CSV文件数量与查询结果数量完全一致，确保财务对账准确。
