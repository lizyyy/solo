# 船舶靠泊排队调度 API 服务

## 功能特性

### 1. 材料提交与重复检测
- 支持批量提交船舶调度材料
- 自动检测重复提交（通过批次号和材料哈希）
- 重复提交返回历史处理结果

### 2. 任务状态管理（持久化存储）
- processing - 处理中
- failed - 处理失败
- manual_confirm - 人工确认
- completed - 已完成
- partial_completed - 部分完成
- exported - 已导出

### 3. 审计追踪
- 记录所有状态变更
- 记录谁在什么时候修改了什么
- 记录修改原因
- 可追溯修改前后值对比

### 4. 字段溯源
- 错误明细可追溯到原始材料位置
- 关键字段从原始输入到最终报告全链路追踪

### 5. 船舶调度算法
- **吃水深度**：考虑船舶吃水与泊位水深匹配
- **潮汐窗口**：吃水不足时自动计算潮汐窗口
- **插队审批**：支持紧急任务插队，记录审批人

### 6. 泊位管理
- 锁定泊位，防止冲突
- 泊位调整记录前后差异
- 调整原因记录

## 项目结构

```
.
├── src/
│   ├── index.js                 # 应用入口
│   ├── database/
│   │   ├── init.js              # 数据库初始化脚本
│   │   └── db.js                # 数据库连接封装
│   ├── services/
│   │   ├── taskService.js       # 任务服务
│   │   └── schedulerService.js  # 调度算法服务
│   ├── routes/
│   │   └── tasks.js             # API路由
│   └── utils/
│       ├── validator.js         # 数据验证
│       └── hash.js              # 哈希计算
├── data/                        # 数据库文件目录
├── test-data.json               # 测试数据
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

### 3. 启动服务

```bash
npm start
# 或者开发模式
npm run dev
```

服务将在 http://localhost:3000 启动

## API 接口文档

### 健康检查
```
GET /health
```

### 提交调度材料
```
POST /api/tasks/submit
Content-Type: application/json

{
  "batch_no": "BATCH-2024-001",
  "submitted_by": "调度员张三",
  "schedule_date": "2024-05-20T00:00:00Z",
  "ships": [
    {
      "ship_name": "远洋一号",
      "imo_no": "IMO9876543",
      "draught": 11.5,
      "length": 280,
      "arrival_time": "2024-05-20T08:00:00Z",
      "priority": 2
    }
  ]
}
```

### 获取任务详情
```
GET /api/tasks/:taskId
```

### 获取任务列表
```
GET /api/tasks?status=completed&page=1&pageSize=20
```

### 更新任务状态
```
PATCH /api/tasks/:taskId/status
Content-Type: application/json

{
  "status": "manual_confirm",
  "changed_by": "调度主任",
  "reason": "需要人工确认泊位分配"
}
```

### 获取审计日志
```
GET /api/tasks/:taskId/audit-logs
```

### 导出任务
```
POST /api/tasks/:taskId/export
Content-Type: application/json

{
  "exported_by": "调度员张三"
}
```

### 锁定泊位分配
```
POST /api/tasks/berth-assignments/:assignmentId/lock
Content-Type: application/json

{
  "locked_by": "调度员张三"
}
```

### 调整泊位
```
POST /api/tasks/berth-assignments/:assignmentId/adjust
Content-Type: application/json

{
  "new_berth_id": 2,
  "adjusted_by": "调度员张三",
  "reason": "原泊位临时维护"
}
```

### 获取泊位调整记录
```
GET /api/tasks/berth-assignments/:assignmentId/adjustments
```

## 测试示例

使用 curl 测试提交材料：

```bash
curl -X POST http://localhost:3000/api/tasks/submit \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

## 数据库表说明

| 表名 | 说明 |
|------|------|
| tasks | 任务主表 |
| ships | 船舶信息表 |
| berths | 泊位基础信息表 |
| berth_assignments | 泊位分配记录表 |
| berth_adjustments | 泊位调整记录表 |
| tides | 潮汐数据表 |
| audit_logs | 审计日志表 |
| task_status_history | 任务状态历史表 |
| field_tracking | 字段追踪表 |
