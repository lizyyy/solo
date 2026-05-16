# 定时任务漏跑恢复API

基于Go语言开发的定时任务漏跑恢复管理系统，提供完整的漏跑检测、状态追踪、影响分析和恢复报告功能。

## 技术栈

- **Web框架**: Gin
- **ORM**: GORM
- **数据库**: SQLite（本地持久化）
- **唯一标识**: UUID

## 核心功能

### 1. 漏跑识别与互斥控制
- 同一任务同一日期只允许创建一个未完成的漏跑记录
- 自动检测漏跑任务接口

### 2. 状态机推进（严格顺序）
```
PENDING → DETECTED → ANALYZING → RECOVERING → COMPLETED
                          ↓                    ↓
                       FAILED  ←→  MANUAL_FIX  ←→
                          ↓
                     CANCELLED
```

### 3. 异常处理与人工修正
- 所有状态变更保留原始输入和处理结论
- 支持人工修正流程

### 4. 影响范围计算
- 按类型统计受影响数据量
- 按业务日期统计
- 总受影响总数

### 5. 恢复报告导出
- 完整的任务信息
- 状态变更历史
- 异常记录详情
- 影响范围汇总

## API接口

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /api/v1/tasks | 创建漏跑任务 |
| GET | /api/v1/tasks | 查询任务列表 |
| GET | /api/v1/tasks/:id | 查询单个任务 |
| POST | /api/v1/tasks/status | 更新任务状态 |
| POST | /api/v1/tasks/manual-fix | 人工修正 |
| GET | /api/v1/tasks/:id/impact | 查询影响范围 |
| GET | /api/v1/tasks/:id/report | 生成恢复报告 |
| GET | /api/v1/tasks/:id/export | 导出报告 |
| POST | /api/v1/detect | 自动检测漏跑 |

### 数据模型

#### TaskRecovery（漏跑任务）
```json
{
  "id": "uuid",
  "task_name": "任务名称",
  "scheduled_time": "计划执行时间",
  "actual_status": "当前状态",
  "miss_reason": "漏跑原因",
  "recovery_action": "恢复动作",
  "remarks": "备注",
  "created_by": "创建人",
  "updated_by": "更新人",
  "original_input": "原始输入",
  "processing_note": "处理说明",
  "version": 0,
  "impacts": [],
  "logs": []
}
```

#### 状态枚举
- PENDING: 待处理
- DETECTED: 已检测
- ANALYZING: 分析中
- RECOVERING: 恢复中
- COMPLETED: 已完成
- FAILED: 失败
- MANUAL_FIX: 人工修正
- CANCELLED: 已取消

#### 漏跑原因
- SCHEDULER_DOWN: 调度器宕机
- TIMEOUT: 超时
- DEPENDENCY_FAILED: 依赖失败
- RESOURCE_LIMIT: 资源限制
- UNKNOWN: 未知

#### 恢复动作
- RETRY: 重试
- SKIP: 跳过
- MANUAL: 人工处理
- ROLLBACK: 回滚

## 快速开始

### 方式一：使用启动脚本
```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动
```bash
# 编译
go build -o task-recovery-api

# 启动
./task-recovery-api

# 另一个终端创建样例数据
cd scripts && go run sample_data.go
```

### API测试示例

```bash
# 健康检查
curl http://localhost:8080/health

# 创建任务
curl -X POST http://localhost:8080/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "FINANCE_DAILY_BATCH",
    "scheduled_time": "2024-05-15 02:00:00",
    "miss_reason": "SCHEDULER_DOWN",
    "recovery_action": "RETRY",
    "remarks": "测试任务",
    "created_by": "admin"
  }'

# 查询任务列表
curl http://localhost:8080/api/v1/tasks

# 更新状态
curl -X POST http://localhost:8080/api/v1/tasks/status \
  -H "Content-Type: application/json" \
  -d '{
    "id": "任务ID",
    "to_status": "DETECTED",
    "operator": "admin",
    "processing_note": "确认漏跑"
  }'

# 查看报告
curl http://localhost:8080/api/v1/tasks/{id}/report

# 导出报告
curl -O http://localhost:8080/api/v1/tasks/{id}/export
```

## 验收测试要点

### 1. 创建正常数据
- 创建漏跑任务 → 推进状态到完成 → 验证报告

### 2. 重复提交测试
- 对已完成任务再次提交状态更新
- 验证：状态不会被推进，返回错误信息

### 3. 异常路径记录
- 模拟失败场景
- 验证：原始输入和处理结论都被记录
- 导出报告中能看到异常详情

### 4. 互斥控制
- 同一任务同一日期创建多个未完成记录
- 验证：第二个创建请求会被拒绝

## 项目结构

```
.
├── main.go                 # 主入口
├── models/
│   └── models.go          # 数据模型
├── database/
│   └── database.go      # 数据库初始化
├── service/
│   └── task_service.go # 业务逻辑
├── handler/
│   ├── handler.go       # API处理
│   └── utils.go       # 工具函数
├── scripts/
│   └── sample_data.go # 样例数据
├── start.sh             # 启动脚本
├── go.mod
├── go.sum
└── task_recovery.db     # SQLite数据库（运行后生成）
```
