# 教室调换设备匹配通知确认后端API

培训中心临时换教室时，学员通知、设备要求和签到码更新的管理系统。

## 核心功能

- ✅ **教室容量检查**: 自动验证目标教室能否容纳学员人数
- ✅ **设备匹配验证**: 检查目标教室设备是否满足课程需求
- ✅ **状态流转管控**: DRAFT → PENDING_APPROVAL → APPROVED → NOTIFYING → ALL_CONFIRMED → COMPLETED → CLOSED
- ✅ **学员通知管理**: 批量生成通知，支持单条确认
- ✅ **签到码刷新**: 教室调换后自动更新签到码
- ✅ **审计日志**: 所有操作留痕，保存原始输入、处理人、结论
- ✅ **人工修正**: 支持特殊情况下的人工调整
- ✅ **撤回/关闭**: 支持取消调换和结案处理
- ✅ **报告导出**: 支持调换报告查询和CSV导出

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **测试**: pytest

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问:
- API文档: http://localhost:8000/docs
- Redoc文档: http://localhost:8000/redoc

### 3. 初始化测试数据

```bash
python seed_data.py
```

会创建:
- 4间教室（含设备配置）
- 3门课程（含设备需求和学员）
- 75名学员

## 主流程 Curl 示例

### 步骤1: 创建教室调换申请

```bash
curl -X POST "http://localhost:8000/api/swaps/" \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": 1,
    "original_room_id": 1,
    "target_room_id": 2,
    "reason": "原教室设备维护",
    "scheduled_time": "2024-12-25T09:00:00",
    "created_by": "教务管理员"
  }'
```

### 步骤2: 提交审批

```bash
# 假设调换申请ID为1
curl -X PATCH "http://localhost:8000/api/swaps/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "pending_approval",
    "operator": "教务主管",
    "remarks": "请审批"
  }'
```

### 步骤3: 审批通过

```bash
curl -X PATCH "http://localhost:8000/api/swaps/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "approved",
    "operator": "培训中心主任",
    "remarks": "同意调换"
  }'
```

### 步骤4: 创建学员通知

```bash
curl -X POST "http://localhost:8000/api/swaps/1/notifications"
```

### 步骤5: 学员确认通知

```bash
# 假设通知ID为1
curl -X PATCH "http://localhost:8000/api/notifications/1/confirm?confirmed_by=学员01"
```

### 步骤6: 刷新签到码

```bash
curl -X POST "http://localhost:8000/api/swaps/1/sign-in-code" \
  -H "Content-Type: application/json" \
  -d '{
    "new_code": "SIGN-NEW-20241225",
    "operator": "系统管理员"
  }'
```

### 步骤7: 完成调换并关闭

```bash
curl -X POST "http://localhost:8000/api/swaps/1/close?operator=教务管理员&conclusion=调换完成，授课顺利"
```

## 查询接口

### 查询调换列表

```bash
# 全部
curl "http://localhost:8000/api/swaps/"

# 按状态筛选
curl "http://localhost:8000/api/swaps/?status=approved"

# 按课程筛选
curl "http://localhost:8000/api/swaps/?course_id=1"
```

### 查看调换详情

```bash
curl "http://localhost:8000/api/swaps/1"
```

### 查看审计日志

```bash
curl "http://localhost:8000/api/swaps/1/audit-logs"
```

### 查看调换报告

```bash
curl "http://localhost:8000/api/swaps/1/report"
```

### 导出CSV报告

```bash
curl "http://localhost:8000/api/swaps/1/export/csv"
```

## 冲突路径示例

### 1. 容量不足冲突

创建调换时自动检测容量：

```bash
curl -X POST "http://localhost:8000/api/swaps/" \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": 1,
    "original_room_id": 1,
    "target_room_id": 3,
    "reason": "测试容量冲突",
    "scheduled_time": "2024-12-25T09:00:00",
    "created_by": "测试"
  }'
```

返回结果中 `check_capacity_pass` 会是 `false`，且无法进入 `approved` 状态。

### 2. 设备不匹配冲突

