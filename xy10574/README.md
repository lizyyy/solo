# 客服外呼名单清洗 CLI

围绕客服外呼前的名单清洗需求，实现的可启动命令行工具。支持重复号码清洗、黑名单过滤、时区校验、预约回拨优先和合规禁呼规则。

---

## 功能特性

### 核心规则
- **号码格式校验**：中国手机号 11 位格式，自动去 `+86`、空格等
- **黑名单过滤**：命中黑名单直接禁呼，记录来源和原因
- **用户拒呼**：历史外呼中用户明确拒呼的号码，加入禁呼
- **重复号码**：同一手机号多条线索，只保留一条活跃的，其余标记为重复
- **预约回拨优先**：有预约回拨且已到时间的线索，优先标记为可拨打；未到期的暂缓
- **跨时区不可打**：根据地区时区规则，非工作时段标记为暂缓
- **合规禁呼**：支持按号码模式和时间窗口的合规规则

### 幂等与审计
- **幂等导入**：同一文件名重复导入自动跳过，不会重复
- **操作日志**：每个状态变更都记录操作者、前后状态、原因
- **人工放行**：被系统禁呼的线索可人工放行，必须留操作者和原因
- **状态追溯**：任意线索可通过 `detail` 命令查看完整历史

### 输出结果
- **可拨打名单**：通过所有规则检查，包括预约回拨到期的
- **暂缓名单**：预约未到期、跨时区非工作时段
- **禁呼名单**：黑名单、拒呼历史、重复、号码格式错误
- **人工放行**：记录放行原因和操作者，输出到报告

---

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 1. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10574
pip install -r requirements.txt
```

### 2. 初始化（导入样例数据）
```bash
python cli.py init --with-examples
```

这条命令会：
- 创建 `data/` 目录和 SQLite 数据库
- 导入 20 条样例线索（销售 10 条 + 售后 5 条 + 续费 5 条）
- 导入黑名单、外呼历史、预约回拨、时区规则、合规规则

### 3. 执行清洗检查
```bash
python cli.py check
```

### 4. 查看完整报告
```bash
python cli.py report
```

---

## 完整演示路径

### 路径 A：标准流程（销售线索清洗）

```bash
# Step 1: 初始化
python cli.py init --with-examples

# Step 2: 执行清洗
python cli.py check
```

**预期结果：**
- 总线索 20 条
- 可拨打约 11-13 条（取决于当前时间是否在工作时段内）
- 禁呼约 5-7 条
  - 2 条黑名单（钱七、周经理）
  - 2 条拒呼历史（郑十一、公司 E）
  - 1 条重复号码（张三重复）
  - 1 条号码格式错误（吴十）
- 暂缓约 0-4 条
  - 当前时间不在工作时段的（时区规则）

```bash
# Step 3: 生成报告
python cli.py report
```

**报告将包含：**
- 可拨打名单：张三、李四、王五、赵六、孙八、周九（预约回拨）、陈经理、林主管、黄经理、吴主管、科技公司 A、电商公司 B、金融公司 C、教育公司 D
- 禁呼名单：张三（重复）、钱七（黑名单）、郑十一（拒呼）、吴十（号码错误）、周经理（黑名单）、公司 E（拒呼）
- 暂缓名单（若当前时间不在 9-18 点）：所有非预约回拨的线索

---

### 路径 B：人工放行流程

```bash
# Step 1: 查看某个禁呼线索的详情
python cli.py detail SL-009

# Step 2: 人工放行（需要留理由）
python cli.py release SL-009 "客户投诉已解决，确认可以再次联系" --operator "客服主管-王总"

# Step 3: 再次查看详情，确认操作已记录
python cli.py detail SL-009

# Step 4: 重新执行 check，该线索会出现在可拨打名单
python cli.py check
python cli.py report
```

**预期结果：**
- SL-009 状态从 `blocked/invalid_number` 变为 `manual_released`
- 操作日志记录操作者 "客服主管-王总" 和放行原因
- 重新检查后该线索会出现在可拨打名单，并标注 `[人工放行: 客户投诉已解决...]`

---

### 路径 C：失败路径（导入 + 重复导入 + 错误文件）

```bash
# Step 1: 导入销售线索
python cli.py import leads examples/sales_leads.json
# → 成功：新增 10 条

# Step 2: 重复导入同一文件（演示幂等）
python cli.py import leads examples/sales_leads.json
# → ℹ 文件 sales_leads.json 已导入过，跳过（幂等保护）

# Step 3: 尝试导入不存在的文件
python cli.py import leads nonexistent.json
# → ✗ 失败: 文件不存在: nonexistent.json

# Step 4: 查看线索详情（失败路径）
python cli.py detail NONEXISTENT_ID
# → ✗ 线索不存在

# Step 5: 重置所有数据
python cli.py reset --yes
```

---

## 主要命令说明

### init - 初始化
```bash
python cli.py init                    # 仅创建数据库
python cli.py init --with-examples    # 同时导入样例数据
```

### import - 数据导入
```bash
# 线索
python cli.py import leads path/to/leads.json

