# 备份恢复申请台

一个面向技术场景的数据库恢复管理平台，提供可审批、可演练、可回滚的全流程管理。

## 功能特性

### 核心流程
- **恢复申请**: 提交恢复需求，指定备份点、恢复范围、目标环境
- **审批流程**: 支持多级审批，记录审批意见
- **演练验证**: 在演练环境预演恢复过程，验证可行性
- **分步执行**: 分步骤执行恢复，实时监控进度
- **失败回滚**: 执行失败时支持回滚操作
- **验证报告**: 恢复完成后的数据一致性验证

### 数据模型
- **备份点管理**: 管理可用的备份快照
- **恢复记录**: 恢复申请主记录，跟踪状态流转
- **审批记录**: 审批流程记录
- **执行步骤**: 分步骤执行记录
- **验证结果**: 数据验证项记录
- **变更日志**: 全操作审计日志

## 技术栈
- **后端**: Python + FastAPI + SQLAlchemy
- **前端**: HTML + Bootstrap 5 + JavaScript
- **数据库**: SQLite (可扩展)
- **API**: RESTful API

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python seed_data.py
```

样例数据包含：
- 3个备份点（生产环境2个，演练环境1个）
- 1个**成功案例**（完整流程：申请→审批→演练→执行→验证→完成）
- 1个**失败案例**（执行失败，待回滚）
- 1个**待审批案例**（新建申请等待审批）
- 1个**重复提交测试案例**（用于演示重复提交检测

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问: http://localhost:8000

## 前端功能

### 首页功能
1. **统计概览**: 显示各状态的申请数量统计卡片
2. **申请列表**: 分页显示所有恢复申请
3. **筛选功能**: 按状态、申请人筛选
4. **新建申请**: 提交新的恢复申请

### 详情页功能
1. **基本信息**: 显示申请详情、恢复范围
2. **执行步骤时间线**: 可视化显示各步骤执行状态
3. **审批记录**: 显示审批意见
4. **验证结果**: 显示验证项及结果
5. **变更日志**: 完整的操作审计日志
6. **操作按钮**: 根据当前状态显示可用操作（批准/拒绝/开始演练/开始执行/开始验证/开始回滚

## API接口说明

### 基础路径: `GET /api/v1/records
获取恢复记录列表

**参数**:
- `status`: 状态筛选
- `applicant`: 申请人筛选
- `page`: 页码
- `page_size`: 每页数量

### `GET /api/v1/records/{id}
获取单条记录详情

### `POST /api/v1/records
创建恢复申请

**请求体**:
```json
{
  "title": "申请标题",
  "description": "描述",
  "backup_point_id": "备份点ID",
  "backup_point_time": "2024-05-15T10:00:00",
  "source_environment": "production",
  "target_environment": "staging",
  "restore_scope": {"databases": ["main_db"]", "tables": ["users"]},
  "applicant": "张三",
  "reason": "恢复原因"
}
```

### `POST /api/v1/records/{id}/approve`
审批操作

**请求体**:
```json
{
  "approved": true,
  "approver": "审批人",
  "comment": "审批意见"
}
```

### `POST /api/v1/records/{id}/start-drill`
开始演练

### `POST /api/v1/records/{id}/start-execution`
开始正式执行

### `POST /api/v1/records/{id}/steps/{step_id}/complete`
标记步骤完成

**参数**:
- `result`: 执行结果
- `error_message`: 错误信息（失败时）

### `POST /api/v1/records/{id}/start-verification`
开始验证

### `POST /api/v1/records/{id}/verifications/{verification_id}/complete`
标记验证项完成

### `POST /api/v1/records/{id}/start-rollback`
开始回滚

### `POST /api/v1/records/{id}/complete-rollback`
完成回滚

### `GET /api/v1/records/{id}/export`
导出记录详情

### `GET /api/v1/backup-points`
获取可用备份点列表

### `GET /api/v1/statistics`
获取统计数据

## 状态流转

状态机定义：

```
pending_approval (待审批)
    ↓ approve / reject
approved (已批准) / rejected (已拒绝)
    ↓ start-drill
drill_started (演练中)
    ↓ drill_completed / drill_failed
drill_completed (演练完成) / drill_failed (演练失败)
    ↓ start-execution
execution_started → execution_in_progress (执行中)
    ↓ 失败 / 全部步骤完成
execution_failed (执行失败) → rollback_pending (待回滚)
    ↓ start-verification
verification_pending (待验证) → verification_in_progress (验证中)
    ↓ 全部验证通过 / 验证失败
completed (已完成) / verification_failed (验证失败)
    ↓ start-rollback
rollback_pending (待回滚) → rolled_back (已回滚)
```

## 常见场景操作流程

### 1. 成功恢复（成功恢复流程
1. 创建恢复申请（状态: pending_approval）
2. 审批通过（状态: approved）
3. 开始演练（状态: drill_started）
4. 执行演练步骤
5. 演练完成（状态: drill_completed）
6. 开始正式执行（状态: execution_in_progress）
7. 完成所有执行步骤
8. 开始验证（状态: verification_in_progress）
9. 完成所有验证项
10. 流程结束（状态: completed）

### 2. 执行失败回滚
1. 执行中某步骤失败（状态: execution_failed）
2. 执行失败，点击"开始回滚"
3. 执行回滚操作
4. 回滚完成（状态: rolled_back）

### 3. 重复提交检测
创建申请时，系统自动检测同一备份点在目标环境是否已有进行中的申请，防止重复操作。

## 项目结构

```
├── main.py              # 应用入口
├── database.py          # 数据库模型
├── schemas.py           # Pydantic 数据模型
├── state_machine.py     # 状态机和业务规则
├── api.py               # API 路由
├── seed_data.py         # 样例数据初始化
├── requirements.txt    # 依赖清单
├── .env                # 环境变量
├── templates/          # 前端模板
│   ├── index.html   # 首页
│   └── detail.html  # 详情页
└── static/           # 静态资源
```

## API测试

项目包含各类场景测试脚本：

```bash
# 测试创建申请
curl -X POST http://localhost:8000/api/v1/records \
  -H "Content-Type: application/json" \
  -d '{...'}'

# 测试获取列表
curl http://localhost:8000/api/v1/records

# 测试审批
curl -X POST http://localhost:8000/api/v1/records/1/approve \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "approver": "测试用户", "comment": "同意"}'

# 测试导出
curl http://localhost:8000/api/v1/records/1/export
```

## 注意事项

1. **数据安全**: 本系统为演示系统，生产环境请加强安全措施
2. **权限控制**: 实际使用时请添加用户认证和权限控制
3. **真实执行**: 演示版本中的执行步骤为模拟，实际使用对接真实数据库恢复
4. **数据库升级**: SQLite适合小规模使用，生产环境建议 PostgreSQL 或 MySQL
