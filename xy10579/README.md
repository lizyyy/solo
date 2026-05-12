# 水电抄表纠错 API

一个完整的物业水电抄表管理与纠错系统，支持表计档案管理、抄表录入、估读、异常检测与复核、账单生成、纠错和重新出账等功能。

## 本地启动

### 前置要求
- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

首次启动时会自动初始化演示数据。如需重新初始化演示数据：

```bash
FLASK_APP=run.py flask init-demo
```

如需重置数据库：

```bash
FLASK_APP=run.py flask reset-db
```

### 健康检查

```bash
curl http://localhost:5000/api/health
```

---

## 造数（演示场景）

系统内置 5 个完整的演示场景：

| 表计编号 | 户主 | 类型 | 场景说明 |
|---------|------|------|---------|
| W001 | 张三 | 水表 | **正常出账流程** - 历史2期 + 本期正常抄表出账 |
| W002 | 李四 | 水表 | **漏抄估读+补录重算** - 估读生成账单后补录真实读数，自动修正账单 |
| E001 | 张三 | 电表 | **异常高用量复核** - 6000读数被检测为异常，复核修正为5350 |
| W003 | 王五 | 水表 | **已缴费账单拦截+重新出账** - 已缴费账单无法直接纠错，需重新出账 |
| E002 | 赵六 | 电表 | **读数倒退异常待处理** - 3150 < 上期3220，待复核 |

---

## 主要演示路径

### 路径1：查看正常出账流程（W001 张三 水表）

```bash
# 1. 查看表计列表
curl http://localhost:5000/api/meters

# 2. 查看 W001 的完整历史（包含3期抄表记录和账单）
curl http://localhost:5000/api/meters/1/history

# 3. 查看 W001 本期账单详情
curl http://localhost:5000/api/bills?meter_id=1

# 4. 查看账单历史变更记录
curl http://localhost:5000/api/bills/<bill_id>/history
```

**预期结果：**
- W001 初始读数 100
- 前2期：100→108→120
- 本期：120→135，用量15吨，金额 ¥75.00
- 状态：已出账(issued)

---

### 路径2：查看漏抄估读+补录重算（W002 李四 水表）

```bash
# 1. 查看 W002 的完整历史
curl http://localhost:5000/api/meters/3/history

# 2. 查看本期账单（已被自动修正）
curl http://localhost:5000/api/bills?meter_id=3
```

**预期结果：**
- 本期先估读：210→215（估读算法：平均用量5吨）
- 估读账单：用量5吨，金额 ¥25.00
- 补录真实读数：210→220，用量10吨
- 账单自动修正：金额从 ¥25 → ¥50，状态变为 corrected
- 历史记录显示：估读→修正，操作者"班长小王"，原因"补录真实读数"

---

### 路径3：查看异常高用量复核（E001 张三 电表）

```bash
# 1. 查看异常列表（应包含已解决的异常）
curl http://localhost:5000/api/abnormals

# 2. 查看 E001 的完整历史
curl http://localhost:5000/api/meters/2/history

# 3. 查看本期账单详情
curl http://localhost:5000/api/bills?meter_id=2
```

**预期结果：**
- 历史2期平均用量：(100+120)/2 = 110 度
- 抄表读数 6000：用量 780 度，远超平均（阈值3倍 = 330度）
- 触发异常类型：high_usage（异常高用量）
- 复核：action=resolve，correct_reading=5350
- 修正后用量：130 度，金额 ¥78.00
- 异常状态：resolved，复核人"主管老李"
- 历史记录：detected→reviewing→resolved

---

### 路径4：查看已缴费账单拦截+重新出账（W003 王五 水表）

```bash
# 1. 查看 W003 的完整历史
curl http://localhost:5000/api/meters/4/history

# 2. 查看本期原始账单和补收账单
curl http://localhost:5000/api/bills?meter_id=4

# 3. 查看原始账单的历史变更
curl http://localhost:5000/api/bills/<original_bill_id>/history
```

**预期结果：**
- 抄表读数：175，用量7吨，账单金额 ¥35.00
- 状态变更：draft→issued→paid（已缴费）
- 尝试直接纠错(correct)：失败，返回"已缴费账单不能直接修改"
- 重新出账(reissue)：
  - 新读数 180，用量10吨
  - 原账单状态变为 corrected
  - 生成新的补收账单，金额 ¥15.00（3吨差价）
  - 父账单关联：新账单 parent_bill_id 指向原账单
- 历史记录：paid→corrected，操作者"财务小张"

---

### 路径5：查看读数倒退异常待处理（E002 赵六 电表）

```bash
# 1. 查看待处理的异常
curl http://localhost:5000/api/abnormals?status=detected

# 2. 查看 E002 的历史
curl http://localhost:5000/api/meters/5/history
```

**预期结果：**
- 上期读数：3220
- 本期抄表：3150（小于上期）
- 触发异常类型：backward_reading（读数倒退）
- 异常状态：detected（待复核）
- 抄表记录状态：pending（未确认）
- 无法生成账单：抄表记录未确认

---

## 失败路径演示

### 失败路径1：重复抄表（幂等性验证）

```bash
# 给 W001 再次提交相同计费周期的抄表
curl -X POST http://localhost:5001/api/meters/1/readings \
  -H "Content-Type: application/json" \
  -d '{"reading_value": 140, "billing_period": "2026-05"}'
```

**预期结果：**
- 返回 success: false
- 说明该周期已存在抄表记录
- is_idempotent: true（重复操作无副作用）

---