目标教室缺少课程必需的设备：

```bash
# 假设课程需要计算机教室，但目标教室没有
curl -X POST "http://localhost:8000/api/swaps/" \
  -H "Content-Type: application/json" \
  -d '{
    "course_id": 1,
    "original_room_id": 2,
    "target_room_id": 3,
    "reason": "测试设备冲突",
    "scheduled_time": "2024-12-25T09:00:00",
    "created_by": "测试"
  }'
```

返回结果中 `check_devices_pass` 会是 `false`，无法继续审批流程。

### 3. 非法状态转换

已关闭的调换无法重新打开：

```bash
curl -X PATCH "http://localhost:8000/api/swaps/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "draft",
    "operator": "测试用户"
  }'
```

会返回 400 错误，提示不允许的状态转换。

## 人工修正接口

```bash
curl -X PATCH "http://localhost:8000/api/swaps/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "reason",
    "old_value": "原教室设备维护",
    "new_value": "突发情况需紧急调换",
    "operator": "超级管理员",
    "reason": "紧急情况特批"
  }'
```

## 撤回调换

```bash
curl -X POST "http://localhost:8000/api/swaps/1/cancel?operator=教务管理员&reason=不需要调换了"
```

## 运行测试

### 执行所有测试

```bash
pytest test_main.py -v
```

### 执行特定测试类

```bash
pytest test_main.py::TestStatusFlow -v
pytest test_main.py::TestConflictCases -v
```

### 生成测试覆盖率报告

```bash
pytest test_main.py --cov=. --cov-report=html
```

## 数据库模型

### 核心表结构

- **rooms**: 教室信息（名称、位置、容量、状态）
- **room_devices**: 教室设备配置
- **courses**: 课程信息（含原教室）
- **device_requirements**: 课程设备需求
- **students**: 学员信息
- **room_swaps**: 教室调换主记录（核心）
  - `check_capacity_pass`: 容量检查结果
  - `check_devices_pass`: 设备检查结果
  - `original_input`: 原始请求输入JSON
- **notifications**: 学员通知记录
- **sign_in_codes**: 签到码记录
- **audit_logs**: 审计日志（所有操作）

## 状态流转图

```
DRAFT → PENDING_APPROVAL → APPROVED → NOTIFYING → ALL_CONFIRMED → COMPLETED → CLOSED
  ↓              ↓            ↓           ↓            ↓            ↓
CANCELLED    CANCELLED    CANCELLED   CANCELLED    CANCELLED        ×
  ↓
CLOSED
```

所有状态变更都记录在 audit_logs 中。

## API 端点总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/rooms/ | 创建教室 |
| GET | /api/rooms/ | 查询教室列表 |
| POST | /api/rooms/{id}/devices/ | 添加教室设备 |
| POST | /api/courses/ | 创建课程 |
| GET | /api/courses/ | 查询课程列表 |
| GET | /api/courses/{id} | 查询课程详情 |
| POST | /api/swaps/ | 创建调换申请 |
| GET | /api/swaps/ | 查询调换列表 |
| GET | /api/swaps/{id} | 查询调换详情 |
| PATCH | /api/swaps/{id}/status | 更新状态 |
| POST | /api/swaps/{id}/notifications | 创建学员通知 |
| GET | /api/swaps/{id}/notifications | 查看通知列表 |
| PATCH | /api/notifications/{id}/confirm | 确认通知 |
| POST | /api/swaps/{id}/sign-in-code | 刷新签到码 |
| GET | /api/swaps/{id}/sign-in-code | 查询签到码 |
| POST | /api/swaps/{id}/cancel | 撤回调换 |
| POST | /api/swaps/{id}/close | 关闭调换 |
| PATCH | /api/swaps/{id}/correct | 人工修正 |
| GET | /api/swaps/{id}/audit-logs | 查询审计日志 |
| GET | /api/swaps/{id}/report | 获取调换报告 |
| GET | /api/swaps/{id}/export/csv | 导出CSV报告 |
| GET | /api/health | 健康检查 |
