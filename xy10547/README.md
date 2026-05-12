# 养老院用药提醒 API

一个完整的养老院老人用药管理系统，围绕医嘱核对、库存管理、漏服处理、补服审批和护理员交接展开。

## 功能概览

| 模块 | 功能 | 主要接口 |
|------|------|----------|
| 老人档案 | 创建、查询、更新、删除 | `/api/residents` |
| 医嘱管理 | 创建、查询、停用、更新（含历史） | `/api/prescriptions` |
| 用药计划 | 创建计划、确认服药、漏服登记 | `/api/medications` |
| 补服流程 | 申请补服、审批补服、执行补服 | `/api/medications/makeup/*` |
| 库存管理 | 创建、查询、调整、预警 | `/api/inventory` |
| 交接班 | 创建、核对、确认（含异常检查） | `/api/handovers` |
| 异常处理 | 记录、查询、处理、统计 | `/api/exceptions` |
| 报告导出 | 日历、异常、库存、交接、仪表盘 | `/api/reports` |

## 核心业务规则

### 1. 幂等性保证
所有写操作都需要传入 `request_id`，重复调用同一个 `request_id` 不会重复执行，而是返回首次执行结果。

```json
POST /api/medications/confirm
{
    "request_id": "unique-request-id-123",
    "plan_id": "PLAN-001",
    "nurse_id": "N001"
}
```

### 2. 状态机（用药计划）
```
待执行 ──确认──► 已确认
    │
    ├──漏服────► 已漏服 ──申请──► 补服申请中 ──批准──► 补服已批准 ──确认──► 补服已执行
    │              │                  │                  │
    │              │                  └──拒绝──► 补服已拒绝
    │              │
    │              └──超过补服窗口──► 无法补服
    │
    └──医嘱停用──► 已跳过
```

### 3. 异常处理
系统自动检测并记录以下异常：
- **同一时段重复确认**：已确认的计划再次确认时抛出
- **医嘱停用**：已停用医嘱无法确认用药
- **库存不足**：确认用药时检查库存
- **漏服超过补服窗口**：超过4小时（可配置）无法申请补服
- **交接班未确认**：交接班时检查未核对项

### 4. 人工修正审计
所有状态变更和数据更新都会记录：
- 操作前后的值
- 操作者ID和姓名
- 操作原因
- 操作时间

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
# 创建数据库并填充样例数据
python sample_data.py
```

样例数据包含：
- **护理员**：张护士（护士长）、李护士、王护士
- **老人档案**：陈大爷（高血压+糖尿病）、李奶奶（心脏病）、王爷爷（阿尔茨海默）
- **医嘱**：5条（含1条已停用）
- **用药计划**：10条（昨日3条、今日6条、明日1条）
- **库存**：5种药品（含2种低库存预警）

### 3. 启动服务

```bash
python run.py
```

服务地址：`http://127.0.0.1:5000`

健康检查：`http://127.0.0.1:5000/health`

### 4. 运行演示

```bash
# 在另一个终端运行
python demo.py
```

选择要演示的场景（输入数字 1-7）。

---

## 主要演示路径

### 路径1：正常服药流程

**目的**：演示完整的用药确认流程，包含幂等性测试

**步骤**：
1. 查看今日陈大爷（R001）的用药计划
2. 张护士（N001）确认 `PLAN-005`（早8点硝苯地平）
3. 使用相同 `request_id` 再次调用（返回已存在记录，不重复执行）
4. 查看计划状态：`待执行` → `已确认`

**验证点**：
- 库存扣减：硝苯地平从50片减到49片
- 确认记录：包含护理员、时间、备注
- 人工修正记录：状态变更日志

---

### 路径2：漏服补服流程

**目的**：演示漏服登记→申请→审批→执行的完整流程

**步骤**：
1. 查看漏服计划 `PLAN-003`（状态：已漏服）
2. 李护士（N002）申请补服
3. 张护士（N001，护士长）审批通过
4. 李护士执行补服确认
5. 查看最终状态：`已漏服` → `补服申请中` → `补服已批准` → `补服已执行`

**验证点**：
- 补服窗口检查：默认4小时内可申请
- 审批流程：需护士长审批
- 状态追踪：每一步都有历史记录

---

### 路径3：医嘱停用流程

