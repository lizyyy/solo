# 园区访客通行异常回执状态机 API

## 项目概述

这是一个园区访客通行异常回执状态管理系统，用于处理访客预约表、闸机记录、临时车牌截图和手工改价表等材料，实现完整的状态机流转和异常处理机制。

## 核心功能

### 1. 状态机流程
- **批次创建** - 新建处理批次
- **材料上传** - 支持访客预约表、闸机记录、车牌截图、手工改价表、历史压缩包
- **复核改判** - 人工审核异常记录
- **冻结结算** - 临时冻结待核实，完成后结算
- **撤回归档** - 最终归档保存

### 2. 关键特性
- **状态变更审计** - 每次状态变化记录时间、操作者、原因
- **幂等处理** - 同一批数据支持忽略/覆盖/追加策略
- **历史追溯** - 完整记录谁在什么时候改了什么
- **异步任务** - 失败后区分等重试/等人工/永久失败
- **服务恢复** - 重启后自动恢复待处理任务

### 3. 安保主管视图
- 冻结前后状态对比
- 人工处理理由明细
- 来源可追溯的汇总报告
- Excel导出功能

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化数据库
```bash
python scripts/init_db.py
```

### 3. 生成样例数据
```bash
python scripts/generate_sample_data.py
```

### 4. 运行演示流程
```bash
python scripts/demo_workflow.py
```

### 5. 启动API服务
```bash
python main.py
```

访问 http://localhost:8000/docs 查看API文档

## API接口

### 批次管理
- `POST /api/batches` - 创建批次
- `GET /api/batches` - 查询批次列表
- `GET /api/batches/{id}` - 获取批次详情
- `POST /api/batches/{id}/state` - 变更状态

### 材料管理
- `POST /api/materials/upload` - 上传材料
- `POST /api/materials/{id}/parse` - 解析材料

### 访客记录
- `GET /api/visitors` - 查询访客记录
- `PATCH /api/visitors/{id}` - 更新记录
- `GET /api/visitors/{id}/audit-logs` - 查看审计日志

### 任务管理
- `GET /api/tasks` - 查询任务列表
- `POST /api/tasks/recover` - 恢复运行中任务
- `POST /api/tasks/manual-retry` - 人工重试
- `POST /api/tasks/manual-resolve` - 人工处理

### 报告导出
- `GET /api/reports/security-supervisor/{batch_id}` - 安保主管报告
- `POST /api/reports/export` - 导出Excel报告

## 目录结构

```
.
├── app/
│   ├── api/              # API路由
│   │   ├── batches.py
│   │   ├── materials.py
│   │   ├── visitors.py
│   │   ├── tasks.py
│   │   └── reports.py
│   ├── models/           # 数据模型
│   │   ├── enums.py
│   │   └── models.py
│   ├── schemas/          # Pydantic Schema
│   ├── services/         # 业务逻辑
│   │   ├── state_machine.py    # 状态机核心
│   │   ├── batch_service.py
│   │   ├── material_service.py
│   │   ├── visitor_service.py
│   │   ├── task_service.py
│   │   ├── material_parser.py
│   │   └── report_service.py
│   ├── config.py
│   └── database.py
├── scripts/              # 脚本
│   ├── init_db.py
│   ├── generate_sample_data.py
│   └── demo_workflow.py
├── data/
│   ├── sample/           # 样例数据
│   ├── uploads/          # 上传文件
│   └── exports/          # 导出文件
├── logs/
├── main.py
└── requirements.txt
```

## 状态流转图

```
DRAFT → CREATED → MATERIALS_UPLOADED → UNDER_REVIEW → REVIEW_PASSED → SETTLED → ARCHIVED
                                      ↓                   ↓                ↓         ↑
                                    FROZEN ←────────── FROZEN ←─────── FROZEN ────┘
                                      ↓
                                REVIEW_REJECTED
                                      ↓
                                  CANCELLED
```

## 演示流程说明

运行 `demo_workflow.py` 将演示以下完整流程：

1. 创建处理批次
2. 上传访客预约表、闸机记录、手工改价表
3. 解析各类材料生成记录
4. 提交审核并人工修正超时记录
5. 触发异步任务失败并演示人工处理
6. 审核通过后临时冻结（模拟跨天权限核查）
7. 解除冻结并完成结算
8. 生成安保主管专用报告
9. 导出Excel报告
10. 测试幂等性处理
11. 最终归档并展示状态历史
