# 计量器具借用校准服务

面向计量器具被车间借走后，**归还、校准、封存状态经常丢失**的真实业务场景。

核心覆盖：**器具档案、借用状态跟踪、校准周期管理、封存审批、逾期催还、台账导出**。

---

## 项目结构

```
zy70050/
├── main.py                        # FastAPI 应用入口
├── requirements.txt               # 依赖
├── README.md
├── app/
│   ├── __init__.py
│   ├── core/                      # 配置、数据库连接
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── database.py
│   ├── models/                    # SQLAlchemy 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── instrument.py
│   │   ├── borrow.py
│   │   ├── calibration.py
│   │   ├── approval.py
│   │   └── history.py             # 所有变更历史（补录、撤回都留痕）
│   ├── schemas/                   # Pydantic 输入输出模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── instrument.py
│   │   ├── borrow.py
│   │   ├── calibration.py
│   │   └── approval.py
│   ├── services/                  # 业务逻辑
│   │   ├── __init__.py
│   │   ├── instrument_service.py
│   │   ├── borrow_service.py
│   │   ├── calibration_service.py
│   │   ├── approval_service.py
│   │   ├── history_service.py     # 统一记录历史
│   │   └── export_service.py      # Excel 台账导出
│   └── api/
│       ├── __init__.py
│       └── routers/
│           ├── __init__.py
│           ├── users.py
│           ├── instruments.py
│           ├── borrows.py
│           ├── calibrations.py
│           ├── approvals.py
│           └── exports.py
└── scripts/
    ├── __init__.py
    ├── seed_data.py               # 造数脚本（可重复执行）
    └── demo_flow.py               # 主流程 API 演示
```

---

## 核心设计点

- **状态机约束**：状态流转有校验，不是想改就能改
- **历史全记录**：创建、更新、借用、归还、校准、封存、补录、撤回都写入 `instrument_histories`
- **重跑稳定性**：造数脚本每次先清空再重建，同一批数据重跑结果一致
- **补录/修正标注**：档案更新接口支持 `is_rectify=true`，历史记录里会标记为 `rectify` 动作
- **逾期自动检测**：`GET /borrows/check-overdue` 或 `GET /borrows/overdue` 会自动把过期借用状态置为 `overdue`
- **Excel 台账**：支持器具档案、借用记录、校准记录、完整台账四种导出

---

## 快速开始

### 1. 安装依赖

需要 Python 3.9+。

```bash
cd /Users/lzy/pro/solo/workspaces/zy70050
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 初始化数据（造数）

造数脚本每次会**清空所有表**后重建，确保结果可复现。

```bash
python scripts/seed_data.py
```

执行后会创建：
- 6 个用户（管理员、计量师、车间用户、审批人）
- 8 台计量器具（游标卡尺、千分尺、天平、变送器、温湿度仪等）
- 5 条借用记录（含 1 条逾期）
- 6 条校准记录（含 2 条待执行）
- 1 条封存审批申请

### 3. 启动服务

```bash
python main.py
```

或者：

```bash
uvicorn main:app --reload --port 8000
```

启动后访问：
- 健康检查：http://127.0.0.1:8000/health
- Swagger 文档：http://127.0.0.1:8000/docs
- Redoc：http://127.0.0.1:8000/redoc

---

## 调用主流程

### 方式一：运行演示脚本

```bash
python scripts/demo_flow.py
```

脚本会自动执行：
1. 完整借用-归还-校准-封存审批流程
2. 逾期催还通知
3. 统计数据查看

### 方式二：手动调用（以 cURL 为例）

#### 1. 查看统计概览

```bash
curl -s http://127.0.0.1:8000/instruments/stats | python3 -m json.tool
```

#### 2. 查看在库器具

```bash
curl -s "http://127.0.0.1:8000/instruments?status=in_stock&limit=5" | python3 -m json.tool
```

#### 3. 创建借用

先看一下有哪些用户：

```bash
curl -s http://127.0.0.1:8000/users | python3 -m json.tool
```

选一个在库器具和一个车间用户：

```bash
curl -s -X POST http://127.0.0.1:8000/borrows \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 1,
    "borrower_id": 4,
    "purpose": "生产线工件检测",
    "department": "生产一车间",
    "workshop": "机加工段",
    "work_order": "WO-2026-099",
    "borrow_date": "2026-05-09",
    "expected_return_date": "2026-06-08"
  }' | python3 -m json.tool
