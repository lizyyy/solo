# 数据质量平台 - 质量规则临时静默 API

## 概述

本 API 提供数据质量规则的临时静默管理功能，支持静默申请、审批、到期自动恢复告警、人工干预恢复以及静默记录导出。

## 项目结构

```
.
├── app/
│   ├── __init__.py          # Flask 应用工厂
│   ├── models.py            # 数据库模型
│   ├── routes.py            # API 路由
│   └── services.py          # 业务逻辑服务
├── tests/
│   └── test_silence_api.py  # 测试用例
├── app.py                   # 应用入口
├── config.py                # 配置文件
├── requirements.txt         # 依赖包
└── README.md                # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
# 使用 Flask CLI
flask --app app init-db
flask --app app seed-data  # 填充示例数据

# 或直接运行
python app.py
```

### 3. 启动服务

```bash
python app.py
# 服务将在 http://localhost:5000 启动
```

## API 接口文档

### 1. 静默申请接口

**接口**: `POST /api/silence/apply`

**输入**:
```json
{
    "rule_id": 1,
    "table_id": 1,
    "applicant": "user_name",
    "reason": "Scheduled maintenance window",
    "start_time": "2024-12-01T00:00:00",
    "end_time": "2024-12-01T23:59:59"
}
```

**字段说明**:
- `rule_id`: 质量规则 ID (必填)
- `table_id`: 数据表 ID (必填)
- `applicant`: 申请人 (必填)
- `reason`: 申请原因 (必填)
- `start_time`: 静默开始时间，ISO 格式 (必填)
- `end_time`: 静默结束时间，ISO 格式 (必填)

**处理**:
- 验证必填字段
- 验证日期格式和逻辑（结束时间 > 开始时间）
- 检查是否存在冲突的活跃静默
- 创建静默申请记录，状态为 `pending`

**输出**:
```json
{
    "message": "Silence application submitted successfully",
    "silence_id": 1,
    "status": "pending"
}
```

---

### 2. 静默审批接口

**接口**: `POST /api/silence/approve/<silence_id>`

**输入**:
```json
{
    "approver": "admin_user"
}
```

**处理**:
- 验证静默申请存在
- 检查申请状态必须为 `pending`
- 更新状态为 `approved`
- 静默该规则下的所有活跃告警
- 记录告警静默历史

**输出**:
```json
{
    "message": "Silence approved successfully",
    "silence_id": 1,
    "status": "approved"
}
```

---

### 3. 静默拒绝接口

**接口**: `POST /api/silence/reject/<silence_id>`

**输入**:
```json
{
    "approver": "admin_user",
    "reason": "Not a valid maintenance window"
}
```

**处理**:
- 验证静默申请存在
- 检查申请状态必须为 `pending`
- 更新状态为 `rejected`

**输出**:
```json
{
    "message": "Silence rejected successfully",
    "silence_id": 1,
    "status": "rejected"
}
```

---

### 4. 到期检查与自动恢复接口

**接口**: `POST /api/silence/check-expired`

**输入**: 无（检查所有已过期的静默）

**处理**:
- 查找所有 `status=approved` 且 `end_time < 当前时间` 的静默
- 对每个过期静默：
  - 更新状态为 `expired`
  - 尝试自动恢复告警
  - 如恢复成功：`restore_status=auto_restored`
  - 如恢复失败：`restore_status=failed`，记录错误信息
- 记录恢复尝试次数

**输出**:
```json
{
    "checked": 2,
    "results": [
        {
            "silence_id": 1,
            "rule_id": 1,
            "status": "auto_restored",
            "message": "Alerts automatically restored"
        },
        {
            "silence_id": 2,
            "rule_id": 2,
            "status": "restore_failed",
            "message": "Automatic restore failed, manual intervention required"
        }
    ]
}
```

---

### 5. 获取恢复失败列表接口

**接口**: `GET /api/silence/failed-restore`

**处理**:
- 查询所有 `restore_status=failed` 的静默记录

**输出**:
```json
{
    "count": 1,
    "silences": [
        {
            "silence_id": 2,
            "rule_id": 2,
            "rule_name": "Email not null check",
            "rule_code": "NULL_CHECK_001",
            "table_id": 1,
            "table_name": "user_profiles",
            "reason": "Emergency fix",
            "end_time": "2024-12-01T12:00:00",
            "restore_attempts": 1,
            "restore_error": "Found merged alerts. Need to verify merge state before restoring."
        }
    ]
}
```

---

### 6. 人工恢复接口

**接口**: `POST /api/silence/restore/<silence_id>`

**输入**:
```json
{
    "restorer": "admin_user"
}
```

