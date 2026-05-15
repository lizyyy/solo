# 跨器心跳后端服务 - 财务结转表处理系统

## 项目概述

这是一个面向医疗机构的财务结转表处理系统，提供跨系统心跳监控、异常处理、批量操作、数据追溯等功能。

## 启动方式

### 环境要求
- Node.js >= 14.x
- SQLite3 (内置)

### 安装依赖
```bash
npm install
```

### 初始化样例数据
```bash
node scripts/init-data.js
```

### 启动服务
```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 健康检查
```bash
curl http://localhost:3000/api/health
```

## 样例来源

### 正常结转记录 (5条)
- **批次**: BATCH-2024-001 ~ BATCH-2024-003
- **来源系统**: ERP系统A、ERP系统B、财务系统C、供应链系统D
- **财务类型**: 药品采购结转、医疗器械结转、门诊收入结转、住院收入结转、耗材采购结转
- **负责人**: 张三、李四、王五、赵六、钱七
- **状态**: success

### 异常结转记录 (3条)
- **批次**: BATCH-2024-004 ~ BATCH-2024-005
- **异常类型**: 负责人缺失 (handler_missing)
- **状态**: error

## API 接口列表

### 1. 心跳监控 API

#### 上报心跳
```bash
POST /api/heartbeat/report
Content-Type: application/json

{
  "service_name": "ERP系统A",
  "status": "normal",
  "error_message": null
}
```

#### 异常心跳上报（保留最后正常时间）
```bash
POST /api/heartbeat/report
Content-Type: application/json

{
  "service_name": "ERP系统A",
  "status": "error",
  "error_message": "数据库连接超时"
}
```

#### 查看所有心跳状态
```bash
GET /api/heartbeat/status
```

#### 查看单个服务心跳状态
```bash
GET /api/heartbeat/status/ERP系统A
```

**关键特性**:
- 异常状态下会自动保留最后一次正常上报时间
- 每次上报都会记录完整历史

### 2. 财务结转表 API

#### 统一查询入口（成功/异常路径一览）
```bash
GET /api/transfer/query
```

查询参数:
- `keyword`: 关键词搜索（批次号、负责人、财务类型等）
- `status`: 状态过滤 (success/error)

响应示例:
```json
{
  "total": 8,
  "success_count": 6,
  "error_count": 2,
  "data": [...]
}
```

#### 获取所有记录
```bash
GET /api/transfer
```

#### 获取单条记录
```bash
GET /api/transfer/{id}
```

#### 创建结转记录
```bash
POST /api/transfer
Content-Type: application/json

{
  "batch_no": "BATCH-2024-006",
  "source_system": "ERP系统A",
  "finance_type": "药品采购结转",
  "amount": 123456.78,
  "transfer_date": "2024-01-20",
  "handler": "周九",
  "handler_department": "财务部一组"
}
```

### 3. 批量操作 API

#### 生成批量操作预览
```bash
POST /api/batch/preview
Content-Type: application/json

{
  "batch_no": "BATCH-2024-004",
  "action_type": "mark_resolved",
  "filter_condition": {
    "status": "error"
  },
  "created_by": "管理员"
}
```

**关键特性**:
- 执行前必须先生成预览
- 预览包含影响范围和具体记录
- 防止误操作，需确认后执行

#### 执行批量操作
```bash
POST /api/batch/execute/{preview_id}
Content-Type: application/json

{
  "operator": "管理员",
  "remark": "补全负责人信息"
}
```

#### 查看预览历史
```bash
GET /api/batch/previews
```

### 4. 历史记录与材料摘要 API

#### 查看处理历史
```bash
GET /api/history?operator=张三
```

#### 添加处理记录（含药房配送回执）
```bash
POST /api/history
Content-Type: application/json

{
  "record_id": "...",
  "action": "approve",
  "operator": "张三",
  "operator_department": "财务部一组",
  "before_status": "pending",
  "after_status": "success",
  "remark": "审核通过",
  "receipt_data": {
    "delivery_no": "DEL-2024-00123",
    "pharmacy": "中心药房",
    "deliverer": "李配送",
    "receive_time": "2024-01-15T10:30:00Z",
    "items": ["药品A", "药品B"]
  }
}
```

#### 查看材料摘要
```bash
GET /api/history/summaries
```

#### 添加材料摘要
```bash
POST /api/history/summaries
Content-Type: application/json