# 黑名单
python cli.py import blacklist path/to/blacklist.json

# 外呼历史
python cli.py import history path/to/history.json

# 预约回拨
python cli.py import callbacks path/to/callbacks.json

# 规则
python cli.py import rules path/to/rules.json --type timezone
python cli.py import rules path/to/rules.json --type compliance

# 一键导入所有样例
python cli.py import examples
```

### check - 执行清洗
```bash
python cli.py check                    # 检查所有线索
python cli.py check --lead-id SL-001   # 仅检查指定线索
```

### detail - 查看详情
```bash
python cli.py detail SL-001
python cli.py detail SL-001 --json     # JSON 格式输出
```

**detail 输出包含：**
- 线索基本信息（姓名、电话、类型、地区、时区、状态）
- 操作历史（时间、操作者、操作类型、前后状态、原因）
- 活跃预约回拨
- 外呼历史
- 黑名单记录（如有）

### report - 生成报告
```bash
python cli.py report                    # 控制台输出 + JSON 报告
python cli.py report --output-dir ./reports
python cli.py report --json            # 仅 JSON 概要
```

报告结构：
```
reports/cleaning_report_20260512_143000.json
├── report_time
├── summary
│   ├── total
│   ├── by_status
│   ├── by_block_reason
│   ├── by_type
│   ├── check_sessions
│   └── import_sessions
├── callable_leads []
├── deferred_leads []
└── blocked_leads []
```

### release - 人工放行
```bash
python cli.py release SL-006 "客户关系修复，重新联系" --operator "张经理"
```

### reset - 重置数据
```bash
python cli.py reset          # 交互式确认
python cli.py reset --yes    # 直接清除
```

---

## 样例数据说明

### 销售线索 (examples/sales_leads.json) - 10 条
| ID | 姓名 | 预期结果 | 原因 |
|----|------|---------|------|
| SL-001 | 张三 | 可拨打 | 正常 |
| SL-002 | 李四 | 可拨打 | 正常（有无人接听历史，但非拒呼） |
| SL-003 | 王五 | 可拨打 | 正常 |
| SL-004 | 赵六 | 可拨打 | 正常 |
| SL-005 | 张三(重复) | 禁呼 | 与 SL-001 号码重复 |
| SL-006 | 钱七(黑名单) | 禁呼 | 命中黑名单 |
| SL-007 | 孙八 | 可拨打 | 正常 |
| SL-008 | 周九(预约回拨) | 可拨打 | 预约已到期，优先级 |
| SL-009 | 吴十(号码错误) | 禁呼 | 号码格式错误（只有 5 位） |
| SL-010 | 郑十一(拒呼) | 禁呼 | 外呼历史显示用户拒呼 |

### 售后回访 (examples/service_leads.json) - 5 条
| ID | 姓名 | 预期结果 | 原因 |
|----|------|---------|------|
| SV-001 | 陈经理 | 可拨打 | 正常 |
| SV-002 | 林主管 | 可拨打 | 正常 |
| SV-003 | 黄经理 | 可拨打 | 正常 |
| SV-004 | 吴主管 | 可拨打 | 正常 |
| SV-005 | 周经理(黑名单) | 禁呼 | 命中黑名单 |

### 续费提醒 (examples/renewal_leads.json) - 5 条
| ID | 姓名 | 预期结果 | 原因 |
|----|------|---------|------|
| RN-001 | 科技公司 A | 可拨打 | 正常 |
| RN-002 | 电商公司 B | 可拨打 | 正常 |
| RN-003 | 金融公司 C | 可拨打 | 正常 |
| RN-004 | 教育公司 D | 可拨打 | 正常 |
| RN-005 | 公司 E(拒呼) | 禁呼 | 外呼历史显示用户拒呼 |

### 其他样例
- **blacklist.json**：2 条，用户投诉和明确拒呼
- **call_history.json**：3 条，2 条拒呼 + 1 条无人接听
- **callback_schedule.json**：1 条，预约回拨已到期
- **timezone_rules.json**：9 个城市的工作时段规则
- **compliance_rules.json**：节假日禁呼规则示例

---

## 数据文件格式

### 线索 JSON 格式
```json
[
  {
    "id": "SL-001",
    "phone": "13800138001",
    "name": "张三",
    "type": "sales",
    "region": "北京",
    "timezone": "Asia/Shanghai",
    "extra_field_1": "任意扩展字段"
  }
]
```
- `type` 可选：`sales`（销售）、`after_sales`（售后）、`renewal`（续费）
- `id` 可选，不提供则自动生成 UUID
- 其他字段会被保存在 `extra_data` 中

### 黑名单 JSON 格式
```json
[
  {
    "phone": "13800138999",
    "reason": "用户投诉",
    "source": "客服投诉记录"
  }
]
```

### 外呼历史 JSON 格式
```json
[
  {
    "lead_id": "SL-010",
    "phone": "13800138997",
    "call_time": "2026-05-01T10:30:00",
    "result": "rejected",
    "agent": "王小明",
    "notes": "用户明确表示不需要"
  }
]
```
- `result` 可选值：`connected`, `no_answer`, `rejected`, `line_busy`, `invalid_number`, `callback_scheduled`

### 预约回拨 JSON 格式
```json
[
  {
    "lead_id": "SL-008",
    "phone": "13800138998",
    "scheduled_time": "2026-05-12T09:00:00",
    "timezone": "Asia/Shanghai",
    "reason": "用户希望工作日上午有空",
    "created_by": "王小明"
  }
]
```

### 时区规则 JSON 格式
```json
[
  {
    "region": "北京",
    "timezone": "Asia/Shanghai",
    "call_window_start": 9,
    "call_window_end": 18
  }
]
```

---

## 规则执行顺序

1. **号码格式校验**（立即失败则终止）
2. **黑名单校验**（命中则禁呼，终止）
3. **用户拒呼历史**（有拒呼则禁呼，终止）
4. **重复号码校验**（重复则禁呼，终止）
5. **预约回拨优先**（到期标记可拨打，未到期暂缓）
6. **时区规则**（非工作时段暂缓）
7. **合规规则**（不合规则暂缓）

最终状态：
- `blocked`：1-4 任一条命中
- `deferred`：5（未到期）、6、7 命中
- `callable`：全部通过或 5（已到期）

---

## 业务闭环验证

通过 `report` 命令的输出，不看源码也能判断业务是否闭环：

### 1. 可拨打名单
```
SL-001 | 13800138001 | 张三 | sales
SL-008 | 13800138998 | 周九(预约回拨) | sales [预约回拨优先级]
SL-009 | 12345 | 吴十(号码错误) | sales [人工放行: 客户投诉已解决...]
```
- ✓ 正常线索进入
- ✓ 预约回拨有优先级标识
- ✓ 人工放行有原因和上下文

### 2. 暂缓名单
```
SL-003 | 13800138003 | 王五 | sales | 原因: wrong_timezone
```
- ✓ 显示具体原因，便于后续处理

### 3. 禁呼名单
```
SL-005 | 13800138001 | 张三(重复) | sales | 原因: duplicate
SL-006 | 13800138999 | 钱七(黑名单) | sales | 原因: blacklist
SL-010 | 13800138997 | 郑十一(拒呼) | sales | 原因: user_rejected
SL-009 | 12345 | 吴十(号码错误) | sales | 原因: invalid_number
```
- ✓ 原因分类清晰
- ✓ 可通过 `detail` 命令追溯具体原因

### 4. 操作日志追溯
通过 `detail SL-009` 可看到：
```
操作历史:
  [1] 2026-05-12T14:30:00
      操作者: 客服主管-王总
      操作: manual_release
      状态变更: blocked/invalid_number -> manual_released/客户投诉已解决
      原因: 客户投诉已解决，确认可以再次联系