**处理**:
- 验证静默申请存在
- 检查恢复状态必须为 `failed` 或 `pending`
- 尝试恢复告警（绕过自动恢复的某些检查）
- 更新 `restore_status=manual_restored`

**输出**:
```json
{
    "message": "Alerts manually restored successfully",
    "silence_id": 2,
    "restore_status": "manual_restored"
}
```

---

### 7. 导出静默记录接口

**接口**: `GET /api/silence/export`

**查询参数**:
- `format`: 导出格式，可选 `csv` 或 `excel` (默认: `csv`)
- `status`: 按状态过滤 (可选)

**处理**:
- 查询符合条件的静默记录
- 关联规则和表信息
- 生成指定格式的文件

**输出**:
- CSV 或 Excel 文件下载

**CSV 示例输出**:
```
ID,Rule ID,Rule Name,Table ID,Table Name,Applicant,Approver,Reason,Start Time,End Time,Status,Restore Status,Created At,Approved At,Restored At
1,1,Email not null check,1,user_profiles,test_user,admin,Scheduled maintenance,2024-12-01T00:00:00,2024-12-01T23:59:59,expired,auto_restored,2024-11-30T10:00:00,2024-11-30T11:00:00,2024-12-02T00:00:00
```

---

### 8. 查询静默列表接口

**接口**: `GET /api/silence`

**查询参数**:
- `page`: 页码 (默认: 1)
- `per_page`: 每页数量 (默认: 20)
- `status`: 按状态过滤 (可选)

**输出**:
```json
{
    "items": [
        {
            "id": 1,
            "rule_id": 1,
            "rule_name": "Email not null check",
            "table_id": 1,
            "table_name": "user_profiles",
            "applicant": "test_user",
            "approver": "admin",
            "reason": "Maintenance",
            "start_time": "2024-12-01T00:00:00",
            "end_time": "2024-12-01T23:59:59",
            "status": "approved",
            "restore_status": "pending",
            "is_active": true,
            "is_expired": false
        }
    ],
    "total": 10,
    "page": 1,
    "per_page": 20,
    "pages": 1
}
```

---

### 9. 查询静默详情接口

**接口**: `GET /api/silence/<silence_id>`

**输出**:
```json
{
    "id": 1,
    "rule_id": 1,
    "rule_name": "Email not null check",
    "table_id": 1,
    "table_name": "user_profiles",
    "applicant": "test_user",
    "approver": "admin",
    "reason": "Maintenance",
    "start_time": "2024-12-01T00:00:00",
    "end_time": "2024-12-01T23:59:59",
    "status": "approved",
    "restore_status": "pending",
    "restore_attempts": 0,
    "alert_history": [
        {
            "alert_id": 1,
            "alert_type": "null_violation",
            "previous_status": "active",
            "silenced_at": "2024-11-30T11:00:00"
        }
    ],
    "is_active": true,
    "is_expired": false
}
```

---

## 特殊场景处理

### 场景 1: 规则改名

**接口**: `POST /api/rule/rename/<rule_id>`

**输入**:
```json
{
    "new_name": "Renamed Rule Name",
    "renamed_by": "admin_user"
}
```

**处理**:
- 更新规则名称
- 记录改名历史
- 更新所有相关静默记录中的告警历史，标记规则名称变更

**输出**:
```json
{
    "message": "Rule renamed successfully",
    "rule_id": 1,
    "old_name": "Original Rule Name",
    "new_name": "Renamed Rule Name"
}
```

---

### 场景 2: 表迁移

**接口**: `POST /api/rule/migrate-table/<table_id>`

**输入**:
```json
{
    "new_database": "new_production",
    "new_schema": "public",
    "new_table_name": "new_user_profiles",
    "migrated_by": "admin_user"
}
```

**处理**:
- 更新表信息
- 记录迁移历史
- 更新所有相关静默记录中的告警历史，标记表迁移信息
- 返回受影响的规则数量

**输出**:
```json
{
    "message": "Table migrated successfully",
    "table_id": 1,
    "affected_rules_count": 3,
    "affected_rules": [
        {
            "rule_id": 1,
            "rule_code": "NULL_CHECK_001",
            "silence_count": 2
        }
    ]
}
```

---

### 场景 3: 告警合并

**接口**: `POST /api/alert/merge`

**输入**:
```json
{
    "source_alert_ids": [2, 3, 4],
    "target_alert_id": 1,
    "merged_by": "admin_user"
}
```

**处理**:
- 将源告警合并到目标告警
- 更新源告警状态为 `merged`
- 记录合并关系
- 更新相关静默记录的告警历史
- **重要**: 合并后的告警在静默到期时会阻止自动恢复，需要人工干预