```

#### 4. 归还器具

```bash
curl -s -X POST http://127.0.0.1:8000/borrows/1/return \
  -H "Content-Type: application/json" \
  -d '{
    "return_date": "2026-06-01",
    "return_condition": "状态良好，无磕碰",
    "remarks": "已完成检测任务"
  }' | python3 -m json.tool
```

#### 5. 安排并完成校准

```bash
curl -s -X POST http://127.0.0.1:8000/calibrations \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 1,
    "calibration_type": "定期校准",
    "scheduled_date": "2026-05-10",
    "calibration_agency": "内部计量室"
  }' | python3 -m json.tool
```

开始校准：

```bash
curl -s -X POST http://127.0.0.1:8000/calibrations/1/start | python3 -m json.tool
```

完成校准（合格）：

```bash
curl -s -X POST http://127.0.0.1:8000/calibrations/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "calibration_date": "2026-05-10",
    "result_pass": true,
    "certificate_number": "CERT-2026-0001",
    "remarks": "所有指标符合要求"
  }' | python3 -m json.tool
```

#### 6. 封存审批

申请封存：

```bash
curl -s -X POST http://127.0.0.1:8000/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "approval_type": "seal",
    "instrument_id": 1,
    "reason": "设备长期闲置，封存待后续评估"
  }' | python3 -m json.tool
```

审批通过：

```bash
curl -s -X POST http://127.0.0.1:8000/approvals/1/process \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "approval_remark": "记录完整，同意封存"
  }' | python3 -m json.tool
```

#### 7. 查看历史记录（重要）

```bash
curl -s http://127.0.0.1:8000/instruments/1/history | python3 -m json.tool
```

可以看到完整的变更轨迹：创建、借用、归还、校准、审批、封存等。

---

## 触发异常场景

### 1. 借用已借出的器具

先看某个器具当前已借出，再尝试借用它：

```bash
curl -s "http://127.0.0.1:8000/instruments?status=borrowed" | python3 -m json.tool
```

取一个已借出器具的 ID（比如 2），尝试再次借用：

```bash
curl -s -X POST http://127.0.0.1:8000/borrows \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 2,
    "borrower_id": 4,
    "purpose": "测试异常",
    "department": "测试",
    "borrow_date": "2026-05-09",
    "expected_return_date": "2026-06-01"
  }'
```

返回应该是 400：`"器具当前状态为 borrowed，无法借用"`

### 2. 归还已归还的借用

```bash
curl -s "http://127.0.0.1:8000/borrows?status=returned" | python3 -m json.tool
```

取一个已归还的借用 ID（比如 4）：

```bash
curl -s -X POST http://127.0.0.1:8000/borrows/4/return \
  -H "Content-Type: application/json" \
  -d '{
    "return_date": "2026-05-09",
    "return_condition": "异常测试"
  }'
```

返回 400：`"借用状态为 returned，无法归还"`

### 3. 审批已处理的申请

```bash
curl -s "http://127.0.0.1:8000/approvals?status=pending" | python3 -m json.tool
```

先审批一条 pending 的：

```bash
curl -s -X POST http://127.0.0.1:8000/approvals/1/process \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}' | python3 -m json.tool
```

再审批一次同一条：

```bash
curl -s -X POST http://127.0.0.1:8000/approvals/1/process \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

返回 400：`"审批状态为 approved，无法处理"`

### 4. 对已封存的器具安排校准

找一个封存状态的器具，尝试为它安排校准：

```bash
curl -s -X POST http://127.0.0.1:8000/calibrations \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_id": 1,
    "calibration_type": "定期校准",
    "scheduled_date": "2026-06-01"
  }'
```

返回 400：`"器具当前状态为 sealed，无法安排校准"`

---

## 台账导出

在浏览器中直接访问以下 URL 即可下载 Excel：

| 导出内容 | URL |
|---------|-----|
| 器具档案 | http://127.0.0.1:8000/exports/instruments |
| 借用记录 | http://127.0.0.1:8000/exports/borrows |
| 校准记录 | http://127.0.0.1:8000/exports/calibrations |
| **完整台账** | http://127.0.0.1:8000/exports/ledger |

带状态过滤示例：
- 只看借出中的器具：`http://127.0.0.1:8000/exports/instruments?status=borrowed`
- 只看逾期借用：`http://127.0.0.1:8000/exports/borrows?status=overdue`

---

## 查看结果的几种方式

### 1. Swagger 文档界面（推荐）

打开 http://127.0.0.1:8000/docs，可以：
- 点 `Try it out` 直接调用接口
- 看请求/响应 Schema
- 实时查看返回值