### 失败路径2：已缴费账单直接纠错

```bash
# 先找到 W003 的已缴费账单
curl http://localhost:5001/api/bills?meter_id=4

# 尝试直接修正已缴费账单
curl -X POST http://localhost:5001/api/bills/<paid_bill_id>/correct \
  -H "Content-Type: application/json" \
  -d '{"new_reading": 185, "operator": "测试员", "reason": "测试直接纠错"}'
```

**预期结果：**
- 返回 success: false
- 消息："已缴费账单不能直接修改，需通过重新出账流程处理"
- 正确做法：使用 `/api/bills/<id>/reissue`

---

### 失败路径3：抄表记录未确认时生成账单

```bash
# 尝试为 E002 生成账单（抄表记录为pending）
curl -X POST http://localhost:5000/api/bills \
  -H "Content-Type: application/json" \
  -d '{"meter_id": 5, "billing_period": "2026-05"}'
```

**预期结果：**
- 返回 success: false
- 消息："抄表记录未确认，无法生成账单"

---

## 报告导出

### JSON格式报告

```bash
# 全部周期
curl http://localhost:5000/api/report

# 指定周期
curl "http://localhost:5000/api/report?billing_period=2026-05"
```

### 文本格式报告

```bash
curl http://localhost:5001/api/export/report
```

报告包含：
- 汇总统计（总账单数、总金额、已缴费/未缴费、估读账单数、已修正账单数、待处理异常数）
- 账单明细（含修正记录）
- 异常记录（含复核历史）
- 所有历史变更和操作者信息

---

## 业务规则要点

| 规则 | 实现位置 | 说明 |
|-----|---------|------|
| 读数小于上期检测 | `detect_abnormal()` L70-77 | 自动检测并生成异常记录 |
| 估读后补真实读数 | `update_estimated_to_actual()` | 自动修正读数和相关账单 |
| 异常高用量复核 | `review_abnormal()` action=resolve/dismiss | 支持修正读数或忽略异常 |
| 已缴费账单拦截 | `correct_bill()` L636-641 | 已缴费账单不能直接纠错 |
| 重新出账 | `reissue_bill()` | 生成补收/退款账单，原账单标为corrected |
| 重复抄表幂等 | `submit_reading()` L145-152 | 同周期已存在则返回不重复创建 |
| 重复出账幂等 | `generate_bill()` L518-529 | 同周期已存在账单则返回 |
| 重复缴费幂等 | `pay_bill()` L595-601 | 已缴费则返回不重复操作 |
| 人工修正留痕 | 所有修改操作 | 记录 old/new 值、操作者、原因、时间 |

---

## API 完整列表

### 表计管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/meters` | 创建设备 |
| GET | `/api/meters` | 设备列表 |
| GET | `/api/meters/<id>` | 设备详情 |
| GET | `/api/meters/<id>/history` | 设备完整历史（抄表+账单+异常） |

### 抄表管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/meters/<id>/readings` | 抄表录入 |
| POST | `/api/meters/<id>/estimated-reading` | 估读（漏抄处理） |
| POST | `/api/meters/<id>/update-estimated` | 补录真实读数 |
| GET | `/api/meters/<id>/readings` | 抄表记录列表 |

### 异常管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/abnormals` | 异常列表（支持status过滤） |
| POST | `/api/abnormals/<id>/review` | 复核异常（resolve/dismiss） |

### 账单管理
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/bills` | 生成账单 |
| GET | `/api/bills` | 账单列表（支持status/meter_id/billing_period过滤） |
| GET | `/api/bills/<id>` | 账单详情 |
| GET | `/api/bills/<id>/history` | 账单历史变更 |
| POST | `/api/bills/<id>/issue` | 出账 |
| POST | `/api/bills/<id>/pay` | 缴费 |
| POST | `/api/bills/<id>/correct` | 账单纠错（仅未缴费账单） |
| POST | `/api/bills/<id>/reissue` | 重新出账（已缴费账单） |

### 报告
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/report` | 收费报告(JSON) |
| GET | `/api/export/report` | 收费报告(文本) |

---

## 数据模型

- **Meter** - 表计档案
- **MeterReading** - 抄表记录
- **ReadingHistory** - 抄表历史变更
- **AbnormalRecord** - 异常记录
- **AbnormalHistory** - 异常复核历史
- **Bill** - 账单
- **BillHistory** - 账单历史变更
- **CorrectionRecord** - 纠错记录（留痕）
- **SystemConfig** - 系统配置（价格等）

---

## 通过结果判断业务闭环

### 查看表计历史
访问 `GET /api/meters/<id>/history`，应能看到：
- 该表计所有抄表记录（含类型：actual/estimated/corrected）
- 所有账单（含状态变更）
- 所有异常记录（含状态：detected/reviewing/resolved/dismissed）
- 每条变更都有操作者和原因

### 查看账单差异
访问 `GET /api/bills/<id>/history`，应能看到：
- 账单完整状态流转（draft→issued→paid/corrected）
- 每次金额变更的 old/new 值
- 操作者信息

### 查看纠错原因
查看账单的 `corrections` 数组或报告的 `correction_summary`，应包含：
- 修正类型（读数错误/估读错误/价格调整）
- 修正前后的读数、用量、金额
- 修正原因和操作者

### 查看收费报告
访问 `GET /api/export/report`，应能以文本格式清晰看到：
- 整体汇总（总金额、已缴/未缴、估读/修正账单数）
- 每张账单的明细
- 所有异常记录及其处理结果
- 完整的历史追踪