**目的**：演示医嘱停用对用药计划的影响

**步骤**：
1. 查看医嘱 P002（二甲双胍，状态：有效）
2. 查看该医嘱下的待执行计划（PLAN-006）
3. 医生停用医嘱（原因：胃肠道不良反应）
4. 查看医嘱历史记录
5. 查看相关用药计划：`待执行` → `已跳过`

**验证点**：
- 级联处理：停用医嘱自动跳过相关待执行计划
- 异常记录：自动创建"医嘱停用"异常
- 历史追踪：可追溯谁在何时因为什么原因停用

---

### 路径4：库存不足（失败路径）

**目的**：演示库存不足时的处理逻辑

**样例数据**：
- 阿司匹林（INV-003）：2片（低库存预警）
- 多奈哌齐片（INV-004）：0片（库存清零）

**验证点**：
- 库存预警：查询 `/api/inventory/alerts` 获取低库存列表
- 确认失败：库存为0时无法确认用药
- 异常记录：自动创建"库存不足"异常

---

### 路径5：交接班流程

**目的**：演示护理员换班时的用药核对

**步骤**：
1. 创建上午班交接班（张护士 → 王护士）
2. 系统自动生成核对清单（包含该时段所有用药计划）
3. 确认交接班
4. 查看交接报告：核对率、异常项、完成度

**验证点**：
- 自动清单：按时段筛选用药计划
- 异常检测：漏服/跳过的计划标记为异常
- 状态判定：全正常→已确认，有异常→有异常

---

### 路径6：报告导出

**可用报告**：

| 报告 | 接口 | 内容 |
|------|------|------|
| 用药日历 | `GET /api/reports/calendar` | 按日期/时间分组的用药计划，含状态 |
| 异常报告 | `GET /api/reports/exceptions` | 异常统计（按类型/状态）、明细列表 |
| 库存报告 | `GET /api/reports/inventory` | 库存清单、低库存预警、扣减历史 |
| 交接报告 | `GET /api/reports/handover` | 交接班详情、核对率、异常项 |
| 仪表盘 | `GET /api/reports/dashboard` | 今日概览、告警数、近期活动 |

---

## 失败路径演示

### 失败场景：库存不足导致无法确认用药

**前置条件**：
1. 某药品库存为0（如多奈哌齐片 INV-004）
2. 有该药品的待执行用药计划

**操作**：
```bash
curl -X POST http://127.0.0.1:5000/api/medications/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "fail-test-001",
    "plan_id": "PLAN-007",
    "nurse_id": "N001"
  }'
```

**预期结果**：
```json
{
    "success": false,
    "message": "库存不足：多奈哌齐片 仅剩 0 片",
    "error_code": "INVENTORY_SHORTAGE",
    "details": {
        "exception_id": 1,
        "inventory_id": "INV-004",
        "current_quantity": 0
    }
}
```

**验证点**：
1. ✅ 返回明确错误信息
2. ✅ 异常记录已创建（可在 `/api/exceptions` 查询）
3. ✅ 用药计划状态未改变（仍为"待执行"）
4. ✅ 库存未被扣减

---

## API 参考

### 老人档案

```bash
# 列表
GET /api/residents?page=1&per_page=20

# 查询
GET /api/residents/{id}

# 创建
POST /api/residents
{
    "id": "R004",
    "name": "张奶奶",
    "gender": "女",
    "age": 80,
    "room_number": "201室",
    "bed_number": "1床",
    "admission_date": "2024-01-01"
}

# 更新
PUT /api/residents/{id}
```

### 医嘱管理

```bash
# 创建
POST /api/prescriptions
{
    "id": "P006",
    "resident_id": "R001",
    "medication_name": "新药品",
    "dosage": "1片/次",
    "frequency": "每日1次",
    "start_date": "2024-05-12",
    "medication_type": "口服"
}

# 停用
POST /api/prescriptions/{id}/discontinue
{
    "reason": "不良反应"
}

# 查询（含历史）
GET /api/prescriptions/{id}?history=true
```

### 用药计划