{
  "record_id": "...",
  "summary_type": "处理依据",
  "content": "根据财务制度第123条规定...",
  "created_by": "张三"
}
```

### 5. 追溯与回滚 API

#### 通过处理人追溯操作记录
```bash
GET /api/trace/operator/张三
```

**关键特性**:
- 可追溯每个处理人的所有操作
- 关联原始输入（药房配送回执）
- 关联处理依据（材料摘要）
- 完整的操作时间线

#### 单条记录完整追溯链
```bash
GET /api/trace/record/{record_id}/trace
```

#### 创建回滚候选清单
```bash
POST /api/trace/rollback/candidates
Content-Type: application/json

{
  "record_id": "...",
  "reason": "操作失误，需要回滚",
  "candidate_data": {
    "status": "error",
    "handler": null,
    "handler_department": null,
    "before_status": "success"
  },
  "created_by": "管理员"
}
```

**关键特性**:
- 回滚前必须创建候选清单
- 避免误伤真实数据
- 支持审核确认机制

#### 查看回滚候选清单
```bash
GET /api/trace/rollback/candidates
```

#### 执行回滚操作
```bash
POST /api/trace/rollback/execute/{candidate_id}
Content-Type: application/json

{
  "operator": "管理员"
}
```

## 主流程说明

### 正常处理流程

1. **数据接入**: 各系统财务数据通过API或批量导入方式接入系统
2. **自动校验**: 系统自动校验负责人信息等关键字段
3. **状态标记**: 校验通过标记为 `success`，校验失败标记为 `error`
4. **统一查询**: 通过查询入口查看所有记录的状态分布
5. **处理执行**: 正常记录自动流转，异常记录人工介入
6. **记录追溯**: 所有操作记录留痕，支持历史追溯

### 异常处理流程（负责人缺失场景）

1. **异常发现**: 系统自动检测到 `handler` 字段为空
2. **异常标记**: 记录状态标记为 `error`，错误类型为 `handler_missing`
3. **异常列表**: 在统一查询入口筛选 `status=error` 查看异常
4. **批量预览**: 选择异常记录生成批量处理预览
5. **确认执行**: 确认影响范围后执行批量修复
6. **材料补充**: 添加处理依据和相关材料摘要
7. **操作追溯**: 通过处理人查看完整操作记录和依据

## 数据持久化

系统使用 SQLite 数据库存储所有数据，数据文件位于:
```
data/app.db
```

**重启后保留的数据**:
- 所有财务结转记录
- 所有处理历史记录
- 所有材料摘要
- 所有批量操作预览和执行记录
- 所有回滚候选清单
- 所有心跳上报历史

## 目录结构

```
.
├── server.js              # 主服务入口
├── db.js                  # 数据库配置
├── package.json           # 项目配置
├── routes/                # API路由
│   ├── heartbeat.js       # 心跳监控
│   ├── transfer.js        # 结转记录
│   ├── batch.js           # 批量操作
│   ├── history.js         # 历史记录
│   └── trace.js           # 追溯与回滚
├── scripts/               # 脚本
│   └── init-data.js       # 初始化样例数据
└── data/                  # 数据目录
    └── app.db             # SQLite数据库文件
```

## 核心特性总结

✅ **跨器心跳监控**: 支持多服务心跳上报，异常时保留最后正常时间  
✅ **多源数据接入**: 支持多系统财务数据统一管理  
✅ **异常自动检测**: 自动检测负责人缺失等异常情况  
✅ **统一查询入口**: 成功和异常路径统一视图  
✅ **批量操作预览**: 批量操作前预览影响范围，防止误操作  
✅ **数据持久化**: 重启后所有历史数据保留  
✅ **回滚候选清单**: 清理/回滚前创建候选，避免误伤真实数据  
✅ **处理人追溯**: 通过处理人找到原始输入和处理依据  
✅ **材料摘要管理**: 支持添加处理依据、证明材料等  
✅ **药房配送回执**: 关联原始业务单据，完整追溯链条  
