# 商旅审批服务 - 差旅政策例外 API

## 核心设计原则

本服务围绕 **状态、幂等、审计、异常解释**四大核心原则设计，确保差旅政策例外审批的严谨性和可追溯性。

---

## 数据模型设计

### 1. 核心实体

| 实体 | 说明 |
|------|------|
| **Employee** | 员工信息，包含部门、职级、直属上级 |
| **Destination** | 目的地配置，关联酒店档次、舱位标准 |
| **PolicyClause** | 政策条款，分酒店/机票两类，包含限额标准 |
| **ExceptionRequest** | 例外申请主表，支持住宿/机票/同时例外 |
| **AuditLog** | 审核历史日志，完整记录每一次状态变更 |
| **ImportValidation** | 导入行级校验结果，支持批量导入场景 |

### 2. 状态机设计

```
待审批 (pending_approval)
    ↓
    ├─→ 升级 → 例外审核 (exception_review)
    │                       ↓
    │                       ├─→ 批准 → 已通过 (approved)
    │                       └─→ 拒绝 → 已拒绝 (rejected)
    │
    ├─→ 批准 → 已通过 (approved)
    └─→ 拒绝 → 已拒绝 (rejected)
```

**状态转换规则在 `services.py:StateMachine` 中严格定义**

---

## API 接口设计

### 例外申请管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/exceptions` | 查询申请列表（支持过滤、分页） |
| GET | `/api/v1/exceptions/{id}` | 查询申请详情 |
| POST | `/api/v1/exceptions` | 创建例外申请（幂等） |
| POST | `/api/v1/exceptions/{id}/actions` | 执行审批动作 |
| GET | `/api/v1/exceptions/{id}/history` | 查询审核历史 |

### 导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/exceptions/import` | 批量导入（行级校验） |
| GET | `/api/v1/exceptions/export/csv` | 导出 CSV |
| GET | `/api/v1/exceptions/export/json` | 导出 JSON |

---

## 核心特性

### 1. 幂等性保证

- 使用 `idempotency_key` 防止重复提交
- 重复提交返回已存在的请求，不产生副作用
- 同时返回重复提交警告

### 2. 冲突检测

- 同一出差单不能同时有多个进行中的申请
- 检测到冲突时返回详细的冲突申请 ID 和修复建议

### 3. 审计追踪

- 每一次状态变更都记录审计日志
- 包含：操作人、动作、源状态、目标状态、备注、IP地址
- 支持完整的审批流程可追溯

### 4. 异常解释

错误响应格式统一：

```json
{
  "error": "请求处理失败",
  "details": [{
    "code": "CONFLICTING_REQUEST",
    "message": "出差单 TRIP-001 已有进行中的例外申请",
    "field": "trip_id",
    "suggestion": "请先处理现有申请 (ID: xxx)"
  }],
  "timestamp": "2024-05-20T10:00:00Z"
}
```

**错误码分类**：

| 错误码 | HTTP 说明 |
|--------|------------|
| `MISSING_FIELD` | 400 缺少必填字段 |
| `INVALID_FORMAT` | 400 数据格式错误 |
| `EMPLOYEE_NOT_FOUND` | 400 员工不存在 |
| `POLICY_NOT_FOUND` | 400 政策条款不存在 |
| `DUPLICATE_REQUEST` | 409 重复提交 |
| `CONFLICTING_REQUEST` | 409 冲突的进行中申请 |
| `INVALID_STATE_TRANSITION` | 400 非法状态转换 |
| `PERMISSION_DENIED` | 403 无权限 |

### 5. 行级校验

批量导入时逐行校验：
- 格式校验
- 业务规则校验
- 每一行独立返回结果
- 包含错误码、错误字段、修复建议

### 6. 住宿+机票同时例外

- `exception_type = "both"` 支持同时申请两类例外
- 详情页同时显示住宿和机票的违规信息
- 历史记录完整记录两类例外的审核过程
- 导出结果同时包含两类例外的详细信息

---

## 验收场景

运行 `python seed_data.py` 自动生成验收数据：

### 场景1：完整流转（住宿+机票同时例外）

**流程**：
1. 员工提交（EMP001）提交北京出差例外申请（住宿+机票同时违规）
2. 王经理（EMP003）审批 → 升级到例外审核
3. 赵总监（EMP004）审批 → 最终通过

**验证点**：
- ✓ 例外类型显示为 "both"
- ✓ 详情包含住宿和机票的理由、政策条款、实际金额
- ✓ 历史记录包含3条记录（提交、升级、通过）
- ✓ 导出结果同时包含两类例外信息

### 场景2：冲突记录

**流程**：
1. 提交出差单 TRIP-SH-20240615-002 的住宿例外
2. 尝试提交同出差单的机票例外 → 冲突拦截

**验证点**：
- ✓ 第二个请求返回 400 错误
- ✓ 错误码 `CONFLICTING_REQUEST`
- ✓ 提示现有申请 ID
- ✓ 列表中仅显示第一个申请

### 场景3：导入坏行

**导入5行测试数据**：
| 行号 | 问题 | 预期 |
|------|------|------|
| 1 | 空幂等键 | 失败，MISSING_FIELD |
| 2 | 空出差单ID | 失败，MISSING_FIELD |
| 3 | 不存在的员工ID | 失败，EMPLOYEE_NOT_FOUND |
| 4 | 无效的例外类型 | 失败，INVALID_FORMAT |
| 5 | 有效数据 | 成功创建 |

**验证点**：
- ✓ 成功1行，失败4行
- ✓ 每一行有独立的错误码和建议
- ✓ 失败行不影响成功行的导入

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 初始化数据库和种子数据

```bash
python seed_data.py
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### API 文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 项目结构

```
.
├── main.py              # FastAPI 应用和路由
├── database.py          # 数据库模型和连接
├── schemas.py           # Pydantic 数据结构
├── services.py          # 业务逻辑服务
│   ├── StateMachine   # 状态机
│   ├── ExceptionService # 例外申请服务
│   └── ImportService  # 导入服务（行级校验）
├── export_service.py    # 导出服务
├── seed_data.py         # 种子数据和验收场景
└── requirements.txt     # 依赖列表
```

---

## 技术栈

- **FastAPI 0.104+
- **SQLAlchemy 2.0+
- **Pydantic 2.0+
- **SQLite**（可迁移至 PostgreSQL）

---

## 互操作性验证

请按以下顺序验证数据一致性：

| 操作 | 预期 |
|------|------|
| GET /api/v1/exceptions | 列表显示所有申请 |
| GET /api/v1/exceptions/{id} | 详情与列表一致 |
| GET /api/v1/exceptions/{id}/history | 历史记录数正确 |
| GET /api/v1/exceptions/export/csv | 导出内容与详情一致 |

所有验收场景的三个申请应在列表、详情、历史、导出中完全对应。