```
- ✓ 操作者记录
- ✓ 前后状态差异
- ✓ 原因说明

---

## 项目结构

```
xy10574/
├── cli.py              # CLI 主入口
├── models.py           # 数据模型定义
├── storage.py          # SQLite 持久化层
├── rules.py            # 清洗规则引擎
├── importer.py         # 数据导入器
├── reporter.py         # 报告生成器
├── requirements.txt    # 依赖
├── examples/           # 样例数据
│   ├── sales_leads.json
│   ├── service_leads.json
│   ├── renewal_leads.json
│   ├── blacklist.json
│   ├── call_history.json
│   ├── callback_schedule.json
│   ├── timezone_rules.json
│   └── compliance_rules.json
├── data/               # 数据库（运行时生成）
│   └── call_center.db
└── reports/            # 报告输出（运行时生成）
```

---

## 数据存储

使用 SQLite 3 单文件数据库：`data/call_center.db`

主要表：
- `leads` - 线索表
- `blacklist` - 黑名单
- `call_history` - 外呼历史
- `callback_schedule` - 预约回拨
- `timezone_rules` - 时区规则
- `compliance_rules` - 合规规则
- `operation_logs` - 操作日志（审计用）
- `import_sessions` - 导入会话（幂等用）
- `check_sessions` - 检查会话

---

## 常见问题

**Q: 为什么有些线索显示暂缓？**
A: 暂缓意味着不是禁呼，只是当前时间不合适。可能原因：
- 有预约回拨但还没到时间
- 当前时间不在该地区的工作时段内
- 命中合规时间限制

**Q: 如何确认线索被正确处理了？**
A: 使用 `python cli.py detail SL-001` 查看完整的操作历史和每条规则的判断结果。

**Q: 重复导入同一个文件会怎样？**
A: 不会重复导入。系统通过文件名做幂等判断，第二次导入会提示"已导入过，跳过"。

**Q: 人工放行的线索会被再次禁呼吗？**
A: 不会。`manual_released` 状态的线索会跳过后续清洗检查，保持可拨打状态。

---

## 下一步扩展

- 接入真实外呼系统，同步通话结果
- 增加黑名单批量导入（从 CRM 系统）
- 增加更多合规规则（节假日、夜间、特定号段）
- 增加 Web 界面可视化报告
- 增加任务调度，定时自动清洗
