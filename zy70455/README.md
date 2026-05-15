# 调用链采样导出后端服务

## 功能概述

基于过期研发值班记录的调用链采样导出系统，具备以下核心能力：

1. **规则版本化管理** - 支持多版本采样规则，旧批次可追溯当时的判断口径
2. **脏数据处理** - 保留外部回执晚到等异常场景并可统计分析
3. **数据安全清理** - 清理/回滚需先生成候选清单，经审批后方可执行
4. **完整审计追溯** - 所有操作留痕，可从执行时间定位到数据擦除申请
5. **原始数据保留** - 值班记录字段可回溯到原始输入

## 技术栈

- Python 3.8+
- FastAPI - Web框架
- SQLAlchemy - ORM框架
- SQLite - 持久化存储（本地重启数据不丢失）
- Uvicorn - ASGI服务器

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8080` 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

### 4. 初始化演示数据

访问API文档，执行 `/api/demo/init` 接口，系统将自动生成：
- 2个版本的采样规则（V1.0-202401, V2.0-202404）
- 4个部门的值班记录批次
- 包含外部回执晚到场景的脏数据

## API接口说明

### 演示数据
- `POST /api/demo/init` - 初始化演示数据

### 采样规则管理
- `POST /api/rules` - 创建新采样规则（自动停用旧版本）
- `GET /api/rules` - 获取所有规则版本
- `GET /api/rules/active` - 获取当前激活规则
- `GET /api/rules/{version}` - 获取指定版本规则

### 批次管理
- `POST /api/batches` - 创建处理批次
- `GET /api/batches` - 查询批次列表
- `GET /api/batches/{batch_id}` - 获取批次详情
- `GET /api/batches/{batch_id}/raw-records` - 获取批次原始记录

### 采样执行
- `POST /api/batches/{batch_id}/sample` - 执行调用链采样
  - 可指定规则版本，不指定则使用当前激活规则
  - 返回采样结果，包含晚到回执统计和当时使用的规则快照

### 值班记录管理
- `POST /api/records/batch` - 批量创建值班记录
- `GET /api/records/{record_id}` - 获取单条记录详情（含原始输入）

### 数据安全清理
- `POST /api/cleanup/candidates` - 创建清理候选清单
- `GET /api/cleanup/candidates` - 获取候选清单列表
- `POST /api/cleanup/candidates/{candidate_id}/approve` - 审批候选
- `POST /api/cleanup/candidates/{candidate_id}/execute` - 执行清理

### 审计日志
- `GET /api/logs` - 查询操作日志
- `GET /api/logs/trace` - 根据执行时间追溯数据擦除申请

## 核心业务流程

### 1. 典型采样流程
```
创建规则版本 → 创建处理批次 → 导入值班记录 → 执行采样 → 
查看采样结果(含规则快照) → 导出数据
```

### 2. 数据清理流程
```
创建清理候选(列出影响范围) → 审批确认 → 执行清理 → 
操作留痕可追溯
```

### 3. 复盘追溯流程
```
给定时间范围 → 查询清理操作日志 → 关联候选创建记录 → 
查看审批链和操作人
```

## 数据模型说明

### DutyRecord (值班记录)
- 保存完整的原始输入(raw_input)
- 标记外部回执状态(received/pending/late)
- 关联批次ID

### SamplingRule (采样规则)
- 版本化管理(version)
- 支持部门白/黑名单
- 包含采样率、事件阈值、超时时间等参数

### ProcessingBatch (处理批次)
- 关联特定规则版本
- 执行采样后保存规则快照(rule_snapshot)
- 保存采样统计摘要

### OperationLog (操作日志)
- 所有关键操作留痕
- 支持按时间、操作类型、操作员查询

### CleanupCandidate (清理候选)
- 三状态流转: pending → approved → executed
- 保存影响范围摘要
- 记录审批链和执行时间

## 注意事项

1. **数据持久化**：使用SQLite数据库文件 `call_chain_sampling.db`，本地重启数据不丢失
2. **规则变更**：创建新规则会自动停用同部门旧规则，但旧批次仍保留当时的规则快照
3. **清理安全**：必须先创建候选清单并审批通过，才能执行实际删除操作
4. **原始数据**：所有值班记录都保留了原始输入字段，可随时回溯
