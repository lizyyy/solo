# 任务批次水印后端服务

## 功能特性

### 1. 参数组合漏测拦截
- 系统内置参数组合验证规则
- 未覆盖的参数组合会被拦截并说明原因
- 提供参数调整建议

### 2. 异常记录处理
- 异常记录不会被跳过
- 异常记录与正常记录一起进入历史数据库
- 可追溯原始异常信息

### 3. 失败项管理
- 处理失败的记录单独保存
- 包含错误详情和堆栈信息
- 可关联客服升级工单号
- 方便接手人直接查看失败原因

### 4. 回滚/清理候选清单
- 执行前先生成候选清单
- 避免误伤真实数据
- 需要审批后才能执行
- 记录操作人和操作时间

### 5. 人工修正备注
- 人工修正必须留下备注
- 不直接覆盖系统判断
- 保存原始判断和修正后判断
- 可关联复核意见和客服工单号
- 支持根据工单号追溯原始记录

### 6. 处理报告
- 处理前后数据对比
- 执行时间统计
- 下一步建议
- 拦截记录分析
- 失败项总结

## 技术栈

- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- SQLite (可扩展为其他数据库)
- Pydantic 2.x

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### API文档

启动后访问: http://localhost:8000/docs

## API接口说明

### 批次处理
- `POST /api/batch/process` - 处理批次水印
- `GET /api/batch/{batch_id}` - 获取批次信息
- `GET /api/batch/{batch_id}/records` - 获取批次所有记录
- `GET /api/batch/{batch_id}/failed` - 获取批次失败项
- `GET /api/batches` - 获取所有批次列表

### 回滚管理
- `POST /api/batch/{batch_id}/rollback/candidates` - 生成回滚候选清单
- `GET /api/batch/{batch_id}/rollback/candidates` - 获取回滚候选清单
- `POST /api/rollback/candidates/{candidate_id}/approve` - 审批回滚候选
- `POST /api/rollback/candidates/{candidate_id}/execute` - 执行回滚

### 人工修正
- `POST /api/correction` - 创建人工修正备注
- `GET /api/correction/ticket/{ticket_id}` - 根据工单号查询修正记录

### 报告
- `GET /api/batch/{batch_id}/report` - 获取批次处理报告

## 核心参数组合验证规则

当前验证的合法参数组合:
1. channel=online, product=A, region=domestic
2. channel=online, product=B, region=domestic
3. channel=offline, product=A, region=domestic
4. channel=online, product=A, region=international

其他组合将被拦截并提示风险。

## 临时权限票据说明

系统接收 `temp_permission_ticket` 作为输入背景，用于追溯批次的授权来源。

## 数据模型

- TaskBatch: 任务批次主表
- WatermarkRecord: 水印记录表(含异常和正常记录)
- FailedItem: 失败项表
- RollbackCandidate: 回滚候选表
- ManualCorrection: 人工修正表
- ProcessReport: 处理报告表
- ParameterCombinationCheck: 参数组合检查表
