# 正畸复诊牙套阶段管理系统

## 项目概述

这是一个正畸治疗过程中的牙套阶段管理系统，实现了从患者管理、牙套批次、复诊计划到医生待办的完整闭环。

## 核心功能

### 1. 患者管理
- 创建/编辑患者信息
- 治疗阶段跟踪（初始/对齐/收缝/精调/保持/完成）
- 当前牙套进度跟踪

### 2. 牙套批次管理
- 批量导入牙套批次
- 牙套状态跟踪（待佩戴/佩戴中/已完成/已跳过/丢失/损坏）
- 批次进度推进

### 3. 复诊计划管理
- 创建/编辑复诊预约
- 复诊状态跟踪（已预约/已确认/已完成/爽约/已取消/已改期）
- 自动关联对应牙套批次

### 4. 逾期提醒
- 自动检测逾期复诊
- 自动创建异常记录
- 自动标记为爽约状态

### 5. 异常反馈处理
- 人工创建异常记录（牙套问题/治疗偏差/患者投诉等）
- 异常状态跟踪（开放/处理中/已解决/已关闭）
- 自动创建医生待办

### 6. 医生待办
- 自动生成待办任务
- 待办状态跟踪
- 按负责人筛选

### 7. 时间线与修改历史
- 每个状态变化都记录原因和操作人
- 完整的时间线展示
- 修改前后值对比记录

### 8. 报告导出
- 支持JSON和CSV格式导出
- 按责任人和处理时间筛选
- 包含完整修改历史

### 9. 幂等性保证
- 重复操作自动识别
- 防止重复创建记录

## 项目结构

```
├── src/
│   ├── types/
│   │   └── index.ts          # 类型定义和枚举
│   ├── database/
│   │   └── init.ts           # 数据库初始化
│   ├── services/
│   │   ├── database.ts       # 数据库基础服务
│   │   └── treatment.ts      # 治疗业务服务
│   ├── routes/
│   │   ├── patients.ts       # 患者路由
│   │   ├── batches.ts        # 牙套批次路由
│   │   ├── appointments.ts   # 复诊路由
│   │   ├── todos.ts          # 待办路由
│   │   ├── exceptions.ts     # 异常路由
│   │   └── reports.ts        # 报告路由
│   ├── test/
│   │   └── sample-data.ts    # 样例数据脚本
│   └── index.ts              # 主入口文件
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 创建样例数据

```bash
npm test
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 启动生产服务器

```bash
npm run build
npm start
```

## API 端点

### 患者相关
- `GET /api/patients` - 获取所有患者
- `GET /api/patients/:id` - 获取单个患者
- `POST /api/patients` - 创建患者（支持幂等）
- `POST /api/patients/batch-import` - 批量导入患者
- `GET /api/patients/:id/timeline` - 获取患者时间线
- `GET /api/patients/:id/batches` - 获取患者牙套批次
- `GET /api/patients/:id/appointments` - 获取患者复诊
- `GET /api/patients/:id/todos` - 获取患者待办
- `GET /api/patients/:id/exceptions` - 获取患者异常记录
- `PUT /api/patients/:id/phase` - 更新治疗阶段
- `GET /api/patients/:id/history/:entityType/:entityId` - 获取修改历史

### 牙套批次相关
- `POST /api/batches` - 创建牙套批次（支持幂等）
- `POST /api/batches/batch-import` - 批量导入批次
- `PUT /api/batches/:id/status` - 更新批次状态

### 复诊相关
- `POST /api/appointments` - 创建复诊（支持幂等）
- `PUT /api/appointments/:id/status` - 更新复诊状态

### 待办相关
- `GET /api/todos` - 获取待办列表（可按负责人和状态筛选）
- `PUT /api/todos/:id/complete` - 完成待办

### 异常相关
- `GET /api/exceptions` - 获取异常列表
- `POST /api/exceptions` - 创建异常
- `PUT /api/exceptions/:id/resolve` - 解决异常

### 报告相关
- `GET /api/reports/export` - 导出报告（JSON）
- `GET /api/reports/export/csv` - 导出报告（CSV）

### 系统相关
- `POST /api/check-overdue` - 检查逾期复诊
- `GET /api/health` - 健康检查

## 数据模型

### TreatmentPhase（治疗阶段）
- `initial` - 初始阶段
- `alignment` - 对齐阶段
- `space_closure` - 收缝阶段
- `finishing` - 精调阶段
- `retention` - 保持阶段
- `completed` - 治疗完成

### AlignerStatus（牙套状态）
- `pending` - 待佩戴
- `in_use` - 佩戴中
- `completed` - 已完成
- `skipped` - 已跳过
- `lost` - 丢失
- `damaged` - 损坏

### AppointmentStatus（复诊状态）
- `scheduled` - 已预约
- `confirmed` - 已确认
- `completed` - 已完成
- `missed` - 爽约
- `cancelled` - 已取消
- `rescheduled` - 已改期

### ExceptionType（异常类型）
- `overdue` - 逾期
- `aligner_issue` - 牙套问题
- `treatment_deviation` - 治疗偏差
- `patient_complaint` - 患者投诉

## 样例数据说明

运行 `npm test` 会创建以下样例数据：

1. **2位患者** - 张三（对齐阶段）、李四（初始阶段）
2. **3个牙套批次** - 包含已完成、佩戴中、待佩戴状态
3. **3个复诊** - 包含1个逾期复诊
4. **1个人工异常** - 牙套破损问题（已解决）
5. **1个自动异常** - 逾期提醒（系统自动生成）
6. **多个待办** - 自动关联复诊和异常
7. **完整时间线** - 记录所有状态变化
8. **修改历史** - 记录所有字段修改前后值

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web框架
- **TypeScript** - 类型安全
- **SQLite** - 本地数据库
- **json2csv** - CSV导出
- **uuid** - ID生成
- **crypto** - 幂等性哈希