**输出**:
```json
{
    "message": "Successfully merged 3 alerts",
    "target_alert_id": 1,
    "merged_count": 3
}
```

---

## 测试命令

### 运行所有测试

```bash
pytest tests/test_silence_api.py -v
```

### 运行特定测试类

```bash
pytest tests/test_silence_api.py::TestNormalScenarios -v
pytest tests/test_silence_api.py::TestExceptionScenarios -v
pytest tests/test_silence_api.py::TestSpecialScenarios -v
pytest tests/test_silence_api.py::TestRepeatability -v
```

### 运行单个测试用例

```bash
pytest tests/test_silence_api.py::TestNormalScenarios::test_apply_silence -v
```

### 生成测试覆盖率报告

```bash
pytest tests/test_silence_api.py --cov=app --cov-report=html
```

---

## 验收测试场景

### 1. 正常记录场景

```bash
# 1. 申请静默
curl -X POST http://localhost:5000/api/silence/apply \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "table_id": 1,
    "applicant": "tester",
    "reason": "Scheduled maintenance",
    "start_time": "2024-12-01T00:00:00",
    "end_time": "2024-12-01T23:59:59"
  }'

# 2. 审批静默
curl -X POST http://localhost:5000/api/silence/approve/1 \
  -H "Content-Type: application/json" \
  -d '{"approver": "admin"}'

# 3. 检查告警状态（应为 silenced）
curl http://localhost:5000/api/alert

# 4. 触发到期检查
curl -X POST http://localhost:5000/api/silence/check-expired

# 5. 检查恢复状态（应为 auto_restored）
curl http://localhost:5000/api/silence/1

# 6. 导出静默记录
curl -O http://localhost:5000/api/silence/export?format=csv
```

### 2. 异常记录场景

```bash
# 1. 测试缺少字段
curl -X POST http://localhost:5000/api/silence/apply \
  -H "Content-Type: application/json" \
  -d '{"rule_id": 1, "applicant": "tester"}'

# 2. 测试无效日期
curl -X POST http://localhost:5000/api/silence/apply \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "table_id": 1,
    "applicant": "tester",
    "reason": "Test",
    "start_time": "invalid-date",
    "end_time": "2024-12-31"
  }'

# 3. 测试重复申请
curl -X POST http://localhost:5000/api/silence/apply \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "table_id": 1,
    "applicant": "another_user",
    "reason": "Duplicate",
    "start_time": "2024-12-01T00:00:00",
    "end_time": "2024-12-01T23:59:59"
  }'
```

### 3. 重复运行场景

```bash
# 多次调用到期检查（应保证幂等性）
for i in {1..5}; do
  echo "=== Run $i ==="
  curl -X POST http://localhost:5000/api/silence/check-expired
  echo ""
done

# 多次调用导出
for i in {1..3}; do
  curl -s -o /dev/null -w "Export $i: %{http_code}\n" http://localhost:5000/api/silence/export?format=csv
done
```

---

## 状态枚举

### 静默状态 (status)
- `pending`: 待审批
- `approved`: 已批准（活跃）
- `rejected`: 已拒绝
- `expired`: 已过期
- `restored`: 已恢复

### 恢复状态 (restore_status)
- `pending`: 待恢复
- `auto_restored`: 自动恢复成功
- `manual_restored`: 人工恢复成功
- `failed`: 恢复失败

### 告警状态
- `active`: 活跃
- `silenced`: 已静默
- `merged`: 已合并

---

## 注意事项

1. **告警合并处理**: 合并后的告警会阻止自动恢复，需要管理员人工确认后手动恢复
2. **规则改名追踪**: 所有历史静默记录都会追踪规则名称变更，保证审计可追溯
3. **表迁移记录**: 表迁移会记录新旧位置信息，便于数据血缘追踪
4. **幂等性保证**: 到期检查接口支持重复调用，不会重复处理已恢复的静默
5. **错误重试**: 恢复失败的记录会记录错误信息，便于排查问题

---

## 数据库表结构

### data_tables (数据表)
- id, database_name, schema_name, table_name, description, created_at, updated_at, is_active, migration_history (JSON)

### quality_rules (质量规则)
- id, rule_code, rule_name, rule_type, table_id, column_name, expression, threshold, severity, status, created_at, updated_at, name_history (JSON)

### rule_silences (规则静默)
- id, rule_id, table_id, applicant, approver, reason, start_time, end_time, status, restore_status, restore_attempts, last_restore_attempt, restore_error, created_at, approved_at, expired_at, restored_at, alert_history (JSON)

### alerts (告警)
- id, rule_id, table_id, alert_type, severity, message, status, merged_into, created_at, updated_at, silenced_by