### 2. 数据库文件

服务使用 SQLite，数据文件位于：
```
/Users/lzy/pro/solo/workspaces/zy70050/metrology.db
```

可以用任何 SQLite 客户端（如 DB Browser for SQLite、VSCode 插件）打开查看所有表。

### 3. 关键接口列表

| 功能 | 方法 | 路径 |
|------|------|------|
| 健康检查 | GET | /health |
| 统计概览 | GET | /instruments/stats |
| 器具列表 | GET | /instruments |
| 器具详情 | GET | /instruments/{id} |
| 器具历史 | GET | /instruments/{id}/history |
| 补录/修正档案 | PUT | /instruments/{id}?is_rectify=true |
| 借用列表 | GET | /borrows |
| 创建借用 | POST | /borrows |
| 归还 | POST | /borrows/{id}/return |
| 逾期列表（自动检测） | GET | /borrows/overdue |
| 发送催还通知 | POST | /borrows/{id}/send-notice |
| 校准列表 | GET | /calibrations |
| 开始校准 | POST | /calibrations/{id}/start |
| 完成校准 | POST | /calibrations/{id}/complete |
| 审批列表 | GET | /approvals |
| 提交审批 | POST | /approvals |
| 审批通过/拒绝 | POST | /approvals/{id}/process |
| 撤回审批 | POST | /approvals/{id}/cancel?reason=... |

---

## 状态流转说明

### 器具状态机

```
IN_STOCK (在库)
    ├─→ BORROWED (借出) ──归还──→ IN_STOCK
    ├─→ CALIBRATING (校准中) ──完成──→ IN_STOCK
    └─→ SEALED (封存) ──审批启封──→ IN_STOCK
         └─→ 只能查看/启封，不能借用、校准
    └─→ DISCARDED (报废) ──终态
```

### 借用状态机

```
PENDING (待确认)
    ├─→ BORROWED (借用中)
    │     ├─→ 超期自动 → OVERDUE (逾期)
    │     │       └─→ 归还 → RETURNED
    │     └─→ 正常归还 → RETURNED
    └─→ 取消 → CANCELLED
```

### 校准状态机

```
SCHEDULED (已排期)
    ├─→ IN_PROGRESS (进行中)
    │     ├─→ PASSED (合格)
    │     └─→ FAILED (不合格)
    └─→ CANCELLED
```

---

## 历史记录说明

所有影响器具的操作都会在 `instrument_histories` 表里留痕，包括：

| action | 含义 |
|--------|------|
| create | 创建档案 |
| update | 一般更新 |
| rectify | 补录/修正（接口调用时传 `is_rectify=true`） |
| borrow | 器具被借走 |
| return | 器具归还 |
| calibrate | 执行校准 |
| seal | 封存 |
| unseal | 启封 |
| withdraw | 撤回操作（如撤回审批申请） |
| status_change | 直接状态变更 |

每条历史记录包含：
- `old_status` / `new_status`：状态前后值
- `old_values` / `new_values`：详细字段变更
- `created_by_name`：操作人
- `created_at`：操作时间
- `remark`：备注

---

## 后续扩展方向

已预留的扩展点：

1. **用户认证**：目前接口简化处理，可接入 JWT / OAuth2
2. **权限控制**：基于 `UserRole`（管理员、计量师、车间用户、审批人）做细粒度权限
3. **消息通知**：逾期催还、校准到期提醒目前只记录，可接入邮件/短信
4. **文件管理**：校准证书上传
5. **定时任务**：用 Celery / APScheduler 自动执行逾期检测和校准提醒
6. **多数据库**：当前 SQLite，配置 `DATABASE_URL` 即可切 PostgreSQL / MySQL

---

## 常见问题

**Q: 造数脚本会删除现有数据吗？**

是的。`scripts/seed_data.py` 每次执行前会清空所有表，目的是保证**同一批数据重跑时结果稳定**。如果需要保留数据，不要再次执行它。

**Q: 怎么验证状态没丢？**

查看单个器具的历史：
```
GET /instruments/{id}/history
```

历史记录是按时间倒序的，可追溯每一次状态变更。

**Q: 怎么区分"正常更新"和"补录"？**

调用 `PUT /instruments/{id}` 时：
- 不传 `is_rectify` 或传 `false` → 历史记录 `action=update`
- 传 `is_rectify=true` → 历史记录 `action=rectify`，描述里会带"补录修正档案"字样