```bash
# 创建
POST /api/medications/plans
{
    "id": "PLAN-011",
    "resident_id": "R001",
    "prescription_id": "P001",
    "dose_date": "2024-05-12",
    "dose_time": "08:00"
}

# 确认
POST /api/medications/confirm
{
    "request_id": "req-001",
    "plan_id": "PLAN-001",
    "nurse_id": "N001",
    "notes": "已服药"
}

# 漏服登记
POST /api/medications/missed
{
    "request_id": "miss-001",
    "plan_id": "PLAN-001",
    "nurse_id": "N001",
    "reason": "老人外出"
}
```

### 补服流程

```bash
# 申请
POST /api/medications/makeup/request
{
    "request_id": "mk-req-001",
    "plan_id": "PLAN-003",
    "nurse_id": "N002",
    "reason": "老人返回"
}

# 审批（通过）
POST /api/medications/makeup/approve
{
    "request_id": "mk-app-001",
    "plan_id": "PLAN-003",
    "nurse_id": "N001"
}

# 审批（拒绝）
POST /api/medications/makeup/deny
{
    "request_id": "mk-deny-001",
    "plan_id": "PLAN-003",
    "nurse_id": "N001",
    "reason": "已过服药时间"
}
```

### 异常处理

```bash
# 列表（可筛选）
GET /api/exceptions?status=待处理&type=库存不足

# 处理
POST /api/exceptions/{id}/resolve
{
    "nurse_id": "N001",
    "resolution_notes": "已补充库存"
}

# 忽略
POST /api/exceptions/{id}/ignore
{
    "nurse_id": "N001",
    "reason": "不影响"
}

# 统计
GET /api/exceptions/stats
```

---

## 数据模型

### 核心实体关系

```
Resident（老人）
    ├── Prescription（医嘱）1:N
    │       └── MedicationPlan（用药计划）1:N
    │               ├── MedicationConfirmation（确认记录）
    │               ├── MissedDose（漏服记录）
    │               └── MakeupApproval（补服审批）
    │
Nurse（护理员）
    ├── MedicationConfirmation
    ├── MissedDose
    ├── MakeupApproval
    └── ShiftHandover（交接班）
            └── HandoverChecklist（核对清单）

MedicationInventory（库存）
    └── InventoryDeduction（扣减记录）

ExceptionRecord（异常）
ManualCorrection（人工修正日志）
```

---

## 配置说明

编辑 `config.py`：

```python
class Config:
    # 数据库（默认SQLite）
    SQLALCHEMY_DATABASE_URI = 'sqlite:///nursing_home.db'
    
    # 补服窗口（小时）
    MISSED_DOSE_WINDOW_HOURS = 4
    
    # 分页大小
    DEFAULT_PAGE_SIZE = 20
```

---

## 业务闭环验证

运行演示后，可通过以下方式验证业务是否真正闭环：

### 1. 用药日历验证
```bash
curl http://127.0.0.1:5000/api/reports/calendar
```

查看：
- 每个用药计划的状态变化
- 各状态的数量统计
- 按日期/时间的分组

### 2. 异常记录验证
```bash
curl http://127.0.0.1:5000/api/reports/exceptions
```

查看：
- 异常类型分布
- 待处理/已处理数量
- 每条异常的详细信息

### 3. 库存变化验证
```bash
curl http://127.0.0.1:5000/api/reports/inventory
```

查看：
- 初始库存 vs 当前库存
- 扣减历史记录
- 低库存预警

### 4. 交接报告验证
```bash
curl "http://127.0.0.1:5000/api/reports/handover?date={今天日期}"
```

查看：
- 核对完成率
- 异常项明细
- 交接班状态

---

## 目录结构

```
xy10547/
├── app/
│   ├── __init__.py          # Flask应用工厂
│   ├── models.py            # 数据模型
│   ├── utils.py             # 工具函数
│   └── routes/
│       ├── __init__.py
│       ├── main.py          # 首页/健康检查
│       ├── resident.py      # 老人档案
│       ├── nurse.py         # 护理员
│       ├── prescription.py  # 医嘱
│       ├── medication.py    # 用药确认/漏服/补服
│       ├── inventory.py     # 库存
│       ├── handover.py      # 交接班
│       ├── exception.py     # 异常处理
│       └── report.py        # 报告导出
├── config.py                # 配置
├── requirements.txt         # 依赖
├── run.py                   # 启动脚本
├── sample_data.py           # 样例数据
└── demo.py                  # 演示脚本
```
